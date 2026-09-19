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

interface Measured {
  /** The cosine this case's own ruling was given in this case's block. */
  readonly score: number;
  /** Whether that ruling leads some window in the block, rather than trailing one. */
  readonly leads: boolean;
}

/** Every case in its own body, so one case cannot cite or shadow another. */
function scanAll(): Map<string, Measured> {
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
  const scored = new Map<string, Measured>();
  for (const item of LABELLED) {
    const path = pathFor(item);
    const lines = `${item.text}\n`.split("\n");
    const at = lines.findIndex((line) => line.includes(item.anchor));
    if (at < 0) throw new Error(`anchor missing from captured text: ${item.id}`);
    let lo = at;
    let hi = at;
    while (lo > 0 && (lines[lo - 1] ?? "").trim() !== "") lo--;
    while (hi < lines.length - 1 && (lines[hi + 1] ?? "").trim() !== "") hi++;
    // And it is the score this case's *ruling* was given, not the block's
    // leader. A block can be led by an unrelated window naming a different
    // ruling -- `review-delta-novelty-evidence` is led by a `two-fix-cycles`
    // window at 0.34 while the clause the case is about scores 0.30 -- and
    // storing the leader would put a number in the fixture that describes a
    // sentence the case is not about.
    const wanted = new RegExp(`\`${item.ruling}\` \\((\\d\\.\\d+)\\)`);
    const inBlock = issues.filter((i) => i.file === path && (i.line ?? 0) >= lo + 1 && (i.line ?? 0) <= hi + 1);
    const best = inBlock.map((i) => Number(wanted.exec(i.message)?.[1] ?? 0));
    // Leading matters separately from scoring. The check prints ranked
    // candidates precisely because the leader is often the wrong sibling, so a
    // ruling that only ever trails is one this text does not restate.
    const leads = inBlock.some((i) => /`([a-z-]+)` \(\d\.\d+\)/.exec(i.message)?.[1] === item.ruling);
    scored.set(item.id, { score: Math.max(0, ...best), leads });
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
      expect(scores.get(item.id)?.score ?? 0).toBeGreaterThanOrEqual(RESTATEMENT_THRESHOLD);
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
      expect(scores.get(item.id)?.score ?? 0).toBeLessThan(RESTATEMENT_THRESHOLD);

      // And it is not the shared-nothing-vocabulary blind spot. The check
      // scores these well above zero and ranks the right ruling first; the
      // threshold is what cuts them. A miss at zero and a miss at 0.50 are
      // different failures and only one of them is reachable by tuning.
      expect(scores.get(item.id)?.score ?? 0).toBeGreaterThan(0.25);
    });
  }

  for (const item of LABELLED.filter((c) => c.label === "not-a-defect")) {
    test(`${item.id} stays rejected: ${item.why.slice(0, 55)}...`, () => {
      // The guard in the other direction. Every case found by reading the
      // report is above the line by construction, so a change that dragged
      // rejections up across it would leave no trace in a set built only from
      // what the check already emits.
      expect(scores.get(item.id)?.score ?? 0).toBeLessThan(RESTATEMENT_THRESHOLD);
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
        reported: (scores.get(item.id)?.score ?? 0) >= RESTATEMENT_THRESHOLD,
      });
    }
  });

  test("each case names a ruling the check ranks first somewhere in its block", () => {
    // A weak invariant, deliberately, and worth being precise about what it
    // does and does not do.
    //
    // What catches a swapped ruling id is the drift test, because `score` is
    // the score of the case's *own* ruling: storing an id the text does not
    // restate moves the number, and the number is pinned. That is how the two
    // mis-attributions in this file were found -- one filed under
    // `supervisor-agreement-is-not-authority` whose 0.49 belonged to
    // `delta-baseline-reset-not-third-loop`, one under
    // `missing-supervisor-never-implementer` at 0.20 whose claim scores 0.50.
    // Both had a plausible id, a plausible number and a `why` describing the
    // right phenomenon; nothing measured whether the id and the number
    // belonged to each other, because `score` was the block's leader.
    //
    // This test catches the weaker failure the drift test cannot: a ruling
    // that scores but never leads, which the check would never propose for
    // this text and which therefore cannot be what the case is about.
    const wrong = LABELLED.filter((item) => {
      // A case whose captured unit cites its own ruling is suppressed by
      // design, so no window can name it. That is the file-scope rule working
      // and it is what `product-prototype-rationale` exists to hold.
      if (item.text.includes(item.ruling)) return false;
      return !(scores.get(item.id)?.leads ?? false);
    }).map((item) => ({ id: item.id, ruling: item.ruling }));
    expect(wrong).toEqual([]);
  });

  test("a suppressed case is suppressed by its own citation, not by a low score", () => {
    // The other half of that rule. `product-prototype-rationale` scores zero in
    // its file and 0.50 as an isolated block, and only the citation explains
    // the difference -- so the case is evidence about scope, not about cosine.
    // Without this, a change that merely stopped scoring the file would look
    // identical to the citation being honoured.
    for (const item of LABELLED.filter((c) => c.text.includes(c.ruling))) {
      expect({ id: item.id, score: scores.get(item.id)?.score ?? -1 }).toEqual({ id: item.id, score: 0 });
      expect(longestSharedRun(item.text, RULINGS_AT_REVISION.find((r) => r.id === item.ruling)?.text ?? "")).toBeGreaterThan(10);
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
    const drifted = LABELLED.map((item) => ({ id: item.id, was: item.score, now: scores.get(item.id)?.score ?? 0 })).filter(
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
