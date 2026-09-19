/**
 * Protocol and role body shapes (AUTHORING.md §12).
 *
 * §1-§11 describe a `SKILL.md`. Two further body shapes exist, and they are not
 * skills: a protocol is shared phase logic a skill delegates to, a role is a
 * prompt the runner fills a seat with. Neither is an entrypoint, so neither
 * carries host frontmatter and neither has an execution contract of its own —
 * the catalog entry plus the prose is the contract, which is why a
 * `protocol.yaml` or `role.yaml` on disk is an error rather than an extra.
 *
 * The section lists are the enforceable half of §12. A missing heading is a
 * missing decision; a forbidden heading means the writer described the wrong
 * thing, so every rejection names what to write instead.
 */

import { join } from "node:path";

import { entryDir, preferredBodyFile, type DirectorySection } from "../catalog/layout.ts";
import { exists, isDir, readTextIfPresent } from "../util/fs.ts";
import { parseFrontmatter } from "../util/frontmatter.ts";
import type { CheckContext } from "./context.ts";
import { error, note, type Issue } from "./types.ts";

/** §3's ten headings with `## Authority` replaced by `## Invoked by` (§12.1). */
export const PROTOCOL_SECTIONS: ReadonlyArray<string> = [
  "## When to use",
  "## Not for",
  "## Invoked by",
  "## Inputs",
  "## Workflow",
  "## Hard gates",
  "## Outputs",
  "## Side effects",
  "## Stop conditions",
  "## Limits",
];

/** §12.2's role-specific set, in order. `## Rationalizations this seat makes` comes last. */
export const ROLE_SECTIONS: ReadonlyArray<string> = [
  "## What this seat judges",
  "## Not this seat",
  "## What it must be given",
  "## Evidence it must cite",
  "## Never",
  "## What it returns",
  "## When it has nothing to say",
  "## Rationalizations this seat makes",
];

/** Each rejection carries §12's reason, because the heading is a symptom of the wrong model. */
export const PROTOCOL_FORBIDDEN: Readonly<Record<string, string>> = {
  "## Authority":
    "A protocol holds no authority of its own and never widens the authority it was called with. Write `## Invoked by` instead, naming the skills and phase operations that may call it (ruling `entrypoint-phase-operation-split`).",
};

export const ROLE_FORBIDDEN: Readonly<Record<string, string>> = {
  "## Authority":
    "The runner seats a role; a role never self-authorizes, and whether a seat is filled at all is decided by declared risk (ruling `panel-composition-by-declared-risk`).",
  "## Workflow": "A prompt is not a procedure. Procedure belongs to the protocol that convenes the panel.",
  "## Hard gates":
    "A gate stops a workflow and a seat has no workflow to stop. You are describing the protocol that seats this role, not the seat.",
  "## Inputs":
    "A seat states what it must be *given*, which is a contract on its caller; a protocol lists the inputs it consumes. Write `## What it must be given` instead — the difference is who is bound.",
  "## Side effects":
    "A role has none — it judges and returns. Declaring one means work that belongs in a skill or a protocol has been put in a seat.",
  "## Limits": "Folded into `## Never`.",
};

export const ROLE_FORBIDDEN_SECTIONS: ReadonlyArray<string> = Object.keys(ROLE_FORBIDDEN);

/** §3.1's three columns, spelled exactly. */
export const ANTI_RATIONALIZATION_HEADER = "| The thought | Why it is wrong | Do this instead |";
const ANTI_RATIONALIZATION_COLUMNS = ["The thought", "Why it is wrong", "Do this instead"];

/**
 * A `## Never` row §12.2 governs.
 *
 * `clauses` are the row's distinguishing wording, matched against the row with
 * whitespace collapsed and markdown emphasis stripped. Matching a clause rather
 * than the whole sentence is what keeps a reflowed line break from producing a
 * false error; requiring the citation and the clause in the *same* row is what
 * keeps a section that merely mentions both from passing.
 */
