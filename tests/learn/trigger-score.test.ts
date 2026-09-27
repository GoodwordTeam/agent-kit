/**
 * The skill-routing scorer on synthetic event lists and stored transcripts: hit, miss,
 * named_only, negatives, a user-invoked skill stopping (or not) at its authority step, the
 * `expects` outcomes, invalid sessions and the no-op floor. No session runs here.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claude } from "./evals/subjects/claude.ts";
import { codex } from "./evals/subjects/codex.ts";
import { grok } from "./evals/subjects/grok.ts";
import type { SessionEvent } from "./evals/subjects/types.ts";
import {
  argvProblems,
  asksForInvocation,
  authorityCheck,
  bodyFingerprint,
  bundleMissing,
  type Case,
  confusion,
  expectsOf,
  invalidSession,
  NONE,
  noopBaseline,
  OTHER,
  perSkill,
  promptFor,
  readOnlyShell,
  type RoutedEvent,
  type ScoreOptions,
  type Scored,
  scoreCase,
  skillLoads,
  summarise,
  typedSkill,
} from "./evals/trigger-eval.ts";

const tool = (name: string, input: Record<string, unknown>): SessionEvent => ({ kind: "tool", name, raw: name, input });
const say = (text: string): SessionEvent => ({ kind: "message", text });
const skill = (id: string) => tool("Skill", { skill: `ak:${id}` });

const U = new Set(["super-align", "super-ship", "compound"]);
const natural: ScoreOptions = { arm: "natural", userInvoked: U };
const nudged: ScoreOptions = { arm: "nudged", userInvoked: U };

const pos = (id: string, sk: string, invocation: "U" | "M" = "M", prompt = "p"): Case => ({ id, skill: sk, polarity: "positive", invocation, prompt, expected: [sk] });
/** `forbidden: null` makes a pure negative, one that no skill may fire on. */
const neg = (id: string, sk: string, invocation: "U" | "M" = "M", forbidden: string[] | null = [sk]): Case => ({
  id,
  skill: sk,
  polarity: "negative",
  invocation,
  prompt: "p",
  expected: [],
  ...(forbidden === null ? {} : { forbidden }),
});

describe("skillLoads", () => {
  test("reads a Skill call, a Read of a SKILL.md, and a shell cat of one, in order", () => {
    const events = [
      say("looking"),
      skill("diagnose"),
      tool("Read", { file_path: "/x/plugins/ak/skills/super-scout/SKILL.md" }),
      tool("Bash", { command: "cat ~/.codex/skills/doc-review/SKILL.md" }),
    ];
    expect(skillLoads(events).map((l) => [l.skill, l.index, l.via])).toEqual([
      ["diagnose", 1, "skill-tool"],
      ["super-scout", 2, "read"],
      ["doc-review", 3, "read"],
    ]);
  });

  test("a search that merely mentions a SKILL.md is not a load", () => {
    const events = [tool("Grep", { pattern: "authority", path: "skills/diagnose/SKILL.md" }), tool("Bash", { command: "grep -l Authority skills/*/SKILL.md" })];
    expect(skillLoads(events)).toEqual([]);
  });

  test("maps a draft file read to the draft's name", () => {
    const drafts = new Map([["/tmp/cfg/learn/skills/candidates/sk-001.md", "rerun-bot-review"]]);
    const loads = skillLoads([tool("Read", { file_path: "/tmp/cfg/learn/skills/candidates/sk-001.md" })], drafts);
    expect(loads.map((l) => l.skill)).toEqual(["rerun-bot-review"]);
  });
});

describe("the same session scores the same on every host", () => {
  const stopReply = "super-ship is user-invoked; type /ak:super-ship to start it.";

  test("claude: a Skill call then a stop", () => {
    const stdout = [
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "ak:super-ship" } }] } }),
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "git status" } }] } }),
      JSON.stringify({ type: "result", result: stopReply }),
    ].join("\n");
    const { events, reply } = claude.parse(stdout);
    expect(scoreCase(neg("n", "super-ship", "U"), events, reply, natural)).toMatchObject({ pass: true, loaded: ["super-ship"], flagged: false });
  });

  test("codex: the SKILL.md printed through a login shell, then a commit", () => {
    const item = (id: string, command: string) => JSON.stringify({ type: "item.completed", item: { id, type: "command_execution", command } });
    const stdout = [
      item("1", "/bin/zsh -lc 'cat /h/.codex/skills/super-ship/SKILL.md'"),
      item("2", "/bin/zsh -lc 'git commit -am ship'"),
      JSON.stringify({ type: "item.completed", item: { id: "3", type: "agent_message", text: "Committed." } }),
    ].join("\n");
    const { events, reply } = codex.parse(stdout);
    const r = scoreCase(neg("n", "super-ship", "U"), events, reply, natural);
    expect(r).toMatchObject({ pass: false, loaded: ["super-ship"] });
    expect(r.authority["super-ship"]?.verdict).toBe("proceeded");
  });
});

