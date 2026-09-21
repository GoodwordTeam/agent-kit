import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { loadCatalog } from "../src/catalog/load.ts";
import { compileSchemas } from "../src/validation/schemas.ts";
import { checkCompleteness } from "../src/validation/completeness.ts";
import { HOST_IDS, RESTRICTIONS, loadHostCapabilities } from "../src/packaging/hosts.ts";
import { planBundle } from "../src/packaging/plan.ts";
import { writeBundles, checkBundles } from "../src/packaging/build.ts";
import { makeTree } from "./helpers/tree.ts";

const HEAD = (name: string) => `---\nname: ${name}\ndescription: Use when asked.\n---\n`;

/** This repository, for the tests that measure against its real schemas. */
const REPO = join(import.meta.dir, "..");

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
  author: agent-kit maintainers
  license: MIT
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

/**
 * The identity `adapters/codex/CONTRACT.md` §5.2 makes the host manifests agree
 * with, stated once and reused by the fixtures that perturb it.
 *
 * The four values are the ones `CATALOG` above produces: `name` from
 * `package.id`, `description` from `package.name`, and `version` and `license`
 * from their namesakes. They have to match, because a fixture whose two sides
 * already disagree makes every test in this file report a parity failure that
 * is about the fixture rather than about the code.
 */
const PACKAGE_JSON: Record<string, unknown> = {
  name: "ak",
  version: "0.1.0",
  description: "agent-kit",
  license: "MIT",
};

const packageJson = (doc: Record<string, unknown>) => `${JSON.stringify(doc, null, 2)}\n`;

const BASE: Record<string, string> = {
  "catalog.yaml": CATALOG,
  // In every fixture because it is in every real tree: `ak` runs from a package
  // root. A plan with no package.json to agree with is not a plan with nothing
  // to check -- it is the manifests sitting in front of the check with no
  // authority to judge them by, which the check reports rather than passes.
  "package.json": packageJson(PACKAGE_JSON),
  "skills/alpha/SKILL.md": `${HEAD("alpha")}\nFollow [tdd](../../protocols/tdd/PROTOCOL.md).\n`,
  "skills/alpha/skill.yaml": "id: alpha\nversion: 0.1.0\ninvocation: U\nargument_hint: <ticket>\nallowed_tools: [Read, Grep]\n",
  "skills/beta/SKILL.md": `${HEAD("beta")}\nPlain body.\n`,
  "skills/beta/skill.yaml": "id: beta\nversion: 0.1.0\ninvocation: M\n",
  "protocols/tdd/PROTOCOL.md": "# TDD\n\nSee [implementer](../../roles/implementer/ROLE.md).\n",
  "roles/implementer/ROLE.md": "# Implementer\n",
  "profiles/core.yaml": "id: core\nskills: [alpha, beta]\n",
  "profiles/autonomy.yaml": "id: autonomy\nskills: [beta]\n",
  // A source tree that cannot produce a licensed distribution is not a valid
  // fixture for any packaging test, so these are in the base rather than in the
  // one describe that reads them.
  // A case for each fixture skill, because the corpus is scoped to the skills
  // the bundle installs and a fixture carrying one skill's cases cannot show
  // that scoping happening.
  "evals/alpha/does-not-start-unasked/case.yaml": 'schema_version: "1.1"\nname: does-not-start-unasked\ntags: [negative]\n',
  "evals/beta/runs-when-asked/case.yaml": 'schema_version: "1.1"\nname: runs-when-asked\ntags: [positive]\n',
  NOTICE: "agent-kit\nCopyright (c) 2026 A Person\n\nAdapted from MIT-licensed projects.\n",
  LICENSE: "MIT License\n\nCopyright (c) 2026 A Person\n\nPermission is hereby granted, free of charge...\n",
};

