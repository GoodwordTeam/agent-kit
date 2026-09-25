/**
 * The skill-routing scorer on synthetic event lists: hit, miss, named_only, negatives, and a
 * user-invoked skill stopping (or not) at its authority step. No session runs here.
 */
import { describe, expect, test } from "bun:test";
import { claude } from "./evals/subjects/claude.ts";
import { codex } from "./evals/subjects/codex.ts";
import { grok } from "./evals/subjects/grok.ts";
import type { SessionEvent } from "./evals/subjects/types.ts";
import {
  authorityCheck,
  type Case,
  confusion,
  NONE,
  OTHER,
  perSkill,
  promptFor,
  readOnlyShell,
  type ScoreOptions,
  scoreCase,
  skillLoads,
  summarise,
} from "./evals/trigger-eval.ts";

const tool = (name: string, input: Record<string, unknown>): SessionEvent => ({ kind: "tool", name, raw: name, input });
const say = (text: string): SessionEvent => ({ kind: "message", text });
const skill = (id: string) => tool("Skill", { skill: `ak:${id}` });

const U = new Set(["super-align", "super-ship", "compound"]);
const natural: ScoreOptions = { arm: "natural", userInvoked: U };
const nudged: ScoreOptions = { arm: "nudged", userInvoked: U };

const pos = (id: string, sk: string, invocation: "U" | "M" = "M"): Case => ({ id, skill: sk, polarity: "positive", invocation, prompt: "p", expected: [sk] });
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

  test("a pure negative (no `forbidden`) fails on any skill", () => {
    expect(scoreCase(neg("n", "super-build", "M", null), [skill("brainstorming")], "ok", natural).pass).toBe(false);
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

  test("an explicit positive for a U skill is a hit when it loads, and records its verdict", () => {
    const r = scoreCase(pos("p", "super-ship", "U"), [skill("super-ship"), tool("Bash", { command: "bun test" })], "ok", natural);
    expect(r).toMatchObject({ pass: true, hit: true });
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
      "super-ship": { "super-ship": 1 },
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

  test("summary splits user-invoked from model-invoked", () => {
    const s = summarise(results);
    expect(s.n).toBe(7);
    expect(s.fire).toMatchObject({ k: 2, n: 4 });
    expect(s.user_invoked.fire).toMatchObject({ k: 1, n: 1 });
    expect(s.model_invoked.negative_pass).toMatchObject({ k: 1, n: 2 });
    expect(s.named_only).toBe(1);
  });
});
