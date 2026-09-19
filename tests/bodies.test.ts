import { describe, expect, test } from "bun:test";

import { loadCatalog } from "../src/catalog/load.ts";
import {
  ANTI_RATIONALIZATION_HEADER,
  MANDATORY_NEVER_RULINGS,
  PRODUCING_SEATS,
  PROTOCOL_SECTIONS,
  ROLE_FORBIDDEN_SECTIONS,
  ROLE_SECTIONS,
  STANDARDS_GATE_TIER,
  STANDARDS_GROUNDING_ROW,
  checkBodyShapes,
} from "../src/validation/bodies.ts";
import { checkCompleteness } from "../src/validation/completeness.ts";
import { makeTree } from "./helpers/tree.ts";

const CATALOG_HEAD = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
`;

const TABLE = [
  ANTI_RATIONALIZATION_HEADER,
  "|---|---|---|",
  '| "The lane did not run but the others agreed." | An unavailable required lane is not a passing lane (ruling `required-lane-failure-is-unavailable`). | Mark it unavailable and block. |',
  "",
].join("\n");

function sectionBody(heading: string): string {
  if (heading === "## Hard gates" || heading === "## Rationalizations this seat makes") return TABLE;
  // The two universal rows plus the plain authorship row: the shape §12.2 puts
  // in twenty-seven of the twenty-nine seats. Defined below, next to the other
  // governed rows, so the whole contract reads in one place.
  if (heading === "## Never") return COMPLIANT_JUDGING_SEAT;
  return "Prose for this section.\n";
}

function body(title: string, sections: ReadonlyArray<string>): string {
  return [`# ${title}`, "", ...sections.map((h) => `${h}\n\n${sectionBody(h)}`)].join("\n");
}

const protocolBody = (sections: ReadonlyArray<string> = PROTOCOL_SECTIONS): string => body("Alpha", sections);
const roleBody = (sections: ReadonlyArray<string> = ROLE_SECTIONS): string => body("Seat", sections);

