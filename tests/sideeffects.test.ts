import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { checkSideEffects } from "../src/validation/sideeffects.ts";
import { loadCatalog } from "../src/catalog/load.ts";
import { runValidation } from "../src/validation/run.ts";
import { makeTree } from "./helpers/tree.ts";

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
skills:
  - id: bound
    status: authored
    invocation: U
  - id: watcher
    status: authored
    invocation: U
  - id: unwritten
    status: contract
    invocation: U
policies:
  - id: invocation
    status: authored
`;

/**
 * The side-effect vocabulary, as `schemas/common.schema.json` states it. Every
 * fixture carries a real `common.schema.json` because the check reads the enum
 * from it rather than from a copy: a token is an effect because the schema says
 * so, not because it looks like one.
 */
const COMMON = JSON.stringify(
  {
    $id: "common.schema.json",
    $defs: {
      side_effect: {
        enum: [
          "workspace-write",
          "branch-create",
          "local-commit",
          "remote-push",
          "pr-open",
          "kb-draft",
          "kb-publish",
          "artifact-write",
          "process-exec",
          "scratch-write",
        ],
      },
      remote_side_effect: { enum: ["remote-push", "pr-open", "kb-publish"] },
    },
  },
  null,
  2,
);

/** One operation exposing `bound` through its `run` entrypoint. */
const POLICY = `schema_version: 1
policy: invocation
operations:
  - id: bound.run
    exposed_by: bound
    authority: delegated-grant
    side_effects: [artifact-write, scratch-write]
`;

interface SkillSpec {
  readonly skillEffects?: ReadonlyArray<string>;
  readonly entrypoints?: Readonly<Record<string, { effects?: ReadonlyArray<string>; operation?: string }>>;
}

function skillYaml(id: string, spec: SkillSpec): string {
  const lines = [`id: ${id}`, "version: 0.1.0", "kind: lifecycle", "invocation: U"];
  const entrypoints = spec.entrypoints ?? { main: { effects: spec.skillEffects ?? [] } };
  lines.push("entrypoints:");
  for (const [name, entry] of Object.entries(entrypoints)) {
    lines.push(`  ${name}:`, "    invocation: U", "    authority: explicit");
    if (entry.operation !== undefined) lines.push(`    operation: ${entry.operation}`);
    if (entry.effects !== undefined) lines.push(`    side_effects: [${entry.effects.join(", ")}]`);
  }
  if (spec.skillEffects !== undefined) lines.push(`side_effects: [${spec.skillEffects.join(", ")}]`);
  return `${lines.join("\n")}\n`;
}

function skillMd(sideEffects: string): string {
  return `---\nname: bound\ndescription: d\n---\n\nProse.\n\n## Side effects\n\n${sideEffects}\n\n## Stop conditions\n\nDone.\n`;
}

function ctxFor(files: Record<string, string>) {
  const root = makeTree({ "catalog.yaml": CATALOG, "schemas/common.schema.json": COMMON, ...files });
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

/** A skill whose four surfaces all agree. Every case below perturbs one of them. */
function clean(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "policies/invocation.yaml": POLICY,
    "skills/bound/SKILL.md": skillMd("`artifact-write`, `scratch-write`. No `workspace-write`: this skill plans."),
    "skills/bound/skill.yaml": skillYaml("bound", {
      skillEffects: ["artifact-write", "scratch-write"],
      entrypoints: { run: { effects: ["artifact-write", "scratch-write"], operation: "bound.run" } },
    }),
    ...overrides,
  };
}

function rules(files: Record<string, string>): string[] {
  return checkSideEffects(ctxFor(files)).map((i) => i.rule);
}

describe("the positive control", () => {
  test("a skill whose prose, manifest, entrypoint and operation all agree is silent", () => {
    // Without this, a check that reported every skill would pass every case below.
    expect(checkSideEffects(ctxFor(clean()))).toEqual([]);
  });

  test("a backticked token that is not an effect is not read as one", () => {
    // What makes a token an effect is membership in the schema's enum, not its
    // shape. `align-answer` is a checkpoint category and `needs-input` a status;
    // both are lowercase kebab ids indistinguishable from an effect by shape,
    // and both belong in a sentence describing when the effects happen. Dropping
    // the enum test would report each of them as an effect the manifest omits.
    const section = "`artifact-write`, `scratch-write`, under an `align-answer` grant or on `needs-input`.";
    expect(checkSideEffects(ctxFor(clean({ "skills/bound/SKILL.md": skillMd(section) })))).toEqual([]);
  });
});