export interface GovernedNeverRow {
  /** The ruling the row must cite, or null where §12.2 states the rule itself. */
  readonly ruling: string | null;
  /** Every clause must appear in the row. */
  readonly clauses: ReadonlyArray<string>;
  /** Named in the failure message, so the writer is told which row is missing. */
  readonly description: string;
}

/**
 * The two rows mandatory in all twenty-nine seats.
 *
 * These were previously welded to the two conditional rows below, and each weld
 * carried a seat-specific half the cited ruling does not state. Writers
 * satisfied the verbatim check and absorbed the mismatch in appended per-seat
 * sentences — load-bearing prose that nothing could check. Splitting them turns
 * that prose into set equality.
 */
export const UNIVERSAL_NEVER_ROWS: ReadonlyArray<GovernedNeverRow> = [
  {
    ruling: "closure-requires-independent-verification",
    clauses: ["independent verification closes a finding"],
    description: "Only independent verification closes a finding: reading a patch is the author's confidence, not a receipt.",
  },
  {
    ruling: "required-lane-failure-is-unavailable",
    clauses: ["lane that could not run", "unavailable"],
    description: "A lane that could not run returns `unavailable` — a result, not an absence, and never backfilled.",
  },
];

/** Kept for the callers that only need the citations. */
export const MANDATORY_NEVER_RULINGS: ReadonlyArray<string> = UNIVERSAL_NEVER_ROWS.map((row) => row.ruling).filter(
  (ruling): ruling is string => ruling !== null,
);

/** What twenty-seven seats say: they judge, and judging is all they do. */
export const AUTHORSHIP_PLAIN_ROW: GovernedNeverRow = {
  ruling: null,
  clauses: ["never edits", "judges and returns"],
  description: 'the plain authorship row, "never edits: it judges and returns"',
};

/**
 * What the two producing seats say instead: they name what they write, and then
 * rule out the outputs that would let them mark their own work.
 */
export const AUTHORSHIP_CONVERSE_ROW: GovernedNeverRow = {
  ruling: null,
  clauses: ["a finding, a receipt, a review record or a ticket", "never closes or approves what it produced"],
  description: "the converse authorship row, naming what this seat writes and ruling out a finding, a receipt, a review record or a ticket",
};

/**
 * The seats that produce an artifact rather than a judgment.
 *
 * A closed list from §12.2, held here rather than read off the bodies on
 * purpose: a check that learned which seats produce by reading the seats and
 * then verified the seats against what it learned could never fail.
 */
export const PRODUCING_SEATS: ReadonlyArray<string> = ["implementer", "plan-review/planner"];

/**
 * Standards grounding, carried by the two seats that judge against a project
 * standard. §12.2 states it directly, so it cites no ruling and none is
 * required — `policies` is still ruling on whether a row should exist.
 */
export const STANDARDS_GROUNDING_ROW: GovernedNeverRow = {
  ruling: null,
  clauses: ["cites an actual project rule or returns empty", "never an invented preference"],
  description: "the standards-grounding row, \"cites an actual project rule or returns empty; an absent standard is never an invented preference\"",
};

/** The seat §12.2 names, because it carries no tier of its own to derive from. */
export const NAMED_STANDARDS_SEATS: ReadonlyArray<string> = ["reviewer-standards"];

/** Every other standards seat comes from the catalog, so a batch-2 seat picks the row up by declaring it. */
export const STANDARDS_GATE_TIER = "standards-gate";

/**
 * §12.2's counterpart table lives in AUTHORING.md, and this is the only copy of
 * its shape.
 *
 * The families are not derivable. `code-review/security` pairs with
 * `doc-review/security-lens` on a shared prefix, but `plan-review/critic` pairs
 * with `code-review/adversarial` on nothing a string comparison can see. So the
 * table is a declaration, and the checker reads it rather than keeping a second
 * copy — two hand-maintained statements of the same fact is the drift shape
 * `universal:` and `entrypoint-count-mismatch` exist to close.
 */
export const COUNTERPART_TABLE_HEADER = "| Seat | Counterpart at another layer |";

const AUTHORING_FILE = "AUTHORING.md";