function ctxFor(files: Record<string, string>): { root: string; catalog: NonNullable<ReturnType<typeof loadCatalog>["catalog"]> } {
  const root = makeTree(files);
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

function protocolTree(extra: Record<string, string> = {}, sections?: ReadonlyArray<string>) {
  return ctxFor({
    "catalog.yaml": `${CATALOG_HEAD}protocols:\n  - id: alpha\n    status: authored\n`,
    "protocols/alpha/PROTOCOL.md": protocolBody(sections),
    ...extra,
  });
}

function roleTree(extra: Record<string, string> = {}, sections?: ReadonlyArray<string>) {
  return ctxFor({
    "catalog.yaml": `${CATALOG_HEAD}roles:\n  - id: seat\n    status: authored\n`,
    "roles/seat/ROLE.md": roleBody(sections),
    ...extra,
  });
}

const errors = (issues: ReturnType<typeof checkBodyShapes>) => issues.filter((i) => i.severity === "error");

describe("protocol body shape (AUTHORING 12.1)", () => {
  test("a protocol carrying all ten sections with Invoked by passes", () => {
    expect(errors(checkBodyShapes(protocolTree()))).toEqual([]);
  });

  test("a protocol missing ## Invoked by is an error naming the heading", () => {
    const ctx = protocolTree({}, PROTOCOL_SECTIONS.filter((h) => h !== "## Invoked by"));
    const issue = errors(checkBodyShapes(ctx)).find((i) => i.rule === "body.missing-section");
    expect(issue?.file).toBe("protocols/alpha/PROTOCOL.md");
    expect(issue?.message).toContain("## Invoked by");
  });

  test("a protocol carrying ## Authority is an error saying it holds none of its own", () => {
    const sections = PROTOCOL_SECTIONS.map((h) => (h === "## Invoked by" ? "## Authority" : h));
    const issues = errors(checkBodyShapes(protocolTree({}, sections)));
    const forbidden = issues.find((i) => i.rule === "body.forbidden-section");
    expect(forbidden?.message).toContain("## Authority");
    expect(forbidden?.message).toContain("## Invoked by");
    expect(issues.some((i) => i.rule === "body.missing-section")).toBe(true);
  });

  test("the ten sections must appear in order", () => {
    const swapped = [...PROTOCOL_SECTIONS];
    const a = swapped[4] as string;
    swapped[4] = swapped[5] as string;
    swapped[5] = a;
    const issue = errors(checkBodyShapes(protocolTree({}, swapped))).find((i) => i.rule === "body.sections-out-of-order");
    expect(issue?.message).toContain("## Hard gates");
  });

  test("an extra section between two required ones is an error; after the last one it is allowed", () => {
    const inserted = [...PROTOCOL_SECTIONS.slice(0, 5), "## Notes", ...PROTOCOL_SECTIONS.slice(5)];
    const issue = errors(checkBodyShapes(protocolTree({}, inserted))).find((i) => i.rule === "body.section-inserted");
    expect(issue?.message).toContain("## Notes");
    expect(errors(checkBodyShapes(protocolTree({}, [...PROTOCOL_SECTIONS, "## Notes"])))).toEqual([]);
  });

  test("a protocol whose ## Hard gates carries no anti-rationalization table is an error", () => {
    const withoutTable = protocolBody().replace(TABLE, "Prose instead of the table.\n");
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_HEAD}protocols:\n  - id: alpha\n    status: authored\n`,
      "protocols/alpha/PROTOCOL.md": withoutTable,
    });
    const issue = errors(checkBodyShapes(ctx)).find((i) => i.rule === "body.missing-anti-rationalization-table");
    expect(issue?.message).toContain("## Hard gates");
  });

  test("frontmatter on a protocol is an error: the packager emits none", () => {
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_HEAD}protocols:\n  - id: alpha\n    status: authored\n`,
      "protocols/alpha/PROTOCOL.md": `---\nname: alpha\n---\n${protocolBody()}`,
    });
    const issue = errors(checkBodyShapes(ctx)).find((i) => i.rule === "body.frontmatter-forbidden");
    expect(issue?.file).toBe("protocols/alpha/PROTOCOL.md");
    expect(issue?.message).toContain("frontmatter");
  });

  test("a protocol.yaml sidecar is an error: the catalog entry plus the prose is the contract", () => {
    const issue = errors(checkBodyShapes(protocolTree({ "protocols/alpha/protocol.yaml": "id: alpha\n" }))).find(
      (i) => i.rule === "body.sidecar-forbidden",
    );
    expect(issue?.file).toBe("protocols/alpha/protocol.yaml");
    expect(issue?.message).toContain("no execution contract of its own");
  });
});

