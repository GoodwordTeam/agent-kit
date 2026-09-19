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

/**
 * The longest run of characters a case shares verbatim with its ruling.
 *
 * Whitespace is flattened first: a verbatim quotation in a wrapped markdown
 * paragraph is broken by newlines that a reader never sees, and comparing
 * against the raw text would score the wrapping rather than the quotation.
 */
function longestSharedRun(caseText: string, rulingText: string): number {
  const a = caseText.replace(/\s+/g, " ").trim();
  const b = rulingText.replace(/\s+/g, " ").trim();
  let best = 0;
  const row = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0;
      if (a[i - 1] === b[j - 1]) {
        const run = diagonal + 1;
        row[j] = run;
        if (run > best) best = run;
      } else {
        row[j] = 0;
      }
      diagonal = above;
    }
  }
  return best;
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
  for (const item of LABELLED.filter((c) => c.label === "defect" && c.reported)) {
    test(`${item.id} is still caught: ${item.why.slice(0, 60)}...`, () => {
      // A recall regression is the failure that matters here. A tuning change
      // that quietly drops one of these would otherwise look like a cleaner
      // report, which is the shape of every mistake made against this check.
      expect(scores.get(item.id) ?? 0).toBeGreaterThanOrEqual(RESTATEMENT_THRESHOLD);
    });
  }

  for (const item of LABELLED.filter((c) => c.label === "defect" && !c.reported)) {
    test(`${item.id} is a known miss, pinned at ${item.score}: ${item.why.slice(0, 45)}...`, () => {
      // This pins a defect the instrument does not see. It is not an assertion
      // that the miss is acceptable -- it is what stops the miss from being
      // forgotten, because the coverage note's recall claim is only true while
      // this number is what it says.
      //
      // It fails when the check improves, and that failure is the point: the
      // recall claim in `checkRestatements` and this case's label have to move
      // in the same commit. Reclassify to `reported: true` and rewrite the note.
      expect(scores.get(item.id) ?? 0).toBeLessThan(RESTATEMENT_THRESHOLD);

      // And it is not the shared-nothing-vocabulary blind spot. The check
      // scores these well above zero and ranks the right ruling first; the
      // threshold is what cuts them. A miss at zero and a miss at 0.50 are
      // different failures and only one of them is reachable by tuning.
      expect(scores.get(item.id) ?? 0).toBeGreaterThan(0.25);
    });
  }

  for (const item of LABELLED.filter((c) => c.label === "not-a-defect")) {
    test(`${item.id} stays rejected: ${item.why.slice(0, 55)}...`, () => {
      // The guard in the other direction. Every case found by reading the
      // report is above the line by construction, so a change that dragged
      // rejections up across it would leave no trace in a set built only from
      // what the check already emits.
      expect(scores.get(item.id) ?? 0).toBeLessThan(RESTATEMENT_THRESHOLD);
    });
  }

  test("what the check does is recorded per case, not inferred from the score", () => {
    // `reported` and `score` are stored separately and a disagreement between
    // them is how a case silently changes which guard it gets. Until these two
    // axes were split, a defect scoring below the threshold was picked up by
    // the rejection guard and asserted to be correctly ignored.
    for (const item of LABELLED) {
      expect({ id: item.id, reported: item.reported }).toEqual({
        id: item.id,
        reported: (scores.get(item.id) ?? 0) >= RESTATEMENT_THRESHOLD,
      });
    }
  });

  test("the set holds cases on both sides of the threshold, and on both axes", () => {
    // A corpus of accepted cases only measures nothing about the threshold.
    expect(LABELLED.some((c) => c.score >= RESTATEMENT_THRESHOLD)).toBe(true);
    expect(LABELLED.some((c) => c.score < RESTATEMENT_THRESHOLD)).toBe(true);
    // And a corpus with no known miss in it cannot support a recall claim at
    // all -- it can only report the instrument's own output back to itself.
    expect(LABELLED.some((c) => c.label === "defect" && !c.reported)).toBe(true);
    expect(LABELLED.some((c) => c.label === "not-a-defect" && !c.reported)).toBe(true);
  });

  test("cosine does not order these by how much they quote, so no threshold fixes the misses", () => {
    // The reason the two misses are not a tuning question, measured here rather
    // than asserted. `:419` quotes 80 characters of its ruling and scores 0.40;
    // `:607` quotes 79 and scores 0.55. `authoring-packaging-back-reference`
    // and `agents-numeric-heuristics` quote an identical 65 and land 0.28
    // apart, on opposite sides of the line. Cosine measures shared vocabulary
    // against a corpus; an exact run measures quotation, and the two disagree.
    //
    // What follows from it: a second signal reaches this class and a threshold
    // does not. An N-character run shared with an uncited ruling needs no
    // corpus, no threshold and no version to be a finding, which is the same
    // property that made the IDF worth pinning.
    const runs = new Map(
      LABELLED.map((c) => {
        const ruling = RULINGS_AT_REVISION.find((r) => r.id === c.ruling);
        if (ruling === undefined) throw new Error(`case cites a ruling outside the corpus: ${c.id}`);
        return [c.id, longestSharedRun(c.text, ruling.text)] as const;
      }),
    );

    // Sanity on the instrument doing the measuring, so a broken helper cannot
    // make the inversion disappear by returning zero for everything.
    expect(runs.get("authoring-second-lifecycle-entrypoint")).toBe(80);
    expect(runs.get("authoring-repeated-failure")).toBe(79);

    const missedDefects = LABELLED.filter((c) => c.label === "defect" && !c.reported);
    const inversions = missedDefects.flatMap((missed) =>
      LABELLED.filter((c) => c.reported && (runs.get(c.id) ?? 0) <= (runs.get(missed.id) ?? 0)).map((c) => ({
        missed: missed.id,
        reported: c.id,
      })),
    );
    expect(inversions.length).toBeGreaterThan(0);
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
