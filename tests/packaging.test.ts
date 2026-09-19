import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { loadCatalog } from "../src/catalog/load.ts";
import { HOST_IDS, RESTRICTIONS, loadHostCapabilities } from "../src/packaging/hosts.ts";
import { planBundle } from "../src/packaging/plan.ts";
import { writeBundles, checkBundles } from "../src/packaging/build.ts";
import { makeTree } from "./helpers/tree.ts";

const HEAD = (name: string) => `---\nname: ${name}\ndescription: Use when asked.\n---\n`;

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
skills:
  - id: alpha
    status: authored
    invocation: U
    profiles: [core]
  - id: beta
    status: authored
    invocation: M
    profiles: [core, autonomy]
protocols:
  - id: tdd
    status: authored
roles:
  - id: implementer
    status: authored
adapters:
  - id: claude-code
    status: authored
  - id: codex
    status: authored
profiles:
  - id: core
    status: authored
  - id: autonomy
    status: authored
`;

const BASE: Record<string, string> = {
  "catalog.yaml": CATALOG,
  "skills/alpha/SKILL.md": `${HEAD("alpha")}\nFollow [tdd](../../protocols/tdd/PROTOCOL.md).\n`,
  "skills/alpha/skill.yaml": "id: alpha\nversion: 0.1.0\ninvocation: U\nargument_hint: <ticket>\nallowed_tools: [Read, Grep]\n",
  "skills/beta/SKILL.md": `${HEAD("beta")}\nPlain body.\n`,
  "skills/beta/skill.yaml": "id: beta\nversion: 0.1.0\ninvocation: M\n",
  "protocols/tdd/PROTOCOL.md": "# TDD\n\nSee [implementer](../../roles/implementer/ROLE.md).\n",
  "roles/implementer/ROLE.md": "# Implementer\n",
  "profiles/core.yaml": "id: core\nskills: [alpha, beta]\n",
  "profiles/autonomy.yaml": "id: autonomy\nskills: [beta]\n",
};

function ctxFor(overrides: Record<string, string> = {}, drop: string[] = []) {
  const files = { ...BASE, ...overrides };
  for (const key of drop) delete files[key];
  const root = makeTree(files);
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

describe("host capability honesty", () => {
  test("both hosts are declared and the restriction vocabulary is closed", () => {
    expect([...HOST_IDS]).toEqual(["claude-code", "codex"]);
    expect([...RESTRICTIONS]).toContain("no-model-invocation");
    expect([...RESTRICTIONS]).toContain("tool-allowlist-enforced");
  });

  test("claude-code does not claim to enforce a tool allowlist: it is pre-approval, not a sandbox", () => {
    const caps = loadHostCapabilities(ctxFor().root, "claude-code");
    expect(caps.enforces.has("no-model-invocation")).toBe(true);
    expect(caps.enforces.has("tool-allowlist-enforced")).toBe(false);
    expect(caps.notes.join(" ")).toContain("pre-approval");
  });

  test("an adapter CONTRACT.md may declare what the host actually enforces", () => {
    const ctx = ctxFor({
      "adapters/codex/CONTRACT.md": "# Codex\n\n```yaml\nenforces:\n  - no-model-invocation\n  - filesystem-sandbox\n```\n",
    });
    const caps = loadHostCapabilities(ctx.root, "codex");
    expect([...caps.enforces].sort()).toEqual(["filesystem-sandbox", "no-model-invocation"]);
  });

  test("an unknown restriction in an adapter declaration is reported, not silently accepted", () => {
    const ctx = ctxFor({ "adapters/codex/CONTRACT.md": "```yaml\nenforces: [teleportation]\n```\n" });
    const caps = loadHostCapabilities(ctx.root, "codex");
    expect(caps.issues.some((i) => i.rule === "packaging.unknown-restriction")).toBe(true);
    expect(caps.enforces.has("teleportation")).toBe(false);
  });
});

describe("bundle planning", () => {
  test("every U skill gets disable-model-invocation: true in the generated frontmatter", () => {
    const plan = planBundle(ctxFor(), "claude-code", {});
    expect(plan.files.get("skills/alpha/SKILL.md")?.contents).toContain("disable-model-invocation: true");
    expect(plan.files.get("skills/beta/SKILL.md")?.contents).not.toContain("disable-model-invocation");
  });

  test("argument-hint and allowed-tools are generated from skill.yaml, never copied from the body", () => {
    const plan = planBundle(ctxFor(), "claude-code", {});
    const alpha = plan.files.get("skills/alpha/SKILL.md")?.contents ?? "";
    expect(alpha).toContain("argument-hint: <ticket>");
    expect(alpha).toContain("allowed-tools:");
    expect(alpha).toContain("- Read");
    expect(plan.files.get("skills/beta/SKILL.md")?.contents).not.toContain("argument-hint");
  });

  test("the canonical name and description survive into the bundle", () => {
    const plan = planBundle(ctxFor(), "claude-code", {});
    const alpha = plan.files.get("skills/alpha/SKILL.md")?.contents ?? "";
    expect(alpha).toContain("name: alpha");
    expect(alpha).toContain("description: Use when asked.");
  });

  test("plugin.json enumerates skills explicitly in catalog order rather than globbing", () => {
    const plan = planBundle(ctxFor(), "claude-code", {});
    const manifest = JSON.parse(plan.files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
    expect(manifest.skills).toEqual(["./skills/alpha", "./skills/beta"]);
    expect(JSON.stringify(manifest)).not.toContain("*");
  });

  test("transitive shared dependencies are copied under references/shared/", () => {
    const plan = planBundle(ctxFor(), "claude-code", {});
    expect([...plan.files.keys()]).toContain("references/shared/protocols/tdd/PROTOCOL.md");
    expect([...plan.files.keys()]).toContain("references/shared/roles/implementer/ROLE.md");
  });

  test("links into shared space are rewritten so closure holds in the bundle", () => {
    const plan = planBundle(ctxFor(), "claude-code", {});
    const alpha = plan.files.get("skills/alpha/SKILL.md")?.contents ?? "";
    expect(alpha).toContain("../../references/shared/protocols/tdd/PROTOCOL.md");
    expect(alpha).not.toContain("](../../protocols/tdd/PROTOCOL.md)");
  });

  test("a link between two shared files needs no rewrite because the layout is preserved", () => {
    const plan = planBundle(ctxFor(), "claude-code", {});
    const proto = plan.files.get("references/shared/protocols/tdd/PROTOCOL.md")?.contents ?? "";
    expect(proto).toContain("../../roles/implementer/ROLE.md");
  });

  test("--profile installs only that profile's member list", () => {
    const plan = planBundle(ctxFor(), "claude-code", { profile: "autonomy" });
    const manifest = JSON.parse(plan.files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
    expect(manifest.skills).toEqual(["./skills/beta"]);
    expect([...plan.files.keys()]).not.toContain("skills/alpha/SKILL.md");
  });

  test("an unknown profile is an error, not an empty bundle", () => {
    const plan = planBundle(ctxFor(), "claude-code", { profile: "nonesuch" });
    expect(plan.issues.some((i) => i.rule === "packaging.unknown-profile")).toBe(true);
  });

  test("a reference into a source-only tree cannot be bundled and is reported", () => {
    const ctx = ctxFor({
      "skills/alpha/SKILL.md": `${HEAD("alpha")}\nSee [notes](../../research/sources/notes.md).\n`,
      "research/sources/notes.md": "# Notes\n",
    });
    const plan = planBundle(ctx, "claude-code", {});
    const issue = plan.issues.find((i) => i.rule === "packaging.not-bundleable");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("research/sources/notes.md");
  });

  test("planning is deterministic: the same tree plans byte-identical files", () => {
    const ctx = ctxFor();
    const a = planBundle(ctx, "claude-code", {});
    const b = planBundle(ctx, "claude-code", {});
    expect([...a.files.entries()].map(([k, v]) => [k, v.contents])).toEqual(
      [...b.files.entries()].map(([k, v]) => [k, v.contents]),
    );
  });

  test("a skill whose body is not authored yet is skipped without crashing", () => {
    const ctx = ctxFor({}, ["skills/beta/SKILL.md"]);
    const plan = planBundle(ctx, "claude-code", {});
    expect(plan.issues.some((i) => i.rule === "packaging.skill-body-missing")).toBe(true);
    expect([...plan.files.keys()]).not.toContain("skills/beta/SKILL.md");
  });
});

describe("host-capability decisions at build time", () => {
  const autonomous = {
    "skills/beta/skill.yaml":
      "id: beta\nversion: 0.1.0\ninvocation: M\nautonomy:\n  modes: [manual, guided, autonomous]\n  requires_enforced: [filesystem-sandbox]\n",
  };

  test("a host that cannot enforce a required restriction rejects autonomous mode and exposes guided", () => {
    const plan = planBundle(ctxFor(autonomous), "claude-code", {});
    const decision = plan.decisions.find((d) => d.skill === "beta");
    expect(decision?.mode).toBe("guided");
    expect(decision?.rejected).toEqual(["autonomous"]);
    expect(decision?.unenforceable).toEqual(["filesystem-sandbox"]);
    expect(plan.files.get("skills/beta/SKILL.md")?.contents).toContain("mode: guided");
  });

  test("the rejection is recorded in the bundle manifest, not only in the log", () => {
    const plan = planBundle(ctxFor(autonomous), "claude-code", {});
    const manifest = JSON.parse(plan.files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
    expect(manifest.ak.host.enforces).toContain("no-model-invocation");
    expect(manifest.ak.autonomy_rejected).toEqual([{ skill: "beta", unenforceable: ["filesystem-sandbox"] }]);
  });

  test("a host that does enforce the restriction keeps autonomous mode", () => {
    const ctx = ctxFor({
      ...autonomous,
      "adapters/codex/CONTRACT.md": "```yaml\nenforces: [no-model-invocation, filesystem-sandbox]\n```\n",
    });
    const plan = planBundle(ctx, "codex", {});
    expect(plan.decisions.find((d) => d.skill === "beta")?.mode).toBe("autonomous");
    expect(plan.decisions.find((d) => d.skill === "beta")?.rejected).toEqual([]);
  });

  test("a skill declaring no autonomy needs is unaffected", () => {
    const plan = planBundle(ctxFor(), "claude-code", {});
    expect(plan.decisions.find((d) => d.skill === "alpha")?.mode).toBe("manual");
  });
});

describe("ak build and --check", () => {
  test("writes both host bundles under dist/", () => {
    const ctx = ctxFor();
    const issues = writeBundles(ctx, {});
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(readFileSync(join(ctx.root, "dist/claude-code/.claude-plugin/plugin.json"), "utf8")).toContain("alpha");
    expect(readFileSync(join(ctx.root, "dist/codex/skills/alpha/SKILL.md"), "utf8")).toContain("name: alpha");
  });

  test("--check passes immediately after a build", () => {
    const ctx = ctxFor();
    writeBundles(ctx, {});
    expect(checkBundles(ctx, {}).filter((i) => i.severity === "error")).toEqual([]);
  });

  test("--check reports a stale file and writes nothing", () => {
    const ctx = ctxFor();
    writeBundles(ctx, {});
    const target = join(ctx.root, "dist/claude-code/skills/alpha/SKILL.md");
    writeFileSync(target, "tampered\n");
    const issues = checkBundles(ctx, {});
    expect(issues.some((i) => i.rule === "packaging.dist-stale")).toBe(true);
    expect(readFileSync(target, "utf8")).toBe("tampered\n");
  });

  test("--check reports a missing generated file", () => {
    const ctx = ctxFor();
    expect(checkBundles(ctx, {}).some((i) => i.rule === "packaging.dist-missing")).toBe(true);
  });

  test("--check reports an extra file left behind in dist/", () => {
    const ctx = ctxFor();
    writeBundles(ctx, {});
    mkdirSync(join(ctx.root, "dist/claude-code/skills/zombie"), { recursive: true });
    writeFileSync(join(ctx.root, "dist/claude-code/skills/zombie/SKILL.md"), "x\n");
    expect(checkBundles(ctx, {}).some((i) => i.rule === "packaging.dist-extra")).toBe(true);
  });

  test("rebuilding removes a file that is no longer generated", () => {
    const ctx = ctxFor();
    writeBundles(ctx, {});
    writeFileSync(join(ctx.root, "dist/claude-code/skills/zombie.md"), "x\n");
    writeBundles(ctx, {});
    expect(checkBundles(ctx, {}).filter((i) => i.severity === "error")).toEqual([]);
  });
});