describe("role body shape (AUTHORING 12.2)", () => {
  test("a role carrying the required headings and neither forbidden one passes", () => {
    expect(errors(checkBodyShapes(roleTree()))).toEqual([]);
  });

  test("a role missing ## Evidence it must cite is an error naming the heading", () => {
    const ctx = roleTree({}, ROLE_SECTIONS.filter((h) => h !== "## Evidence it must cite"));
    const issue = errors(checkBodyShapes(ctx)).find((i) => i.rule === "body.missing-section");
    expect(issue?.message).toContain("## Evidence it must cite");
  });

  test("## Side effects in a role is an error saying the work belongs in a skill or protocol", () => {
    const ctx = roleTree({}, [...ROLE_SECTIONS, "## Side effects"]);
    const issue = errors(checkBodyShapes(ctx)).find((i) => i.rule === "body.forbidden-section");
    expect(issue?.message).toContain("## Side effects");
    expect(issue?.message).toMatch(/a role has none/i);
    expect(issue?.message).toMatch(/skill or a protocol/i);
  });

  test("every forbidden role heading is rejected, each with its own reason", () => {
    for (const heading of ROLE_FORBIDDEN_SECTIONS) {
      const ctx = roleTree({}, [...ROLE_SECTIONS, heading]);
      const issue = errors(checkBodyShapes(ctx)).find((i) => i.rule === "body.forbidden-section");
      expect(issue?.message).toContain(heading);
      expect(issue?.message.length).toBeGreaterThan(heading.length + 20);
    }
  });

  test("## Rationalizations this seat makes comes last", () => {
    const moved = ["## What this seat judges", "## Not this seat", "## Evidence it must cite", "## Never", "## Rationalizations this seat makes", "## What it returns", "## When it has nothing to say"];
    const issue = errors(checkBodyShapes(roleTree({}, moved))).find((i) => i.rule === "body.sections-out-of-order");
    expect(issue?.message).toContain("## Rationalizations this seat makes");
  });

  test("a ## Never that carries neither universal row is an error naming both rulings", () => {
    const issues = errors(checkBodyShapes(seatTree("seat", "- The seat never edits.\n"))).filter(
      (i) => i.rule === "role.missing-universal-never-row",
    );
    expect(issues.map((i) => i.message).join(" ")).toContain(MANDATORY_NEVER_RULINGS[0] as string);
    expect(issues.map((i) => i.message).join(" ")).toContain(MANDATORY_NEVER_RULINGS[1] as string);
  });

  test("a seat may add a section of its own between the required ones; only the order of the required set is fixed", () => {
    const withOwn = [...ROLE_SECTIONS.slice(0, 3), "## How this seat reads a diff", ...ROLE_SECTIONS.slice(3)];
    expect(errors(checkBodyShapes(roleTree({}, withOwn)))).toEqual([]);
  });

  test("a role whose ## Rationalizations this seat makes carries no table is an error", () => {
    const withoutTable = roleBody().replace(TABLE, "The seat has no rationalizations.\n");
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_HEAD}roles:\n  - id: seat\n    status: authored\n`,
      "roles/seat/ROLE.md": withoutTable,
    });
    const issue = errors(checkBodyShapes(ctx)).find((i) => i.rule === "body.missing-anti-rationalization-table");
    expect(issue?.message).toContain("## Rationalizations this seat makes");
  });

  test("a role.yaml sidecar is an error", () => {
    const issue = errors(checkBodyShapes(roleTree({ "roles/seat/role.yaml": "id: seat\n" }))).find(
      (i) => i.rule === "body.sidecar-forbidden",
    );
    expect(issue?.file).toBe("roles/seat/role.yaml");
  });

  test("a role nested more than one level is an error", () => {
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_HEAD}roles:\n  - id: code-review/deep/security\n    status: authored\n`,
      "roles/code-review/deep/security/ROLE.md": roleBody(),
    });
    const issue = errors(checkBodyShapes(ctx)).find((i) => i.rule === "body.role-nesting-too-deep");
    expect(issue?.message).toContain("code-review/deep/security");
  });
});

