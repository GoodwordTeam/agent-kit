import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { runCli } from "../src/cli.ts";
import { makeTree, DENY_MARKER, sampleModelTerm } from "./helpers/tree.ts";

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
skills:
  - id: triage
    invocation: U
    status: authored
    profiles: [core]
packs:
  - id: pack-secure
    status: contract
  - id: pack-perf
    status: contract
profiles:
  - id: core
    status: contract
    default: true
`;

const SKILL = `---
name: triage
description: Sort incoming work into the smallest next action.
---

# triage

Read the queue and pick one item.
`;

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { out: (line: string) => out.push(line), err: (line: string) => err.push(line) },
    stdout: () => out.join("\n"),
    stderr: () => err.join("\n"),
  };
}

function cleanTree(): string {
  return makeTree({ "catalog.yaml": CATALOG, "skills/triage/SKILL.md": SKILL });
}

describe("ak", () => {
  test("no command prints usage and exits non-zero", () => {
    const io = capture();
    expect(runCli([], { cwd: cleanTree(), io: io.io })).not.toBe(0);
    expect(io.stderr()).toContain("validate");
    expect(io.stderr()).toContain("attach");
    expect(io.stderr()).toContain("build");
  });

  test("an unknown command is an error, not a silent success", () => {
    const io = capture();
    expect(runCli(["frobnicate"], { cwd: cleanTree(), io: io.io })).not.toBe(0);
    expect(io.stderr()).toContain("frobnicate");
  });
});

describe("ak validate", () => {
  test("a clean tree exits 0", () => {
    const io = capture();
    expect(runCli(["validate"], { cwd: cleanTree(), io: io.io })).toBe(0);
  });

  test("every failure line names the file and the rule", () => {
    const root = makeTree({ "catalog.yaml": CATALOG, "skills/triage/SKILL.md": SKILL, "skills/stray/SKILL.md": SKILL });
    const io = capture();
    expect(runCli(["validate"], { cwd: root, io: io.io })).not.toBe(0);
    const lines = io.out.filter((l) => l.includes("catalog.directory-without-entry"));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain("skills/stray");
    expect(lines[0]).toMatch(/^ERROR\s/);
  });

  test("a warning alone does not fail the run", () => {
    const long = `${SKILL}\n${"A line of guidance.\n".repeat(200)}`;
    const io = capture();
    const root = makeTree({ "catalog.yaml": CATALOG, "skills/triage/SKILL.md": long });
    expect(runCli(["validate"], { cwd: root, io: io.io })).toBe(0);
    expect(io.stdout()).toContain("budget.skill-over-target");
  });

  test("--json emits one machine-readable record per issue", () => {
    const root = makeTree({ "catalog.yaml": CATALOG, "skills/triage/SKILL.md": SKILL, "skills/stray/SKILL.md": SKILL });
    const io = capture();
    runCli(["validate", "--json"], { cwd: root, io: io.io });
    const parsed = JSON.parse(io.stdout()) as { ok: boolean; issues: Array<{ rule: string; file: string }> };
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.some((i) => i.rule === "catalog.directory-without-entry")).toBe(true);
  });

  test("a missing catalog is reported, not a crash", () => {
    const io = capture();
    expect(runCli(["validate"], { cwd: makeTree({ "README.md": "x\n" }), io: io.io })).not.toBe(0);
    expect(io.stdout()).toContain("catalog.missing");
  });

  test("the summary counts errors, warnings and notes", () => {
    const io = capture();
    runCli(["validate"], { cwd: cleanTree(), io: io.io });
    expect(io.stdout()).toMatch(/0 error/);
  });
});

describe("ak build", () => {
  test("writes both host bundles and enumerates skills explicitly", () => {
    const root = cleanTree();
    const io = capture();
    expect(runCli(["build"], { cwd: root, io: io.io })).toBe(0);
    const manifestPath = join(root, "dist/claude-code/.claude-plugin/plugin.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { skills: string[] };
    expect(manifest.skills).toEqual(["./skills/triage"]);
    expect(existsSync(join(root, "dist/codex"))).toBe(true);
  });

  test("--check on an unbuilt tree fails and writes nothing", () => {
    const root = cleanTree();
    const io = capture();
    expect(runCli(["build", "--check"], { cwd: root, io: io.io })).not.toBe(0);
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  test("--check after a build succeeds", () => {
    const root = cleanTree();
    expect(runCli(["build"], { cwd: root, io: capture().io })).toBe(0);
    expect(runCli(["build", "--check"], { cwd: root, io: capture().io })).toBe(0);
  });

  test("--check fails once the source moves ahead of dist", () => {
    const root = cleanTree();
    runCli(["build"], { cwd: root, io: capture().io });
    Bun.write(join(root, "skills/triage/SKILL.md"), `${SKILL}\nOne more line.\n`);
    const io = capture();
    expect(runCli(["build", "--check"], { cwd: root, io: io.io })).not.toBe(0);
    expect(io.stdout()).toContain("packaging.dist-stale");
  });

  test("--profile narrows the bundle to that profile's members", () => {
    const catalog = CATALOG.replace("    profiles: [core]", "    profiles: [autonomy]").replace(
      "  - id: core\n    status: contract\n    default: true\n",
      "  - id: core\n    status: contract\n    default: true\n  - id: autonomy\n    status: contract\n",
    );
    const root = makeTree({ "catalog.yaml": catalog, "skills/triage/SKILL.md": SKILL });
    expect(runCli(["build", "--profile", "core"], { cwd: root, io: capture().io })).toBe(0);
    const manifest = JSON.parse(
      readFileSync(join(root, "dist/claude-code/.claude-plugin/plugin.json"), "utf8"),
    ) as { skills: string[] };
    expect(manifest.skills).toEqual([]);
  });

  test("an unknown profile is an error", () => {
    const io = capture();
    expect(runCli(["build", "--profile", "ghost"], { cwd: cleanTree(), io: io.io })).not.toBe(0);
    expect(io.stdout()).toContain("packaging.unknown-profile");
  });

  test("a content failure blocks the build rather than shipping it", () => {
    const body = SKILL.replace("Read the queue", `Read the queue with ${DENY_MARKER}`).replace(
      DENY_MARKER,
      sampleModelTerm(),
    );
    const root = makeTree({ "catalog.yaml": CATALOG, "skills/triage/SKILL.md": body });
    const io = capture();
    expect(runCli(["build"], { cwd: root, io: io.io })).not.toBe(0);
    expect(existsSync(join(root, "dist"))).toBe(false);
    expect(io.stdout()).toContain("content.denylist");
  });
});

describe("ak attach", () => {
  test("requires a subject", () => {
    const io = capture();
    expect(runCli(["attach"], { cwd: cleanTree(), io: io.io })).not.toBe(0);
  });

  test("prints the selected packs with a rationale for each", () => {
    const io = capture();
    expect(runCli(["attach", "src/auth/session.ts"], { cwd: cleanTree(), io: io.io })).toBe(0);
    expect(io.stdout()).toContain("pack-secure");
    expect(io.stdout()).toContain("why:");
  });

  test("--json emits the selections and the rejected packs", () => {
    const io = capture();
    runCli(["attach", "src/auth/session.ts", "--json"], { cwd: cleanTree(), io: io.io });
    const parsed = JSON.parse(io.stdout()) as {
      selections: Array<{ pack: string; rationale: string }>;
      skipped: Array<{ pack: string; reason: string }>;
    };
    expect(parsed.selections.some((s) => s.pack === "pack-secure" && s.rationale.length > 0)).toBe(true);
    expect(parsed.skipped.length).toBeGreaterThan(0);
  });

  test("a manifest error is reported and exits non-zero", () => {
    const root = makeTree({
      "catalog.yaml": CATALOG,
      "skills/triage/SKILL.md": SKILL,
      "packs/pack-secure/pack.yaml": "id: pack-secure\nactivation:\n  signals:\n    - kind: vibes\n      pattern: x\n",
    });
    const io = capture();
    expect(runCli(["attach", "src/auth/session.ts"], { cwd: root, io: io.io })).not.toBe(0);
    expect(io.stdout()).toContain("attach.unknown-signal-kind");
  });
});