describe("the prose section and the manifest are one statement in two forms", () => {
  test("an effect in skill.yaml that the section omits is an error naming both", () => {
    const issues = checkSideEffects(
      ctxFor(clean({ "skills/bound/SKILL.md": skillMd("`artifact-write`. No `workspace-write`: this skill plans.") })),
    );
    expect(issues.map((i) => i.rule)).toEqual(["sideeffects.prose-missing-effect"]);
    expect(issues[0]?.severity).toBe("error");
    expect(issues[0]?.file).toBe("skills/bound/SKILL.md");
    expect(issues[0]?.message).toContain("scratch-write");
    expect(issues[0]?.message).toContain("skills/bound/skill.yaml");
  });

  test("an effect in the section that skill.yaml omits is an error naming both", () => {
    const issues = checkSideEffects(
      ctxFor(clean({ "skills/bound/SKILL.md": skillMd("`artifact-write`, `scratch-write`, `kb-draft`.") })),
    );
    expect(issues.map((i) => i.rule)).toContain("sideeffects.prose-undeclared-effect");
    const undeclared = issues.find((i) => i.rule === "sideeffects.prose-undeclared-effect");
    expect(undeclared?.severity).toBe("error");
    expect(undeclared?.file).toBe("skills/bound/SKILL.md");
    expect(undeclared?.message).toContain("kb-draft");
  });

  test("the error points at the heading, not at the top of the file", () => {
    // A writer given `skills/bound/SKILL.md` with no line reads the whole file.
    // The frontmatter is four lines, a blank, `Prose.`, a blank: the heading is
    // line 8 and the check reports the file's line, not the body's.
    const issues = checkSideEffects(
      ctxFor(clean({ "skills/bound/SKILL.md": skillMd("`artifact-write`. No `workspace-write`: this skill plans.") })),
    );
    expect(issues[0]?.line).toBe(8);
  });

  test("a section that denies an effect the manifest declares is a contradiction", () => {
    const issues = checkSideEffects(
      ctxFor(
        clean({
          "skills/bound/SKILL.md": skillMd("`artifact-write`, `scratch-write`. No `kb-draft`: it drafts nothing."),
          "skills/bound/skill.yaml": skillYaml("bound", {
            skillEffects: ["artifact-write", "scratch-write", "kb-draft"],
            entrypoints: { run: { effects: ["artifact-write", "scratch-write"], operation: "bound.run" } },
          }),
        }),
      ),
    );
    // The denial is the load-bearing half: the two surfaces state opposite facts
    // about one effect, which no subset comparison alone would call out.
    expect(issues.map((i) => i.rule)).toContain("sideeffects.prose-denies-declared-effect");
    const denial = issues.find((i) => i.rule === "sideeffects.prose-denies-declared-effect");
    expect(denial?.message).toContain("kb-draft");
    expect(denial?.severity).toBe("error");
    // And the denial does not count as naming the effect: the list is still
    // short one entry, which is the half a writer fixes by editing the list.
    expect(issues.map((i) => i.rule)).toContain("sideeffects.prose-missing-effect");
  });

  test("a section whose opening sentence is prose rather than a list is named as such", () => {
    const issues = checkSideEffects(
      ctxFor(clean({ "skills/bound/SKILL.md": skillMd("This skill writes artifacts and a scratch directory.") })),
    );
    expect(issues.map((i) => i.rule)).toEqual(["sideeffects.prose-no-list"]);
    expect(issues[0]?.severity).toBe("error");
  });

  test("commentary after the list is not read as part of it", () => {
    // The authored skills follow the list with a paragraph on idempotency that
    // names `kb-publish` again. Reading the whole section would make that
    // paragraph a second, differently-shaped declaration.
    const section = [
      "`artifact-write`, `scratch-write`.",
      "",
      "`artifact-write` is not a remote effect and needs no idempotency key",
      "(`adapters/runner-contract/CONTRACT.md`).",
    ].join("\n");
    expect(checkSideEffects(ctxFor(clean({ "skills/bound/SKILL.md": skillMd(section) })))).toEqual([]);
  });
});