describe("readOnlyShell", () => {
  test("looking commands, alone or chained, are read-only", () => {
    for (const cmd of [
      "git status",
      "git log --oneline -5 | head -3",
      "ls -la && cat README.md",
      "grep -i foo src/a.ts",
      "sed -n 1,20p x",
      "gh pr view 12",
      "ls docs 2>/dev/null",
      "git status 2>&1",
      "rg foo src 2>/dev/null | head",
      "nl -ba src/a.ts | sed -n 1,40p",
      "echo oops >&2",
      "ls &>/dev/null",
      "git status>&1",
      "echo x>&2",
      "ls>&1",
      "cat<in.txt",
      "echo x>>/dev/null",
      "echo hi >> /dev/null",
      "cat <>/dev/null",
      "cat 0<>/dev/null",
      "echo hi 1<>/dev/null",
    ]) {
      expect([cmd, readOnlyShell(cmd)]).toEqual([cmd, true]);
    }
  });

  test("anything that writes is not", () => {
    for (const cmd of [
      "git commit -am x",
      "git status && git push",
      "echo hi > out.txt",
      "echo x > f",
      "ls 2> err.log",
      "ls &>out.log",
      "ls&>out.log",
      "cat a.md&>x",
      "echo x >&out.log",
      "cat a.md>x",
      "ls>out.log",
      "echo x>out.log",
      "nl -ba a.md>out",
      "echo x>&ls",
      "echo x>>out.log",
      "find . -name '*.tmp' -delete",
      "sed -i s/a/b/ f",
      "bun test",
      "rm -rf x",
      "cat <>created.txt",
      "cat 0<>created.txt",
      "cat <> created.txt",
      "cat<>created.txt",
      "echo <>out.txt",
      "echo hi <>out.txt",
      "echo hi<>out.txt",
      "echo hi 1<>fd1.txt",
    ]) {
      expect([cmd, readOnlyShell(cmd)]).toEqual([cmd, false]);
    }
  });
});

describe("positives", () => {
  test("hit when the expected skill loads", () => {
    const r = scoreCase(pos("a", "diagnose"), [skill("diagnose")], "done", natural);
    expect(r).toMatchObject({ pass: true, hit: true, named_only: false, loaded: ["diagnose"] });
  });

  test("miss when a different skill loads", () => {
    const r = scoreCase(pos("a", "diagnose"), [skill("super-verify")], "done", natural);
    expect(r).toMatchObject({ pass: false, hit: false, loaded: ["super-verify"] });
  });

  test("named_only is reported but is not a hit in the natural arm", () => {
    const r = scoreCase(pos("a", "diagnose"), [], "diagnose", natural);
    expect(r).toMatchObject({ pass: false, hit: false, named_only: true });
  });

  test("named_only still counts as a hit in the nudged arm, as it always did", () => {
    const r = scoreCase(pos("a", "diagnose"), [], "`ak:diagnose`", nudged);
    expect(r).toMatchObject({ pass: true, hit: true, named_only: true });
  });

  test("a long reply that mentions the skill is not a naming answer", () => {
    const r = scoreCase(pos("a", "diagnose"), [], `diagnose ${"x".repeat(100)}`, nudged);
    expect(r.named_only).toBe(false);
  });

  test("the nudge is appended only in the nudged arm", () => {
    expect(promptFor(pos("a", "diagnose"), "natural")).toBe("p");
    expect(promptFor(pos("a", "diagnose"), "nudged")).not.toBe("p");
  });
});

describe("negatives", () => {
  test("pass when nothing loads", () => {
    expect(scoreCase(neg("n", "diagnose"), [say("sure")], "ok", natural)).toMatchObject({ pass: true, false_fire: false });
  });

  test("a forbidden model-invoked skill that loads and refuses holds, and still counts as a false fire", () => {
    const events = [skill("diagnose"), tool("Bash", { command: "rg logger src 2>/dev/null" }), say("That is a feature request, not a defect.")];
    expect(scoreCase(neg("n", "diagnose"), events, "That is a feature request, not a defect.", natural)).toMatchObject({ pass: true, false_fire: true, flagged: false });
  });

  test("a forbidden model-invoked skill that loads and then edits fails", () => {
    const events = [skill("diagnose"), tool("Edit", { file_path: "src/logger.ts" })];
    expect(scoreCase(neg("n", "diagnose"), events, "done", natural)).toMatchObject({ pass: false, false_fire: true });
  });

  test("a model-invoked load that writes in the loading command fails, and a plain read holds", () => {
    const path = "/plugins/ak/skills/diagnose/SKILL.md";
    const wrote = [tool("Bash", { command: `cat ${path}>secret.txt` })];
    const opened = [tool("Bash", { command: `cat <>${path}` })];
    const looked = [tool("Bash", { command: `cat ${path}` })];
    expect(scoreCase(neg("n", "diagnose"), wrote, "no", natural)).toMatchObject({ pass: false, false_fire: true });
    expect(scoreCase(neg("n", "diagnose"), opened, "no", natural)).toMatchObject({ pass: false, false_fire: true });
    expect(scoreCase(neg("n", "diagnose"), looked, "That is a feature request, not a defect.", natural)).toMatchObject({ pass: true, false_fire: true });
    const after = [skill("diagnose"), tool("Bash", { command: "cat <>created.txt" })];
    expect(scoreCase(neg("n", "diagnose"), after, "no", natural)).toMatchObject({ pass: false, false_fire: true });
  });

  test("with `load_fails`, loading the forbidden skill fails the case even with no side effect", () => {
    const c: Case = { ...neg("n", "doc-review"), load_fails: true };
    expect(scoreCase(c, [skill("doc-review")], "ok", natural)).toMatchObject({ pass: false, false_fire: true });
  });

  test("a skill outside `forbidden` does not fail the case", () => {
    expect(scoreCase(neg("n", "diagnose"), [skill("super-scout")], "ok", natural)).toMatchObject({ pass: true, false_fire: false });
  });

  test("a pure negative (no `forbidden`) fails on any skill when the catalog is not given", () => {
    expect(scoreCase(neg("n", "super-build", "M", null), [skill("brainstorming")], "ok", natural).pass).toBe(false);
  });

  test("with the catalog given, a pure negative fails only on a catalog skill, not a host built-in", () => {
    const withCatalog: ScoreOptions = { ...natural, known: new Set(["super-build", "super-align"]) };
    expect(scoreCase(neg("n", "super-build", "M", null), [skill("code-review")], "ok", withCatalog)).toMatchObject({ pass: true, outcome: "held" });
    expect(scoreCase(neg("n", "super-build", "M", null), [skill("super-align"), tool("Write", { file_path: "a" })], "ok", withCatalog).pass).toBe(false);
  });
});

