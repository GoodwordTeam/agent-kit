import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { loadCatalog } from "../src/catalog/load.ts";
import { checkCompleteness } from "../src/validation/completeness.ts";
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

/**
 * A skill the catalog declares with `status: contract` has no body yet, and
 * treating that as a packaging error made `ak build` unable to emit anything at
 * all until the last of 33 skills was written -- a gate that says nothing about
 * the bundle and blocks every intermediate release. The catalog is the
 * authority on what exists, so an unauthored skill is excluded from the bundle
 * rather than failing it.
 *
 * Exclusion is the dangerous half of that: a bundle that silently ships without
 * most of its skills and reports success is the fails-open shape this validator
 * exists to prevent. So the exclusion is recorded in `.claude-plugin/plugin.json`,
 * which is inside the byte comparison `ak build --check` performs, and a run
 * that drops a skill says so in its output. Neither is a courtesy; they are what
 * make the exclusion checkable rather than invisible.
 */
describe("skills the catalog has not authored yet", () => {
  const WITH_CONTRACT = {
    "catalog.yaml": CATALOG.replace(
      "protocols:",
      `  - id: gamma
    status: contract
    invocation: M
    profiles: [core]
protocols:`,
    ),
    "profiles/core.yaml": "id: core\nskills: [alpha, beta, gamma]\n",
  };

  test("a contract skill with no body is excluded from the bundle, not an error", () => {
    const plan = planBundle(ctxFor(WITH_CONTRACT), "claude-code", {});
    expect(plan.issues.filter((i) => i.rule === "packaging.skill-body-missing")).toEqual([]);
    expect([...plan.files.keys()].filter((p) => p.startsWith("skills/gamma/"))).toEqual([]);
  });

  test("an authored skill with no body is still an error", () => {
    // The gate that had to survive. Exclusion is keyed on what the catalog
    // says, not on whether a file happens to be there, so a skill declared
    // `authored` with no body is still a packaging failure and not silently
    // dropped into the excluded list.
    const plan = planBundle(ctxFor({}, ["skills/beta/SKILL.md"]), "claude-code", {});
    const issue = plan.issues.find((i) => i.rule === "packaging.skill-body-missing");
    expect(issue?.severity).toBe("error");
    expect(issue?.file).toBe("skills/beta/SKILL.md");
  });

  test("the manifest records every exclusion and its reason", () => {
    const plan = planBundle(ctxFor(WITH_CONTRACT), "claude-code", {});
    const manifest = JSON.parse(plan.files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
    expect(manifest.skills).toEqual(["./skills/alpha", "./skills/beta"]);
    expect(manifest.ak.excluded).toEqual([{ skill: "gamma", reason: "status: contract" }]);
  });

  test("a run that excludes a skill says so, not only in the file it writes", () => {
    // The manifest is the durable record and this is the one a person reads.
    // Without it the only signal that a third of the catalog is missing from
    // the bundle is a JSON file nobody opens on a green run.
    const plan = planBundle(ctxFor(WITH_CONTRACT), "claude-code", {});
    const note = plan.issues.find((i) => i.rule === "packaging.excluded-unauthored");
    expect(note?.severity).toBe("note");
    expect(note?.message).toContain("gamma");
  });

  test("a bundle with no skills left in it is an error, not a green empty build", () => {
    // The failure this exclusion would otherwise introduce, and it is the same
    // one it was meant to remove. With every skill still `contract`, excluding
    // them all leaves a bundle containing nothing but its own manifest, and
    // without this the packager reports `0 errors` and exit 0 over it -- a
    // claim that a releasable artifact was produced, which is worse than the
    // 33 errors it replaced, because that at least said something was wrong.
    //
    // This is what makes the exclusion an unblocking change rather than a
    // silencing one: the build goes green the moment the *first* skill is
    // authored, instead of staying red until the last.
    const noneAuthored = {
      "catalog.yaml": CATALOG.replace(/status: authored\n    invocation/g, "status: contract\n    invocation"),
      "profiles/core.yaml": "id: core\nskills: [alpha, beta]\n",
    };
    const plan = planBundle(ctxFor(noneAuthored), "claude-code", {});
    const issue = plan.issues.find((i) => i.rule === "packaging.empty-bundle");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("alpha");

    // And it is gone as soon as one skill is real, which is the whole claim.
    const oneAuthored = {
      ...noneAuthored,
      "catalog.yaml": (noneAuthored["catalog.yaml"] ?? "").replace("id: alpha\n    status: contract", "id: alpha\n    status: authored"),
    };
    expect(planBundle(ctxFor(oneAuthored), "claude-code", {}).issues.some((i) => i.rule === "packaging.empty-bundle")).toBe(false);
  });

  test("an included skill linking an excluded one fails the build rather than dangling", () => {
    // Exclusion removes the skill from the bundle's namespace, so a link into
    // it has nowhere to resolve. `packaging.not-bundleable` already carried
    // this case for profile exclusions and carries it unchanged here: the
    // alternative is a bundle shipping a link to a directory it does not have.
    const plan = planBundle(
      ctxFor({ ...WITH_CONTRACT, "skills/alpha/SKILL.md": `${HEAD("alpha")}\nSee [gamma](../gamma/SKILL.md).\n` }),
      "claude-code",
      {},
    );
    const issue = plan.issues.find((i) => i.rule === "packaging.not-bundleable");
    expect(issue?.severity).toBe("error");
    expect(issue?.file).toBe("skills/alpha/SKILL.md");
  });

  test("a body present while the catalog still says contract is excluded, and the catalog is why", () => {
    // The catalog is the authority on what exists; a directory listing is not.
    // So this is excluded even though the file is right there, and the author
    // is told by `catalog.status-behind-body` rather than by a silent
    // inclusion that makes the catalog wrong about its own bundle. Asserted in
    // both directions so the exclusion cannot become a hole nobody is warned
    // about.
    const ctx = ctxFor({
      ...WITH_CONTRACT,
      "skills/gamma/SKILL.md": `${HEAD("gamma")}\nWritten already.\n`,
    });
    const plan = planBundle(ctx, "claude-code", {});
    expect([...plan.files.keys()].filter((p) => p.startsWith("skills/gamma/"))).toEqual([]);
    const warned = checkCompleteness(ctx).filter((i) => i.rule === "catalog.status-behind-body");
    expect(warned.map((i) => i.file)).toContain("skills/gamma/SKILL.md");
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

  test("a missing skill body is one problem, not one per bundle that wanted it", () => {
    // planBundle runs once per host, so every fact it reports about the source
    // tree used to be emitted once per host. A missing SKILL.md is not a fact
    // about either bundle: it cannot be fixed per target and does not differ
    // per target, so two byte-identical rows read as a bug in the reporter and
    // double the error count everyone glances at as a progress number.
    const ctx = ctxFor({}, ["skills/beta/SKILL.md"]);
    const missing = checkBundles(ctx, {}).filter((i) => i.rule === "packaging.skill-body-missing");
    expect(missing.length).toBe(1);
    expect(missing[0]?.file).toBe("skills/beta/SKILL.md");
  });

  test("a per-target problem is still reported per target", () => {
    // The other half, and the reason this is a dedup rather than a blanket
    // collapse: dist-missing names the bundle in its file column, so its rows
    // are genuinely different diagnostics about different artifacts and both
    // must survive.
    const ctx = ctxFor();
    const files = checkBundles(ctx, {})
      .filter((i) => i.rule === "packaging.dist-missing")
      .map((i) => i.file);
    expect(files.length).toBeGreaterThan(1);
    expect(new Set(files).size).toBe(files.length);
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