describe("an entrypoint's effects and its invoker's envelope", () => {
  test("an entrypoint effect no operation permits is an error naming the operation", () => {
    const issues = checkSideEffects(
      ctxFor(
        clean({
          "skills/bound/SKILL.md": skillMd("`artifact-write`, `scratch-write`, `remote-push`."),
          "skills/bound/skill.yaml": skillYaml("bound", {
            skillEffects: ["artifact-write", "scratch-write", "remote-push"],
            entrypoints: {
              run: { effects: ["artifact-write", "scratch-write", "remote-push"], operation: "bound.run" },
            },
          }),
        }),
      ),
    );
    const unpermitted = issues.filter((i) => i.rule === "sideeffects.entrypoint-effect-unpermitted");
    expect(unpermitted).toHaveLength(1);
    expect(unpermitted[0]?.severity).toBe("error");
    expect(unpermitted[0]?.message).toContain("remote-push");
    expect(unpermitted[0]?.message).toContain("bound.run");
    expect(unpermitted[0]?.file).toBe("skills/bound/skill.yaml");
  });

  test("an operation effect the entrypoint does not declare is an error naming the policy", () => {
    const wider = POLICY.replace("[artifact-write, scratch-write]", "[artifact-write, scratch-write, kb-publish]");
    const issues = checkSideEffects(ctxFor(clean({ "policies/invocation.yaml": wider })));
    const undeclared = issues.filter((i) => i.rule === "sideeffects.operation-effect-undeclared");
    expect(undeclared).toHaveLength(1);
    expect(undeclared[0]?.severity).toBe("error");
    expect(undeclared[0]?.message).toContain("kb-publish");
    expect(undeclared[0]?.message).toContain("policies/invocation.yaml");
  });

  test("an effect one of two invokers permits is permitted", () => {
    // The union is the whole point. `watch` permits nothing but artifact-write;
    // `repair` permits the push. An entrypoint both can reach may do either, so
    // a per-operation subset test would report a false error here.
    const twoOperations = `schema_version: 1
policy: invocation
operations:
  - id: watcher.watch
    exposed_by: watcher
    authority: delegated-grant
    side_effects: [artifact-write]
  - id: watcher.repair
    exposed_by: watcher
    authority: delegated-grant
    side_effects: [artifact-write, remote-push]
`;
    const files = {
      "policies/invocation.yaml": twoOperations,
      "skills/watcher/SKILL.md": skillMd("`artifact-write`, `remote-push`."),
      "skills/watcher/skill.yaml": skillYaml("watcher", {
        skillEffects: ["artifact-write", "remote-push"],
        entrypoints: { run: { effects: ["artifact-write", "remote-push"] } },
      }),
    };
    expect(rules(files).filter((r) => r.startsWith("sideeffects.entrypoint-effect"))).toEqual([]);
  });

  test("an effect neither invoker permits is still reported", () => {
    // The positive control for the union: widening the permitted set must not
    // widen it to everything.
    const twoOperations = `schema_version: 1
policy: invocation
operations:
  - id: watcher.watch
    exposed_by: watcher
    authority: delegated-grant
    side_effects: [artifact-write]
  - id: watcher.repair
    exposed_by: watcher
    authority: delegated-grant
    side_effects: [artifact-write, remote-push]
`;
    const files = {
      "policies/invocation.yaml": twoOperations,
      "skills/watcher/SKILL.md": skillMd("`artifact-write`, `remote-push`, `kb-publish`."),
      "skills/watcher/skill.yaml": skillYaml("watcher", {
        skillEffects: ["artifact-write", "remote-push", "kb-publish"],
        entrypoints: { run: { effects: ["artifact-write", "remote-push", "kb-publish"] } },
      }),
    };
    const issues = checkSideEffects(ctxFor(files)).filter((i) => i.rule === "sideeffects.entrypoint-effect-unpermitted");
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("kb-publish");
    expect(issues[0]?.message).not.toContain("remote-push");
  });

  test("a public entrypoint no operation reaches is not held to an envelope", () => {
    // The human path legitimately does more than the delegated one: this is the
    // shape of every authored skill, and reporting it would make the check
    // unusable rather than strict.
    const files = clean({
      "skills/bound/SKILL.md": skillMd("`artifact-write`, `scratch-write`, `kb-publish`."),
      "skills/bound/skill.yaml": skillYaml("bound", {
        skillEffects: ["artifact-write", "scratch-write", "kb-publish"],
        entrypoints: {
          main: { effects: ["artifact-write", "scratch-write", "kb-publish"] },
          run: { effects: ["artifact-write", "scratch-write"], operation: "bound.run" },
        },
      }),
    });
    expect(checkSideEffects(ctxFor(files))).toEqual([]);
  });
});