describe("the body file is named by kind", () => {
  test("a wrongly named body file in protocols/ is an error naming the file and the expected name", () => {
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_HEAD}protocols:\n  - id: alpha\n    status: authored\n`,
      "protocols/alpha/README.md": protocolBody(),
    });
    const issue = checkCompleteness(ctx).find((i) => i.rule === "catalog.unexpected-body-name");
    expect(issue?.severity).toBe("error");
    expect(issue?.file).toBe("protocols/alpha/README.md");
    expect(issue?.message).toContain("PROTOCOL.md");
  });

  test("a wrongly named body file in roles/ is an error", () => {
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_HEAD}roles:\n  - id: seat\n    status: authored\n`,
      "roles/seat/SEAT.md": roleBody(),
    });
    const issue = checkCompleteness(ctx).find((i) => i.rule === "catalog.unexpected-body-name");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("ROLE.md");
  });

  test("a wrongly named body file in references/ stays a warning", () => {
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_HEAD}references:\n  - id: guide\n    status: authored\n`,
      "references/guide/NOTES.md": "# Notes\n",
    });
    const issue = checkCompleteness(ctx).find((i) => i.rule === "catalog.unexpected-body-name");
    expect(issue?.severity).toBe("warning");
  });
});

describe("loose doctrine files (AUTHORING 12.3)", () => {
  test("a loose .md at a section root has no catalog entry and is never an orphan", () => {
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_HEAD}protocols:\n  - id: alpha\n    status: authored\n`,
      "protocols/alpha/PROTOCOL.md": protocolBody(),
      "protocols/invocation-authority.md": "# Invocation authority\n\nDoctrine, not a catalog entry.\n",
    });
    const flagged = [...checkCompleteness(ctx), ...checkBodyShapes(ctx)].filter(
      (i) => i.file.includes("invocation-authority"),
    );
    expect(flagged).toEqual([]);
  });

  test("a loose .md is not mistaken for an unnamed body of a sibling entry", () => {
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_HEAD}protocols:\n  - id: alpha\n    status: authored\n`,
      "protocols/alpha/PROTOCOL.md": protocolBody(),
      "protocols/invocation-authority.md": "# Invocation authority\n",
    });
    expect(checkCompleteness(ctx).filter((i) => i.severity === "error")).toEqual([]);
  });
});

describe("unauthored and absent trees", () => {
  test("a protocol declared with status: contract and no directory reports nothing here", () => {
    const ctx = ctxFor({ "catalog.yaml": `${CATALOG_HEAD}protocols:\n  - id: alpha\n    status: contract\n` });
    expect(checkBodyShapes(ctx)).toEqual([]);
  });

  test("a catalog with no protocols or roles reports nothing here", () => {
    expect(checkBodyShapes(ctxFor({ "catalog.yaml": CATALOG_HEAD }))).toEqual([]);
  });
});

/**
 * The four governed `## Never` rows, written out the way §12.2 words them.
 *
 * Literal on purpose, and wrapped at awkward points on purpose: building them
 * from the checker's own clause constants would only assert that the checker
 * agrees with itself, and the line breaks are what prove the match survives a
 * reflow. The existing bodies wrap these across three lines at different points.
 */
const CLOSURE_ROW = [
  "1. **Only independent verification closes a finding.** Reading a patch is the author's",
  "   confidence, not a receipt, and no seat closes what it produced (ruling",
  "   `closure-requires-independent-verification`).",
].join("\n");

const UNAVAILABLE_ROW = [
  "2. **A lane that could not run returns `unavailable`.** That is a result, not an absence:",
  "   never an empty result, and never backfilled by the author, another seat or the",
  "   synthesis step (ruling `required-lane-failure-is-unavailable`).",
].join("\n");

/** The same row with the break falling inside the matched clause. */
const UNAVAILABLE_ROW_REFLOWED = [
  "2. **A lane that could not",
  "   run returns `unavailable`.** Never backfilled by another seat (ruling",
  "   `required-lane-failure-is-unavailable`).",
].join("\n");

const PLAIN_AUTHORSHIP_ROW = "3. **This seat never edits: it judges and returns.**";

const CONVERSE_AUTHORSHIP_ROW = [
  "3. **This seat writes the patch its approved ticket allows.** It never writes a finding, a",
  "   receipt, a review record or a ticket, and never closes or approves what it produced.",
].join("\n");

const STANDARDS_ROW = [
  "4. **This seat cites an actual project rule or returns empty.** An absent standard is",
  "   never an invented preference.",
].join("\n");

function neverSection(rows: ReadonlyArray<string>): string {
  return `${rows.join("\n")}\n`;
}

/** A role body whose `## Never` is exactly the given rows. */
function seatBody(never: string): string {
  return body("Seat", ROLE_SECTIONS).replace(sectionBody("## Never"), never);
}

function seatTree(id: string, never: string, catalogRows = "", extra: Record<string, string> = {}) {
  return ctxFor({
    "catalog.yaml": `${CATALOG_HEAD}roles:\n  - id: ${id}\n    status: authored\n${catalogRows}`,
    [`roles/${id}/ROLE.md`]: seatBody(never),
    ...extra,
  });
}

const COMPLIANT_JUDGING_SEAT = neverSection([CLOSURE_ROW, UNAVAILABLE_ROW, PLAIN_AUTHORSHIP_ROW]);

describe("the two universal ## Never rows (AUTHORING 12.2)", () => {
  test("a seat carrying both universal rows and the plain authorship row passes", () => {
    expect(errors(checkBodyShapes(seatTree("seat", COMPLIANT_JUDGING_SEAT)))).toEqual([]);
  });

  test("a missing universal row is an error naming the ruling it cites", () => {
    const issues = errors(checkBodyShapes(seatTree("seat", neverSection([CLOSURE_ROW, PLAIN_AUTHORSHIP_ROW])))).filter(
      (i) => i.rule === "role.missing-universal-never-row",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("required-lane-failure-is-unavailable");
  });

  test("the citation alone does not satisfy the row; the distinguishing clause must be there too", () => {
    const hollow = "2. Some other prohibition entirely (ruling `required-lane-failure-is-unavailable`).";
    const issues = errors(checkBodyShapes(seatTree("seat", neverSection([CLOSURE_ROW, hollow, PLAIN_AUTHORSHIP_ROW])))).filter(
      (i) => i.rule === "role.missing-universal-never-row",
    );
    expect(issues).toHaveLength(1);
  });

  test("the clause alone does not satisfy the row either; the citation must be there too", () => {
    const uncited = "2. **A lane that could not run returns `unavailable`.** Never backfilled.";
    const issues = errors(checkBodyShapes(seatTree("seat", neverSection([CLOSURE_ROW, uncited, PLAIN_AUTHORSHIP_ROW])))).filter(
      (i) => i.rule === "role.missing-universal-never-row",
    );
    expect(issues).toHaveLength(1);
  });

  test("the citation and the clause must sit in the same row, not merely in the section", () => {
    const split = neverSection([
      CLOSURE_ROW,
      "2. **A lane that could not run returns `unavailable`.** Never backfilled.",
      "3. An unrelated prohibition (ruling `required-lane-failure-is-unavailable`).",
      PLAIN_AUTHORSHIP_ROW,
    ]);
    expect(
      errors(checkBodyShapes(seatTree("seat", split))).filter((i) => i.rule === "role.missing-universal-never-row"),
    ).toHaveLength(1);
  });

  test("a line break inside the matched clause does not produce a false error", () => {
    const reflowed = neverSection([CLOSURE_ROW, UNAVAILABLE_ROW_REFLOWED, PLAIN_AUTHORSHIP_ROW]);
    expect(
      errors(checkBodyShapes(seatTree("seat", reflowed))).filter((i) => i.rule === "role.missing-universal-never-row"),
    ).toEqual([]);
  });
});

describe("the conditional authorship row (AUTHORING 12.2)", () => {
  test("a judging seat carries the plain form", () => {
    expect(
      errors(checkBodyShapes(seatTree("seat", COMPLIANT_JUDGING_SEAT))).filter((i) => i.rule === "role.authorship-row-mismatch"),
    ).toEqual([]);
  });

  test.each(["implementer", "plan-review/planner"])("the producing seat %s carries the converse", (id) => {
    const never = neverSection([CLOSURE_ROW, UNAVAILABLE_ROW, CONVERSE_AUTHORSHIP_ROW]);
    expect(
      errors(checkBodyShapes(seatTree(id, never))).filter((i) => i.rule === "role.authorship-row-mismatch"),
    ).toEqual([]);
  });

  test("a producing seat claiming it never edits is an error: that is the bug the split exists to catch", () => {
    const issue = errors(checkBodyShapes(seatTree("implementer", COMPLIANT_JUDGING_SEAT))).find(
      (i) => i.rule === "role.authorship-row-mismatch",
    );
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("implementer");
  });

  test("a producing seat that carries neither form is an error", () => {
    const never = neverSection([CLOSURE_ROW, UNAVAILABLE_ROW]);
    const issue = errors(checkBodyShapes(seatTree("implementer", never))).find((i) => i.rule === "role.authorship-row-mismatch");
    expect(issue?.severity).toBe("error");
  });

  test("a judging seat carrying the converse is an error: only two seats produce", () => {
    const never = neverSection([CLOSURE_ROW, UNAVAILABLE_ROW, CONVERSE_AUTHORSHIP_ROW]);
    const issue = errors(checkBodyShapes(seatTree("supervisor", never))).find((i) => i.rule === "role.authorship-row-mismatch");
    expect(issue?.severity).toBe("error");
  });

  test("a judging seat carrying no authorship row at all is an error", () => {
    const never = neverSection([CLOSURE_ROW, UNAVAILABLE_ROW]);
    const issue = errors(checkBodyShapes(seatTree("supervisor", never))).find((i) => i.rule === "role.authorship-row-mismatch");
    expect(issue?.severity).toBe("error");
  });

  test("the producing seats are a closed list, not something read off the bodies", () => {
    expect([...PRODUCING_SEATS].sort()).toEqual(["implementer", "plan-review/planner"]);
  });
});

describe("the conditional standards-grounding row (AUTHORING 12.2)", () => {
  const withStandards = neverSection([CLOSURE_ROW, UNAVAILABLE_ROW, PLAIN_AUTHORSHIP_ROW, STANDARDS_ROW]);

  test("reviewer-standards is named in the contract and carries the row", () => {
    expect(
      errors(checkBodyShapes(seatTree("reviewer-standards", withStandards))).filter(
        (i) => i.rule === "role.standards-row-mismatch",
      ),
    ).toEqual([]);
  });

  test("the second standards seat is derived from the catalog's tier, not hardcoded", () => {
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_HEAD}roles:\n  - id: code-review/project-standards\n    status: authored\n    tier: ${STANDARDS_GATE_TIER}\n`,
      "roles/code-review/project-standards/ROLE.md": seatBody(withStandards),
    });
    expect(errors(checkBodyShapes(ctx)).filter((i) => i.rule === "role.standards-row-mismatch")).toEqual([]);
  });

  test("a batch-2 seat that acquires the standards tier picks the row up automatically", () => {
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_HEAD}roles:\n  - id: code-review/newcomer\n    status: authored\n    tier: ${STANDARDS_GATE_TIER}\n`,
      "roles/code-review/newcomer/ROLE.md": seatBody(COMPLIANT_JUDGING_SEAT),
    });
    const issue = errors(checkBodyShapes(ctx)).find((i) => i.rule === "role.standards-row-mismatch");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("code-review/newcomer");
  });

  test("a standards seat missing the row is an error", () => {
    const issue = errors(checkBodyShapes(seatTree("reviewer-standards", COMPLIANT_JUDGING_SEAT))).find(
      (i) => i.rule === "role.standards-row-mismatch",
    );
    expect(issue?.severity).toBe("error");
  });

  test("a seat that does not judge against a project standard carrying the row is an error", () => {
    const issue = errors(checkBodyShapes(seatTree("supervisor", withStandards))).find(
      (i) => i.rule === "role.standards-row-mismatch",
    );
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("supervisor");
  });

  test("the standards row carries no ruling citation, and no rulings check demands one", () => {
    const issues = checkBodyShapes(seatTree("reviewer-standards", withStandards));
    expect(issues.filter((i) => i.rule.startsWith("rulings."))).toEqual([]);
    expect(STANDARDS_GROUNDING_ROW.ruling).toBeNull();
  });

  test("a role tier other than the standards gate does not pull the row in", () => {
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_HEAD}roles:\n  - id: code-review/correctness\n    status: authored\n    tier: always-on\n`,
      "roles/code-review/correctness/ROLE.md": seatBody(COMPLIANT_JUDGING_SEAT),
    });
    expect(errors(checkBodyShapes(ctx)).filter((i) => i.rule === "role.standards-row-mismatch")).toEqual([]);
  });
});
