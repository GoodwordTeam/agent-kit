/**
 * `ak firstmate grant`: the Firstmate binding as the delegated grant (ADR-0004).
 *
 * Label: mock/contract. Every case binds a task in a temp Firstmate home built by
 * ./fixture.ts, then asks the real `ak firstmate` entry for a grant.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { bind } from "../../src/firstmate/bind.ts";
import { runFirstmate } from "../../src/firstmate/cli.ts";
import { BINDING_SHA_FILE, ENV_FILE } from "../../src/firstmate/constants.ts";
import { FIXED_NOW, makeBundle, makeDir, makeHome, makeProject, REPO } from "./fixture.ts";

const sha256 = (bytes: string | Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function bound(taskId = "T-G") {
  const { home, upstream } = makeHome({ patched: true });
  // What `ak firstmate install` leaves, and what marks the directory as a Firstmate home.
  writeFileSync(join(home, ENV_FILE), "");
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

/** Rewrite a binding and its hash record together, as Firstmate re-binding would. */
function rewrite(bindingPath: string, binding: unknown) {
  const text = JSON.stringify(binding);
  writeFileSync(bindingPath, text);
  writeFileSync(join(dirname(bindingPath), BINDING_SHA_FILE), `${sha256(text)}\n`);
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
    const sha = sha256(readFileSync(bindingPath));
    expect(readFileSync(join(dirname(bindingPath), BINDING_SHA_FILE), "utf8").trim()).toBe(sha);
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
    const { home, bindingPath } = bound();
    refused(grant(bindingPath, "review.full", home), /inside the worktree/);
    refused(grant(bindingPath, "review.full", join(home, "config")), /inside the worktree/);
  });

  test("a binding whose name starts with '..' is still inside the worktree", () => {
    const { home, bindingPath } = bound();
    copyFileSync(bindingPath, join(dirname(bindingPath), "..binding.json"));
    refused(grant(join(dirname(bindingPath), "..binding.json"), "review.full", home), /inside the worktree/);
  });

  test("refuses a binding inside the bound project checkout", () => {
    const { project, worktree, bindingPath, binding } = bound();
    // A project shaped like a Firstmate home, so only the project check stands in the way.
    mkdirSync(dirname(join(project, ENV_FILE)), { recursive: true });
    writeFileSync(join(project, ENV_FILE), "");
    const dir = join(project, "data", binding.task_id);
    mkdirSync(dir, { recursive: true });
    copyFileSync(bindingPath, join(dir, "binding.json"));
    copyFileSync(join(dirname(bindingPath), BINDING_SHA_FILE), join(dir, BINDING_SHA_FILE));
    refused(grant(join(dir, "binding.json"), "review.full", worktree), /inside the project/);
  });

  test("refuses a copied-and-widened binding outside a Firstmate home's data/<task-id>/", () => {
    const { worktree, bindingPath, binding } = bound();
    const b = JSON.parse(readFileSync(bindingPath, "utf8"));
    b.required_gates = b.required_gates.filter((g: string) => g !== "ship-preflight");
    rewrite(bindingPath, b);
    refused(grant(bindingPath, "ship.prepare", worktree), /ship-preflight/);
    b.required_gates = [...b.required_gates, "ship-preflight"];
    const loose = join(makeDir(), "b.json");
    rewrite(loose, b);
    refused(grant(loose, "ship.prepare", worktree), /not in data\/T-G\//);

    // Home-shaped but with no agent-kit.env: not a Firstmate home.
    const fake = join(makeDir(), "data", binding.task_id, "binding.json");
    mkdirSync(dirname(fake), { recursive: true });
    rewrite(fake, b);
    refused(grant(fake, "ship.prepare", worktree), /not in data\/T-G\//);
  });

  test("refuses a binding edited in place, and one with no hash record beside it", () => {
    const { worktree, bindingPath } = bound();
    const b = JSON.parse(readFileSync(bindingPath, "utf8"));
    b.required_gates = b.required_gates.filter((g: string) => g !== "ship-preflight");
    rewrite(bindingPath, b);
    refused(grant(bindingPath, "ship.prepare", worktree), /ship-preflight/);
    b.required_gates = [...b.required_gates, "ship-preflight"];
    writeFileSync(bindingPath, JSON.stringify(b));
    refused(grant(bindingPath, "ship.prepare", worktree), /hashes to/);
    rmSync(join(dirname(bindingPath), BINDING_SHA_FILE));
    refused(grant(bindingPath, "ship.prepare", worktree), /has no .* beside it/);
  });

  test("bind refuses a '..'-prefixed binding path inside the project", () => {
    const { home, upstream } = makeHome({ patched: true });
    const project = makeProject();
    const opts = { akRoot: REPO, bundleDir: makeBundle(), pinsDir: makeDir(), upstream, now: FIXED_NOW };
    const r = bind(
      { fmHome: home, taskId: "T-D", project, mode: "agent-kit", bindingOut: join(project, "..b.json"), host: "claude-code", evidence: { store: "mock", location: makeDir() } },
      opts,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toContain("inside the project");
  });

  test("refuses an operation whose gate the binding does not require", () => {
    const { worktree, bindingPath } = bound();
    const b = JSON.parse(readFileSync(bindingPath, "utf8"));
    b.required_gates = ["verify", "review-readiness"];
    rewrite(bindingPath, b);
    refused(grant(bindingPath, "review.full", worktree), /review-full/);
    refused(grant(bindingPath, "ship.prepare", worktree), /ship-preflight/);
    expect(grant(bindingPath, "review.readiness", worktree).code).toBe(0);
  });

  test("refuses a tampered binding that no longer validates, and one that is not JSON", () => {
    const { worktree, bindingPath } = bound();
    const b = JSON.parse(readFileSync(bindingPath, "utf8"));
    b.delivery.merge = true;
    rewrite(bindingPath, b);
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
    rewrite(bindingPath, b);
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