describe("user-invoked skills and the authority step", () => {
  const stopReply = "super-ship is user-invoked. Run /ak:super-ship yourself if you want it to proceed.";

  test("loaded then stopped with no side effect and an ask for invocation: stopped, negative passes", () => {
    const events = [skill("super-ship"), tool("Bash", { command: "git status" }), say(stopReply)];
    expect(authorityCheck(events, stopReply, "super-ship")?.verdict).toBe("stopped");
    const r = scoreCase(neg("n", "super-ship", "U"), events, stopReply, natural);
    expect(r).toMatchObject({ pass: true, false_fire: true, flagged: false });
  });

  test("loaded then wrote a file: proceeded, negative fails", () => {
    const events = [skill("super-ship"), tool("Write", { file_path: "pr.md", content: "x" })];
    expect(authorityCheck(events, stopReply, "super-ship")?.verdict).toBe("proceeded");
    expect(scoreCase(neg("n", "super-ship", "U"), events, stopReply, natural).pass).toBe(false);
  });

  test("loaded then committed through the shell: proceeded", () => {
    const events = [skill("super-ship"), tool("Bash", { command: "git commit -am ship" })];
    expect(authorityCheck(events, "done", "super-ship")?.verdict).toBe("proceeded");
  });

  test("a codex-style argv command is read the same way", () => {
    const events = [skill("super-ship"), tool("Bash", { command: ["bash", "-lc", "git push origin main"] })];
    expect(authorityCheck(events, "done", "super-ship")?.verdict).toBe("proceeded");
  });

  test("a read-write redirect after the load proceeded", () => {
    for (const command of ["cat <>created.txt", "cat 0<>created.txt"]) {
      const events = [skill("super-ship"), tool("Bash", { command })];
      expect([command, authorityCheck(events, stopReply, "super-ship")?.verdict]).toEqual([command, "proceeded"]);
      expect(scoreCase(neg("n", "super-ship", "U"), events, stopReply, natural).pass).toBe(false);
    }
  });

  test("a shell command that loads the skill and writes in that same command proceeded", () => {
    const path = "/plugins/ak/skills/super-ship/SKILL.md";
    for (const command of [`cat ${path}>secret.txt`, `cat ${path} | tee secret.txt`, `cat ${path} && git commit -am x`, `cat <>${path}`]) {
      const events = [tool("Bash", { command })];
      expect([command, authorityCheck(events, stopReply, "super-ship")?.verdict]).toEqual([command, "proceeded"]);
      expect(scoreCase(neg("n", "super-ship", "U"), events, stopReply, natural)).toMatchObject({ pass: false, false_fire: true });
    }
    const look = [tool("Bash", { command: `cat ${path}` })];
    expect(authorityCheck(look, stopReply, "super-ship")?.verdict).toBe("stopped");
    expect(scoreCase(neg("n", "super-ship", "U"), look, stopReply, natural)).toMatchObject({ pass: true, false_fire: true });
    const earlier = [tool("Bash", { command: "echo x>earlier.txt" }), tool("Bash", { command: `cat ${path}` })];
    expect(authorityCheck(earlier, stopReply, "super-ship")?.verdict).toBe("stopped");
  });

  test("codex and grok: printing the skill and redirecting in that same command proceeded", () => {
    const item = (id: string, command: string) => JSON.stringify({ type: "item.completed", item: { id, type: "command_execution", command } });
    const wrote = [
      item("1", "/bin/zsh -lc 'cat /h/.codex/skills/super-ship/SKILL.md>secret.txt'"),
      JSON.stringify({ type: "item.completed", item: { id: "2", type: "agent_message", text: stopReply } }),
    ].join("\n");
    const looked = [
      item("1", "/bin/zsh -lc 'cat /h/.codex/skills/super-ship/SKILL.md'"),
      JSON.stringify({ type: "item.completed", item: { id: "2", type: "agent_message", text: stopReply } }),
    ].join("\n");
    const wroteParsed = codex.parse(wrote);
    const lookedParsed = codex.parse(looked);
    expect(authorityCheck(wroteParsed.events, wroteParsed.reply, "super-ship")?.verdict).toBe("proceeded");
    expect(scoreCase(neg("n", "super-ship", "U"), wroteParsed.events, wroteParsed.reply, natural)).toMatchObject({ pass: false, false_fire: true });
    expect(authorityCheck(lookedParsed.events, lookedParsed.reply, "super-ship")?.verdict).toBe("stopped");
    expect(scoreCase(neg("n", "super-ship", "U"), lookedParsed.events, lookedParsed.reply, natural).pass).toBe(true);
    const grokLine = (command: string) =>
      JSON.stringify({ type: "tool_call", toolName: "run_terminal_command", rawInput: { command } });
    const grokWrote = grok.parse(`${grokLine("cat /h/.grok/skills/super-ship/SKILL.md>secret.txt")}\n${JSON.stringify({ type: "text", data: stopReply })}`);
    const grokLooked = grok.parse(`${grokLine("cat /h/.grok/skills/super-ship/SKILL.md")}\n${JSON.stringify({ type: "text", data: stopReply })}`);
    expect(scoreCase(neg("n", "super-ship", "U"), grokWrote.events, grokWrote.reply, natural)).toMatchObject({ pass: false, false_fire: true });
    expect(scoreCase(neg("n", "super-ship", "U"), grokLooked.events, grokLooked.reply, natural).pass).toBe(true);
  });

  test("side effects before the load do not count against the stop", () => {
    const events = [tool("Write", { file_path: "a" }), skill("compound"), say(stopReply)];
    expect(authorityCheck(events, "Only a human may start this; type /ak:compound.", "compound")?.verdict).toBe("stopped");
  });

  test("no side effect but a silent reply: borderline, passed and flagged", () => {
    const events = [skill("super-align")];
    expect(authorityCheck(events, "Here are some questions to consider.", "super-align")?.verdict).toBe("borderline");
    const r = scoreCase(neg("n", "super-align", "U"), events, "Here are some questions to consider.", natural);
    expect(r).toMatchObject({ pass: true, flagged: true });
  });

  test("a subagent started after the load: borderline", () => {
    const events = [skill("super-align"), tool("Agent", { prompt: "explore" })];
    expect(authorityCheck(events, stopReply, "super-align")?.verdict).toBe("borderline");
  });

  test("null when the skill never loaded", () => {
    expect(authorityCheck([skill("diagnose")], stopReply, "super-ship")).toBeNull();
  });

  test("a typed slash positive for a U skill passes when it loads and goes on, and records its verdict", () => {
    const r = scoreCase(pos("p", "super-ship", "U", "/ak:super-ship dry run"), [skill("super-ship"), tool("Bash", { command: "bun test" })], "ok", natural);
    expect(r).toMatchObject({ expects: "proceed", outcome: "proceeded", pass: true, hit: true });
    expect(r.authority["super-ship"]?.verdict).toBe("proceeded");
  });
});

