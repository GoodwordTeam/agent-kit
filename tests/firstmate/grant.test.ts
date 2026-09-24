/**
 * `ak firstmate grant`: the Firstmate binding as the delegated grant (ADR-0004).
 *
 * Label: mock/contract. Every case binds a task in a temp Firstmate home built by
 * ./fixture.ts, then asks the real `ak firstmate` entry for a grant.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { bind } from "../../src/firstmate/bind.ts";
import { runFirstmate } from "../../src/firstmate/cli.ts";
import { FIXED_NOW, makeBundle, makeDir, makeHome, makeProject, REPO } from "./fixture.ts";

function bound(taskId = "T-G") {
  const { home, upstream } = makeHome({ patched: true });
  const project = makeProject();
  const opts = { akRoot: REPO, bundleDir: makeBundle(), pinsDir: makeDir(), upstream, now: FIXED_NOW };
  const bindingPath = join(home, "data", taskId, "binding.json");
  const r = bind(
    { fmHome: home, taskId, project, mode: "agent-kit", bindingOut: bindingPath, host: "claude-code", evidence: { store: "mock", location: makeDir() } },
    opts,
  );
  if (!r.ok) throw new Error(r.errors.join("\n"));
  // The worker's worktree: a checkout of its own, apart from the Firstmate home.
  const worktree = makeProject();
  return { home, project, worktree, bindingPath, binding: r.binding! };
}

function grant(bindingPath: string, operation: string, cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  const code = runFirstmate(["grant", "--binding", bindingPath, "--operation", operation, "--cwd", cwd], {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  return { code, out, err };
}

function refused(r: { code: number; out: string[]; err: string[] }, reason: RegExp) {
  expect(r.code).not.toBe(0);
  expect(r.out).toEqual([]);
  expect(r.err[0]).toMatch(reason);
  expect(r.err.join("\n")).toContain("needs-decision");
}

describe("ak firstmate grant", () => {
  test("grants each operation the binding covers and prints the grant record", () => {
    const { worktree, bindingPath, binding } = bound();
    const sha = `sha256:${createHash("sha256").update(readFileSync(bindingPath)).digest("hex")}`;
    for (const operation of ["review.full", "review.readiness", "ship.prepare"]) {
      const r = grant(bindingPath, operation, worktree);
      expect(r.err).toEqual([]);
      expect(r.code).toBe(0);
      expect(JSON.parse(r.out.join("\n"))).toEqual({
        operation,
        binding: bindingPath,
        binding_sha256: sha,
        task_id: binding.task_id,
        run_id: binding.run_id,
        granted_by: "firstmate-binding",
      });
    }
  });

  test("refuses a binding inside the worktree the grant is asked from, even from a subdirectory", () => {
    const { worktree, bindingPath } = bound();
    const copy = join(worktree, "binding.json");
    copyFileSync(bindingPath, copy);
    refused(grant(copy, "review.full", worktree), /inside the worktree/);
    mkdirSync(join(worktree, "src"), { recursive: true });
    refused(grant(copy, "review.full", join(worktree, "src")), /inside the worktree/);
  });

  test("refuses a binding inside the bound project checkout", () => {
    const { project, worktree, bindingPath } = bound();
    const copy = join(project, "binding.json");
    copyFileSync(bindingPath, copy);
    refused(grant(copy, "review.full", worktree), /inside the project/);
  });

  test("refuses an operation whose gate the binding does not require", () => {
    const { worktree, bindingPath } = bound();
    const b = JSON.parse(readFileSync(bindingPath, "utf8"));
    b.required_gates = ["verify", "review-readiness"];
    writeFileSync(bindingPath, JSON.stringify(b));
    refused(grant(bindingPath, "review.full", worktree), /review-full/);
    refused(grant(bindingPath, "ship.prepare", worktree), /ship-preflight/);
    expect(grant(bindingPath, "review.readiness", worktree).code).toBe(0);
  });

  test("refuses a tampered binding that no longer validates, and one that is not JSON", () => {
    const { worktree, bindingPath } = bound();
    const b = JSON.parse(readFileSync(bindingPath, "utf8"));
    b.delivery.merge = true;
    writeFileSync(bindingPath, JSON.stringify(b));
    refused(grant(bindingPath, "ship.prepare", worktree), /does not validate/);
    writeFileSync(bindingPath, "{ not json");
    refused(grant(bindingPath, "review.full", worktree), /not JSON/);
    refused(grant(join(makeDir(), "missing.json"), "review.full", worktree), /does not exist/);
  });

  test("refuses when the pinned bundle no longer matches its hash, or is gone", () => {
    const { worktree, bindingPath, binding } = bound();
    writeFileSync(join(binding.skill_bundle.path, "skills/super-ship/SKILL.md"), "---\nname: super-ship\n---\nedited\n");
    refused(grant(bindingPath, "ship.prepare", worktree), /pinned bundle/);

    const b = JSON.parse(readFileSync(bindingPath, "utf8"));
    b.skill_bundle.path = join(makeDir(), "gone");
    writeFileSync(bindingPath, JSON.stringify(b));
    refused(grant(bindingPath, "review.full", worktree), /pinned bundle/);
  });

  test("refuses an operation that is not on the slip: merge and unknown names", () => {
    const { worktree, bindingPath } = bound();
    refused(grant(bindingPath, "merge", worktree), /not an operation/);
    refused(grant(bindingPath, "review.delta", worktree), /not an operation/);
  });

  test("a missing flag is a usage error", () => {
    const err: string[] = [];
    const code = runFirstmate(["grant", "--operation", "review.full"], { out: () => {}, err: (l) => err.push(l) });
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("--binding is required");
  });
});