/** A backticked catalog-id-shaped token: kebab segments, optionally panel-qualified. */
const BACKTICKED_ID = /`([a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)`/g;

/** The sidecar that must not exist, by section. */
const FORBIDDEN_SIDECAR: Readonly<Record<string, string>> = {
  protocols: "protocol.yaml",
  roles: "role.yaml",
};

interface Section {
  readonly heading: string;
  readonly line: number;
  readonly text: string;
}

/** Split a markdown body into its `##` sections, in file order. */
export function splitSections(text: string): Section[] {
  const lines = text.split("\n");
  const out: Section[] = [];
  let current: { heading: string; line: number; body: string[] } | null = null;
  let fenced = false;
  for (const [i, raw] of lines.entries()) {
    const line = raw ?? "";
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (!fenced && /^## /.test(line)) {
      if (current !== null) out.push({ heading: current.heading, line: current.line, text: current.body.join("\n") });
      current = { heading: line.trimEnd(), line: i + 1, body: [] };
      continue;
    }
    current?.body.push(line);
  }
  if (current !== null) out.push({ heading: current.heading, line: current.line, text: current.body.join("\n") });
  return out;
}

function hasAntiRationalizationTable(text: string): boolean {
  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length === 3 && cells.every((c, i) => c.toLowerCase() === (ANTI_RATIONALIZATION_COLUMNS[i] as string).toLowerCase())) {
      return true;
    }
  }
  return false;
}

/** A markdown ruling citation: the word `ruling` followed by the bare id in backticks (§6). */
export function citedRulings(text: string): string[] {
  const out: string[] = [];
  const pattern = /\bruling\s+`([a-z0-9][a-z0-9-]*)`/g;
  for (const match of text.matchAll(pattern)) if (match[1] !== undefined) out.push(match[1]);
  return out;
}

/**
 * The rows of a `## Never` section, each with its wrapping undone.
 *
 * A row is a list item — `1.`, `-` or `*` — and everything indented under it.
 * Emphasis and backticks are stripped and whitespace collapsed so a clause
 * matches wherever the author happened to break the line.
 */
export function neverRows(text: string): string[] {
  return listItems(text).map(normalizeRow).filter((row) => row.length > 0);
}

/**
 * The list items of a section, each with its wrapping undone and its markup
 * intact.
 *
 * `neverRows` normalises away backticks, which is right for matching a clause
 * and wrong for `## Not this seat`, where whether a token was backticked is the
 * whole signal.
 */
export function listItems(text: string): string[] {
  const rows: string[] = [];
  let current: string[] | null = null;
  let fenced = false;
  for (const raw of text.split("\n")) {
    const line = raw ?? "";
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (!fenced && /^\s*(?:\d+\.|[-*])\s+/.test(line)) {
      if (current !== null) rows.push(current.join(" "));
      current = [line.replace(/^\s*(?:\d+\.|[-*])\s+/, "")];
      continue;
    }
    if (current !== null) current.push(line);
  }
  if (current !== null) rows.push(current.join(" "));
  return rows.map((row) => row.replace(/\s+/g, " ").trim()).filter((row) => row.length > 0);
}