describe("binding an operation to the entrypoint it runs", () => {
  test("the policy's own entrypoint field binds it", () => {
    const named = POLICY.replace("    authority: delegated-grant", "    entrypoint: run\n    authority: delegated-grant");
    const files = clean({
      "policies/invocation.yaml": named,
      "skills/bound/skill.yaml": skillYaml("bound", {
        skillEffects: ["artifact-write", "scratch-write"],
        entrypoints: { run: { effects: ["artifact-write", "scratch-write"] } },
      }),
    });
    expect(checkSideEffects(ctxFor(files))).toEqual([]);
  });

  test("the two bindings naming different entrypoints is an error, not a silent preference", () => {
    const named = POLICY.replace("    authority: delegated-grant", "    entrypoint: main\n    authority: delegated-grant");
    const files = clean({
      "policies/invocation.yaml": named,
      "skills/bound/skill.yaml": skillYaml("bound", {
        skillEffects: ["artifact-write", "scratch-write"],
        entrypoints: {
          main: { effects: ["artifact-write", "scratch-write"] },
          run: { effects: ["artifact-write", "scratch-write"], operation: "bound.run" },
        },
      }),
    });
    const issues = checkSideEffects(ctxFor(files));
    expect(issues.map((i) => i.rule)).toContain("sideeffects.operation-entrypoint-conflict");
    const conflict = issues.find((i) => i.rule === "sideeffects.operation-entrypoint-conflict");
    expect(conflict?.message).toContain("main");
    expect(conflict?.message).toContain("run");
  });

  test("a policy entrypoint the skill does not have is an error", () => {
    const named = POLICY.replace("    authority: delegated-grant", "    entrypoint: absent\n    authority: delegated-grant");
    const issues = checkSideEffects(ctxFor(clean({ "policies/invocation.yaml": named })));
    expect(issues.map((i) => i.rule)).toContain("sideeffects.operation-entrypoint-unknown");
  });

  test("a sole entrypoint binds without either field", () => {
    const files = clean({
      "skills/bound/skill.yaml": skillYaml("bound", {
        skillEffects: ["artifact-write", "scratch-write"],
        entrypoints: { only: { effects: ["artifact-write", "scratch-write"] } },
      }),
    });
    expect(checkSideEffects(ctxFor(files))).toEqual([]);
  });

  test("several entrypoints and no binding is an error, never a guess", () => {
    const files = clean({
      "skills/bound/skill.yaml": skillYaml("bound", {
        skillEffects: ["artifact-write", "scratch-write"],
        entrypoints: {
          main: { effects: ["artifact-write", "scratch-write"] },
          run: { effects: ["artifact-write", "scratch-write"] },
        },
      }),
    });
    const issues = checkSideEffects(ctxFor(files));
    expect(issues.map((i) => i.rule)).toEqual(["sideeffects.operation-entrypoint-unresolved"]);
    expect(issues[0]?.message).toContain("bound.run");
  });
});

