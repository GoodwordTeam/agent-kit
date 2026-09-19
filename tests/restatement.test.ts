import { describe, expect, test } from "bun:test";

import { loadCatalog } from "../src/catalog/load.ts";
import { RESTATEMENT_THRESHOLD, checkRestatements } from "../src/validation/restatement.ts";
import { makeTree } from "./helpers/tree.ts";

const CATALOG_HEAD = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
`;

/**
 * A ruling whose text is distinctive enough that a near-verbatim restatement
 * scores high on any sane lexical measure. The fixtures pin behaviour, never a
 * score: the corpus here is four documents and the live one is hundreds, so an
 * assertion on a cosine value would be an assertion about the fixture.
 */
const LANE = [
  "A required lane that cannot be filled under the declared constraints is unavailable,",
  "and unavailability blocks the phase; it is never backfilled by the author who needed it.",
].join(" ");

const SEAT = [
  "A supervisor never takes the implementer seat in the same cycle it supervises,",
  "and a cycle with no distinct implementer is unavailable rather than merged.",
].join(" ");

/**
 * Rulings the tests never reference by name, present so that inverse document
 * frequency means something.
 *
 * The corpus the weights are computed over is the ruling list, so the size of
 * that list is not a fixture detail. With two rulings, `log(N / (1 + df))` is
 * zero for every word in exactly one of them and negative for the two words
 * they share -- so every score the fixture produced was carried by negative
 * weights on shared vocabulary, a regime the live list of nineteen never
 * enters. The tests still passed, because they assert lines and counts rather
 * than numbers, but they were passing on the wrong mechanism, and nothing that
 * depends on one score being larger than another could be written at all.
 */
const BALLAST: ReadonlyArray<readonly [string, string]> = [
  ["closure-requires-independent-verification", "Only verification independent of the author closes a finding, and reviewer confidence is advisory rather than evidence."],
  ["delta-scope-affected-behavior", "A delta review is bounded by affected behaviour rather than by changed lines, and a serious issue in an untouched caller stays reportable."],
  ["two-fix-cycles-then-stop", "Two repair cycles then stop; whatever remains open is reported with its evidence attached rather than looped a third time."],
  ["numeric-heuristics-are-guidance", "Numeric targets are configurable starting points, and an exception is recorded rather than forcing an artificial split."],
  ["central-kb-owns-project-artifacts", "Project narrative belongs to the knowledgebase adapter, and no skill writes a document tree into the working repository."],
  ["panel-composition-by-declared-risk", "Panel membership follows the declared risk of the change, not the preference of whoever assembled the panel."],
  ["reviewer-continuity-not-amnesia", "A fresh reviewer means independent of the author, not forgetful between cycles; the prior packet travels with the seat."],
  ["entrypoint-phase-operation-split", "A human starts an entrypoint and a delegated controller starts a phase operation, and neither borrows the other's authority."],
];

function policy(): string {
  const row = (id: string, ruling: string, scenario: number) => [
    `  - id: ${id}`,
    "    tension: they disagreed",
    "    ruling: >-",
    `      ${ruling}`,
    `    scenario: ${scenario}`,
    "    coverage: direct",
  ];
  return [
    "schema_version: 1",
    "policy: resolved-conflicts",
    `rows: ${2 + BALLAST.length}`,
    "",
    "conflicts:",
    ...row("required-lane-failure-is-unavailable", LANE, 3),
    ...row("missing-supervisor-never-implementer", SEAT, 4),
    ...BALLAST.flatMap(([id, ruling], index) => row(id, ruling, 5 + index)),
  ].join("\n");
}

/**
 * Filler, because inverse document frequency is defined over a corpus and a
 * corpus of four documents is not one. In a tiny tree a word shared by a ruling
 * and the body restating it appears in a large fraction of all documents and is
 * weighted down to nothing, which is a property of the measure rather than of
 * these fixtures -- the live tree carries hundreds of windows. The filler shares
 * no vocabulary with either ruling, so it changes the denominator and nothing
 * else.
 */
function filler(): Record<string, string> {
  const topics = [
    "The packager copies each bundle into its host directory and writes a manifest beside it.",
    "A profile lists the skills a bundle includes, and resolving one yields that membership.",
    "Frontmatter carries the name and description a host loader reads before anything else.",
    "The catalog records identifiers, status and batch for every artifact the package ships.",
    "A schema compiles once and validates many documents against the draft it declares.",
    "Link rewriting maps a source path onto its published location inside the bundle.",
    "Hashes of the input files make a receipt reproducible for whoever reads it later.",
    "Budget accounting counts iterations and repairs against caps the runner supplies.",
  ];
  const files: Record<string, string> = {};
  for (const [index, topic] of topics.entries()) {
    files[`references/filler-${index}/REFERENCE.md`] = `# Filler ${index}\n\n${topic}\n\n${topic} ${topic}\n`;
  }
  return files;
}

