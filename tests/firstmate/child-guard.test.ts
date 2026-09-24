/**
 * adapters/firstmate/hooks/child-guard.sh.
 *
 * Label: mock/contract for the decisions, pinned to the input shape observed
 * on the real host (Claude Code 2.1.281): a call made inside a subagent carries
 * `agent_id` and `agent_type`, a main-thread call carries neither. If the host
 * stops sending those fields the guard becomes a no-op, and these cases are
 * what say which shape it was built against.
 */
import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { makeDir, REPO } from "./fixture.ts";

const HOOK = join(REPO, "adapters/firstmate/hooks/child-guard.sh");

function binding(evidence: string): string {
  const dir = makeDir();
  const path = join(dir, "agent-kit-binding.json");
  writeFileSync(path, JSON.stringify({ schema: "firstmate-binding", evidence: { store: "mock", location: evidence } }));
  return path;
}

interface Decision {
  denied: boolean;
  reason: string;
  code: number;
}

function guard(bindingPath: string, input: Record<string, unknown>, cwd?: string): Decision {
  const proc = Bun.spawnSync(["bash", HOOK, "--binding", bindingPath], {
    cwd,
    stdin: new TextEncoder().encode(JSON.stringify(input)),
    env: { ...process.env, TMPDIR: "/nonexistent-tmp/" },
  });
  const out = proc.stdout.toString();
  if (out.trim() === "") return { denied: false, reason: "", code: proc.exitCode ?? -1 };
  const parsed = JSON.parse(out) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } };
  return {
    denied: parsed.hookSpecificOutput.permissionDecision === "deny",
    reason: parsed.hookSpecificOutput.permissionDecisionReason,
    code: proc.exitCode ?? -1,
  };
}

const WORKTREE = "/work/tree";
const child = (tool_name: string, tool_input: Record<string, unknown>) => ({
  session_id: "s",
  hook_event_name: "PreToolUse",
  cwd: WORKTREE,
  agent_id: "a1b2",
  agent_type: "general-purpose",
  tool_name,
  tool_input,
});
const parent = (tool_name: string, tool_input: Record<string, unknown>) => {
  const { agent_id: _a, agent_type: _t, ...rest } = child(tool_name, tool_input);
  return rest;
};

