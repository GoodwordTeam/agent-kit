import { describe, expect, test } from "bun:test";

import { loadCatalog } from "../src/catalog/load.ts";
import { RESTATEMENT_THRESHOLD, checkRestatements } from "../src/validation/restatement.ts";
import { LABELLED, RULINGS_AT_REVISION } from "./fixtures/restatement-cases.ts";
import { makeTree } from "./helpers/tree.ts";

/**
 * The labelled corpus, scored against the rulings as they stood when it was
 * labelled.
 *
 * Both halves are frozen on purpose. A fixture that read the live
 * `policies/resolved-conflicts.yaml` would re-score itself every time someone
 * edited a ruling, and a fixture that pointed at `AUTHORING.md:607` would stop
 * meaning anything the moment a line was inserted above it -- which happened to
 * six of these cases within a day of their being labelled, and happened to the
 * first harness that measured them. So the case carries its own text and the
 * corpus carries its own rulings, and the only way either changes is a diff to
 * this file.
 *
 * `policies` owns the classifications; this file owns their storage. A new
 * label, or a change to one, is a judgment about AUTHORING 6 and goes to that
 * seat rather than being decided here.
 */
const CATALOG_HEAD = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
`;

function policyYaml(): string {
  const lines = ["schema_version: 1", "policy: resolved-conflicts", `rows: ${RULINGS_AT_REVISION.length}`, "", "conflicts:"];
  for (const [index, row] of RULINGS_AT_REVISION.entries()) {
    lines.push(`  - id: ${row.id}`, "    tension: captured with the corpus", "    ruling: >-");
    // Folded scalar: one physical line, so no wrapping can alter the text.
    lines.push(`      ${row.text.replace(/\n/g, " ")}`);
    lines.push(`    scenario: ${index + 1}`, "    coverage: direct");
  }
  return lines.join("\n");
}

/** Format decides citation scope, so a YAML case has to stay YAML. */
function pathFor(item: (typeof LABELLED)[number]): string {
  return item.format === "yaml" ? `policies/${item.id}.yaml` : `protocols/${item.id}/PROTOCOL.md`;
}

/** Every case in its own body, so one case cannot cite or shadow another. */
function scanAll(): Map<string, number> {
  const files: Record<string, string> = {
    "catalog.yaml": CATALOG_HEAD,
    "policies/resolved-conflicts.yaml": policyYaml(),
  };
  for (const item of LABELLED) files[pathFor(item)] = `${item.text}\n`;
  const root = makeTree(files);
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");

  const issues = checkRestatements({ root, catalog }, 0.02).filter((i) => i.rule === "rulings.uncited-restatement");

  // The score of a case is the best window in the block its anchor sits in --
  // the same unit the capture used. Taking the best in the whole file would
  // score a neighbouring paragraph for a case captured whole, which is what a
  // YAML case has to be.
  const scored = new Map<string, number>();
  for (const item of LABELLED) {
    const path = pathFor(item);
    const lines = `${item.text}\n`.split("\n");
    const at = lines.findIndex((line) => line.includes(item.anchor));
    if (at < 0) throw new Error(`anchor missing from captured text: ${item.id}`);
    let lo = at;
    let hi = at;
    while (lo > 0 && (lines[lo - 1] ?? "").trim() !== "") lo--;
    while (hi < lines.length - 1 && (lines[hi + 1] ?? "").trim() !== "") hi++;
    const best = issues
      .filter((i) => i.file === path && (i.line ?? 0) >= lo + 1 && (i.line ?? 0) <= hi + 1)
      .map((i) => Number(/\((\d\.\d+)\)/.exec(i.message)?.[1] ?? 0));
    scored.set(item.id, Math.max(0, ...best));
  }
  return scored;
}

const scores = scanAll();

describe("the labelled corpus, which is what any recall claim rests on", () => {
  for (const item of LABELLED.filter((c) => c.label === "defect")) {
    test(`${item.id} is still caught: ${item.why.slice(0, 60)}...`, () => {
      // A recall regression is the failure that matters here. A tuning change
      // that quietly drops one of these would otherwise look like a cleaner
      // report, which is the shape of every mistake made against this check.
      expect(scores.get(item.id) ?? 0).toBeGreaterThanOrEqual(RESTATEMENT_THRESHOLD);
    });
  }

  for (const item of LABELLED.filter((c) => c.score < RESTATEMENT_THRESHOLD)) {
    test(`${item.id} stays rejected: ${item.why.slice(0, 55)}...`, () => {
      // The guard in the other direction. Every case found by reading the
      // report is above the line by construction, so a change that dragged
      // rejections up across it would leave no trace in a set built only from
      // what the check already emits.
      expect(scores.get(item.id) ?? 0).toBeLessThan(RESTATEMENT_THRESHOLD);
    });
  }

  test("the set holds cases on both sides of the threshold", () => {
    // A corpus of accepted cases only measures nothing about the threshold.
    expect(LABELLED.some((c) => c.score >= RESTATEMENT_THRESHOLD)).toBe(true);
    expect(LABELLED.some((c) => c.score < RESTATEMENT_THRESHOLD)).toBe(true);
  });

  test("every case scores what it scored when it was labelled", () => {
    // Tolerance, not equality: an edit to a ruling legitimately moves these,
    // and should show up as a re-measure rather than as a broken build. A
    // change to the scoring path moves them much further than this.
    const drifted = LABELLED.map((item) => ({ id: item.id, was: item.score, now: scores.get(item.id) ?? 0 })).filter(
      (row) => Math.abs(row.now - row.was) > 0.05,
    );
    expect(drifted).toEqual([]);
  });

  test("the corpus is the whole ruling list, since that is what the weights are over", () => {
    // Scoring a case against a subset would reproduce neither the weights nor
    // the numbers above, and the fixture would silently stop being a fixture.
    expect(RULINGS_AT_REVISION.length).toBe(19);
    expect(new Set(RULINGS_AT_REVISION.map((r) => r.id)).size).toBe(RULINGS_AT_REVISION.length);
  });

  test("each case records why it carries its label, not just the label", () => {
    // Three agents classified the same case wrong in the same direction, and a
    // bare TP/FP column is what let that reading propagate.
    for (const item of LABELLED) {
      expect(item.why.length).toBeGreaterThan(40);
      expect(item.origin).toMatch(/ at [0-9a-f]{7}$/);
    }
  });
});
