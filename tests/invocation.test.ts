import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { checkInvocation, extractSkillReferences } from "../src/validation/invocation.ts";
import { loadCatalog } from "../src/catalog/load.ts";
import { loadSkillManifest } from "../src/packaging/manifest.ts";
import { makeTree } from "./helpers/tree.ts";

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
skills:
  - id: ship
    status: authored
    invocation: U
  - id: compound
    status: authored
    invocation: U
  - id: scout
    status: authored
    invocation: M
policies:
  - id: invocation
    status: authored
`;

function ctxFor(files: Record<string, string>) {
  const root = makeTree({ "catalog.yaml": CATALOG, ...files });
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

const head = (n: string) => `---\nname: ${n}\ndescription: d\n---\n`;
// The key names here are the authored policy's: `operations`, with `exposed_by`
// on each entry. This fixture used to say `phase_operations` and `behind`,
// which `policies/invocation.yaml` has never used -- so the loader read an
// empty operation table from the real file while every test here passed.
const POLICY = `schema_version: 1
policy: invocation
operations:
  - id: compound.capture
    exposed_by: compound
    authority: delegated-grant
    grant:
      covers: publish-lesson
  - id: review.delta
    exposed_by: super-review
    authority: active-review-run
  - id: ship.prepare
    exposed_by: ship
    authority: explicit
