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

function guard(bindingPath: string, input: Record<string, unknown>): Decision {
  const proc = Bun.spawnSync(["bash", HOOK, "--binding", bindingPath], {
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
    for (const command of ["bun test", "git status", "git diff HEAD", "gh pr view 3", "cat CLAUDE.md", "grep -rn push src"]) {
      expect({ command, denied: guard(b, child("Bash", { command })).denied }).toEqual({ command, denied: false });
    }
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