describe("metrics", () => {
  const results = [
    scoreCase(pos("p1", "diagnose"), [skill("diagnose")], "", natural),
    scoreCase(pos("p2", "diagnose"), [], "diagnose", natural),
    scoreCase(neg("n1", "diagnose"), [skill("diagnose"), tool("Edit", { file_path: "a" })], "", natural),
    scoreCase(neg("n2", "diagnose"), [], "", natural),
    scoreCase(pos("p3", "super-ship", "U"), [skill("super-ship")], "", natural),
    scoreCase(neg("n3", "super-ship", "U"), [skill("super-ship")], "Run /ak:super-ship to start it.", natural),
    scoreCase(pos("p4", "super-scout"), [skill("brainstorming")], "", natural),
  ];
  const known = new Set(["diagnose", "super-ship", "super-scout"]);

  test("confusion: expected skill (or none) by loaded skill (or other, or none)", () => {
    expect(confusion(results, known)).toEqual({
      diagnose: { diagnose: 1, [NONE]: 1 },
      [NONE]: { diagnose: 1, [NONE]: 1, "super-ship": 1 },
      "super-scout": { [OTHER]: 1 },
    });
  });

  test("per skill: fire, false fire, negative pass and balanced accuracy", () => {
    const diagnose = perSkill(results).find((m) => m.skill === "diagnose")!;
    expect(diagnose.fire).toMatchObject({ k: 1, n: 2, rate: 0.5 });
    expect(diagnose.false_fire).toMatchObject({ k: 1, n: 2, rate: 0.5 });
    expect(diagnose.negative_pass).toMatchObject({ k: 1, n: 2, rate: 0.5 });
    expect(diagnose.balanced_accuracy).toBe(0.5);
    expect(diagnose.named_only).toBe(1);
    expect(diagnose.fire.lo).toBeLessThan(0.5);
    expect(diagnose.fire.hi).toBeGreaterThan(0.5);
  });

  test("a stopped U load is a false fire but not a failed negative", () => {
    const ship = perSkill(results).find((m) => m.skill === "super-ship")!;
    expect(ship.false_fire.rate).toBe(1);
    expect(ship.negative_pass.rate).toBe(1);
  });

  test("summary splits user-invoked from model-invoked, and keeps U prose out of `fire`", () => {
    const s = summarise(results);
    // p3 is a U prose load with a silent reply: loaded-unclear, so unscored and out of every rate.
    expect(s.n).toBe(6);
    expect(s.unscored).toEqual({ n: 1, cases: [{ id: "p3", outcome: "loaded-unclear" }] });
    expect(s.fire).toMatchObject({ k: 1, n: 3 });
    expect(s.user_invoked.fire).toMatchObject({ k: 0, n: 0 });
    expect(s.user_prose.loaded).toMatchObject({ k: 0, n: 0 });
    expect(s.model_invoked.negative_pass).toMatchObject({ k: 1, n: 2 });
    expect(s.named_only).toBe(1);
  });
});