describe("child-guard", () => {
  const b = binding("/evidence/store");

  test("a child may not run ak firstmate bind, install or remove", () => {
    for (const cmd of [
      "ak firstmate bind --fm-home /h --task-id T --project /p --mode agent-kit --binding-out /tmp/b.json",
      "bun run ak firstmate install --fm-home /h",
      "bun src/cli.ts firstmate remove --fm-home /h",
      "cd /x && ak firstmate bind",
    ]) {
      const d = guard(b, child("Bash", { command: cmd }));
      expect(d.denied).toBe(true);
      expect(d.reason).toContain("supervisor-side");
    }
  });

  test("a child may not write agent-kit's binding ledger", () => {
    const ledger = "/Users/w/.agent-kit/firstmate/bindings/ak-T-1.json";
    expect(guard(b, child("Write", { file_path: ledger })).reason).toContain("binding ledger");
    expect(guard(b, child("Edit", { file_path: ledger })).reason).toContain("binding ledger");
    expect(guard(b, child("NotebookEdit", { notebook_path: "/Users/w/.agent-kit/firstmate/x.ipynb" })).reason).toContain("binding ledger");
    expect(guard(b, child("Bash", { command: `echo '{}' >${ledger}` })).reason).toContain("binding ledger");
    expect(guard(b, child("Bash", { command: "cp /tmp/r.json ~/.agent-kit/firstmate/bindings/" })).reason).toContain("binding ledger");
  });

  test("a main-thread call is never judged, even one naming ak firstmate bind or the ledger", () => {
    for (const cmd of [
      "git commit -m 'fix(firstmate): ak firstmate bind refuses X'",
      "rg 'firstmate install' src",
      "ak firstmate grant --binding /h/data/T/agent-kit-binding.json --operation review.full",
      "cat ~/.agent-kit/firstmate/bindings/ak-T-1.json",
    ]) {
      expect(guard(b, parent("Bash", { command: cmd })).denied).toBe(false);
    }
    expect(guard(b, parent("Write", { file_path: "/Users/w/.agent-kit/firstmate/bindings/x.json" })).denied).toBe(false);
  });

  test("a main-thread call is never judged, even one a child would be denied", () => {
    for (const cmd of ["git push origin main", "fm-spawn.sh x", "gh pr create"]) {
      expect(guard(b, parent("Bash", { command: cmd })).denied).toBe(false);
    }
    expect(guard(b, parent("Write", { file_path: "/etc/passwd" })).denied).toBe(false);
  });

  test("a child may not push, merge, open a PR, run Firstmate or no-mistakes, or start an agent", () => {
    const denied = [
      "git push origin HEAD",
      "cd x && git   push",
      "gh pr merge 3",
      "gh pr create --fill",
      "gh-axi pr create",
      "fm-spawn.sh T-1",
      "bin/fm-control.sh pause",
      "no-mistakes axi run",
      "git push no-mistakes feature",
      "claude -p hello",
      "codex exec hi",
      "gh api -X POST repos/o/r/pulls -f title=x",
      "gh api --method PATCH repos/o/r/pulls/3",
      "gh api --method=post repos/o/r/pulls",
      "gh api repos/o/r/pulls -f title=x -f head=b -f base=main",
      "gh api -X PUT repos/o/r/pulls/3/merge",
      "gh api repos/o/r/pulls/3/merge",
      `gh api graphql -f query='mutation { mergePullRequest(input:{pullRequestId:"X"}) { clientMutationId } }'`,
      `gh api graphql -f query='mutation{createPullRequest(input:{}){pullRequest{url}}}'`,
      `gh api graphql -f query='mutation { enablePullRequestAutoMerge(input:{}) { clientMutationId } }'`,
      `gh api graphql -f query='mutation { updatePullRequestBranch(input:{}) { clientMutationId } }'`,
    ];
    for (const command of denied) {
      const d = guard(b, child("Bash", { command }));
      expect({ command, denied: d.denied }).toEqual({ command, denied: true });
      expect(d.code).toBe(0);
    }
    expect(guard(b, child("Task", { prompt: "x" })).denied).toBe(true);
    expect(guard(b, child("Agent", { prompt: "x" })).denied).toBe(true);
  });

  test("ordinary child commands pass", () => {
    for (const command of ["bun test", "git status", "git diff HEAD", "gh pr view 3", "cat CLAUDE.md", "grep -rn push src", "gh api repos/o/r/pulls/3", "gh api -X POST repos/o/r/issues/3/comments -f body=x", `gh api graphql -f query='query { repository(owner:"o", name:"r") { pullRequest(number:3) { title } } }'`]) {
      expect({ command, denied: guard(b, child("Bash", { command })).denied }).toEqual({ command, denied: false });
    }
  });

  test("glob characters in a command are not expanded against the hook's directory", () => {
    const dir = makeDir();
    writeFileSync(join(dir, "push"), "");
    expect(guard(b, child("Bash", { command: "git pu*" }), dir).denied).toBe(false);
  });

  test("a child writes inside the worktree or the evidence store, and nowhere else", () => {
    expect(guard(b, child("Write", { file_path: `${WORKTREE}/src/a.ts` })).denied).toBe(false);
    expect(guard(b, child("Edit", { file_path: "src/a.ts" })).denied).toBe(false);
    expect(guard(b, child("Write", { file_path: "/evidence/store/raw-1.json" })).denied).toBe(false);
    expect(guard(b, child("Write", { file_path: "/work/treehouse/x" })).denied).toBe(true);
    expect(guard(b, child("Write", { file_path: `${WORKTREE}/../elsewhere` })).denied).toBe(true);
    expect(guard(b, child("Edit", { file_path: "/home/fm/state/T-1.status" })).denied).toBe(true);
    expect(guard(b, child("NotebookEdit", { notebook_path: "/tmp/x.ipynb" })).denied).toBe(true);
  });

  test("an unreadable binding denies every child call and still leaves the main thread alone", () => {
    const missing = "/nonexistent/agent-kit-binding.json";
    const d = guard(missing, child("Bash", { command: "bun test" }));
    expect(d.denied).toBe(true);
    expect(d.reason).toContain("binding");
    expect(guard(missing, parent("Bash", { command: "bun test" })).denied).toBe(false);
  });

  test("an unsubstituted binding token is treated as unreadable", () => {
    expect(guard("__AK_FIRSTMATE_BINDING__", child("Bash", { command: "bun test" })).denied).toBe(true);
  });
});