function normalizeRow(text: string): string {
  return text
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** A row satisfies a governed row when it carries the citation, if any, and every clause. */
function rowMatches(row: string, governed: GovernedNeverRow): boolean {
  if (governed.ruling !== null && !row.includes(`ruling ${governed.ruling}`)) return false;
  return governed.clauses.every((clause) => row.includes(normalizeRow(clause)));
}

function carries(rows: ReadonlyArray<string>, governed: GovernedNeverRow): boolean {
  return rows.some((row) => rowMatches(row, governed));
}

function checkSections(
  file: string,
  sections: ReadonlyArray<Section>,
  required: ReadonlyArray<string>,
  forbidden: Readonly<Record<string, string>>,
  /** §3's insertion law, which §12.1 inherits for protocols and §12.2 does not impose on roles. */
  noInsertions: boolean,
): Issue[] {
  const issues: Issue[] = [];
  const present = new Map(sections.map((s) => [s.heading, s]));

  for (const heading of required) {
    if (present.has(heading)) continue;
    issues.push(error("body.missing-section", file, `missing required section ${heading}.`));
  }

  for (const [heading, reason] of Object.entries(forbidden)) {
    const found = present.get(heading);
    if (found === undefined) continue;
    issues.push(error("body.forbidden-section", file, `${heading} does not belong here. ${reason}`, found.line));
  }

  // §3: extra `##` sections may follow the last required heading; none may be
  // inserted between them. A protocol inherits that law with §3's ten headings.
  // A role does not: §12.2 fixes the required set and puts
  // `## Rationalizations this seat makes` last, and says nothing against a seat
  // adding a section of its own in between — the authored seats use one.
  const lastRequired = sections.map((s) => s.heading).reduce((last, h, i) => (required.includes(h) ? i : last), -1);
  for (const [i, section] of noInsertions ? sections.entries() : []) {
    if (i >= lastRequired || required.includes(section.heading) || section.heading in forbidden) continue;
    issues.push(
      error(
        "body.section-inserted",
        file,
        `${section.heading} is inserted between required sections. Extra sections may follow the last required heading, never interrupt them.`,
        section.line,
      ),
    );
  }

  // Order is checked over the required headings that are actually present, so a
  // missing heading is reported once as missing rather than again as misplaced.
  const expected = required.filter((h) => present.has(h));
  const actual = sections.filter((s) => expected.includes(s.heading)).map((s) => s.heading);
  for (const [i, heading] of actual.entries()) {
    if (expected[i] === heading) continue;
    const at = present.get(heading);
    issues.push(
      error(
        "body.sections-out-of-order",
        file,
        `${heading} appears out of order; the required order is ${expected.join(", ")}.`,
        at?.line,
      ),
    );
    break;
  }

  return issues;
}

function checkOneBody(
  ctx: CheckContext,
  section: DirectorySection,
  id: string,
  standardsSeats: ReadonlySet<string>,
  families: ReadonlyMap<string, ReadonlyArray<string>> | null,
): Issue[] {
  const dir = entryDir(section, id);
  if (!isDir(join(ctx.root, dir))) return [];

  const issues: Issue[] = [];

  const sidecar = FORBIDDEN_SIDECAR[section];
  if (sidecar !== undefined && exists(join(ctx.root, dir, sidecar))) {
    issues.push(
      error(
        "body.sidecar-forbidden",
        `${dir}/${sidecar}`,
        `a ${section === "protocols" ? "protocol" : "role"} has no execution contract of its own; the catalog entry plus the prose is the contract (AUTHORING.md §12). Delete ${sidecar}.`,
      ),
    );
  }

  if (section === "roles" && id.split("/").length > 2) {
    issues.push(
      error(
        "body.role-nesting-too-deep",
        `${dir}/${preferredBodyFile(section)}`,
        `role id ${id} nests ${id.split("/").length - 1} levels; §12.2 allows at most one (a panel directory and its seats).`,
      ),
    );
  }

  const file = `${dir}/${preferredBodyFile(section)}`;
  const text = readTextIfPresent(join(ctx.root, file));
  if (text === null) return issues; // completeness owns "this body does not exist".

  const front = parseFrontmatter(text);
  if (front.present) {
    issues.push(
      error(
        "body.frontmatter-forbidden",
        file,
        `neither a protocol nor a role carries frontmatter: it is not an entrypoint, and the packager emits none (policies/invocation.yaml, statement protocols-and-roles-are-not-entrypoints).`,
        1,
      ),
    );
  }

  const sections = splitSections(front.present ? front.body : text);
  if (section === "protocols") {
    issues.push(...checkSections(file, sections, PROTOCOL_SECTIONS, PROTOCOL_FORBIDDEN, true));
    const gates = sections.find((s) => s.heading === "## Hard gates");
    if (gates !== undefined && !hasAntiRationalizationTable(gates.text)) {
      issues.push(
        error(
          "body.missing-anti-rationalization-table",
          file,
          `## Hard gates carries no anti-rationalization table. §3.1 requires the three columns ${ANTI_RATIONALIZATION_HEADER} with no prose around them.`,
          gates.line,
        ),
      );
    }
    return issues;
  }

  issues.push(...checkSections(file, sections, ROLE_SECTIONS, ROLE_FORBIDDEN, false));
  const rationalizations = sections.find((s) => s.heading === "## Rationalizations this seat makes");
  if (rationalizations !== undefined && !hasAntiRationalizationTable(rationalizations.text)) {
    issues.push(
      error(
        "body.missing-anti-rationalization-table",
        file,
        `## Rationalizations this seat makes carries no table. §12.2 requires §3.1's three columns ${ANTI_RATIONALIZATION_HEADER} unchanged.`,
        rationalizations.line,
      ),
    );
  }

  const never = sections.find((s) => s.heading === "## Never");
  // A body with no `## Never` is already reported as a missing section; there is
  // nothing to say about its rows on top of that.
  if (never !== undefined) issues.push(...checkNeverRows(file, id, never.text, never.line, standardsSeats));

  const notThisSeat = sections.find((s) => s.heading === "## Not this seat");
  if (notThisSeat !== undefined) {
    issues.push(...checkPanelMentions(ctx, file, id, notThisSeat.text, notThisSeat.line));
    if (families !== null) issues.push(...checkCounterparts(file, id, notThisSeat.text, notThisSeat.line, families));
  }

  return issues;
}

/**
 * The four governed `## Never` rows: two universal, two conditional on a closed
 * list of seats.
 *
 * Both conditionals are checked as **set equality** rather than presence. The
 * direction that matters is the second one: a seat that produces an artifact
 * while carrying the row saying it never edits is the defect the split exists
 * to catch, and a presence check would pass it.
 */
function checkNeverRows(
  file: string,
  id: string,
  text: string,
  line: number,
  standardsSeats: ReadonlySet<string>,
): Issue[] {
  const issues: Issue[] = [];
  const rows = neverRows(text);

  for (const governed of UNIVERSAL_NEVER_ROWS) {
    if (carries(rows, governed)) continue;
    issues.push(
      error(
        "role.missing-universal-never-row",
        file,
        `${id} does not carry the universal ## Never row citing ruling \`${String(governed.ruling)}\`: ${governed.description} §12.2 mandates both in all twenty-nine seats, and the row must carry the citation and the clause together.`,
        line,
      ),
    );
  }

  const produces = PRODUCING_SEATS.includes(id);
  const required = produces ? AUTHORSHIP_CONVERSE_ROW : AUTHORSHIP_PLAIN_ROW;
  const excluded = produces ? AUTHORSHIP_PLAIN_ROW : AUTHORSHIP_CONVERSE_ROW;
  const producingSeats = PRODUCING_SEATS.join(" and ");

  if (!carries(rows, required)) {
    issues.push(
      error(
        "role.authorship-row-mismatch",
        file,
        `${id} does not carry ${required.description}. ${produces ? `${producingSeats} produce an artifact, so they carry that form` : `Every seat but ${producingSeats} judges without producing, so it carries that form`} (§12.2).`,
        line,
      ),
    );
  }
  if (carries(rows, excluded)) {
    issues.push(
      error(
        "role.authorship-row-mismatch",
        file,
        `${id} carries ${excluded.description}, which belongs to ${produces ? "the twenty-seven seats that only judge" : `${producingSeats} alone`}. ${produces ? `${id} writes an artifact; a seat that produces must not also claim it never edits.` : `${id} produces nothing, so the plain form is the one it carries.`}`,
        line,
      ),
    );
  }

  const groundsInStandards = standardsSeats.has(id);
  const hasStandardsRow = carries(rows, STANDARDS_GROUNDING_ROW);
  if (groundsInStandards && !hasStandardsRow) {
    issues.push(
      error(
        "role.standards-row-mismatch",
        file,
        `${id} judges against a project standard but does not carry ${STANDARDS_GROUNDING_ROW.description}. §12.2 states this row directly, so it cites no ruling.`,
        line,
      ),
    );
  }
  if (!groundsInStandards && hasStandardsRow) {
    issues.push(
      error(
        "role.standards-row-mismatch",
        file,
        `${id} carries ${STANDARDS_GROUNDING_ROW.description}, which belongs to the seats that judge against a project standard: ${[...standardsSeats].sort().join(", ")}. This seat has its own grounding rule to write in its own terms.`,
        line,
      ),
    );
  }

  return issues;
}

/**
 * The seats that judge against a project standard.
 *
 * `reviewer-standards` is named by §12.2 because it carries no tier; every other
 * one is read from the catalog's `tier: standards-gate`, so a batch-2 seat that
 * acquires the tier picks the row up without this file changing. Neither source
 * is the corpus being checked.
 */
function standardsSeatIds(ctx: CheckContext): Set<string> {
  const seats = new Set<string>(NAMED_STANDARDS_SEATS);
  for (const entry of ctx.catalog.bySection("roles")) {
    if (entry.raw["tier"] === STANDARDS_GATE_TIER) seats.add(entry.id);
  }
  return seats;
}

/**
 * §12.2's counterpart families, read out of AUTHORING.md's table.
 *
 * Returns `null` for `families` when AUTHORING.md is absent — nothing to check
 * against, the same way an absent rulings policy resolves no citation. A table
 * that is present but unreadable is a different thing and is reported by the
 * caller: a check whose authority has silently vanished passes everything.
 */
export function counterpartFamilies(root: string): {
  families: Map<string, string[]> | null;
  tablePresent: boolean;
} {
  const text = readTextIfPresent(join(root, AUTHORING_FILE));
  if (text === null) return { families: null, tablePresent: false };

  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === COUNTERPART_TABLE_HEADER);
  if (start === -1) return { families: null, tablePresent: true };

  const families = new Map<string, string[]>();
  for (const raw of lines.slice(start + 2)) {
    const line = raw.trim();
    if (!line.startsWith("|")) break;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    const seat = cells[0] === undefined ? [] : [...cells[0].matchAll(BACKTICKED_ID)].map((m) => m[1] ?? "");
    const counterparts = cells[1] === undefined ? [] : [...cells[1].matchAll(BACKTICKED_ID)].map((m) => m[1] ?? "");
    if (seat.length !== 1 || seat[0] === undefined || counterparts.length === 0) continue;
    families.set(seat[0], counterparts);
  }

  return { families: families.size === 0 ? null : families, tablePresent: true };
}