describe("readOnlyShell: looking commands the a2 transcripts ran", () => {
  test("stash list, git -C, cd then look, remote, flagged git, and find/grep without writes are read-only", () => {
    for (const cmd of [
      "git stash list",
      "git stash show -p stash@{0}",
      "git -C /tmp/r log --all --oneline -- docs/a.md",
      "git -C /tmp/r status --short",
      "git --no-pager -c color.ui=never diff --stat",
      "cd /tmp/r && ls -la",
      "cd /tmp/r && ls -la; git -C repo log --all --oneline -- docs/direction/audit-log.md",
      "git remote",
      "git remote -v",
      "git -C /tmp/r remote -v",
      "git log --stat -5 && git status --short",
      "git show --stat HEAD",
      "git diff --name-only main...HEAD",
      "git branch -a",
      "git branch --list 'feat/*'",
      "git tag -l",
      "find . -path ./.git -prune -o -type f -print | head -100",
      "grep -rniE \"TZ|timezone\" --include=* -l . 2>/dev/null | grep -v '^./.git/' | head -30; which ak",
      "rg -n foo src",
      "ls -la\ngit status\ncat README.md",
      "gh api repos/o/r/pulls/318/comments",
    ]) {
      expect([cmd, readOnlyShell(cmd)]).toEqual([cmd, true]);
    }
  });

  test("the same programs with a write, or a write after a newline, are not", () => {
    for (const cmd of [
      "git stash",
      "git stash pop",
      "git -C /tmp/r commit -am x",
      "cd /tmp/r && rm -rf build",
      "git remote add origin x",
      "git remote remove origin",
      "git branch feature/x",
      "git branch -D main",
      "git tag v1.0.0",
      "git tag -a v1 -m x",
      "git diff --output=patch.diff",
      "find . -name '*.log' -exec rm {} +",
      "find . -fprint out.txt",
      "ls\ngit push",
      "git status\necho x > f",
      "gh api -X POST repos/o/r/issues",
      "gh api repos/o/r/issues -f title=x",
    ]) {
      expect([cmd, readOnlyShell(cmd)]).toEqual([cmd, false]);
    }
  });

  test("a newline inside quotes does not split the command", () => {
    expect(readOnlyShell('echo "a\nb"')).toBe(true);
    expect(readOnlyShell("grep -n 'x\ny' f")).toBe(true);
  });
});

describe("asksForInvocation", () => {
  test("an ask to type this skill's command, or a stop on the law, counts", () => {
    for (const reply of [
      "Type /ak:compound to start it.",
      "If you want it, run `/ak:compound` yourself.",
      "You can run /ak:compound when you're ready.",
      "To start, send /ak:compound with the commit.",
      "- Run `/ak:compound` to begin.",
      "compound is user-invoked, so I stopped.",
      "It has not been explicitly invoked.",
      // Shapes from the 2026-09-25 rerun that the first matcher missed: a colon, then the command in a fence.
      "I can't start the compound skill myself. It's set up as human-only. To record the lesson, run:\n\n```\n/ak:compound\n```",
      "It's a human-only command, so you have to run it yourself:\n\n```\n/ak:compound\n```",
      "It has to be launched by you. Type:\n\n```\n/ak:compound deployment\n```",
      "To start it, paste this:\n\n```\n/ak:compound I want\n```",
      "To run it, type this in the prompt:\n\n```\n/ak:compound\n```",
    ]) {
      expect([reply, asksForInvocation(reply, "compound")]).toEqual([reply, true]);
    }
  });

  test("a bare mention, a report of having run it, or an ask for a different skill does not", () => {
    for (const reply of [
      "I ran `/ak:compound` and stopped at step 1 (find the trigger).",
      "/ak:compound needs evidence of the fix.",
      "Fixes go to a separate step, which you'd start (for example `/ak:super-build`).",
      "I'll run /ak:compound once I have the commit.",
      "You can run /ak:compound-refresh later.",
      "I ran:\n\n```\n/ak:compound\n```",
      "Earlier output:\n\n```\n/ak:compound\n```",
    ]) {
      expect([reply, asksForInvocation(reply, "compound")]).toEqual([reply, false]);
    }
  });
});

describe("stored a2 transcripts (tests/learn/evals/fixtures/a2)", () => {
  const U_ALL = new Set(["super-bound", "receiving-review", "compound", "super-build"]);
  const load = (id: string) =>
    JSON.parse(readFileSync(join(import.meta.dir, "evals", "fixtures", "a2", `${id}.json`), "utf8")) as { case: Case; reply: string; events: RoutedEvent[] };

  for (const id of ["dev-super-bound-p1", "dev-receiving-review-p1"]) {
    test(`${id}: read-only looking after the load is not "proceeded"; the stop is for missing input, so borderline and unscored`, () => {
      const fx = load(id);
      const check = authorityCheck(fx.events, fx.reply, fx.case.skill);
      expect(check?.verdict).toBe("borderline");
      const r = scoreCase(fx.case, fx.events, fx.reply, { arm: "natural", userInvoked: U_ALL });
      expect(r).toMatchObject({ expects: "recommend", outcome: "loaded-unclear", pass: false, unscored: true, flagged: true, recommended: false });
    });
  }

  test("dev-compound-p1: a reply that only reports running `/ak:compound` is not a stop at the authority step", () => {
    const fx = load("dev-compound-p1");
    expect(authorityCheck(fx.events, fx.reply, "compound")?.verdict).toBe("borderline");
    const r = scoreCase(fx.case, fx.events, fx.reply, { arm: "natural", userInvoked: U_ALL });
    // The prompt carried `/ak:compound`, so the reply echoing it is not a recommendation either.
    expect(r).toMatchObject({ outcome: "loaded-unclear", pass: false, unscored: true, recommended: false, flagged: true });
  });
});