/**
 * Characterization test: pins the hook's exact stdout bytes and exit code
 * across every deny/allow branch, so a rewrite of the jq plumbing can be
 * proven byte-for-byte equivalent rather than merely "still denies/allows".
 * This must pass unmodified against both the pre- and post-rewrite script.
 */
function runRaw(
  bindingPath: string,
  input: string | Record<string, unknown>,
  opts?: { cwd?: string },
): { stdout: string; code: number } {
  const proc = Bun.spawnSync(["bash", HOOK, "--binding", bindingPath], {
    cwd: opts?.cwd,
    stdin: new TextEncoder().encode(typeof input === "string" ? input : JSON.stringify(input)),
    env: { ...process.env, TMPDIR: "/nonexistent-tmp/" },
  });
  return { stdout: proc.stdout.toString(), code: proc.exitCode ?? -1 };
}

function denyLine(reason: string): string {
  return (
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `agent-kit child guard: ${reason}`,
      },
    }) + "\n"
  );
}

function rawBinding(content: string): string {
  const dir = makeDir();
  const path = join(dir, "agent-kit-binding.json");
  writeFileSync(path, content);
  return path;
}

describe("child-guard exact output (characterization)", () => {
  const b = binding("/evidence/store");
  const badSchema = rawBinding(JSON.stringify({ schema: "something-else" }));
  const brokenBinding = rawBinding("{not json");
  const noCwd = {
    session_id: "s",
    hook_event_name: "PreToolUse",
    agent_id: "a1b2",
    agent_type: "general-purpose",
    tool_name: "Bash",
    tool_input: { command: "bun test" },
  };

  const allowCases: Array<{ name: string; bindingPath: string; input: string | Record<string, unknown> }> = [
    { name: "main-thread git push", bindingPath: b, input: parent("Bash", { command: "git push origin main" }) },
    { name: "main-thread write outside worktree", bindingPath: b, input: parent("Write", { file_path: "/etc/passwd" }) },
    { name: "child ordinary bash command", bindingPath: b, input: child("Bash", { command: "git status" }) },
    { name: "child write inside worktree", bindingPath: b, input: child("Write", { file_path: `${WORKTREE}/src/a.ts` }) },
    { name: "child write inside evidence store", bindingPath: b, input: child("Write", { file_path: "/evidence/store/raw-1.json" }) },
    { name: "child reads a pull request", bindingPath: b, input: child("Bash", { command: "gh pr view 3" }) },
  ];

  for (const c of allowCases) {
    test(`allow: ${c.name}`, () => {
      const r = runRaw(c.bindingPath, c.input);
      expect({ name: c.name, stdout: r.stdout, code: r.code }).toEqual({ name: c.name, stdout: "", code: 0 });
    });
  }

  const denyCases: Array<{ name: string; bindingPath: string; input: string | Record<string, unknown>; reason: string }> = [
    {
      name: "malformed JSON input",
      bindingPath: b,
      input: '{"agent_id":"a1"',
      reason: "the hook input is not JSON",
    },
    {
      name: "no binding substituted (empty)",
      bindingPath: "",
      input: child("Bash", { command: "bun test" }),
      reason: "no task binding was substituted into the worker settings",
    },
    {
      name: "no binding substituted (token)",
      bindingPath: "__AK_FIRSTMATE_BINDING__",
      input: child("Bash", { command: "bun test" }),
      reason: "no task binding was substituted into the worker settings",
    },
    {
      name: "unreadable binding",
      bindingPath: "/nonexistent/agent-kit-binding.json",
      input: child("Bash", { command: "bun test" }),
      reason: "the task binding /nonexistent/agent-kit-binding.json is unreadable",
    },
    {
      name: "binding has the wrong schema",
      bindingPath: badSchema,
      input: child("Bash", { command: "bun test" }),
      reason: `the task binding ${badSchema} is not a firstmate-binding`,
    },
    {
      name: "binding is not valid JSON",
      bindingPath: brokenBinding,
      input: child("Bash", { command: "bun test" }),
      reason: `the task binding ${brokenBinding} is not a firstmate-binding`,
    },
    {
      name: "hook input names no cwd",
      bindingPath: b,
      input: noCwd,
      reason: "the hook input names no working directory",
    },
    {
      name: "Task tool",
      bindingPath: b,
      input: child("Task", { prompt: "x" }),
      reason: "a task-local child has depth 1 and may not start an agent",
    },
    {
      name: "Agent tool",
      bindingPath: b,
      input: child("Agent", { prompt: "x" }),
      reason: "a task-local child has depth 1 and may not start an agent",
    },
    {
      name: "claude token in command",
      bindingPath: b,
      input: child("Bash", { command: "claude -p hello" }),
      reason: "a task-local child has depth 1 and may not start an agent (claude)",
    },
    {
      name: "codex token in command",
      bindingPath: b,
      input: child("Bash", { command: "codex exec hi" }),
      reason: "a task-local child has depth 1 and may not start an agent (codex)",
    },
    {
      name: "fm-* command",
      bindingPath: b,
      input: child("Bash", { command: "fm-spawn.sh T-1" }),
      reason: "a task-local child may not run Firstmate (fm-spawn.sh)",
    },
    {
      name: "fm-* command with a path prefix",
      bindingPath: b,
      input: child("Bash", { command: "bin/fm-control.sh pause" }),
      reason: "a task-local child may not run Firstmate (bin/fm-control.sh)",
    },
    {
      name: "no-mistakes command",
      bindingPath: b,
      input: child("Bash", { command: "no-mistakes axi run" }),
      reason: "a task-local child may not run no-mistakes",
    },
    {
      name: "git push",
      bindingPath: b,
      input: child("Bash", { command: "git push origin HEAD" }),
      reason: "a task-local child may not push",
    },
    {
      name: "gh pr create",
      bindingPath: b,
      input: child("Bash", { command: "gh pr create --fill" }),
      reason: "a task-local child may not create a pull request",
    },
    {
      name: "gh pr merge",
      bindingPath: b,
      input: child("Bash", { command: "gh pr merge 3" }),
      reason: "a task-local child may not merge a pull request",
    },
    {
      name: "gh api graphql pull-request mutation",
      bindingPath: b,
      input: child("Bash", {
        command: `gh api graphql -f query='mutation{createPullRequest(input:{}){pullRequest{url}}}'`,
      }),
      reason: "a task-local child may not change a pull request through gh api graphql",
    },
    {
      name: "gh api merge path",
      bindingPath: b,
      input: child("Bash", { command: "gh api -X PUT repos/o/r/pulls/3/merge" }),
      reason: "a task-local child may not merge a pull request",
    },
    {
      name: "gh api mutating pulls request",
      bindingPath: b,
      input: child("Bash", { command: "gh api -X POST repos/o/r/pulls -f title=x" }),
      reason: "a task-local child may not change a pull request through gh api",
    },
    {
      name: "empty write path",
      bindingPath: b,
      input: child("Write", { file_path: "" }),
      reason: "a write with no target path",
    },
    {
      name: "write path climbs with ..",
      bindingPath: b,
      input: child("Write", { file_path: `${WORKTREE}/../elsewhere` }),
      reason: `a write path that climbs with '..' (${WORKTREE}/../elsewhere)`,
    },
    {
      name: "write outside worktree/evidence/tmp",
      bindingPath: b,
      input: child("Write", { file_path: "/work/treehouse/x" }),
      reason: "a task-local child writes only inside the worktree, the evidence store or its scratch directory, not /work/treehouse/x",
    },
    {
      name: "NotebookEdit outside worktree/evidence/tmp",
      bindingPath: b,
      input: child("NotebookEdit", { notebook_path: "/tmp/x.ipynb" }),
      reason: "a task-local child writes only inside the worktree, the evidence store or its scratch directory, not /tmp/x.ipynb",
    },
  ];

  for (const c of denyCases) {
    test(`deny: ${c.name}`, () => {
      const r = runRaw(c.bindingPath, c.input);
      expect({ name: c.name, stdout: r.stdout, code: r.code }).toEqual({
        name: c.name,
        stdout: denyLine(c.reason),
        code: 0,
      });
    });
  }
});
