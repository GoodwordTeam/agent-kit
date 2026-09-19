import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { checkSchemas } from "../src/validation/schemas.ts";
import { loadCatalog } from "../src/catalog/load.ts";
import { makeTree } from "./helpers/tree.ts";

/**
 * The conditional branches in finding.schema.json, exercised against the
 * shipped schema rather than a synthetic stand-in.
 *
 * tests/schemas.test.ts covers the compile-and-report machinery using small
 * hand-written schemas, which is the right shape for testing the machinery and
 * the wrong shape for testing a constraint: a copy of the constraint inside a
 * test proves the copy works. These cases read schemas/ off disk at run time,
 * so a branch that is edited or deleted is a branch these tests stop agreeing
 * with. Nothing here is duplicated into tests/fixtures/, for the same reason.
 *
 * The rejections assert on the field the branch guards rather than on ajv's
 * wording, which differs per keyword: a missing excerpt reports `required`, a
 * counter-evidence-only array reports `contains`. What makes a rejection
 * meaningful is the accepting case beside it -- the same evidence passes at a
 * lower anchor, so a rejection cannot be the fixture being malformed.
 */

const SCHEMAS_DIR = join(import.meta.dir, "..", "schemas");

/** Every shipped schema, written into a throwaway root so checkSchemas sees the real text. */
function shippedSchemas(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(SCHEMAS_DIR)) {
    if (name.endsWith(".schema.json")) out[`schemas/${name}`] = readFileSync(join(SCHEMAS_DIR, name), "utf8");
  }
  return out;
}

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
schemas:
${readdirSync(SCHEMAS_DIR)
  .filter((n) => n.endsWith(".schema.json"))
  .map((n) => `  - id: ${n.replace(".schema.json", "")}\n    status: authored`)
  .join("\n")}
`;

const SHA = "a".repeat(40);
const LOCATION = { repo: "demo", revision: SHA, path: "src/p.ts", line_range: { start: 1, end: 1 } };
const FINGERPRINT = {
  value: `sha256:${"b".repeat(64)}`,
  inputs: { rule: "null-deref", symbol_or_path: "src/p.ts", evidence_digest: `sha256:${"c".repeat(64)}` },
};

function finding(anchor: number, evidence: ReadonlyArray<Record<string, unknown>>) {
  return {
    schema: "finding",
    schema_version: 1,
    id: "finding-1",
    project: { id: "demo" },
    run_id: null,
    created_by: { role: "implementer" },
    inputs: [],
    source_revision: null,
    created_at: "2026-09-19T10:00:00Z",
    status: "open",
    title: "A caller dereferences a value the callee may return null for",
    lane: "correctness",
    fingerprint: FINGERPRINT,
    severity: "P1",
    confidence_anchor: anchor,
    spec_quality: "patch",
    difficulty: "mechanical",
    autofix_class: "manual",
    evidence,
    verification: [{ check: "bun test" }],
  };
}

/** Errors reported against the finding artifact alone; catalog noise is not the subject here. */
function findingErrors(anchor: number, evidence: ReadonlyArray<Record<string, unknown>>): string[] {
  const root = makeTree({
    "catalog.yaml": CATALOG,
    ...shippedSchemas(),
    "templates/finding.json": JSON.stringify(finding(anchor, evidence)),
  });
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return checkSchemas({ root, catalog })
    .filter((i) => i.file === "templates/finding.json" && i.severity === "error")
    .map((i) => i.message ?? "");
}

const UNQUOTED = { location: LOCATION, observation: "the return value is used without a null check" };
const QUOTED = { ...UNQUOTED, excerpt: "return user.profile.name;" };
const COUNTER = { ...UNQUOTED, excerpt: "if (user == null) return;", supports: "counter-evidence" };

describe("the quote-the-line gate on high confidence anchors", () => {
  test("anchor 75 with no excerpt anywhere is rejected", () => {
    expect(findingErrors(75, [UNQUOTED]).join(" ")).toMatch(/evidence/);
  });

  test("anchor 100 with no excerpt anywhere is rejected", () => {
    expect(findingErrors(100, [UNQUOTED]).join(" ")).toMatch(/evidence/);
  });

  test("anchor 75 with a grounding excerpt passes", () => {
    expect(findingErrors(75, [QUOTED])).toEqual([]);
  });

  test("an empty excerpt string does not satisfy the gate", () => {
    expect(findingErrors(75, [{ ...UNQUOTED, excerpt: "" }]).join(" ")).toMatch(/evidence/);
  });

  test("a quote that argues against the finding does not ground it", () => {
    expect(findingErrors(100, [COUNTER]).join(" ")).toMatch(/evidence/);
  });

  test("counter-evidence beside a grounding quote passes, and order does not matter", () => {
    expect(findingErrors(100, [COUNTER, QUOTED])).toEqual([]);
    expect(findingErrors(100, [QUOTED, COUNTER])).toEqual([]);
  });

  test("the gate does not reach anchors below 75, which is where an unquotable finding belongs", () => {
    for (const anchor of [0, 25, 50]) expect(findingErrors(anchor, [UNQUOTED])).toEqual([]);
  });

  test("a seat that cannot quote has a passing option, so the gate never forces a fabricated excerpt", () => {
    // The pair that matters: the same evidence is rejected at 75 and accepted at 50. If this
    // ever inverts, the cheapest way past the gate becomes inventing a quote rather than
    // recording the weaker anchor the vocabulary already provides.
    expect(findingErrors(75, [UNQUOTED]).length).toBeGreaterThan(0);
    expect(findingErrors(50, [UNQUOTED])).toEqual([]);
  });
});