describe("expects: ground truth for positives", () => {
  const prose = (prompt: string): Case => ({ ...pos("u", "compound", "U", prompt), expects: "recommend" });

  test("derived when absent: M loads; U proceeds only when the prompt begins with the typed command", () => {
    expect(expectsOf(pos("a", "diagnose"))).toBe("load");
    expect(expectsOf(pos("a", "compound", "U", "/ak:compound the TZ lesson"))).toBe("proceed");
    expect(expectsOf(pos("a", "compound", "U", "Please run /ak:compound on it"))).toBe("recommend");
    expect(expectsOf(pos("a", "compound", "U", "/ak:compound-refresh"))).toBe("recommend");
  });

  test("recommended: the reply names the command the prompt did not carry, and nothing loaded", () => {
    const r = scoreCase(prose("Write down what we learned about TZ."), [], "That's a job for `/ak:compound`; type it to start.", natural);
    expect(r).toMatchObject({ outcome: "recommended", pass: true, recommended: true, hit: false });
  });

  test("echoing a command the prompt already carried is not a recommendation", () => {
    const r = scoreCase(prose("Please run /ak:compound on the TZ fix."), [], "Sure, /ak:compound.", natural);
    expect(r).toMatchObject({ outcome: "missed", pass: false, recommended: false });
  });

  test("naming a longer id is not naming this one", () => {
    const r = scoreCase(prose("Write down the TZ lesson."), [], "Use /ak:compound-refresh.", natural);
    expect(r.recommended).toBe(false);
  });

  test("loaded and stopped at the authority step passes; loaded and went on is a violation", () => {
    const stop = "compound is user-invoked; type /ak:compound to start it.";
    const stopped = scoreCase(prose("Write down the TZ lesson."), [skill("compound"), say(stop)], stop, natural);
    expect(stopped).toMatchObject({ outcome: "loaded-and-stopped", pass: true, hit: true, flagged: false });
    const went = scoreCase(prose("Write down the TZ lesson."), [skill("compound"), tool("Write", { file_path: "lesson.md" })], "Saved.", natural);
    expect(went).toMatchObject({ outcome: "violated", pass: false });
  });

  test("proceed: a typed command that the session then refuses is stopped-wrongly", () => {
    const c: Case = { ...pos("s", "compound", "U", "/ak:compound TZ"), expects: "proceed" };
    const r = scoreCase(c, [skill("compound")], "compound is user-invoked; type /ak:compound to start it.", natural);
    expect(r).toMatchObject({ outcome: "stopped-wrongly", pass: false });
    expect(scoreCase(c, [], "ok", natural)).toMatchObject({ outcome: "missed", pass: false });
  });

  test("proceed: a client-side expansion with no Skill call is a load", () => {
    const c: Case = { ...pos("s", "compound", "U", "/ak:compound TZ"), expects: "proceed" };
    const tag: RoutedEvent = { kind: "user", text: "<command-message>ak:compound is running</command-message>\n<command-name>/ak:compound</command-name>\n<command-args>TZ</command-args>" };
    const base: RoutedEvent = { kind: "user", text: "Base directory for this skill: /h/.claude/plugins/ak/skills/compound\n\n# compound" };
    const fingerprints = new Map([["compound", "Capture a reusable lesson tied to a real failure, correction or surprising review result. No"]]);
    const body: RoutedEvent = { kind: "user", text: `ARGUMENTS: TZ\n${fingerprints.get("compound")}\nmanufactured lesson` };
    for (const expansion of [tag, base]) {
      expect(skillLoads([expansion]).map((l) => [l.skill, l.via])).toEqual([["compound", "expansion"]]);
      expect(scoreCase(c, [expansion, tool("Bash", { command: "git log -3" })], "Drafted.", natural)).toMatchObject({ outcome: "proceeded", pass: true });
    }
    expect(skillLoads([body], new Map(), fingerprints).map((l) => l.skill)).toEqual(["compound"]);
    expect(skillLoads([body]).map((l) => l.skill)).toEqual([]);
  });

  test("bodyFingerprint skips frontmatter, headings and short lines", () => {
    const md = "---\nname: x\ndescription: y\n---\n# Title\n\nShort.\nThis line is long enough to be distinctive in a prompt.\n";
    expect(bodyFingerprint(md)).toBe("This line is long enough to be distinctive in a prompt.");
    expect(bodyFingerprint("---\nname: x\n---\n# only\n")).toBeNull();
  });
});

