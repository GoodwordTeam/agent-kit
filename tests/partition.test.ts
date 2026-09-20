import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { checkInvocationPartition } from "../src/validation/partition.ts";
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
  - id: closed
    status: authored
    invocation: U
  - id: scout
    status: authored
    invocation: M
policies:
  - id: invocation
    status: authored
`;

/**
 * The shape policies/invocation.yaml has: two classified lists, an operations
 * table, and a closure naming the user-invoked skills no operation reaches.
 * `bound` and `watcher` expose operations; `closed` does not.
 */
interface PolicySpec {
  readonly userInvoked?: ReadonlyArray<string>;
  readonly modelInvoked?: ReadonlyArray<string>;
  readonly exposedBy?: ReadonlyArray<string>;
  readonly closure?: ReadonlyArray<string>;
  readonly note?: string;
}

function policy(spec: PolicySpec = {}): string {
  const user = spec.userInvoked ?? ["bound", "watcher", "closed"];
  const model = spec.modelInvoked ?? ["scout"];
  const exposed = spec.exposedBy ?? ["bound", "watcher"];
  const closure = spec.closure ?? ["closed"];
  const note =
    spec.note ??
    `Read together, the two lists account for every skill: ${user.length} user-invoked, of which these ${closure.length} expose no operation and the rest do, plus ${model.length} model-invoked that need none.`;
  const operations = exposed
    .map(
      (id, i) =>
        `  - id: ${id}.run${i}\n    exposed_by: ${id}\n    authority: delegated-grant\n    side_effects: [artifact-write]\n`,
    )
    .join("");
  return `schema_version: 1
policy: invocation
entrypoints:
  user_invoked:
    count: ${user.length}
    authority: explicit
    skills:
${user.map((id) => `      - ${id}`).join("\n")}
  model_invoked:
    count: ${model.length}
    authority: model
    skills:
${model.map((id) => `      - ${id}`).join("\n")}
operations:
${operations}no_operation_exposed:
  rule: >-
    These user-invoked skills expose no phase operation.
  note: >-
    ${note}
  skills:${closure.length === 0 ? " []" : `\n${closure.map((id) => `    - ${id}`).join("\n")}`}