/** The panels in the catalog: the first segment of every qualified role id. */
function panelNames(ctx: CheckContext): Set<string> {
  const panels = new Set<string>();
  for (const entry of ctx.catalog.bySection("roles")) {
    const slash = entry.id.indexOf("/");
    if (slash > 0) panels.add(entry.id.slice(0, slash));
  }
  return panels;
}

function backtickedIds(bullet: string): string[] {
  return [...bullet.matchAll(BACKTICKED_ID)].map((m) => m[1] ?? "");
}

/**
 * The invention half (§12.2): a bullet that names another panel must name a seat
 * in it by catalog id.
 *
 * Scoped by the bullet's *semantics* rather than by token shape, and that is
 * what makes it sound. Role ids, protocol ids and ruling ids are all kebab-case
 * and mutually indistinguishable, so "does this backticked token resolve as a
 * role" would fail a correct protocol citation as readily as an invented seat.
 * A protocol citation never mentions another panel, so it is never examined.
 *
 * The seat's own panel is exempt: §12.2 permits naming a sibling without an id
 * when the id would be the seat's own.
 */
function checkPanelMentions(ctx: CheckContext, file: string, id: string, text: string, line: number): Issue[] {
  const roles = new Set(ctx.catalog.bySection("roles").map((entry) => entry.id));
  const slash = id.indexOf("/");
  const ownPanel = slash > 0 ? id.slice(0, slash) : null;
  const others = [...panelNames(ctx)].filter((panel) => panel !== ownPanel).sort();
  if (others.length === 0) return [];

  const issues: Issue[] = [];
  for (const bullet of listItems(text)) {
    const mentioned = others.filter((panel) => bullet.includes(panel));
    if (mentioned.length === 0) continue;
    if (backtickedIds(bullet).some((token) => roles.has(token))) continue;
    issues.push(
      error(
        "role.panel-mention-without-seat-id",
        file,
        `${id} has a \`## Not this seat\` bullet naming the ${mentioned.join(" and ")} panel in prose with no seat id in it: "${bullet.slice(0, 110)}". Name the seat by its catalog.yaml id in backticks (§12.2). A description of a seat never has to resolve, which is how an invented counterpart gets written.`,
        line,
      ),
    );
  }
  return issues;
}