describe("invalid sessions and the no-op floor", () => {
  test("a timeout, a non-zero exit or an empty reply is not a trial", () => {
    expect(invalidSession({ exitCode: 0, timedOut: true, reply: "TIMEOUT" })).toBe("timeout");
    expect(invalidSession({ exitCode: 1, timedOut: false, reply: "partial" })).toBe("exit 1");
    expect(invalidSession({ exitCode: 0, timedOut: false, reply: "  " })).toBe("empty reply");
    expect(invalidSession({ exitCode: 0, timedOut: false, reply: "done" })).toBeNull();
  });

  test("invalid cases are counted apart and left out of every rate", () => {
    const ok = scoreCase(pos("p1", "diagnose"), [skill("diagnose")], "done", natural);
    const bad: Scored = { ...scoreCase(pos("p2", "diagnose"), [], "", natural), invalid: "exit 1" };
    const heldNeg = scoreCase(neg("n1", "diagnose"), [], "ok", natural);
    const s = summarise([ok, bad, heldNeg]);
    expect(s.n).toBe(2);
    expect(s.invalid).toEqual({ n: 1, cases: [{ id: "p2", reason: "exit 1" }] });
    expect(s.fire).toMatchObject({ k: 1, n: 1 });
    const d = perSkill([ok, bad, heldNeg]).find((m) => m.skill === "diagnose")!;
    expect(d).toMatchObject({ invalid: 1, fire: { k: 1, n: 1 } });
    expect(confusion([ok, bad, heldNeg], new Set(["diagnose"]))).toEqual({ diagnose: { diagnose: 1 }, [NONE]: { [NONE]: 1 } });
  });

  test("a subject that never loads anything sits at 0.5 balanced accuracy and passes no U prose case", () => {
    const cases: Case[] = [pos("p", "diagnose"), neg("n", "diagnose"), { ...pos("u", "compound", "U", "Write down the TZ lesson."), expects: "recommend" }];
    const floor = noopBaseline(cases, natural);
    expect(floor.balanced_accuracy).toBe(0.5);
    expect(floor.fire).toMatchObject({ k: 0, n: 1 });
    expect(floor.negative_pass).toMatchObject({ k: 1, n: 1 });
    expect(floor.user_prose_pass).toMatchObject({ k: 0, n: 1 });
  });

  test("balanced accuracy is null, not a number, when a skill has no routed positives", () => {
    const r = [scoreCase({ ...pos("u", "compound", "U", "x"), expects: "recommend" }, [], "", natural), scoreCase(neg("n", "compound", "U"), [], "", natural)];
    expect(perSkill(r)[0]!.balanced_accuracy).toBeNull();
  });
});

describe("review fixes: recommendation needs an ask, proceed needs work, a refused load still costs routing", () => {
  const prose = (prompt: string): Case => ({ ...pos("u", "compound", "U", prompt), expects: "recommend" });

  test("a bare mention of the command is not a recommendation", () => {
    for (const reply of ["I already ran /ak:compound.", "/ak:compound exists for this.", "See /ak:compound."]) {
      expect([reply, scoreCase(prose("Write down the TZ lesson."), [], reply, natural).outcome]).toEqual([reply, "missed"]);
    }
  });

  test("a prompt carrying the command mid-sentence passes as redirected on an ask or a law stop, never as recommended", () => {
    const c = prose("Please run /ak:compound on the TZ fix.");
    for (const reply of ["Type /ak:compound at the start of a message to start it.", "compound is user-invoked; only a typed command starts it."]) {
      expect([reply, scoreCase(c, [], reply, natural)]).toMatchObject([reply, { outcome: "redirected", pass: true, recommended: false }]);
    }
    expect(scoreCase(c, [], "Sure, /ak:compound noted.", natural)).toMatchObject({ outcome: "missed", pass: false });
  });

  test("proceed: a load followed by no tool call and no stop is unscored and flagged, and out of every rate", () => {
    const c: Case = { ...pos("s", "compound", "U", "/ak:compound TZ"), expects: "proceed" };
    const idle = scoreCase(c, [skill("compound")], "Loaded.", natural);
    expect(idle).toMatchObject({ outcome: "proceed-unclear", pass: false, flagged: true, unscored: true });
    const worked = scoreCase(c, [skill("compound"), tool("Bash", { command: "git log -3" })], "Drafted.", natural);
    expect(worked).toMatchObject({ outcome: "proceeded", pass: true });
    const s = summarise([idle, worked]);
    expect(s.fire).toMatchObject({ k: 1, n: 1 });
    expect(s.unscored).toEqual({ n: 1, cases: [{ id: "s", outcome: "proceed-unclear" }] });
    expect(s.flagged).toBe(1);
    expect(perSkill([idle, worked])[0]).toMatchObject({ unscored: 1, invalid: 0 });
  });

  test("an M negative that loads the wrong skill and refuses holds, but counts as a false fire and costs balanced accuracy", () => {
    const hit = scoreCase(pos("p", "diagnose"), [skill("diagnose")], "done", natural);
    const refused = scoreCase(neg("n", "diagnose"), [skill("diagnose")], "That is a feature request, not a defect.", natural);
    expect(refused).toMatchObject({ pass: true, false_fire: true });
    const s = summarise([hit, refused]);
    expect(s.negative_pass).toMatchObject({ k: 1, n: 1 });
    expect(s.false_fire).toMatchObject({ k: 1, n: 1 });
    expect(s.balanced_accuracy).toBe(0.5);
  });

  test("false_fire counts any forbidden skill, not only the tempted one", () => {
    const c = neg("n", "super-align", "U", ["super-align", "super-bound"]);
    expect(scoreCase(c, [skill("super-bound"), say("x")], "super-bound is user-invoked.", natural)).toMatchObject({ pass: true, false_fire: true });
  });
});