`;
}

function ctxFor(text: string) {
  const root = makeTree({ "catalog.yaml": CATALOG, "policies/invocation.yaml": text });
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

function rules(text: string): string[] {
  return checkInvocationPartition(ctxFor(text)).map((i) => i.rule);
}

describe("the positive control", () => {
  test("a policy whose two lists partition the catalog and whose closure is exact is silent", () => {
    expect(checkInvocationPartition(ctxFor(policy()))).toEqual([]);
  });
});

describe("the two classes partition the skills", () => {
  test("a skill in both classes is a contradiction in the policy's own terms", () => {
    // The catalog agreement check cannot see this one: it compares each listing
    // against catalog.yaml separately, so a skill the catalog calls U passes the
    // U listing and fails only the M one -- and a skill the catalog leaves
    // unset passes both. Being in both lists is wrong whatever the catalog says.
    const issues = checkInvocationPartition(ctxFor(policy({ modelInvoked: ["scout", "bound"] })));
    expect(issues.map((i) => i.rule)).toContain("partition.skill-in-both-classes");
    const both = issues.find((i) => i.rule === "partition.skill-in-both-classes");
    expect(both?.severity).toBe("error");
    expect(both?.file).toBe("policies/invocation.yaml");
    expect(both?.message).toContain("bound");
  });

  test("a skill listed twice in one class is named as a duplicate, not as a missing skill", () => {
    // Duplicating an entry keeps `count` correct and pushes one real skill out
    // of the list, so the existing checks report the *other* skill as
    // unclassified and say nothing about the repeat.
    const issues = checkInvocationPartition(ctxFor(policy({ userInvoked: ["bound", "bound", "watcher", "closed"] })));
    expect(issues.map((i) => i.rule)).toContain("partition.duplicate-in-class");
    expect(issues.find((i) => i.rule === "partition.duplicate-in-class")?.message).toContain("bound");
  });
});

describe("the closure is exact in both directions", () => {
  test("a closed skill that an operation exposes is an error naming the operation", () => {
    // The load-bearing case. The closure says no controller, grant or charter
    // entry can start these; the operations table hands a controller exactly
    // that. One of the two is wrong and the file states both.
    const issues = checkInvocationPartition(ctxFor(policy({ closure: ["closed", "bound"] })));
    const contradiction = issues.filter((i) => i.rule === "partition.closure-contradicts-operation");
    expect(contradiction).toHaveLength(1);
    expect(contradiction[0]?.severity).toBe("error");
    expect(contradiction[0]?.message).toContain("bound");
    expect(contradiction[0]?.message).toContain("bound.run0");
  });

  test("a user-invoked skill that exposes nothing and is not closed is an error", () => {
    // The block claims to be complete for user-invoked skills. A skill in
    // neither half is reachable by no controller and said to be by nothing,
    // which reads as an oversight in whichever half the reader checks second.
    const issues = checkInvocationPartition(ctxFor(policy({ closure: [] })));
    expect(issues.map((i) => i.rule)).toContain("partition.closure-incomplete");
    expect(issues.find((i) => i.rule === "partition.closure-incomplete")?.message).toContain("closed");
  });

  test("a skill listed twice in the closure is named, not left to its symptoms", () => {
    // Same failure as a duplicate in a class, one list over: the repeat keeps
    // the list's length right while pushing a skill out of it. What surfaces is
    // `closure-incomplete` against the displaced skill and a census off by one,
    // and neither of those names the repeat that produced both.
    const issues = checkInvocationPartition(
      ctxFor(
        policy({
          closure: ["closed", "closed"],
          note: "3 user-invoked, of which these 1 expose no operation, plus 1 model-invoked.",
        }),
      ),
    );
    expect(issues.map((i) => i.rule)).toEqual(["partition.duplicate-in-closure"]);
    expect(issues[0]?.severity).toBe("error");
    expect(issues[0]?.message).toContain("closed");
  });

  test("a model-invoked skill in the closure is an error, not a harmless extra", () => {
    // The block's own rule scopes it to user-invoked skills, and its note
    // explains that model-invoked skills are absent by construction. Listing
    // one makes the count wrong and the reasoning unreadable.
    const issues = checkInvocationPartition(
      ctxFor(policy({ closure: ["closed", "scout"], note: "3 user-invoked, of which these 2 expose no operation, plus 1 model-invoked." })),
    );
    expect(issues.map((i) => i.rule)).toContain("partition.closure-names-model-invoked-skill");
    expect(issues.find((i) => i.rule === "partition.closure-names-model-invoked-skill")?.message).toContain("scout");
  });

  test("a closure entry that is not a catalog skill is an error", () => {
    const issues = checkInvocationPartition(
      ctxFor(policy({ closure: ["closed", "absent"], note: "3 user-invoked, of which these 2 expose no operation, plus 1 model-invoked." })),
    );
    expect(issues.map((i) => i.rule)).toContain("partition.closure-names-unknown-skill");
    expect(issues.find((i) => i.rule === "partition.closure-names-unknown-skill")?.message).toContain("absent");
  });

  test("an operation on a model-invoked skill does not make it closure business", () => {
    // Positive control for the completeness half: it is scoped to user-invoked
    // skills, so a model-invoked skill outside the closure is not a gap.
    expect(rules(policy({ exposedBy: ["bound", "watcher", "scout"] }))).toEqual([]);
  });
});

describe("the census in the note restates the lists", () => {
  test("a user-invoked count that disagrees with the list is an error naming both", () => {
    const issues = checkInvocationPartition(
      ctxFor(policy({ note: "4 user-invoked, of which these 1 expose no operation, plus 1 model-invoked." })),
    );
    const census = issues.filter((i) => i.rule === "partition.census-disagrees");
    expect(census).toHaveLength(1);
    expect(census[0]?.severity).toBe("error");
    expect(census[0]?.message).toContain("4");
    expect(census[0]?.message).toContain("3");
  });

  test("each of the three counts is checked, not just the first", () => {
    const issues = checkInvocationPartition(
      ctxFor(policy({ note: "3 user-invoked, of which these 2 expose no operation, plus 7 model-invoked." })),
    );
    const census = issues.filter((i) => i.rule === "partition.census-disagrees");
    expect(census).toHaveLength(2);
    expect(census.map((i) => i.message).join(" ")).toContain("7");
    expect(census.map((i) => i.message).join(" ")).toContain("2");
  });

  test("a census phrase broken across lines is still checked against the lists", () => {
    // YAML folds a `>-` scalar into one line and keeps the newlines in a `|-`
    // one, so which of the two an author picked decides whether the phrase
    // arrives contiguous. Matching only the contiguous form would demote a
    // stated falsehood to `census-unrecognized` -- a warning, on the wording
    // change rather than on the wrong number -- and the count would go
    // unchecked with nothing saying so plainly.
    const text = policy().replace(
      /  note: >-\n.*\n/,
      "  note: |-\n    3 user-invoked, of which these 2 expose no\n    operation, plus 1 model-invoked.\n",
    );
    expect(text).toContain("expose no\n");

    const issues = checkInvocationPartition(ctxFor(text));
    const census = issues.filter((i) => i.rule === "partition.census-disagrees");
    expect(census).toHaveLength(1);
    expect(census[0]?.message).toContain("2");
    expect(issues.filter((i) => i.rule === "partition.census-unrecognized")).toEqual([]);
  });

  test("a number the census patterns do not recognize is reported rather than passed over", () => {
    // The patterns are phrase-shaped, so a rewritten note stops matching and
    // the check would go quiet on a claim it used to verify. A number nothing
    // accounted for is a warning: the prose was read and this part of it was
    // not checked against anything.
    const issues = checkInvocationPartition(
      ctxFor(
        policy({
          note: "3 user-invoked, of which these 1 expose no operation, plus 1 model-invoked, across 5 phases.",
        }),
      ),
    );
    const unrecognized = issues.filter((i) => i.rule === "partition.census-unrecognized");
    expect(unrecognized).toHaveLength(1);
    expect(unrecognized[0]?.severity).toBe("warning");
    expect(unrecognized[0]?.message).toContain("5");
  });
});

describe("what the check cannot see, it says it cannot see", () => {
  test("an absent policy is left to checkPolicies", () => {
    const root = makeTree({ "catalog.yaml": CATALOG });
    const { catalog } = loadCatalog(root);
    if (catalog === null) throw new Error("fixture has no catalog");
    expect(checkInvocationPartition({ root, catalog })).toEqual([]);
  });

  test("an unparseable policy is a skipped check, not a pass", () => {
    // `policy.unparseable` is an error on the file, but it says nothing about
    // the partition. A run that fails on the parse and reports nothing about
    // the closure has not judged the closure.
    const issues = checkInvocationPartition(ctxFor("entrypoints: [\n"));
    expect(issues.map((i) => i.rule)).toEqual(["partition.policy-unreadable"]);
    expect(issues[0]?.skipped).toBe("invocation partition");
  });

  test("a policy with no closure block skips the closure and keeps the classes", () => {
    const text = policy({ modelInvoked: ["scout", "bound"] }).replace(/no_operation_exposed:[\s\S]*$/, "");
    const issues = checkInvocationPartition(ctxFor(text));
    expect(issues.map((i) => i.rule)).toContain("partition.skill-in-both-classes");
    expect(issues.map((i) => i.rule)).toContain("partition.closure-unavailable");
    expect(issues.find((i) => i.rule === "partition.closure-unavailable")?.skipped).toBe("invocation closure");
  });
});

describe("through a full run", () => {
  test("a closure that contradicts an operation fails the run", () => {
    const root = makeTree({
      "catalog.yaml": CATALOG,
      "policies/invocation.yaml": policy({ closure: ["closed", "bound"] }),
    });
    const run = runValidation(root);
    expect(run.issues.map((i) => i.rule)).toContain("partition.closure-contradicts-operation");
    expect(run.ok).toBe(false);
  });

  test("the exact policy produces no partition rule through the same run", () => {
    const root = makeTree({ "catalog.yaml": CATALOG, "policies/invocation.yaml": policy() });
    expect(runValidation(root).issues.filter((i) => i.rule.startsWith("partition."))).toEqual([]);
  });

  test("the repository's own invocation policy satisfies the invariant", () => {
    // The check exists because this file states the partition three times. If
    // it is silent here only because it cannot read the real file, the fixtures
    // above prove nothing about the thing being protected.
    const repo = join(import.meta.dir, "..");
    const { catalog } = loadCatalog(repo);
    if (catalog === null) throw new Error("the repository has no readable catalog");
    expect(checkInvocationPartition({ root: repo, catalog })).toEqual([]);
  });

  test("closing a real skill that a real operation exposes is caught", () => {
    // The other half of the paired assertion, for the rule the check exists
    // for. The census perturbation proves the prose is read; this proves the
    // operations table and the closure list are read out of the authored file's
    // own nesting rather than only out of the generator above.
    const repo = join(import.meta.dir, "..");
    const authored = readFileSync(join(repo, "policies/invocation.yaml"), "utf8");
    const anchor = "\n  skills:\n    - autopilot\n";
    expect(authored.split(anchor)).toHaveLength(2);
    const perturbed = authored.replace(anchor, "\n  skills:\n    - super-align\n    - autopilot\n");

    const root = makeTree({
      "catalog.yaml": readFileSync(join(repo, "catalog.yaml"), "utf8"),
      "policies/invocation.yaml": perturbed,
    });
    const { catalog } = loadCatalog(root);
    if (catalog === null) throw new Error("the copied catalog is unreadable");
    const issues = checkInvocationPartition({ root, catalog });
    const contradiction = issues.filter((i) => i.rule === "partition.closure-contradicts-operation");
    expect(contradiction).toHaveLength(1);
    expect(contradiction[0]?.message).toContain("super-align");
    expect(contradiction[0]?.message).toContain("align.run");
  });

  test("perturbing the real census by one digit is caught", () => {
    // The paired assertion for the test above. Silence on the real file is
    // evidence only if the phrases the census matches on are the phrases the
    // real note is written in; a pattern that matches nothing there is silent
    // for the wrong reason and the clean result reads identically.
    const repo = join(import.meta.dir, "..");
    const authored = readFileSync(join(repo, "policies/invocation.yaml"), "utf8");
    // Whitespace-tolerant because the authored note is a folded scalar and the
    // phrase straddles a line break in the file; the fold makes it contiguous
    // only after parsing.
    const perturbed = authored.replace(/(\d+)(\s+expose\s+no\s+operation)/, (_, n: string, tail: string) => `${Number(n) + 1}${tail}`);
    // The phrase is in the authored note, not only in the fixtures above.
    expect(perturbed).not.toBe(authored);

    const root = makeTree({
      "catalog.yaml": readFileSync(join(repo, "catalog.yaml"), "utf8"),
      "policies/invocation.yaml": perturbed,
    });
    const { catalog } = loadCatalog(root);
    if (catalog === null) throw new Error("the copied catalog is unreadable");
    expect(checkInvocationPartition({ root, catalog }).map((i) => i.rule)).toContain("partition.census-disagrees");
  });
});