/**
 * The omission half (§12.2): every counterpart the table declares for this seat
 * is named in its `## Not this seat`.
 *
 * A writer holding one panel cannot see the other two, so this is the half no
 * reader of a single body can perform. Both defects this catches are invisible
 * in a body that is internally coherent.
 */
function checkCounterparts(
  file: string,
  id: string,
  text: string,
  line: number,
  families: ReadonlyMap<string, ReadonlyArray<string>>,
): Issue[] {
  const required = families.get(id);
  if (required === undefined) return [];

  const named = new Set(listItems(text).flatMap(backtickedIds));
  const missing = required.filter((counterpart) => !named.has(counterpart));
  if (missing.length === 0) return [];

  return [
    error(
      "role.counterpart-not-named",
      file,
      `${id} does not name ${missing.length === 1 ? "its counterpart" : "these counterparts"} ${missing.join(", ")} in \`## Not this seat\`. AUTHORING.md §12.2 declares the family; the entry is required and does not count against the three-or-four budget. Resolve it in catalog.yaml and say what separates the layers.`,
      line,
    ),
  ];
}

/** The table's own coherence: every seat it names exists, and a family reads both ways. */
function checkCounterpartTable(ctx: CheckContext, families: ReadonlyMap<string, ReadonlyArray<string>>): Issue[] {
  const roles = new Set(ctx.catalog.bySection("roles").map((entry) => entry.id));
  const issues: Issue[] = [];

  for (const [seat, counterparts] of [...families].sort(([a], [b]) => a.localeCompare(b))) {
    for (const named of [seat, ...counterparts]) {
      if (roles.has(named)) continue;
      issues.push(
        error(
          "role.counterpart-table-unknown-seat",
          AUTHORING_FILE,
          `§12.2's counterpart table names ${named}, which catalog.yaml does not declare as a role. A family naming a seat that does not exist imposes a requirement no body can satisfy, which is the invention the table exists to prevent.`,
        ),
      );
    }
    for (const counterpart of counterparts) {
      if ((families.get(counterpart) ?? []).includes(seat)) continue;
      issues.push(
        error(
          "role.counterpart-table-asymmetric",
          AUTHORING_FILE,
          `§12.2's table has ${seat} naming ${counterpart}, but not the reverse. A reader with the wrong file open arrives from either side, so ${counterpart} is not told to name ${seat}.`,
        ),
      );
    }
  }

  issues.push(...checkCensusProse(ctx, families.size, roles.size));

  // Symmetry is a property of the rows that are there. It says nothing about the
  // rows that are not, and the table is a hand-maintained census of a set the
  // catalog also holds -- the same shape as `universal:` beside `binds`, and as
  // `count:` beside an entrypoint list. Neither this check nor any other can
  // tell a family that was considered and rejected from one nobody looked for,
  // so the honest thing is to report the coverage rather than imply the census
  // is complete by staying silent.
  issues.push(
    note(
      "role.counterpart-census-coverage",
      AUTHORING_FILE,
      `§12.2's counterpart table declares ${familyCount(families)} ${familyCount(families) === 1 ? "family" : "families"} covering ${families.size} of ${roles.size} catalog roles. A family is a group of mutually-paired seats, so a three-seat family counts once. Symmetry and seat existence are checked; completeness is not checkable, so an undeclared family is invisible here and stays a handback obligation on the batch that authors the seats.`,
    ),
  );

  return issues;
}