`;

describe("reference extraction", () => {
  test("finds namespaced slash-command references", () => {
    expect(extractSkillReferences("Run /ak:compound afterwards.\n", "/ak:").map((r) => r.target)).toEqual(["compound"]);
  });

  test("finds phase operation ids written in inline code", () => {
    expect(extractSkillReferences("Invoke `review.delta` under a grant.\n", "/ak:").map((r) => r.target)).toEqual([
      "review.delta",
    ]);
  });

  test("does not mistake a filename for a phase operation", () => {
    const refs = extractSkillReferences("Read `skill.yaml` and `plugin.json` and `notes.md`.\n", "/ak:");
    expect(refs).toEqual([]);
  });

  test("records 1-based line numbers", () => {
    expect(extractSkillReferences("a\nb\n/ak:scout\n", "/ak:")[0]?.line).toBe(3);
  });
});

describe("the invocation law", () => {
  test("a U skill starting another U skill directly is an error", () => {
    const ctx = ctxFor({
      "policies/invocation.yaml": POLICY,
      "skills/ship/SKILL.md": `${head("ship")}\nThen run /ak:compound.\n`,
      "skills/compound/SKILL.md": head("compound"),
      "skills/scout/SKILL.md": head("scout"),
    });
    const issue = checkInvocation(ctx).find((i) => i.rule === "invocation.u-calls-u");
    expect(issue?.severity).toBe("error");
    expect(issue?.file).toBe("skills/ship/SKILL.md");
    expect(issue?.line).toBe(6);
    expect(issue?.message).toContain("compound");
  });

  test("the same need expressed as a declared, grant-gated phase operation passes", () => {
    const ctx = ctxFor({
      "policies/invocation.yaml": POLICY,
      "skills/ship/SKILL.md": `${head("ship")}\nInvoke \`compound.capture\` under a runner-validated grant.\n`,
      "skills/compound/SKILL.md": head("compound"),
      "skills/scout/SKILL.md": head("scout"),
    });
    expect(checkInvocation(ctx).filter((i) => i.severity === "error")).toEqual([]);
  });

  test("a U skill may start an M skill", () => {
    const ctx = ctxFor({
      "policies/invocation.yaml": POLICY,
      "skills/ship/SKILL.md": `${head("ship")}\nDelegate to /ak:scout.\n`,
      "skills/compound/SKILL.md": head("compound"),
      "skills/scout/SKILL.md": head("scout"),
    });
    expect(checkInvocation(ctx).filter((i) => i.severity === "error")).toEqual([]);
  });

  test("an M skill may not start a U skill either: only a human starts those", () => {
    const ctx = ctxFor({
      "policies/invocation.yaml": POLICY,
      "skills/ship/SKILL.md": head("ship"),
      "skills/compound/SKILL.md": head("compound"),
      "skills/scout/SKILL.md": `${head("scout")}\nThen /ak:compound.\n`,
    });
    expect(checkInvocation(ctx).some((i) => i.rule === "invocation.model-starts-user-skill")).toBe(true);
  });

  test("an operation the policy does not declare is an error", () => {
    const ctx = ctxFor({
      "policies/invocation.yaml": POLICY,
      "skills/ship/SKILL.md": `${head("ship")}\nInvoke \`compound.invent\`.\n`,
      "skills/compound/SKILL.md": head("compound"),
      "skills/scout/SKILL.md": head("scout"),
    });
    const issue = checkInvocation(ctx).find((i) => i.rule === "invocation.undeclared-operation");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("policies/invocation.yaml");
  });

  test("a declared operation whose authority is not delegated cannot be a side door", () => {
    const ctx = ctxFor({
      "policies/invocation.yaml": POLICY,
      "skills/ship/SKILL.md": head("ship"),
      "skills/compound/SKILL.md": `${head("compound")}\nInvoke \`ship.prepare\`.\n`,
      "skills/scout/SKILL.md": head("scout"),
    });
    const issue = checkInvocation(ctx).find((i) => i.rule === "invocation.operation-not-delegated");
    expect(issue?.message).toContain("explicit");
  });

  test("skill.yaml calls are part of the graph, not only the prose body", () => {
    const ctx = ctxFor({
      "policies/invocation.yaml": POLICY,
      "skills/ship/SKILL.md": head("ship"),
      "skills/ship/skill.yaml": "id: ship\ncalls: [compound]\n",
      "skills/compound/SKILL.md": head("compound"),
      "skills/scout/SKILL.md": head("scout"),
    });
    const issue = checkInvocation(ctx).find((i) => i.rule === "invocation.u-calls-u");
    expect(issue?.file).toBe("skills/ship/skill.yaml");
  });

  test("a reference to a skill the catalog does not declare is an error", () => {
    const ctx = ctxFor({
      "policies/invocation.yaml": POLICY,
      "skills/ship/SKILL.md": `${head("ship")}\nRun /ak:nonesuch.\n`,
      "skills/compound/SKILL.md": head("compound"),
      "skills/scout/SKILL.md": head("scout"),
    });
    expect(checkInvocation(ctx).some((i) => i.rule === "invocation.unknown-target")).toBe(true);
  });

  test("with no policy file the check fails closed: a U to U call is still an error", () => {
    const ctx = ctxFor({
      "skills/ship/SKILL.md": `${head("ship")}\nInvoke \`compound.capture\`.\nThen /ak:compound.\n`,
      "skills/compound/SKILL.md": head("compound"),
      "skills/scout/SKILL.md": head("scout"),
    });
    const issues = checkInvocation(ctx);
    expect(issues.some((i) => i.rule === "invocation.policy-unavailable")).toBe(true);
    expect(issues.some((i) => i.rule === "invocation.u-calls-u")).toBe(true);
    expect(issues.some((i) => i.rule === "invocation.undeclared-operation")).toBe(true);
  });
});