describe("the skill-level list and the entrypoints beneath it", () => {
  test("an entrypoint effect missing from the skill-level list is an error", () => {
    const files = clean({
      "skills/bound/skill.yaml": skillYaml("bound", {
        skillEffects: ["artifact-write"],
        entrypoints: { run: { effects: ["artifact-write", "scratch-write"], operation: "bound.run" } },
      }),
    });
    const issues = checkSideEffects(ctxFor(files));
    expect(issues.map((i) => i.rule)).toContain("sideeffects.entrypoint-effect-not-in-skill");
    const missing = issues.find((i) => i.rule === "sideeffects.entrypoint-effect-not-in-skill");
    expect(missing?.message).toContain("scratch-write");
    expect(missing?.message).toContain("run");
  });

  test("a skill-level effect no entrypoint performs is an error", () => {
    const files = clean({
      "skills/bound/SKILL.md": skillMd("`artifact-write`, `scratch-write`, `kb-draft`."),
      "skills/bound/skill.yaml": skillYaml("bound", {
        skillEffects: ["artifact-write", "scratch-write", "kb-draft"],
        entrypoints: { run: { effects: ["artifact-write", "scratch-write"], operation: "bound.run" } },
      }),
    });
    const issues = checkSideEffects(ctxFor(files));
    expect(issues.map((i) => i.rule)).toContain("sideeffects.skill-effect-no-entrypoint");
    expect(issues.find((i) => i.rule === "sideeffects.skill-effect-no-entrypoint")?.message).toContain("kb-draft");
  });

  test("an entrypoint that declares no effects of its own inherits the skill's", () => {
    // Omitting the key is not declaring the empty set. An unnarrowed entrypoint
    // claims everything the skill claims, so the envelope comparison must use
    // the skill-level list -- and here that is wider than the operation permits.
    const files = clean({
      "skills/bound/SKILL.md": skillMd("`artifact-write`, `scratch-write`, `kb-publish`."),
      "skills/bound/skill.yaml": skillYaml("bound", {
        skillEffects: ["artifact-write", "scratch-write", "kb-publish"],
        entrypoints: { run: { operation: "bound.run" } },
      }),
    });
    const issues = checkSideEffects(ctxFor(files));
    const unpermitted = issues.filter((i) => i.rule === "sideeffects.entrypoint-effect-unpermitted");
    expect(unpermitted).toHaveLength(1);
    expect(unpermitted[0]?.message).toContain("kb-publish");
    // And the skill-level comparison does not also fire: there is no narrowed
    // entrypoint to compare against, so nothing is claimed about coverage.
    expect(issues.map((i) => i.rule)).not.toContain("sideeffects.skill-effect-no-entrypoint");
  });
});