/**
 * English cardinals, for the one sentence in §12.2 that states the census in
 * words. A closed list up to the size of the roles section is enough, and a
 * number it cannot read is left alone rather than guessed at.
 */
const CARDINALS: ReadonlyArray<string> = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five",
  "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty",
];

const CENSUS_SENTENCE = /\b([A-Za-z-]+) seats? of ([A-Za-z-]+) are named here\b/;

function cardinal(word: string): number | null {
  const index = CARDINALS.indexOf(word.toLowerCase());
  return index === -1 ? null : index;
}

/**
 * How many distinct families the table declares.
 *
 * A family is a connected component of the counterpart graph, not a pair. The
 * adversarial family is three seats that all name each other; counting pairs
 * calls it three families, and the error grows with family size in the
 * direction that makes coverage look better than it is. Components track what
 * the table actually declares: one group of mutually-paired seats, however many
 * seats are in it.
 */
function familyCount(families: ReadonlyMap<string, ReadonlyArray<string>>): number {
  const seen = new Set<string>();
  let count = 0;
  for (const seat of families.keys()) {
    if (seen.has(seat)) continue;
    count++;
    const stack = [seat];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined || seen.has(current)) continue;
      seen.add(current);
      for (const neighbour of families.get(current) ?? []) if (!seen.has(neighbour)) stack.push(neighbour);
    }
  }
  return count;
}