function ctxFor(files: Record<string, string>) {
  const root = makeTree({ "catalog.yaml": CATALOG_HEAD, "policies/resolved-conflicts.yaml": policy(), ...filler(), ...files });
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

const hits = (issues: ReturnType<typeof checkRestatements>) => issues.filter((i) => i.rule === "rulings.uncited-restatement");

/** The leading candidate's cosine, as the report prints it. */
const score = (message: string | undefined) => /\((\d\.\d+)\)/.exec(message ?? "")?.[1];

describe("a window restating a ruling without attributing it (AUTHORING 6)", () => {
  test("a near-verbatim uncited restatement is reported at the line it is on", () => {
    const doc = `# Doctrine\n\nSomething unrelated entirely.\n\nA required lane that cannot be filled under the declared constraints is unavailable, and unavailability blocks the phase.\n`;
    const issue = hits(checkRestatements(ctxFor({ "protocols/loose.md": doc })))[0];
    expect(issue?.file).toBe("protocols/loose.md");
    expect(issue?.line).toBe(5);
  });

  test("it is a warning, because a lexical instrument cannot carry a gate", () => {
    const doc = `# Doctrine\n\nA required lane that cannot be filled under the declared constraints is unavailable, and unavailability blocks the phase.\n`;
    expect(hits(checkRestatements(ctxFor({ "protocols/loose.md": doc })))[0]?.severity).toBe("warning");
  });

  test("the same claim with the ruling cited beside it is not reported", () => {
    const doc = `# Doctrine\n\nA required lane that cannot be filled under the declared constraints is unavailable, and unavailability blocks the phase (ruling \`required-lane-failure-is-unavailable\`).\n`;
    expect(hits(checkRestatements(ctxFor({ "protocols/loose.md": doc })))).toEqual([]);
  });

  test("an adjacent block's citation does not carry, because each clause owes its own", () => {
    // A ruling with N independent clauses generates N citation obligations, not
    // one per file or one per neighbourhood. The live case: two consecutive
    // `Gate:` paragraphs state different clauses of the same ruling, and both
    // cite it. A scope that reached one block back would have told the second
    // gate it was already attributed.
    const doc = [
      "# Doctrine",
      "",
      "The rule here is set out in ruling `required-lane-failure-is-unavailable`, which §7 enforces.",
      "",
      "A required lane that cannot be filled under the declared constraints is unavailable, and unavailability blocks the phase.",
      "",
    ].join("\n");
    expect(hits(checkRestatements(ctxFor({ "protocols/loose.md": doc }))).length).toBe(1);
  });

  test("a citation two blocks away does not reach the claim", () => {
    const doc = [
      "# Doctrine",
      "",
      "The rule here is set out in ruling `required-lane-failure-is-unavailable`, which §7 enforces.",
      "",
      "An intervening paragraph about something else entirely, with its own separate subject matter.",
      "",
      "A required lane that cannot be filled under the declared constraints is unavailable, and unavailability blocks the phase.",
      "",
    ].join("\n");
    expect(hits(checkRestatements(ctxFor({ "protocols/loose.md": doc }))).length).toBe(1);
  });

  test("a citation elsewhere in the file does not clear the window, since the unit is the claim", () => {
    const doc = [
      "# Doctrine",
      "",
      "An unrelated paragraph that cites ruling `required-lane-failure-is-unavailable` about something else.",
      "",
      "Filler that shares no vocabulary with anything.",
      "",
      "A required lane that cannot be filled under the declared constraints is unavailable, and unavailability blocks the phase.",
      "",
    ].join("\n");
    expect(hits(checkRestatements(ctxFor({ "protocols/loose.md": doc }))).length).toBe(1);
  });

  test("a citation earlier in the same section does not clear the claim", () => {
    // Widening the scope from the block to the enclosing section was proposed
    // twice and refused twice, so it is pinned here rather than argued again.
    // The live case it breaks: `AUTHORING.md` 10 spans 517-644, `:601` cites
    // `two-fix-cycles-then-stop`, and `:607` reproduces that ruling's third
    // sentence verbatim while citing a different one. Section scope finds the
    // id six lines up and calls the restatement attributed.
    const doc = [
      "# Doctrine",
      "",
      "## The section",
      "",
      "At most two attempts, then stop (ruling `required-lane-failure-is-unavailable`).",
      "",
      "A required lane that cannot be filled under the declared constraints is unavailable, and unavailability blocks the phase.",
      "",
    ].join("\n");
    expect(hits(checkRestatements(ctxFor({ "protocols/loose.md": doc }))).length).toBe(1);
  });

  test("the candidates are ranked and more than one is offered, because siblings invert", () => {
    const doc = `# Doctrine\n\nA required lane that cannot be filled under the declared constraints is unavailable, and a supervisor never takes the implementer seat in the same cycle.\n`;
    const issue = hits(checkRestatements(ctxFor({ "protocols/loose.md": doc })))[0];
    expect(issue?.message).toContain("required-lane-failure-is-unavailable");
    expect(issue?.message).toContain("missing-supervisor-never-implementer");
  });

  test("one claim is one finding, not one per window that covers it", () => {
    // The 1-, 2- and 3-sentence windows over the same paragraph are the same
    // claim measured three ways. Reporting each would tell an author to repair
    // one sentence three times.
    const doc = [
      "# Doctrine",
      "",
      "A required lane that cannot be filled under the declared constraints is unavailable.",
      "Unavailability blocks the phase and it is never backfilled by the author who needed it.",
      "",
    ].join("\n");
    expect(hits(checkRestatements(ctxFor({ "protocols/loose.md": doc }))).length).toBe(1);
  });

  test("the policy file is never scanned against itself", () => {
    expect(hits(checkRestatements(ctxFor({})))).toEqual([]);
  });

  test("prose sharing no vocabulary with any ruling is not reported", () => {
    const doc = `# Doctrine\n\nThe packager copies each bundle into its host directory and writes a manifest beside it.\n`;
    expect(hits(checkRestatements(ctxFor({ "protocols/loose.md": doc })))).toEqual([]);
  });
});

describe("a score means the same thing twice, or it ranks nothing", () => {
  test("an unrelated file elsewhere in the tree does not move the score", () => {
    // The corpus the IDF is computed over is the ruling texts, so a score is a
    // function of the claim and the rulings and of nothing else. Computed over
    // the scanned windows as well, it was a function of every file in the
    // repository: on the live tree an unrelated commit touching one document
    // moved four reports across the threshold. Rows appearing and disappearing
    // read as "someone stopped citing this", which is not what happened, and a
    // reviewer cannot tell the two apart from the output.
    const doc = `# Doctrine\n\nA required lane that cannot be filled under the declared constraints is unavailable, and unavailability blocks the phase.\n`;
    const alone = hits(checkRestatements(ctxFor({ "protocols/loose.md": doc })))[0];
    const crowded = hits(
      checkRestatements(
        ctxFor({
          "protocols/loose.md": doc,
          // Dense in exactly the words the subject shares with its ruling, which
          // is what drags their weight down when the windows are in the corpus.
          "protocols/unrelated.md": `# Other\n\n${"A required lane under the declared constraints is unavailable, and the supervisor holds the implementer seat. ".repeat(
            8,
          )}\n`,
        }),
      ),
    ).find((issue) => issue.file === "protocols/loose.md");
    expect(score(alone?.message)).toBeDefined();
    expect(score(crowded?.message)).toBe(score(alone?.message));
  });

  test("the reported window is the block's best, not the first one over the cutoff", () => {
    // Keeping the first window past the threshold made the printed line and
    // number depend on the threshold: lower it, and a weaker earlier window in
    // the same block claimed the slot and hid the stronger one behind it. The
    // same paragraph then reported two different scores at two settings.
    const doc = [
      "# Doctrine",
      "",
      "A required lane is a thing this document names.",
      "A required lane that cannot be filled under the declared constraints is unavailable, and unavailability blocks the phase.",
      "",
    ].join("\n");
    const ctx = ctxFor({ "protocols/loose.md": doc });
    const strict = hits(checkRestatements(ctx, 0.5))[0];
    const loose = hits(checkRestatements(ctx, 0.2))[0];
    expect(score(strict?.message)).toBeDefined();
    expect(score(loose?.message)).toBe(score(strict?.message));
    expect(loose?.line).toBe(strict?.line);
  });
});

describe("the scan reports its own reach, because a clean run is not an all-clear", () => {
  test("the coverage note is emitted even when nothing is flagged", () => {
    const note = checkRestatements(ctxFor({})).find((i) => i.rule === "rulings.restatement-scan-coverage");
    expect(note?.severity).toBe("note");
    expect(note?.message).toContain(String(RESTATEMENT_THRESHOLD));
  });

  test("the note says the instrument is lexical, so silence is not evidence", () => {
    const note = checkRestatements(ctxFor({})).find((i) => i.rule === "rulings.restatement-scan-coverage");
    expect(note?.message).toMatch(/lexical/i);
  });
});