function ctxFor(overrides: Record<string, string> = {}, drop: string[] = []) {
  const files = { ...BASE, ...overrides };
  for (const key of drop) delete files[key];
  const root = makeTree(files);
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

/** What this build decided, in the file beside that host's own manifest. */
function recordOf(plan: ReturnType<typeof planBundle>) {
  // Derived from the plan rather than fixed, because the record moved with the
  // manifest when the two hosts stopped sharing one. Fixed, it would have gone
  // on reading `{}` for every codex plan and every assertion on it would have
  // been an assertion about an empty object.
  const dir = plan.host === "codex" ? ".codex-plugin" : ".claude-plugin";
  return JSON.parse(plan.files.get(`${dir}/ak.json`)?.contents ?? "{}");
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

/**
 * Six donors are MIT. MIT requires the copyright notice and the permission
 * notice accompany the distribution, and `dist/` is the distribution -- so
 * these are a licensing obligation, not bundle tidiness, and a bundle without
 * them is defective however clean the rest of the build reports.
 *
 * Both host contracts specify them at the bundle root (`NOTICE, LICENSE` in
 * `adapters/claude-code/CONTRACT.md` §1 and `adapters/codex/CONTRACT.md` §2),
 * so the filenames and the placement are taken from the contract rather than
 * chosen here.
 */
describe("the licence files the distribution is obliged to carry", () => {
  test("every host's bundle carries them, byte-identical to the source tree's", () => {
    // Iterated over HOST_IDS rather than written twice. The defect this package
    // has already produced once is two host manifests disagreeing about the
    // same fact, and a test that names one host cannot see it.
    const ctx = ctxFor();
    for (const host of HOST_IDS) {
      const plan = planBundle(ctx, host, {});
      for (const name of ["NOTICE", "LICENSE"]) {
        expect(`${host}:${name}=${plan.files.get(name)?.contents}`).toBe(`${host}:${name}=${BASE[name]}`);
      }
    }
  });

  test("a tree with no LICENSE fails the build rather than shipping a distribution without one", () => {
    const plan = planBundle(ctxFor({}, ["LICENSE"]), "claude-code", {});
    const issue = plan.issues.find((i) => i.rule === "packaging.licence-file-missing" && i.file === "LICENSE");
    expect(issue?.severity).toBe("error");
  });

  test("a tree with no NOTICE fails for the same reason: the donors' notices travel with the copy", () => {
    const plan = planBundle(ctxFor({}, ["NOTICE"]), "claude-code", {});
    const issue = plan.issues.find((i) => i.rule === "packaging.licence-file-missing" && i.file === "NOTICE");
    expect(issue?.severity).toBe("error");
  });

  test("a licence file that cannot be read is absent from the bundle, never emitted empty", () => {
    // A zero-byte LICENSE would satisfy every check that asks whether the path
    // is there and satisfy the obligation not at all, which is worse than the
    // absence it replaces: absence is legible, an empty file is a forgery of
    // compliance. It matters here specifically because `writeBundles` writes
    // dist/ before its plan errors are reported -- so whatever the plan holds
    // reaches disk, and only the exit code says the build failed.
    const plan = planBundle(ctxFor({}, ["LICENSE"]), "claude-code", {});
    expect(plan.files.has("LICENSE")).toBe(false);
    expect(plan.files.has("NOTICE")).toBe(true);
  });

  test("the failure names the file that is missing, not the pair", () => {
    // Reported per file. One message covering both would leave a reader who
    // has a NOTICE and no LICENSE unable to tell which of the two to write,
    // and the fix for each is a different file.
    const plan = planBundle(ctxFor({}, ["LICENSE"]), "claude-code", {});
    const missing = plan.issues.filter((i) => i.rule === "packaging.licence-file-missing");
    expect(missing.map((i) => i.file)).toEqual(["LICENSE"]);
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

  /**
   * `plugin.json` belongs to the host, and the host checks it. `claude plugin
   * validate dist/claude-code --strict` reports `Unknown field 'ak'. Claude Code
   * ignores it at load time.` and fails, so the build's own provenance -- which
   * profile was applied, what was excluded and why -- was making the bundle
   * unshippable by the tool that decides whether it ships.
   *
   * It moves to `.claude-plugin/ak.json` beside it. The validator reads the
   * manifest, not the directory, and passes with the sibling present. The
   * assertion is on the exact key set rather than on the absence of `ak`,
   * because the next field added out of place fails this the same way.
   */
  test("plugin.json carries host keys only; the build's own record sits beside it", () => {
    const plan = planBundle(ctxFor(), "claude-code", {});
    const manifest = JSON.parse(plan.files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
    expect(Object.keys(manifest)).toEqual(["name", "version", "description", "author", "license", "skills", "experimental"]);

    const record = JSON.parse(plan.files.get(".claude-plugin/ak.json")?.contents ?? "{}");
    expect(Object.keys(record).sort()).toEqual(["autonomy_rejected", "excluded", "host", "modes", "profile"]);
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

  /**
   * `package.default_profile` is the only statement in the tree about what a
   * plain `ak build` installs: catalog.yaml calls core "the default install" and
   * profiles/core.yaml repeats it. A build that names no profile must therefore
   * apply that one.
   *
   * The fixture has to carry a skill outside the default for any of this to be
   * visible. In the real catalog every authored skill happens to be in `core`,
   * so selecting all skills and selecting core's members return the same bundle
   * and the disagreement leaves no trace in the artifact -- it waits on the next
   * skill to be authored outside core.
   */
  describe("a build that names no profile", () => {
    const gamma = {
      "catalog.yaml": CATALOG.replace(
        "protocols:",
        "  - id: gamma\n    status: authored\n    invocation: M\n    profiles: [autonomy]\nprotocols:",
      ),
      "skills/gamma/SKILL.md": `${HEAD("gamma")}\nPlain body.\n`,
      "profiles/autonomy.yaml": "id: autonomy\nskills: [beta, gamma]\n",
    };

    test("installs the catalog's default profile, not every skill in the catalog", () => {
      const plan = planBundle(ctxFor(gamma), "claude-code", {});
      const manifest = JSON.parse(plan.files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
      expect(manifest.skills).toEqual(["./skills/alpha", "./skills/beta"]);
      expect([...plan.files.keys()]).not.toContain("skills/gamma/SKILL.md");
    });

    test("records the profile it applied, so the bundle does not have to be re-derived to know", () => {
      const plan = planBundle(ctxFor(gamma), "claude-code", {});
      expect(recordOf(plan).profile).toBe("core");
      expect(plan.profile).toBe("core");
    });

    test("a default naming no declared profile installs everything rather than nothing", () => {
      // Found by fixture 04-broken-link-bundle, which declares `default_profile:
      // core` and no `profiles:` section at all. Honoring that default emptied
      // the bundle, and an empty bundle has no links, so `links.broken-bundle`
      // stopped reporting the defect the fixture exists to demonstrate. One bad
      // field silenced an unrelated check. The complaint about the field belongs
      // to `catalog.exactly-one-default-profile-matching-package-default-profile`
      // and is left there.
      const plan = planBundle(
        ctxFor({ ...gamma, "catalog.yaml": gamma["catalog.yaml"].replace(/^profiles:\n(?:  .*\n)+/m, "") }),
        "claude-code",
        {},
      );
      const manifest = JSON.parse(plan.files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
      expect(manifest.skills).toEqual(["./skills/alpha", "./skills/beta", "./skills/gamma"]);
      expect(recordOf(plan).profile).toBe("all");
      expect(plan.issues.some((i) => i.rule === "packaging.unknown-profile")).toBe(false);
    });

    test("a catalog declaring no default still installs everything, and says so", () => {
      // The boundary: the fallback is guarded on a default being declared, not
      // applied unconditionally. Without this, a catalog with no default would
      // resolve to the empty string and select nothing.
      const plan = planBundle(ctxFor({ ...gamma, "catalog.yaml": gamma["catalog.yaml"].replace("  default_profile: core\n", "") }), "claude-code", {});
      const manifest = JSON.parse(plan.files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
      expect(manifest.skills).toEqual(["./skills/alpha", "./skills/beta", "./skills/gamma"]);
      expect(recordOf(plan).profile).toBe("all");
    });
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
 * Identity the manifests are obliged to carry, from the one place that states it.
 *
 * `adapters/claude-code/CONTRACT.md` §1 specifies both values literally:
 * `"author": { "name": "agent-kit maintainers" }` at :38 and `"license": "MIT"`
 * at :39. Neither is invented here and neither is written into the packager --
 * they come from `catalog.yaml`'s `package:` block, which AGENTS.md calls the
 * single source of truth, so the two manifests cannot drift apart or drift from
 * the catalog.
 *
 * `adapters/codex/CONTRACT.md` §5.2 is why absence is an error rather than an
 * omission: `name`, `version`, `description` and `license` must agree across
 * `package.json` and both manifests, and the donor this was adapted from treats
 * that disagreement as release-blocking rather than a lint. A manifest with no
 * `license` key does not disagree with anything -- it removes the field the
 * check compares, which is the quieter way to pass.
 */
describe("the identity fields the manifests are obliged to carry", () => {
  test("both manifests carry the author and licence the contract specifies", () => {
    const ctx = ctxFor();
    for (const [host, path] of [
      ["claude-code", ".claude-plugin/plugin.json"],
      ["codex", ".codex-plugin/plugin.json"],
    ] as const) {
      const manifest = JSON.parse(planBundle(ctx, host, {}).files.get(path)?.contents ?? "{}");
      expect(`${host}:${JSON.stringify(manifest.author)}`).toBe(`${host}:{"name":"agent-kit maintainers"}`);
      expect(`${host}:${manifest.license}`).toBe(`${host}:MIT`);
    }
  });

  test("the values are read from the catalog, not written into the packager", () => {
    // The whole point of putting them in `package:` is that one edit moves both
    // manifests. Asserting the contract's own strings only would pass equally
    // well over a packager with those strings hardcoded, which is the shape
    // that cannot be kept in agreement with anything.
    const ctx = ctxFor({
      "catalog.yaml": CATALOG.replace("author: agent-kit maintainers", "author: someone else").replace("license: MIT", "license: Apache-2.0"),
    });
    const manifest = JSON.parse(planBundle(ctx, "codex", {}).files.get(".codex-plugin/plugin.json")?.contents ?? "{}");
    expect(manifest.author).toEqual({ name: "someone else" });
    expect(manifest.license).toBe("Apache-2.0");
  });

  test("a catalog with no author fails the build rather than shipping a manifest without one", () => {
    const ctx = ctxFor({ "catalog.yaml": CATALOG.replace("  author: agent-kit maintainers\n", "") });
    const plan = planBundle(ctx, "claude-code", {});
    const issue = plan.issues.find((i) => i.rule === "packaging.manifest-identity-missing" && i.message.includes("author"));
    expect(issue?.severity).toBe("error");
  });

  test("a catalog with no license fails the same way, and the two are reported separately", () => {
    // Separately, because the fix for each is a different line and a reader
    // with one of the two needs to know which one they are missing.
    const ctx = ctxFor({ "catalog.yaml": CATALOG.replace("  license: MIT\n", "") });
    const missing = planBundle(ctx, "claude-code", {}).issues.filter(
      (i) => i.rule === "packaging.manifest-identity-missing",
    );
    expect(missing.length).toBe(1);
    expect(missing[0]?.message).toContain("license");
  });

  test("an absent field is left out of the manifest rather than emitted empty", () => {
    // Same reasoning as the licence files: `writeBundles` writes dist/ before
    // its plan errors are reported, so whatever the plan holds reaches disk.
    // `"license": ""` would satisfy a check that asks whether the key is there
    // and satisfy §5.2's comparison not at all -- it would disagree with
    // package.json while looking like a field someone had filled in.
    //
    // Both fields, because they are emitted by two separately guarded lines and
    // a test that drops one of them reports clean over the other losing its
    // guard. Measured, not assumed: the licence-only version of this test
    // survived a mutant that emitted `"author": { "name": "" }` for an absent
    // author. The surviving field is asserted too, so "omit the one that is
    // missing" cannot pass as "omit both".
    for (const [field, line, other] of [
      ["license", "  license: MIT\n", "author"],
      ["author", "  author: agent-kit maintainers\n", "license"],
    ] as const) {
      const ctx = ctxFor({ "catalog.yaml": CATALOG.replace(line, "") });
      const manifest = JSON.parse(planBundle(ctx, "claude-code", {}).files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
      expect(`no ${field}: ${field in manifest}`).toBe(`no ${field}: false`);
      expect(`kept ${other}: ${other in manifest}`).toBe(`kept ${other}: true`);
    }
  });

  test("a field declared blank is a failure, not a value", () => {
    // The other direction onto the same defect. `author: ""` parses, loads, and
    // is a string, so it arrives at the packager indistinguishable from a field
    // someone filled in -- `loadCatalog` runs no schema validation, so
    // `minLength: 1` in the catalog schema does not stand between this value
    // and the manifest. A check that asks only whether the field is defined
    // accepts it and ships `"author": { "name": "" }`.
    //
    // Both halves are asserted because they are two decisions: the build has to
    // report it, and the manifest has to leave the key out. Reporting an error
    // while writing the blank anyway is what a separate predicate in the check
    // and at the emit site produces.
    const ctx = ctxFor({ "catalog.yaml": CATALOG.replace("author: agent-kit maintainers", 'author: ""') });
    const plan = planBundle(ctx, "claude-code", {});
    const issue = plan.issues.find((i) => i.rule === "packaging.manifest-identity-missing" && i.message.includes("author"));
    expect(issue?.severity).toBe("error");
    const manifest = JSON.parse(plan.files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
    expect("author" in manifest).toBe(false);
  });
});

/**
 * The four fields §5.2 makes `package.json` and both host manifests agree on.
 *
 * `adapters/codex/CONTRACT.md` §5.2 names them -- `name`, `version`,
 * `description`, `license` -- and cites the donor's own release check,
 * `compound-engineering@05c42da:src/release/components.ts`, as what it was
 * adapted from. Read at that pin rather than recalled: `loadCurrentVersions()`
 * compares `version` and nothing else across `package.json` and five host
 * manifests. The other three are this contract's extension of it, so they are
 * asserted here one at a time rather than assumed to have arrived with the
 * adaptation.
 *
 * Measured against the object the bundle emits, not against the catalog the
 * object was built from. Re-derived from the catalog, the check and the emit
 * would be two readings of one source: they agree with each other whatever the
 * manifest says, which is an instrument returning the same answer under both
 * hypotheses.
 */
describe("the four fields package.json and the host manifests have to agree on", () => {
  /** A package.json built from the agreeing one, with fields changed or dropped. */
  const PKG = (over: Record<string, unknown> = {}, drop: ReadonlyArray<string> = []) => {
    const doc = { ...PACKAGE_JSON, ...over };
    for (const key of drop) delete doc[key];
    return { "package.json": packageJson(doc) };
  };

  const parity = (plan: ReturnType<typeof planBundle>) => plan.issues.filter((i) => i.rule === "packaging.manifest-parity");
  const blocked = (plan: ReturnType<typeof planBundle>) =>
    plan.issues.filter((i) => i.rule === "packaging.manifest-parity-unavailable");

  test("a tree whose two sides agree reports nothing, for either host", () => {
    const ctx = ctxFor();
    for (const host of HOST_IDS) {
      expect(`${host}: ${parity(planBundle(ctx, host, {})).length}`).toBe(`${host}: 0`);
      expect(`${host}: ${blocked(planBundle(ctx, host, {})).length}`).toBe(`${host}: 0`);
    }
  });

  test("each of the four is compared, and the row names the field and both values", () => {
    // Each one alone, and all four of them. The donor check this was adapted
    // from compares `version` only; a check that kept that scope while carrying
    // the wider contract's wording passes any test that perturbs the version
    // and reports nothing about the other three.
    for (const [field, wrong] of [
      ["name", "agent-kit"],
      ["version", "0.0.0"],
      ["description", "One engineering lifecycle."],
      ["license", "Apache-2.0"],
    ] as const) {
      const rows = parity(planBundle(ctxFor(PKG({ [field]: wrong })), "claude-code", {}));
      expect(`${field}: ${rows.length}`).toBe(`${field}: 1`);
      expect(`${field}: ${rows[0]?.severity}`).toBe(`${field}: error`);
      expect(`${field}: ${rows[0]?.file}`).toBe(`${field}: package.json`);
      expect(rows[0]?.message).toContain(field);
      expect(rows[0]?.message).toContain(wrong);
      expect(rows[0]?.message).toContain(String(PACKAGE_JSON[field]));
    }
  });

  test("the identity compared is the tree's, so a check written against this repo's own strings fails here", () => {
    // All four different on both sides at once. A comparison hardcoded to `ak`
    // and `MIT` -- the strings this repo uses, and the strings the fixture above
    // repeats -- passes the agreeing case and passes each single perturbation
    // by reporting the field it was handed. It cannot pass this one.
    //
    // It also pins which catalog field feeds which manifest key: `description`
    // comes from `package.name` and `name` from `package.id`, and a check
    // reading the obvious namesake instead would report two disagreements here.
    const ctx = ctxFor({
      "catalog.yaml": CATALOG.replace("id: ak", "id: zzz")
        .replace("name: agent-kit", "name: Some Other Thing")
        .replace("version: 0.1.0", "version: 9.9.9")
        .replace("license: MIT", "license: Apache-2.0"),
      ...PKG({ name: "zzz", version: "9.9.9", description: "Some Other Thing", license: "Apache-2.0" }),
    });
    const plan = planBundle(ctx, "claude-code", {});
    expect(parity(plan)).toEqual([]);
    expect(blocked(plan)).toEqual([]);
    // The manifest side asserted too, and not only the verdict. "No
    // disagreement" is also what a check that compared nothing reports, and
    // this fixture is the only one in the file where the manifest's four values
    // are none of the strings the rest of the file repeats -- so it is the one
    // place that can say the values came from this tree's catalog by the route
    // `PARITY_FIELDS` claims they do.
    const manifest = JSON.parse(plan.files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
    expect([manifest.name, manifest.version, manifest.description, manifest.license]).toEqual([
      "zzz",
      "9.9.9",
      "Some Other Thing",
      "Apache-2.0",
    ]);
  });

  test("a field package.json does not state is unavailable, not agreement by default", () => {
    // The authority went missing, not the subject: the manifest carries a
    // licence and there is nothing to measure it against. `unavailable` rather
    // than a note, because `report()` exits non-zero on a blocking skip and on
    // nothing else that is not an error -- absent the flag, a package.json
    // with three of the four fields builds green over a field nobody compared.
    const plan = planBundle(ctxFor(PKG({}, ["license"])), "claude-code", {});
    const rows = blocked(plan);
    expect(rows.length).toBe(1);
    expect(rows[0]?.blocking).toBe(true);
    expect(rows[0]?.skipped).toBe("manifest parity");
    expect(rows[0]?.file).toBe("package.json");
    expect(rows[0]?.message).toContain("license");
    // The other three still compared: one absent field does not stand the whole
    // check down.
    expect(parity(plan)).toEqual([]);
  });

  test("a field the catalog does not declare disagrees with a package.json that states it", () => {
    // The manifest side of the same comparison. `checkManifestIdentity` reports
    // the catalog's silence; this reports what that silence does to §5.2 -- the
    // bundle ships with no `license` key and package.json says MIT, which is a
    // disagreement and not an absence. Both rows are expected: they name
    // different files and different edits.
    const plan = planBundle(ctxFor({ "catalog.yaml": CATALOG.replace("  license: MIT\n", "") }), "claude-code", {});
    const rows = parity(plan);
    expect(rows.length).toBe(1);
    expect(rows[0]?.severity).toBe("error");
    expect(rows[0]?.message).toContain("license");
    expect(plan.issues.some((i) => i.rule === "packaging.manifest-identity-missing")).toBe(true);
  });

  test("no package.json at all blocks the build rather than passing quietly", () => {
    const plan = planBundle(ctxFor({}, ["package.json"]), "claude-code", {});
    const rows = blocked(plan);
    expect(rows.length).toBe(1);
    expect(rows[0]?.blocking).toBe(true);
    expect(rows[0]?.skipped).toBe("manifest parity");
    // One row about the file, not four about its fields: nothing was read, so
    // there is one thing to say.
    expect(parity(plan)).toEqual([]);
  });

  test("a package.json that is not a JSON object blocks the same way, rather than reading as empty", () => {
    // The quieter half. `JSON.parse` throwing and being caught into `{}` makes
    // every field missing, and four unavailable rows about a file sitting right
    // there in the tree is a report nobody can act on. A document that parses
    // to an array or a string is the same case: it is not a package manifest.
    for (const text of ["{ not json\n", "[]\n", '"agent-kit"\n']) {
      const plan = planBundle(ctxFor({ "package.json": text }), "claude-code", {});
      expect(`${JSON.stringify(text)}: ${blocked(plan).length}`).toBe(`${JSON.stringify(text)}: 1`);
      expect(blocked(plan)[0]?.blocking).toBe(true);
      expect(parity(plan)).toEqual([]);
    }
  });

  test("one disagreement is one row, not one row per bundle", () => {
    // Both manifests are built from the same catalog fields, so the same field
    // disagrees in both plans. The row names `package.json` -- one of the two
    // files a reader can actually edit, the manifests being generated -- so the
    // two are identical and `collapseDuplicates` in build.ts merges them. Named
    // for the generated manifest they would not be, and a four-field skew would
    // reach the reader as eight failures.
    const rows = checkBundles(ctxFor(PKG({ version: "0.0.0" })), {}).filter((i) => i.rule === "packaging.manifest-parity");
    expect(rows.length).toBe(1);
    expect(rows[0]?.file).toBe("package.json");
  });
});

/**
 * The marketplace entry, which only one of the two bundles carries.
 *
 * `adapters/claude-code/CONTRACT.md` §1 puts `.claude-plugin/marketplace.json`
 * in that bundle's shape; `adapters/codex/CONTRACT.md` §2 does not list it in
 * the codex bundle at all, and that host installs through
 * `codex plugin marketplace add <path>` (§4) rather than from a file of this
 * name. So its presence is a third place the bundles are contractually
 * different, and it is asserted as a difference rather than assumed.
 *
 * The shape is taken from the donor the contract cites,
 * `compound-engineering@05c42da:.claude-plugin/marketplace.json`, read at the
 * pin rather than remembered. Every field this package emits has a value the
 * tree already states. The donor's `homepage`, `tags` and
 * `metadata.description` are omitted because this tree states no value for
 * them, and a plausible-looking invented one is the failure mode this package
 * has already produced once.
 */
describe("the marketplace entry the claude-code bundle carries", () => {
  const marketplaceIn = (plan: ReturnType<typeof planBundle>) =>
    JSON.parse(plan.files.get(".claude-plugin/marketplace.json")?.contents ?? "{}");

  test("the claude-code bundle carries it and the codex bundle does not", () => {
    const ctx = ctxFor();
    expect(planBundle(ctx, "claude-code", {}).files.has(".claude-plugin/marketplace.json")).toBe(true);
    expect([...planBundle(ctx, "codex", {}).files.keys()].filter((p) => p.endsWith("marketplace.json"))).toEqual([]);
  });

  test("it lists exactly one plugin, sourced from the bundle root", () => {
    // "one entry, source ./" is the whole of what
    // `adapters/claude-code/CONTRACT.md` §1 says about it, so both halves are
    // asserted. A second entry would point the host at something this bundle
    // does not contain.
    const entries = marketplaceIn(planBundle(ctxFor(), "claude-code", {})).plugins;
    expect(entries.length).toBe(1);
    expect(entries[0].source).toBe("./");
    expect(entries[0].name).toBe("ak");
  });

  test("its identity comes from the same catalog fields the manifest uses", () => {
    // One source, so the marketplace entry cannot describe a different package
    // than the manifest beside it. Compared against the manifest rather than
    // against literals: literals would pass while the two files drifted apart,
    // which is the defect this pairing exists to prevent.
    //
    // Over a catalog that states none of the real values, because comparing two
    // files built from a fixture carrying the contract's own strings passes
    // just as well when one of them holds a hardcoded copy of those strings. A
    // mutant that set `owner` to the literal "agent-kit maintainers" survived
    // the version of this test that used the unmodified fixture: the literal
    // equalled the manifest's author, and the comparison could not see it.
    const ctx = ctxFor({
      "catalog.yaml": CATALOG.replace("author: agent-kit maintainers", "author: someone else")
        .replace("  version: 0.1.0\n", "  version: 9.9.9\n")
        .replace("  id: ak\n", "  id: not-ak\n"),
    });
    const plan = planBundle(ctx, "claude-code", {});
    const manifest = JSON.parse(plan.files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
    const market = marketplaceIn(plan);
    expect(market.owner).toEqual(manifest.author);
    expect(market.plugins[0].author).toEqual(manifest.author);
    expect(market.metadata.version).toBe(manifest.version);
    expect(market.plugins[0].name).toBe(manifest.name);
  });

  test("it carries no field this tree has no value for", () => {
    // The donor carries `homepage`, `tags` and a `metadata.description`. This
    // tree states none of them, and emitting a plausible one is how a manifest
    // ends up asserting something nobody checked. Absence is the honest answer
    // until a value exists, and this test is what stops one being invented
    // later without a source.
    const market = marketplaceIn(planBundle(ctxFor(), "claude-code", {}));
    expect("homepage" in market.plugins[0]).toBe(false);
    expect("tags" in market.plugins[0]).toBe(false);
    expect("description" in market.metadata).toBe(false);
  });

  test("a catalog with no usable author fails rather than shipping an unowned marketplace", () => {
    // `owner` is an ownership claim in a distributed file. With no author
    // declared there is nothing to derive it from, and an empty owner is worse
    // than a failed build.
    //
    // Blank as well as absent, at this emit site and not only at the manifest's:
    // they are two guarded lines, and `{ "name": "" }` in a file that says who
    // owns a published plugin is the shape that looks answered and is not.
    for (const catalog of [
      CATALOG.replace("  author: agent-kit maintainers\n", ""),
      CATALOG.replace("author: agent-kit maintainers", 'author: ""'),
    ]) {
      const plan = planBundle(ctxFor({ "catalog.yaml": catalog }), "claude-code", {});
      expect(plan.issues.some((i) => i.rule === "packaging.manifest-identity-missing")).toBe(true);
      const market = marketplaceIn(plan);
      expect("owner" in market).toBe(false);
      expect("author" in market.plugins[0]).toBe(false);
    }
  });
});

/**
 * The eval corpus, and the manifest key that points at it.
 *
 * One item, because they are one claim. `experimental.evals` tells the host
 * where the cases are; the cases are what makes the claim true. Shipping the
 * key over a bundle with no corpus points the host at a directory that is not
 * there, and shipping the corpus without the key leaves
 * `claude plugin eval dist/claude-code` (`adapters/claude-code/CONTRACT.md`
 * §5, the command at :166) with nothing to find. Either half alone is a
 * bundle that looks evaluable and is not.
 *
 * claude-code only, and that is the fourth place the two bundles differ on
 * purpose. §1's tree lists `evals/<id>/<case>/case.yaml` and its manifest
 * example carries `"experimental": { "evals": "evals" }`;
 * `adapters/codex/CONTRACT.md` §2's tree lists neither, and §3's capability
 * table records **None verified** for a bundled eval runner on that host. §5
 * closes the question outright: "the behavioral corpus is executed against the
 * claude-code bundle", and results for codex alone are `not-run` rather than
 * inferred from the claude-code run.
 *
 * Scoped to the skills the bundle installs, not copied wholesale. The install
 * set is profile-dependent, and `evals/` holds cases for skills core
 * deliberately excludes -- `profiles/core.yaml`'s `deliberately_excludes`
 * names `babysit-pr` and `ultraqa`, both of which have cases in the tree. A
 * wholesale copy would put cases for uninstalled skills in front of a runner
 * invoked with `--threshold 1.0`, where a case for a skill that is not there
 * cannot pass.
 */
describe("the eval corpus the claude-code bundle carries", () => {
  const casesIn = (plan: ReturnType<typeof planBundle>) =>
    [...plan.files.keys()].filter((p) => p.startsWith("evals/")).sort();

  const experimentalIn = (plan: ReturnType<typeof planBundle>, path: string) =>
    JSON.parse(plan.files.get(path)?.contents ?? "{}").experimental;

  test("the claude-code bundle carries the corpus and the codex bundle carries none of it", () => {
    const ctx = ctxFor();
    expect(casesIn(planBundle(ctx, "claude-code", {}))).toEqual([
      "evals/alpha/does-not-start-unasked/case.yaml",
      "evals/beta/runs-when-asked/case.yaml",
    ]);
    expect(casesIn(planBundle(ctx, "codex", {}))).toEqual([]);
  });

  test("only the skills the bundle installs bring their cases", () => {
    // `autonomy` holds beta alone, so alpha's case must not travel. Asserted as
    // the whole corpus rather than as alpha's absence: "the excluded skill's
    // cases are gone" also passes over a bundle that dropped every case.
    const plan = planBundle(ctxFor(), "claude-code", { profile: "autonomy" });
    expect(casesIn(plan)).toEqual(["evals/beta/runs-when-asked/case.yaml"]);
  });

  test("the manifest points at the directory the cases are actually in", () => {
    // The key and the paths come from one constant, so this compares the
    // manifest against the bundle rather than against the string "evals". A
    // literal on both sides agrees with itself while pointing at nothing.
    const plan = planBundle(ctxFor(), "claude-code", {});
    const dir = experimentalIn(plan, ".claude-plugin/plugin.json").evals;
    expect(typeof dir).toBe("string");
    expect(casesIn(plan).every((p) => p.startsWith(`${dir}/`))).toBe(true);
  });

  test("the codex manifest claims no corpus, because that bundle has none", () => {
    const manifest = JSON.parse(
      planBundle(ctxFor(), "codex", {}).files.get(".codex-plugin/plugin.json")?.contents ?? "{}",
    );
    expect("experimental" in manifest).toBe(false);
  });

  test("a case travels verbatim", () => {
    // Cases are graded input, not prose the packager owns: a rewritten path or
    // a normalised quote changes what the eval asks. Nothing in the packager
    // rewrites YAML today, and this is what says so if something starts to.
    const plan = planBundle(ctxFor(), "claude-code", {});
    expect(plan.files.get("evals/alpha/does-not-start-unasked/case.yaml")?.contents).toBe(
      BASE["evals/alpha/does-not-start-unasked/case.yaml"],
    );
  });

  test("a bundle with no cases does not claim a corpus it does not carry", () => {
    // The manifest key is a pointer, and §1 already makes a manifest pointing
    // at something the bundle does not contain a build failure for `skills`.
    // Reported rather than silently dropped: a bundle that quietly stops being
    // evaluable is the same fails-open shape as a check that cannot fail.
    const ctx = ctxFor({}, ["evals/alpha/does-not-start-unasked/case.yaml", "evals/beta/runs-when-asked/case.yaml"]);
    const plan = planBundle(ctx, "claude-code", {});
    const issue = plan.issues.find((i) => i.rule === "packaging.eval-corpus-missing");
    expect(issue?.severity).toBe("error");
    expect(casesIn(plan)).toEqual([]);
    // Both halves withheld together. Reporting the error while still writing
    // the key would leave the pointer on disk -- `writeBundles` writes before
    // the plan's errors are read -- pointing at a directory that is not there.
    expect(experimentalIn(plan, ".claude-plugin/plugin.json")).toBeUndefined();
  });

  test("a bundle that installs nothing claims nothing, and that is not an error", () => {
    // A profile can narrow to no skills at all, and an empty bundle with no
    // corpus is consistent rather than defective: there is nothing to evaluate
    // and it says so by carrying neither half. The error is for the bundle that
    // installs skills and has no cases for any of them, which is the state that
    // silently stops being evaluable.
    const ctx = ctxFor({ "profiles/autonomy.yaml": "id: autonomy\nskills: []\n" });
    const plan = planBundle(ctx, "claude-code", { profile: "autonomy" });
    expect(plan.issues.some((i) => i.rule === "packaging.eval-corpus-missing")).toBe(false);
    expect(experimentalIn(plan, ".claude-plugin/plugin.json")).toBeUndefined();
  });
});

/**
 * The two bundles are meant to differ, and the contracts say exactly where.
 *
 * This is the comparison whose absence let a decorative second adapter report
 * clean indefinitely. `ak build` was emitting one bundle under two names: the
 * manifest path was a single constant, so `dist/codex` carried
 * `.claude-plugin/plugin.json` -- the other host's directory -- and no check
 * looked at two bundles at once to notice. Every assertion in this file named
 * `claude-code`, and a test that names one host cannot see two hosts agreeing
 * where they are supposed to disagree.
 *
 * Where they differ, taken from the contracts rather than decided here:
 *   - the manifest path, `adapters/codex/CONTRACT.md` §2 against
 *     `adapters/claude-code/CONTRACT.md` §1
 *   - the skill registration: codex takes a directory pointer
 *     (`adapters/codex/CONTRACT.md` §1, the donor table row for
 *     `.codex-plugin/plugin.json`), claude-code enumerates every path because
 *     its install set is profile-dependent and the manifest is the one place
 *     that states what the bundle actually contains
 *     (`adapters/claude-code/CONTRACT.md` §1)
 *
 * Where they must agree, same authority: the identity fields
 * (`adapters/codex/CONTRACT.md` §5.2, adapted from the donor's own release
 * check, which treats manifest drift as release-blocking rather than a lint)
 * and the installed skill set itself (§1: "Divergence between the two bundles
 * is a build failure, not a host difference").
 *
 * Both halves are here on purpose. A test that only proves they differ passes
 * just as well over two bundles that have drifted apart in every other field,
 * and a test that only proves they agree is what the single shared constant
 * already satisfied.
 */
describe("the two host bundles, compared", () => {
  /** Both plans from one source tree, so every difference is the packager's doing. */
  function bundles() {
    const ctx = ctxFor();
    return { claude: planBundle(ctx, "claude-code", {}), codex: planBundle(ctx, "codex", {}) };
  }

  const manifestIn = (plan: ReturnType<typeof planBundle>, path: string) =>
    JSON.parse(plan.files.get(path)?.contents ?? "{}");

  const skillIdsIn = (plan: ReturnType<typeof planBundle>) =>
    [...new Set([...plan.files.keys()].flatMap((p) => /^skills\/([^/]+)\//.exec(p)?.[1] ?? []))].sort();

  test("each bundle carries its own host's manifest", () => {
    const { claude, codex } = bundles();
    expect(claude.files.has(".claude-plugin/plugin.json")).toBe(true);
    expect(codex.files.has(".codex-plugin/plugin.json")).toBe(true);
  });

  test("neither bundle carries anything at all from the other host's directory", () => {
    // Asserted over every path rather than over the two manifest names, because
    // the build record sits in the same directory and had to move with it. A
    // check written against `plugin.json` alone would report clean over a codex
    // bundle still shipping `.claude-plugin/ak.json`, which is the same defect
    // one file further down.
    const { claude, codex } = bundles();
    expect([...codex.files.keys()].filter((p) => p.startsWith(".claude-plugin/"))).toEqual([]);
    expect([...claude.files.keys()].filter((p) => p.startsWith(".codex-plugin/"))).toEqual([]);
  });

  test("codex registers the skills directory; claude-code enumerates the paths", () => {
    const { claude, codex } = bundles();
    expect(manifestIn(claude, ".claude-plugin/plugin.json").skills).toEqual(["./skills/alpha", "./skills/beta"]);
    expect(manifestIn(codex, ".codex-plugin/plugin.json").skills).toBe("./skills/");
  });

  test("the two manifests agree on every identity field they both carry", () => {
    // Compared as whole objects with the one key the contracts say differs
    // removed, rather than against a list of field names written here. A field
    // added to one manifest and not the other fails this immediately; a list
    // would have to be remembered, and the thing being guarded against is
    // exactly the edit nobody remembers to mirror.
    //
    // A key that is genuinely host-specific -- `experimental.evals`, which
    // `adapters/claude-code/CONTRACT.md` §1 gives to that host alone -- must be
    // added to this exclusion when it lands, and that is the point: it makes
    // whoever adds it say out loud that it belongs to one host.
    //
    // It has landed, and this is that saying-out-loud. `experimental` is
    // excluded from claude-code's side and *not* from codex's: if codex ever
    // grows the key, it stays in `codexIdentity` and fails here, which is the
    // asymmetry the exclusion is allowed to have. That codex carries no such
    // key today is asserted positively in the eval-corpus describe, not left
    // to this subtraction.
    const { claude, codex } = bundles();
    const { skills: _enumerated, experimental: _corpus, ...claudeIdentity } = manifestIn(claude, ".claude-plugin/plugin.json");
    const { skills: _pointer, ...codexIdentity } = manifestIn(codex, ".codex-plugin/plugin.json");
    expect(Object.keys(claudeIdentity).length).toBeGreaterThan(0);
    expect(codexIdentity).toEqual(claudeIdentity);
  });

  test("the two bundles install the same skills, whatever form each manifest states it in", () => {
    // `adapters/codex/CONTRACT.md` §1: "Divergence between the two bundles is a
    // build failure, not a host difference." Compared through the bundles' own
    // skill trees rather than through the manifests, because a directory
    // pointer states no set at all -- reading the two manifests against each
    // other here would be comparing a list to a string and calling it agreement.
    //
    // The second assertion is a positive control. Two empty bundles have equal
    // skill sets, and without a figure this test would report agreement most
    // loudly at the moment both bundles had stopped containing anything.
    const { claude, codex } = bundles();
    expect(skillIdsIn(codex)).toEqual(skillIdsIn(claude));
    expect(skillIdsIn(claude)).toEqual(["alpha", "beta"]);
  });

  test("the same skill body reaches both bundles; only the generated frontmatter differs", () => {
    // Contract §5.1, bundle parity. The canonical tree is host-neutral, which is
    // the whole reason host keys are generated rather than written, so a body
    // that differs between bundles means something edited content on the way to
    // one host.
    const { claude, codex } = bundles();
    const bodyOf = (plan: ReturnType<typeof planBundle>, id: string) =>
      (plan.files.get(`skills/${id}/SKILL.md`)?.contents ?? "").replace(/^---\n[\s\S]*?\n---\n/, "");
    for (const id of ["alpha", "beta"]) {
      expect(bodyOf(claude, id)).not.toBe("");
      expect(`${id}:${bodyOf(codex, id)}`).toBe(`${id}:${bodyOf(claude, id)}`);
    }
    // And the frontmatter genuinely is generated per host, so the equality above
    // is a statement about bodies rather than about two identical files.
    const claudeAlpha = claude.files.get("skills/alpha/SKILL.md")?.contents ?? "";
    expect(claudeAlpha).toContain("disable-model-invocation");
    expect(codex.files.get("skills/alpha/SKILL.md")?.contents ?? "").not.toContain("disable-model-invocation");
  });

  /**
   * Contract §5, test 3, which this adapter owns and did not have: "the codex
   * bundle contains no `disable-model-invocation` and no `allowed-tools`; the
   * claude-code bundle contains both where required. A key from one host's set
   * appearing in the other's bundle is a failure."
   *
   * It was failing in the direction that leaves no trace. Both keys were
   * reaching the codex bundle, because `generateHostFrontmatter` took no host
   * argument at all -- the function that generates host frontmatter could not
   * tell the hosts apart, so it answered the same under both.
   *
   * Removing them subtracts no protection. §3 records that codex has no
   * verified equivalent for either, so neither key was ever honored there; what
   * the codex bundle loses is a claim, not an enforcement. The restraint that
   * does the work on that host is §3.1's description clause, which this package
   * does not generate yet.
   */
  test("neither host's own frontmatter keys leak into the other host's bundle", () => {
    const { claude, codex } = bundles();
    const alphaIn = (plan: ReturnType<typeof planBundle>) => plan.files.get("skills/alpha/SKILL.md")?.contents ?? "";

    // alpha is a U skill declaring allowed_tools, so claude-code is where both
    // keys are required. Asserted, not assumed: absent from codex means nothing
    // if the fixture never produced them anywhere.
    expect(alphaIn(claude)).toContain("disable-model-invocation: true");
    expect(alphaIn(claude)).toContain("allowed-tools:");

    for (const leaked of ["disable-model-invocation", "allowed-tools"]) {
      expect(`codex carries ${leaked}: ${alphaIn(codex).includes(leaked)}`).toBe(`codex carries ${leaked}: false`);
    }

    // argument-hint is on both lists on purpose. §3's table names exactly two
    // differences and §5's leaked-key test names the same two, so removing a
    // third key would be this package inventing a host difference the contract
    // does not state.
    expect(alphaIn(codex)).toContain("argument-hint: <ticket>");
  });

  test("each bundle's build record sits beside its own host's manifest and names that host", () => {
    const { claude, codex } = bundles();
    expect(claude.files.has(".claude-plugin/ak.json")).toBe(true);
    expect(codex.files.has(".codex-plugin/ak.json")).toBe(true);
    // `host` in the record is the whole capability declaration, not a name, so
    // the id is reached through it. Asserted on both so a record written into
    // the right directory for the wrong host still fails: the path and the
    // contents are two separate claims and only one of them is a filename.
    expect(recordOf(codex).host.id).toBe("codex");
    expect(recordOf(claude).host.id).toBe("claude-code");
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
 * exists to prevent. So the exclusion is recorded in `.claude-plugin/ak.json`,
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

  test("the build record names every exclusion and its reason", () => {
    const plan = planBundle(ctxFor(WITH_CONTRACT), "claude-code", {});
    const manifest = JSON.parse(plan.files.get(".claude-plugin/plugin.json")?.contents ?? "{}");
    expect(manifest.skills).toEqual(["./skills/alpha", "./skills/beta"]);
    expect(recordOf(plan).excluded).toEqual([{ skill: "gamma", reason: "status: contract" }]);
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

  test("the file the note sends you to is the file the exclusion is written to", () => {
    // This drifted once. The note kept naming `plugin.json` after the build
    // record moved to `ak.json`, so it sent the reader to a file that no longer
    // held what it promised -- and nothing failed, because every assertion on
    // this note was about its severity and its skill list.
    //
    // The filename is taken out of the message and used to look the file up,
    // rather than compared against a second copy of the name written here. A
    // literal would have passed through the move that broke this, since both
    // sides of it would have been edited together or neither.
    const plan = planBundle(ctxFor(WITH_CONTRACT), "claude-code", {});
    const note = plan.issues.find((i) => i.rule === "packaging.excluded-unauthored");
    const named = /recorded in (\S+?)\.\s*$/.exec(note?.message ?? "")?.[1];
    expect(named).toBeDefined();
    expect(note?.file).toBe(named);
    const written = JSON.parse(plan.files.get(named ?? "")?.contents ?? "{}");
    expect(written.excluded).toEqual([{ skill: "gamma", reason: "status: contract" }]);
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

/**
 * The mode each skill runs in on the host it is being packaged for.
 *
 * `packaging.hosts[]` is where a skill.yaml states it, one row per adapter, and
 * it is the only legal place: `schemas/skill.schema.json` sets
 * `additionalProperties: false`, so the `autonomy:` block the packager used to
 * read cannot appear in a skill.yaml that passes `ak validate` -- appending one
 * to a real skill reports `schemas.document-invalid`, "(root) must NOT have
 * additional properties {"additionalProperty":"autonomy"}". It never appeared
 * in one. Every skill in every bundle came out `mode: manual` regardless of
 * what it declared, and `autonomy_unenforceable` was never emitted at all.
 *
 * Four tests stood here and passed over that, because the fixture invented the
 * input: it wrote `autonomy.modes` into `skills/beta/skill.yaml`, a shape the
 * validator rejects. The assertions were real and the feature they covered
 * could not run. The fixtures below declare what a real skill declares, so a
 * decision the packager cannot make is a decision these tests cannot pass.
 *
 * The downgrade rule survives the move, with a legal input. `adapters/
 * claude-code/CONTRACT.md` §3 calls `unsupported` "the `unsupported` semantics
 * this host cannot enforce", and §4's rule is that a host which cannot enforce
 * what an autonomous run requires exposes the skill guided and rejects
 * autonomous. So a row claiming `autonomous` while naming its own host's
 * unenforceable semantics is the rule's case, stated by the skill itself.
 */
describe("the mode a skill is packaged in, per host", () => {
  /** A skill.yaml declaring `packaging.hosts[]` rows, which is the real shape. */
  const declaring = (rows: string) => ({
    "skills/beta/skill.yaml": `id: beta\nversion: 0.1.0\ninvocation: M\npackaging:\n  generated_frontmatter:\n    disable-model-invocation: false\n  hosts:\n${rows}`,
  });

  const decisionFor = (plan: ReturnType<typeof planBundle>, skill: string) => plan.decisions.find((d) => d.skill === skill);

  test("the mode comes from this host's row, and the two hosts may differ", () => {
    // The property the old fixture could not express at all: `autonomy.modes`
    // was one flat list for every adapter, so two hosts could not disagree
    // about a skill even in principle.
    const ctx = ctxFor(declaring("    - adapter: claude-code\n      mode: autonomous\n    - adapter: codex\n      mode: manual\n"));
    expect(decisionFor(planBundle(ctx, "claude-code", {}), "beta")?.mode).toBe("autonomous");
    expect(decisionFor(planBundle(ctx, "codex", {}), "beta")?.mode).toBe("manual");
    expect(planBundle(ctx, "claude-code", {}).files.get("skills/beta/SKILL.md")?.contents).toContain("mode: autonomous");
    expect(planBundle(ctx, "codex", {}).files.get("skills/beta/SKILL.md")?.contents).toContain("mode: manual");
  });

  test("a skill with no row for this host is manual, not autonomous by omission", () => {
    const ctx = ctxFor(declaring("    - adapter: codex\n      mode: autonomous\n"));
    expect(decisionFor(planBundle(ctx, "claude-code", {}), "beta")?.mode).toBe("manual");
    expect(decisionFor(planBundle(ctx, "codex", {}), "beta")?.mode).toBe("autonomous");
  });

  test("a skill with no packaging block at all is manual", () => {
    expect(decisionFor(planBundle(ctxFor(), "claude-code", {}), "alpha")?.mode).toBe("manual");
  });

  test("a row claiming autonomous while naming semantics this host cannot enforce is exposed guided", () => {
    const ctx = ctxFor(
      declaring(
        "    - adapter: claude-code\n      mode: autonomous\n      unsupported:\n        - the host does not scope writes to a grant.\n        - artifact-write is storage only.\n",
      ),
    );
    const decision = decisionFor(planBundle(ctx, "claude-code", {}), "beta");
    expect(decision?.mode).toBe("guided");
    expect(decision?.rejected).toEqual(["autonomous"]);
    expect(decision?.unenforceable).toEqual(["the host does not scope writes to a grant.", "artifact-write is storage only."]);
    expect(planBundle(ctx, "claude-code", {}).files.get("skills/beta/SKILL.md")?.contents).toContain("mode: guided");
  });

  test("the rejection is recorded in the bundle, not only in the plan", () => {
    const ctx = ctxFor(
      declaring("    - adapter: claude-code\n      mode: autonomous\n      unsupported:\n        - the host does not scope writes to a grant.\n"),
    );
    const record = recordOf(planBundle(ctx, "claude-code", {}));
    expect(record.autonomy_rejected).toEqual([{ skill: "beta", unenforceable: ["the host does not scope writes to a grant."] }]);
  });

  test("the semantics the host cannot enforce travel into the skill's own frontmatter", () => {
    // Where a reader of the installed skill can see them. The field existed and
    // had never once been emitted, because its input could not exist.
    const ctx = ctxFor(
      declaring("    - adapter: claude-code\n      mode: guided\n      unsupported:\n        - idempotency is not provided by the host.\n"),
    );
    const body = planBundle(ctx, "claude-code", {}).files.get("skills/beta/SKILL.md")?.contents ?? "";
    expect(body).toContain("autonomy_unenforceable");
    expect(body).toContain("idempotency is not provided by the host.");
  });

  test("a guided row naming unsupported semantics stays guided and is not recorded as a rejection", () => {
    // Nothing was rejected: the skill asked for guided and got guided. Recording
    // a rejection here would make `autonomy_rejected` a list of every skill that
    // named an unenforceable semantic, which is most of them, and the field
    // would stop meaning that a claim was refused.
    const ctx = ctxFor(
      declaring("    - adapter: claude-code\n      mode: guided\n      unsupported:\n        - the host does not scope writes to a grant.\n"),
    );
    const decision = decisionFor(planBundle(ctx, "claude-code", {}), "beta");
    expect(decision?.mode).toBe("guided");
    expect(decision?.rejected).toEqual([]);
    expect(recordOf(planBundle(ctx, "claude-code", {})).autonomy_rejected).toEqual([]);
  });

  test("an autonomous row naming nothing unenforceable keeps autonomous", () => {
    // The other side of the downgrade, so "always guided" cannot pass as the
    // rule. The host's own `enforces` set is deliberately not consulted: the
    // restriction vocabulary it holds and the capability vocabulary `requires[]`
    // speaks are different enums, and the check that compares a skill's
    // `requires[]` against a host contract's §3 table belongs to `ak validate`
    // by both contracts' own words. It does not exist yet.
    const ctx = ctxFor(declaring("    - adapter: claude-code\n      mode: autonomous\n"));
    const decision = decisionFor(planBundle(ctx, "claude-code", {}), "beta");
    expect(decision?.mode).toBe("autonomous");
    expect(decision?.rejected).toEqual([]);
  });

  test("two rows for one adapter is an error, and the first of them is the one that decided", () => {
    // The schema puts no uniqueness constraint on `hosts[]`, so `ak validate`
    // passes a skill.yaml declaring the same adapter twice and whichever row the
    // packager happened to keep would decide the mode with nothing saying so.
    //
    // Which row won is asserted and not left to whichever the loop reached,
    // because the error says "whichever the packager reached first" -- a
    // sentence sending a reader to the first of two rows, and a loader that
    // kept the last would make the message point at the wrong line.
    const ctx = ctxFor(
      declaring("    - adapter: claude-code\n      mode: autonomous\n    - adapter: claude-code\n      mode: manual\n"),
    );
    const plan = planBundle(ctx, "claude-code", {});
    const issue = plan.issues.find((i) => i.rule === "packaging.duplicate-host-row");
    expect(issue?.severity).toBe("error");
    expect(issue?.file).toBe("skills/beta/skill.yaml");
    expect(issue?.message).toContain("claude-code");
    expect(decisionFor(plan, "beta")?.mode).toBe("autonomous");
  });

  test("a row naming no adapter is dropped, not filed under a host that does not exist", () => {
    // Two of them, because one is dropped either way -- a row with an empty
    // adapter that survived would be keyed under "" and nothing ever looks that
    // up, so the guard is invisible until a second one arrives and the pair is
    // reported as a duplicate. That error names adapter '' and sends a reader
    // to fix a host that was never being built.
    const ctx = ctxFor(declaring('    - adapter: ""\n      mode: autonomous\n    - adapter: ""\n      mode: manual\n'));
    const plan = planBundle(ctx, "claude-code", {});
    expect(plan.issues.some((i) => i.rule === "packaging.duplicate-host-row")).toBe(false);
    expect(decisionFor(plan, "beta")?.mode).toBe("manual");
  });

  test("the mode vocabulary is the schema's, and a value outside it is not packaged as one", () => {
    // Two halves, because the packager's fallback is `manual` and a typo that
    // fell through to it would look exactly like a skill that declared nothing.
    // The schema is what stops it, and that is asserted against the real
    // schema rather than described: a mode outside the three fails validation.
    const schemas = compileSchemas(REPO);
    const validate = schemas.validatorFor("skill");
    expect(validate).toBeDefined();
    const doc = parseYaml(readFileSync(join(REPO, "skills/diagnose/skill.yaml"), "utf8")) as Record<string, unknown>;
    expect(validate?.(doc)).toBe(true);
    const rows = (doc["packaging"] as Record<string, unknown>)["hosts"] as Array<Record<string, unknown>>;
    rows[0]!["mode"] = "sideways";
    expect(validate?.(doc)).toBe(false);

    // And the packager does not invent one from it either.
    const ctx = ctxFor(declaring("    - adapter: claude-code\n      mode: sideways\n"));
    expect(decisionFor(planBundle(ctx, "claude-code", {}), "beta")?.mode).toBe("manual");
  });
});

/**
 * `adapters/codex/CONTRACT.md` §3.1, which the mode decision has to honor now
 * that it makes one.
 *
 * §3.1 is not advice about what a skill should declare. It is a statement about
 * what the codex bundle contains: "For every U skill in the codex bundle" the
 * description carries the non-trigger clause, the authority check is the first
 * step, and "Every U skill's `packaging.hosts[]` entry for `adapter: codex`
 * records this explicitly: `mode: manual`". The host has no manual-invocation
 * flag, so a U skill exposed as anything but manual there is a skill the model
 * may start on a host that cannot be told not to.
 *
 * This became reachable and therefore necessary in the same change. While every
 * skill shipped `manual` by accident the bundle satisfied §3.1 without anyone
 * having built the rule; honoring the declarations means honoring three that
 * say `guided` on codex, so the rule has to exist for the bundle to stay
 * compliant. The skill files are wrong as well -- named in the packager's own
 * error, because a declaration that says `guided` where §3.1 requires `manual`
 * is precisely the weakening §3.1 says the declaration exists to notice.
 */
describe("a U skill on a host that cannot suppress model invocation", () => {
  /** A skill.yaml for `alpha`, which the catalog declares U. */
  const alpha = (rows: string, invocation = "invocation: U\n") =>
    ({ "skills/alpha/skill.yaml": `id: alpha\nversion: 0.1.0\n${invocation}packaging:\n  hosts:\n${rows}` });

  const decisionFor = (plan: ReturnType<typeof planBundle>, skill: string) => plan.decisions.find((d) => d.skill === skill);

  const BOTH_GUIDED = "    - adapter: claude-code\n      mode: guided\n    - adapter: codex\n      mode: guided\n";

  test("is packaged manual on codex however its own row reads, and keeps its declared mode elsewhere", () => {
    // Both halves in one test on purpose: "codex forces manual" and "this is a
    // codex rule" are the same claim, and a test that only showed the first
    // would pass just as well against a packager that forced manual everywhere.
    const ctx = ctxFor(alpha(BOTH_GUIDED));
    expect(decisionFor(planBundle(ctx, "codex", {}), "alpha")?.mode).toBe("manual");
    expect(decisionFor(planBundle(ctx, "claude-code", {}), "alpha")?.mode).toBe("guided");
    expect(planBundle(ctx, "codex", {}).files.get("skills/alpha/SKILL.md")?.contents).toContain("mode: manual");
    expect(planBundle(ctx, "claude-code", {}).files.get("skills/alpha/SKILL.md")?.contents).toContain("mode: guided");
  });

  test("records the refusal rather than quietly packaging something other than what was declared", () => {
    const plan = planBundle(ctxFor(alpha(BOTH_GUIDED)), "codex", {});
    expect(decisionFor(plan, "alpha")?.rejected).toEqual(["guided"]);
    expect(recordOf(plan).autonomy_rejected).toEqual([{ skill: "alpha", unenforceable: [] }]);
  });

  test("names the skill file and the rule, because the declaration is wrong and not only the bundle", () => {
    const plan = planBundle(ctxFor(alpha(BOTH_GUIDED)), "codex", {});
    const issue = plan.issues.find((i) => i.rule === "packaging.u-skill-not-manual");
    expect(issue?.severity).toBe("error");
    expect(issue?.file).toBe("skills/alpha/skill.yaml");
    expect(issue?.message).toContain("guided");
    expect(issue?.message).toContain("codex");
    // And not on the host where the declaration is legal.
    expect(planBundle(ctxFor(alpha(BOTH_GUIDED)), "claude-code", {}).issues.some((i) => i.rule === "packaging.u-skill-not-manual")).toBe(false);
  });

  test("goes to manual, not to the guided that §4's downgrade alone would give it", () => {
    // A U skill claiming autonomous on codex is both rules' case at once: §4
    // would expose it guided, §3.1 requires manual. The stricter one is the
    // answer, and this is the test that tells the two apart -- with only §4
    // built, the mode here reads `guided` and looks like a rule having worked.
    const ctx = ctxFor(
      alpha("    - adapter: codex\n      mode: autonomous\n      unsupported:\n        - model invocation cannot be suppressed on this host.\n"),
    );
    const decision = decisionFor(planBundle(ctx, "codex", {}), "alpha");
    expect(decision?.mode).toBe("manual");
    expect(decision?.rejected).toEqual(["autonomous"]);
    expect(decision?.unenforceable).toEqual(["model invocation cannot be suppressed on this host."]);
  });

  test("leaves an M skill's codex row alone, because the rule is about who may start the skill", () => {
    // The control. §3.1's subject is the U skill, whose whole protection on this
    // host is that a human asked for it; an M skill is startable by the model by
    // design and forcing it to manual would be a different package.
    const ctx = ctxFor({ "skills/beta/skill.yaml": `id: beta\nversion: 0.1.0\ninvocation: M\npackaging:\n  hosts:\n${BOTH_GUIDED}` });
    expect(decisionFor(planBundle(ctx, "codex", {}), "beta")?.mode).toBe("guided");
    expect(planBundle(ctx, "codex", {}).issues.some((i) => i.rule === "packaging.u-skill-not-manual")).toBe(false);
  });

  test("reads U from the catalog as well, so it cannot disagree with the frontmatter about what the skill is", () => {
    // Twenty skills in this tree state an invocation in catalog.yaml and none in
    // skill.yaml, so a rule reading only skill.yaml would exempt every one of
    // them -- while `generateHostFrontmatter`, which reads both, went on writing
    // `disable-model-invocation: true` for the same skills. One predicate, or
    // the bundle says a skill is U in its frontmatter and packages it as though
    // it were not.
    const ctx = ctxFor(alpha(BOTH_GUIDED, ""));
    expect(decisionFor(planBundle(ctx, "codex", {}), "alpha")?.mode).toBe("manual");
    expect(planBundle(ctx, "codex", {}).issues.some((i) => i.rule === "packaging.u-skill-not-manual")).toBe(true);
  });

  test("reads U from skill.yaml as well, for the catalog that is missing the field it is meant to carry", () => {
    // The other arm of the same predicate, and not a theoretical one.
    // `catalog.schema.json` requires `invocation` on every skill entry, so a
    // catalog without it is a catalog that failed `ak validate` -- and `ak
    // build` plans and writes anyway, so the packager sees that catalog. A
    // skill whose one surviving record of being U is its own skill.yaml is
    // exactly when the protection has to hold.
    const noInvocation = CATALOG.replace("    status: authored\n    invocation: U\n", "    status: authored\n");
    expect(noInvocation).not.toBe(CATALOG);
    const ctx = ctxFor({ ...alpha(BOTH_GUIDED), "catalog.yaml": noInvocation });
    expect(decisionFor(planBundle(ctx, "codex", {}), "alpha")?.mode).toBe("manual");
    expect(planBundle(ctx, "codex", {}).issues.some((i) => i.rule === "packaging.u-skill-not-manual")).toBe(true);
  });

  test("says nothing about a U skill that declares manual, which is what §3.1 asks for", () => {
    const ctx = ctxFor(alpha("    - adapter: codex\n      mode: manual\n      unsupported:\n        - model invocation cannot be suppressed on this host.\n"));
    const plan = planBundle(ctx, "codex", {});
    expect(decisionFor(plan, "alpha")?.mode).toBe("manual");
    expect(decisionFor(plan, "alpha")?.rejected).toEqual([]);
    expect(plan.issues.some((i) => i.rule === "packaging.u-skill-not-manual")).toBe(false);
  });

  test("follows the capability rather than the host's name, in both directions", () => {
    // The rule's subject is "a host with no manual-invocation flag", not "codex".
    // Keyed on the host id it would be a rule that happens to be right about the
    // two hosts that exist today and silently wrong about the third, and it
    // would keep firing at codex after codex grew the flag. Both directions,
    // because either alone is satisfied by a constant: claude-code declaring it
    // enforces nothing forces the U skill to manual there, and codex declaring
    // it enforces no-model-invocation leaves the declared mode alone.
    const off = ctxFor({ ...alpha(BOTH_GUIDED), "adapters/claude-code/capabilities.yaml": "enforces: []\n" });
    expect(decisionFor(planBundle(off, "claude-code", {}), "alpha")?.mode).toBe("manual");
    expect(planBundle(off, "claude-code", {}).issues.some((i) => i.rule === "packaging.u-skill-not-manual")).toBe(true);

    const on = ctxFor({ ...alpha(BOTH_GUIDED), "adapters/codex/capabilities.yaml": "enforces: [no-model-invocation]\n" });
    expect(decisionFor(planBundle(on, "codex", {}), "alpha")?.mode).toBe("guided");
    expect(planBundle(on, "codex", {}).issues.some((i) => i.rule === "packaging.u-skill-not-manual")).toBe(false);
  });

  test("says nothing about a U skill with no codex row, which was already manual", () => {
    // The fallback and the rule agree here, and they must not both fire: an
    // error naming a declaration that does not exist would send a reader to a
    // file to fix a line that is not in it.
    const ctx = ctxFor(alpha("    - adapter: claude-code\n      mode: guided\n"));
    const plan = planBundle(ctx, "codex", {});
    expect(decisionFor(plan, "alpha")?.mode).toBe("manual");
    expect(decisionFor(plan, "alpha")?.rejected).toEqual([]);
    expect(plan.issues.some((i) => i.rule === "packaging.u-skill-not-manual")).toBe(false);
  });
});

describe("ak build and --check", () => {
  test("writes both host bundles under dist/", () => {
    const ctx = ctxFor();
    const built = writeBundles(ctx, {});
    expect(built.issues.filter((i) => i.severity === "error")).toEqual([]);
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