describe("model_operations", () => {
  const MODEL_POLICY = `${POLICY}  - id: compound.draft
    exposed_by: compound
    authority: model
    callable_by: [ship]
`;
  const bodies = {
    "policies/invocation.yaml": MODEL_POLICY,
    "skills/ship/SKILL.md": head("ship"),
    "skills/compound/SKILL.md": head("compound"),
    "skills/scout/SKILL.md": head("scout"),
  };

  test("the edge is part of the graph the invocation check walks", () => {
    const ctx = ctxFor({ ...bodies, "skills/ship/skill.yaml": "id: ship\nmodel_operations: [compound.draft]\n" });
    const manifest = loadSkillManifest(ctx.root, "ship");
    expect(manifest.calls).toContain("compound.draft");
    expect(manifest.modelOperations).toEqual(["compound.draft"]);
    expect(checkInvocation(ctx).filter((i) => i.severity === "error")).toEqual([]);
  });

  test("the same operation under child_operations is still a side door", () => {
    const ctx = ctxFor({ ...bodies, "skills/ship/skill.yaml": "id: ship\nchild_operations: [compound.draft]\n" });
    expect(checkInvocation(ctx).map((i) => i.rule)).toContain("invocation.operation-not-delegated");
  });

  test("an operation whose callable_by excludes the skill fails", () => {
    const ctx = ctxFor({ ...bodies, "skills/scout/skill.yaml": "id: scout\nmodel_operations: [compound.draft]\n" });
    const issues = checkInvocation(ctx).filter((i) => i.severity === "error");
    expect(issues.map((i) => [i.rule, i.file])).toEqual([["invocation.model-operation-not-callable", "skills/scout/skill.yaml"]]);
  });

  test("an operation that is not model-authority fails under model_operations", () => {
    const ctx = ctxFor({ ...bodies, "skills/ship/skill.yaml": "id: ship\nmodel_operations: [compound.capture]\n" });
    const rules = checkInvocation(ctx)
      .filter((i) => i.severity === "error")
      .map((i) => i.rule);
    expect(rules).toContain("invocation.model-operation-not-model");
    expect(rules).not.toContain("invocation.operation-not-delegated");
  });

  test("an undeclared operation fails under model_operations too", () => {
    const ctx = ctxFor({ ...bodies, "skills/ship/skill.yaml": "id: ship\nmodel_operations: [compound.invent]\n" });
    expect(checkInvocation(ctx).map((i) => i.rule)).toContain("invocation.undeclared-operation");
  });
});

describe("packager enforcement of the law", () => {
  test("a U skill cannot be downgraded to M from its skill.yaml", () => {
    const ctx = ctxFor({
      "policies/invocation.yaml": POLICY,
      "skills/ship/SKILL.md": head("ship"),
      "skills/compound/SKILL.md": head("compound"),
      "skills/scout/SKILL.md": head("scout"),
    });
    // Contradict the catalog from skill.yaml; the packager must not be able to downgrade a U skill.
    const withM = ctxFor({
      "policies/invocation.yaml": POLICY,
      "skills/ship/SKILL.md": head("ship"),
      "skills/ship/skill.yaml": "id: ship\ninvocation: M\n",
      "skills/compound/SKILL.md": head("compound"),
      "skills/scout/SKILL.md": head("scout"),
    });
    expect(checkInvocation(ctx).filter((i) => i.rule === "invocation.declaration-conflict")).toEqual([]);
    expect(checkInvocation(withM).some((i) => i.rule === "invocation.declaration-conflict")).toBe(true);
  });

  test("a declared operation resolves, so a controller reference is not reported", () => {
    const ctx = ctxFor({
      "policies/invocation.yaml": POLICY,
      "skills/scout/SKILL.md": `${head("scout")}Run \`review.delta\` under a grant.\n`,
      "skills/ship/SKILL.md": head("ship"),
      "skills/compound/SKILL.md": head("compound"),
    });
    const issues = checkInvocation(ctx);
    expect(issues.filter((i) => i.rule === "invocation.undeclared-operation")).toEqual([]);
    // And the operation's authority is read, not defaulted: `active-review-run`
    // is delegable, so the side-door check stays quiet too.
    expect(issues.filter((i) => i.rule === "invocation.operation-not-delegated")).toEqual([]);
  });

  test("the loader reads the operation table the authored policy actually writes", () => {
    // Deliberately reads `policies/invocation.yaml` from the repository rather
    // than a fixture, because a fixture is what hid this: the loader looked for
    // `phase_operations` and the authored file has always said `operations`, so
    // the table came back empty and every operation reference in the tree would
    // have been reported as undeclared the moment a skill body cited one.
    //
    // This test is coupled to the real file on purpose. If the policy renames
    // that key, the loader has to be updated in the same commit.
    const real = readFileSync(join(import.meta.dir, "..", "policies", "invocation.yaml"), "utf8");
    const ctx = ctxFor({
      "policies/invocation.yaml": real,
      "skills/scout/SKILL.md": `${head("scout")}Run \`review.delta\` under a grant.\n`,
      "skills/ship/SKILL.md": head("ship"),
      "skills/compound/SKILL.md": head("compound"),
    });
    expect(checkInvocation(ctx).filter((i) => i.rule === "invocation.undeclared-operation")).toEqual([]);
  });
});