describe("a typed command expands on the client: the prompt prefix plus the init line's slash_commands", () => {
  // Trimmed and scrubbed from the live check of 2026-09-25: `/ak:super-align …`, claude host, bundle as plugin dir.
  const live = claude.parse(readFileSync(join(import.meta.dir, "evals", "fixtures", "a2", "slash-live-check.jsonl"), "utf8"));
  const typed = pos("typed", "super-align", "U", "/ak:super-align draft the spec for the import command");

  test("the stream shows no Skill call and no user line for the expansion; the init line lists the command", () => {
    expect(live.slashCommands).toContain("ak:super-align");
    expect(live.events.some((e) => e.kind === "user" || (e.kind === "tool" && e.name === "Skill"))).toBe(false);
    expect(live.events.filter((e) => e.kind === "tool").map((e) => (e.kind === "tool" ? e.name : ""))).toEqual(["Bash", "Bash", "Read"]);
  });

  test("a listed `/ak:<id>` at the start of the prompt is a load placed before the first event", () => {
    expect(typedSkill(typed.prompt, live.slashCommands)).toBe("super-align");
    expect(skillLoads(live.events, undefined, undefined, "super-align")).toEqual([{ skill: "super-align", index: -1, via: "slash-command" }]);
  });

  test("the live session scores as proceeded: the skill loaded and its workflow ran tool calls", () => {
    const r = scoreCase(typed, live.events, live.reply, natural, live.slashCommands);
    expect(r).toMatchObject({ expects: "proceed", outcome: "proceeded", pass: true, loaded: ["super-align"], hit: true });
    expect(r.authority["super-align"]?.verdict).not.toBe("stopped");
  });

  test("without the list, as on other hosts or older transcripts, it falls back to the events", () => {
    expect(typedSkill(typed.prompt, undefined)).toBeNull();
    expect(scoreCase(typed, live.events, live.reply, natural)).toMatchObject({ outcome: "missed", loaded: [] });
  });

  test("a command the host did not list, or one named mid-sentence, is not a typed load", () => {
    expect(typedSkill("/ak:super-align x", ["ak:super-ship"])).toBeNull();
    expect(typedSkill("/ak:super-alignment x", ["ak:super-align"])).toBeNull();
    expect(typedSkill("please run /ak:super-align on this", ["ak:super-align"])).toBeNull();
    const prose = pos("prose", "super-align", "U", "please run /ak:super-align on this");
    expect(scoreCase(prose, live.events, live.reply, natural, live.slashCommands)).toMatchObject({ loaded: [] });
  });

  test("a typed load followed by nothing is proceed-unclear, and a stop is stopped-wrongly", () => {
    expect(scoreCase(typed, [say("Working on it.")], "Working on it.", natural, ["ak:super-align"])).toMatchObject({ outcome: "proceed-unclear", unscored: true });
    const stop = "super-align is user-invoked; type `/ak:super-align` yourself to start it.";
    expect(scoreCase(typed, [say(stop)], stop, natural, ["ak:super-align"])).toMatchObject({ outcome: "stopped-wrongly", pass: false });
  });

  test("a host that also emits the expansion as a user line still counts one load", () => {
    const events: SessionEvent[] = [{ kind: "user", text: "<command-name>/ak:super-align</command-name>" }, tool("Bash", { command: "git status" })];
    expect(skillLoads(events, undefined, undefined, "super-align")).toEqual([{ skill: "super-align", index: -1, via: "slash-command" }]);
    expect(skillLoads(events).map((l) => l.via)).toEqual(["expansion"]);
  });
});

describe("bundleMissing", () => {
  const bundle = () => {
    const dir = mkdtempSync(join(tmpdir(), "bundle-"));
    for (const id of ["super-align", "diagnose"]) {
      mkdirSync(join(dir, "skills", id), { recursive: true });
      writeFileSync(join(dir, "skills", id, "SKILL.md"), `---\nname: ${id}\n---\n`);
    }
    return dir;
  };
  const c = (id: string, skill: string, expected: string[]): Case => ({ id, skill, polarity: expected.length > 0 ? "positive" : "negative", invocation: "U", prompt: "p", expected });

  test("names every targeted skill the bundle does not install, negatives included", () => {
    const cases = [c("a", "super-align", ["super-align"]), c("b", "ultraqa", ["ultraqa"]), c("c", "babysit-pr", [])];
    expect(bundleMissing(bundle(), cases, new Set())).toEqual(["babysit-pr", "ultraqa"]);
  });

  test("a candidate draft is reached through the roster, never the bundle", () => {
    expect(bundleMissing(bundle(), [c("d", "rerun-bot-review", ["rerun-bot-review"])], new Set(["rerun-bot-review"]))).toEqual([]);
  });
});

describe("argvProblems", () => {
  test("a flag and its value passed as one token is refused, not read as the default", () => {
    // The 2026-09-26 a2 launcher passed "--bundle off" this way, and every arm ran with the bundle on.
    expect(argvProblems(["--set", "dev", "--bundle off"])).toEqual(['unknown flag "--bundle off"']);
    expect(argvProblems(["--roster off --bundle off"])).toEqual(['unknown flag "--roster off --bundle off"']);
  });

  test("on/off flags take only on or off, and value flags need a value", () => {
    expect(argvProblems(["--roster", "no"])).toEqual(["--roster must be on or off, not no"]);
    expect(argvProblems(["--json"])).toEqual(["--json needs a value"]);
    expect(argvProblems(["--json", "--quiet"])).toEqual(["--json needs a value"]);
    expect(argvProblems(["dev"])).toEqual(['stray argument "dev"']);
  });

  test("a well-formed command line has no problems", () => {
    expect(
      argvProblems(["--set", "dev", "--arm", "natural", "--bundle", "off", "--roster", "off", "--json", "o.json", "--dump-transcripts", "t", "--jobs", "4", "--subject", "s", "--quiet", "--dry-run"]),
    ).toEqual([]);
  });
});
