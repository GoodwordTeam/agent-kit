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
  // A source tree that cannot produce a licensed distribution is not a valid
  // fixture for any packaging test, so these are in the base rather than in the
  // one describe that reads them.
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
    expect(Object.keys(manifest)).toEqual(["name", "version", "description", "skills"]);

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
    const { claude, codex } = bundles();
    const { skills: _enumerated, ...claudeIdentity } = manifestIn(claude, ".claude-plugin/plugin.json");
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

  test("the rejection is recorded in the bundle, not only in the log", () => {
    const plan = planBundle(ctxFor(autonomous), "claude-code", {});
    const record = recordOf(plan);
    expect(record.host.enforces).toContain("no-model-invocation");
    expect(record.autonomy_rejected).toEqual([{ skill: "beta", unenforceable: ["filesystem-sandbox"] }]);
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