/**
 * §12.2 states its own coverage in prose, and the sentence is load-bearing: it
 * is what tells a reader the table claims no completeness. So it stays, and the
 * number in it is checked instead of trusted.
 *
 * This is the third instance of one shape -- `universal:` beside `binds`,
 * `count:` beside an entrypoint list, and now a written-out count beside the
 * table it counts. Each one is a claim a reader believes and nothing verified,
 * and each goes stale on the next row added rather than at the moment someone
 * next compares by eye.
 */
function checkCensusProse(ctx: CheckContext, seats: number, roles: number): Issue[] {
  const text = readTextIfPresent(join(ctx.root, AUTHORING_FILE));
  if (text === null) return [];
  // Matched against whitespace-normalised text, because the sentence wraps.
  const match = CENSUS_SENTENCE.exec(text.replace(/\s+/g, " "));
  if (match === null) return [];

  const statedSeats = cardinal(match[1] ?? "");
  const statedRoles = cardinal(match[2] ?? "");
  if (statedSeats === null || statedRoles === null) return [];
  if (statedSeats === seats && statedRoles === roles) return [];

  return [
    error(
      "role.counterpart-census-count-stale",
      AUTHORING_FILE,
      `§12.2 says "${match[0]}", but the table names ${seats} seat(s) and catalog.yaml declares ${roles} role(s). The sentence is what tells a reader the table claims no completeness, so it is the number that is wrong, not the sentence.`,
      lineContaining(text, `${match[1]} seat`) ?? lineContaining(text, "are named here"),
    ),
  ];
}

function lineContaining(text: string, needle: string): number | undefined {
  for (const [index, line] of text.split("\n").entries()) if (line.includes(needle)) return index + 1;
  return undefined;
}

export function checkBodyShapes(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  const standardsSeats = standardsSeatIds(ctx);

  const { families, tablePresent } = counterpartFamilies(ctx.root);
  if (families === null && tablePresent) {
    issues.push(
      error(
        "role.counterpart-table-unreadable",
        AUTHORING_FILE,
        `§12.2's counterpart table could not be read: no rows under \`${COUNTERPART_TABLE_HEADER}\`. The table is this check's only authority, so losing it would let every seat pass with its twin unnamed.`,
      ),
    );
  }
  if (families !== null) issues.push(...checkCounterpartTable(ctx, families));

  for (const section of ["protocols", "roles"] as const) {
    for (const entry of ctx.catalog.bySection(section)) {
      issues.push(...checkOneBody(ctx, section, entry.id, standardsSeats, families));
    }
  }
  return issues;
}