describe("what the check cannot see, it says it cannot see", () => {
  test("a body with no manifest is a skipped check, not a pass", () => {
    const files = {
      "policies/invocation.yaml": POLICY,
      "skills/bound/SKILL.md": skillMd("`artifact-write`, `scratch-write`."),
    };
    const issues = checkSideEffects(ctxFor(files));
    expect(issues.map((i) => i.rule)).toEqual(["sideeffects.manifest-unavailable"]);
    expect(issues[0]?.skipped).toBe("skill side effects");
    expect(issues[0]?.file).toBe("skills/bound/skill.yaml");
  });

  test("a skill with neither body nor manifest is left to the catalog", () => {
    // `unwritten` is declared `status: contract` and has no files. The catalog
    // check already names it on its own line; a second line saying the same
    // thing in other words is what makes a summary unreadable.
    const named = checkSideEffects(ctxFor(clean())).map((i) => i.file);
    expect(named.filter((f) => f.includes("unwritten"))).toEqual([]);
  });

  test("an unparseable manifest is left to checkSchemas rather than reported twice", () => {
    // The file exists, so `schemas.document-unparseable` names it by path with
    // the parser's own message. A second rule here would say the same thing
    // less precisely, and neither owner would be the one to remove.
    //
    // The repository's own schemas are copied in rather than sketched, because
    // checkSchemas reaches the parse only once a validator for `skill` compiled:
    // against a fixture without them the file is reported as unvalidatable and
    // this test would confirm an ownership that does not exist.
    const repo = join(import.meta.dir, "..");
    const files = clean({
      "skills/bound/skill.yaml": "entrypoints: [\n",
      "schemas/common.schema.json": readFileSync(join(repo, "schemas/common.schema.json"), "utf8"),
      "schemas/skill.schema.json": readFileSync(join(repo, "schemas/skill.schema.json"), "utf8"),
    });
    expect(checkSideEffects(ctxFor(files)).filter((i) => i.rule.startsWith("sideeffects."))).toEqual([]);
    const run = runValidation(makeTree({ "catalog.yaml": CATALOG, ...files }));
    expect(run.issues.filter((i) => i.file === "skills/bound/skill.yaml").map((i) => i.rule)).toContain(
      "schemas.document-unparseable",
    );
  });

  test("an unreadable side-effect vocabulary is a skipped check, not a pass", () => {
    // Without the enum, every backticked token in the section looks like an
    // effect and every effect in the manifest looks like a typo. A hardcoded
    // fallback list would answer confidently from a copy that can drift.
    const root = makeTree({ "catalog.yaml": CATALOG, ...clean() });
    const { catalog } = loadCatalog(root);
    if (catalog === null) throw new Error("fixture has no catalog");
    const issues = checkSideEffects({ root, catalog });
    expect(issues.map((i) => i.rule)).toEqual(["sideeffects.vocabulary-unavailable"]);
    expect(issues[0]?.skipped).toBe("side-effect vocabulary");
  });

  test("an unreadable invocation policy skips the envelopes and keeps the prose", () => {
    const files = clean({ "policies/invocation.yaml": "operations: [\n" });
    const issues = checkSideEffects(
      ctxFor({ ...files, "skills/bound/SKILL.md": skillMd("`artifact-write`, `kb-draft`.") }),
    );
    // The prose half does not depend on the policy and still reports.
    expect(issues.map((i) => i.rule)).toContain("sideeffects.prose-undeclared-effect");
    expect(issues.map((i) => i.rule)).toContain("sideeffects.policy-unavailable");
    expect(issues.find((i) => i.rule === "sideeffects.policy-unavailable")?.skipped).toBe("side-effect envelopes");
  });

  test("an absent invocation policy is an empty subject, not an unread one", () => {
    // No policy file means no operations exist to compare against, which hides
    // nothing; `policy.invocation-unavailable` already states it. Skipping here
    // too would put a permanent line in the summary of every tree that declares
    // no phase operations, and a term that is always present carries no signal.
    const files = clean();
    delete files["policies/invocation.yaml"];
    expect(checkSideEffects(ctxFor(files))).toEqual([]);
  });

  test("no authored manifest means no envelope to skip", () => {
    // A tree where nothing is authored has no unexamined material, so the
    // policy skip must not fire: a permanent skip on an empty subject would
    // train a reader to ignore the line.
    const issues = checkSideEffects(ctxFor({ "policies/invocation.yaml": "operations: [\n" }));
    expect(issues).toEqual([]);
  });
});

describe("through a full run", () => {
  test("a divergence between the two surfaces fails the run and names the file", () => {
    const root = makeTree({
      "catalog.yaml": CATALOG,
      "schemas/common.schema.json": COMMON,
      ...clean({ "skills/bound/SKILL.md": skillMd("`artifact-write`, `scratch-write`, `kb-draft`.") }),
    });
    const run = runValidation(root);
    const mine = run.issues.filter((i) => i.rule.startsWith("sideeffects."));
    expect(mine.map((i) => i.rule)).toContain("sideeffects.prose-undeclared-effect");
    expect(mine.every((i) => i.file.startsWith("skills/bound/"))).toBe(true);
    expect(run.ok).toBe(false);
  });

  test("the agreeing skill produces no sideeffects rule through the same run", () => {
    const root = makeTree({ "catalog.yaml": CATALOG, "schemas/common.schema.json": COMMON, ...clean() });
    expect(runValidation(root).issues.filter((i) => i.rule.startsWith("sideeffects."))).toEqual([]);
  });
});
