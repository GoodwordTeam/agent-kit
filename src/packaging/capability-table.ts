import { join } from "node:path";

import { readTextIfPresent } from "../util/fs.ts";
import { error, unavailable, type Issue } from "../validation/types.ts";
import type { SkillMode } from "./hosts.ts";

/**
 * The one file that states what each host supplies, for both hosts.
 *
 * Not `adapters/<host>/CONTRACT.md`. `adapters/codex/CONTRACT.md` §3 says
 * outright that "every `common#/$defs/capability` value carries the status
 * `adapters/claude-code/CONTRACT.md` §3 gives it, with no per-capability
 * difference on this host", and gives the reason there is no second copy: "the
 * copy that decided would be whichever one the code read". So the code reads
 * the one. What differs per host is which *restrictions* it enforces, which is
 * `hosts.ts`'s `enforces` set and a different question.
 */
export const CAPABILITY_TABLE_FILE = "adapters/claude-code/CONTRACT.md";

/** The check that does not run when the table cannot be read. */
export const MODE_CEILING_CHECK = "skill mode ceilings";

/**
 * §3's Status column, which that section calls a controlled vocabulary and
 * states once.
 *
 * Restated here because a parser has to recognise the values, and §3 makes the
 * consequence of a value outside them explicit: "Nuance belongs in **Detail**,
 * never in Status, because a compound status is a value no consumer can act
 * on." An unrecognised status is reported rather than coerced, because every
 * coercion available is a guess -- read as `satisfied` it certifies a skill
 * against a host that may not supply what it needs, and read as `not-provided`
 * it caps a skill the host may serve perfectly.
 */
export type CapabilityStatus = "satisfied" | "partial" | "convention-only" | "not-provided";

export const CAPABILITY_STATUSES: ReadonlyArray<CapabilityStatus> = [
  "satisfied",
  "partial",
  "convention-only",
  "not-provided",
];

function isStatus(value: string): value is CapabilityStatus {
  return (CAPABILITY_STATUSES as ReadonlyArray<string>).includes(value);
}

/**
 * The statuses under which a required capability caps a skill's autonomy.
 *
 * One set, in one place, because the alternative reading is defensible and the
 * choice between them has to be visible rather than spread across an
 * expression. Under the strict reading anything short of `satisfied` caps, and
 * `partial` would then cap: §3 gives `artifact-write` that status and its
 * Detail says "every skill in the catalog requires this capability", so every
 * ceiling in this tree would come out `guided` by construction rather than
 * because any host withheld anything. A ceiling that is `guided` for everything
 * is an instrument returning the same answer under both hypotheses.
 *
 * `not-provided` is what §4's own worked example uses. It names `runner-grants`
 * and `event-delivery` as the reason `profiles/autonomy` "does not install
 * against this host on its own", and §3 gives both of those exactly that
 * status. `partial` and `convention-only` are statuses §3 attaches a *stated
 * limitation* to -- the host does the thing and does not guarantee a property
 * of it -- and the package's own protocols are what §3's Detail column points
 * at for each, so those are limitations the package already answers for.
 *
 * Measured before it was chosen: on all 26 skill-adapter rows in this tree the
 * two readings give the identical ceiling, because every skill requiring a
 * `partial` capability also requires a `not-provided` one. The choice is not
 * observable here, which is exactly why it is argued from the contract.
 */
const BLOCKING: ReadonlySet<CapabilityStatus> = new Set<CapabilityStatus>(["not-provided"]);

export function blockingStatuses(): ReadonlySet<CapabilityStatus> {
  return BLOCKING;
}

export interface CapabilityTable {
  /**
   * Whether §3's table was found and had rows in it.
   *
   * False is never "nothing is provided" and never "everything is provided" --
   * it is a question with no answer, and `ceilingFor` returns no ceiling rather
   * than either of those.
   */
  available: boolean;
  /** Capability -> status, for rows whose status is in the vocabulary. */
  status: Map<string, CapabilityStatus>;
  issues: Issue[];
}

/** `| `cap` | `status` | detail |`, which is the only row shape §3 writes. */
const ROW = /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/gm;

/**
 * §3's body: from its own heading to the next `## `, and no further.
 *
 * Scoped rather than swept over the whole file because §4 carries a table with
 * the same three-column shape -- Restriction, Enforced?, How the package treats
 * it -- and codex §3's differences table is a third. A parser reading every
 * table in the file would take rows out of those as capability statements, and
 * the answer for any capability named twice would be whichever row came last.
 */
function sectionThree(contract: string): string | null {
  const start = contract.search(/^##\s+3\.\s/m);
  if (start === -1) return null;
  const rest = contract.slice(start);
  const end = rest.slice(1).search(/^##\s/m);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

/**
 * Read §3's capability table out of the host contract.
 *
 * §3 states that "`ak validate` parses it out of this file rather than reading
 * a generated copy". Until this function existed that sentence described an
 * instrument nobody had built: nothing in `src/` opened the file, and the
 * package's one comparison of a skill against a host ran between
 * `skill.yaml`'s `unsupported` prose and `hosts.ts`'s `RESTRICTIONS`, which are
 * two vocabularies and neither of them this one.
 */
export function loadCapabilityTable(root: string): CapabilityTable {
  const issues: Issue[] = [];
  const status = new Map<string, CapabilityStatus>();
  const blank = (why: string): CapabilityTable => {
    issues.push(
      unavailable(
        "packaging.capability-table-unavailable",
        CAPABILITY_TABLE_FILE,
        MODE_CEILING_CHECK,
        `${why} Every skill's packaging.hosts[] mode is in the plan and the table those modes are measured against is not, so no ceiling was computed for any of them. This is not an empty table: an empty one answers 'nothing is withheld' for every capability and would certify every autonomous declaration in the tree. Restore ${CAPABILITY_TABLE_FILE}'s '## 3.' section with its '| \`capability\` | \`status\` | detail |' rows.`,
      ),
    );
    return { available: false, status, issues };
  };

  const contract = readTextIfPresent(join(root, CAPABILITY_TABLE_FILE));
  if (contract === null) return blank(`${CAPABILITY_TABLE_FILE} is not in the source tree.`);

  const section = sectionThree(contract);
  if (section === null) return blank(`${CAPABILITY_TABLE_FILE} has no '## 3.' section.`);

  let rows = 0;
  for (const match of section.matchAll(ROW)) {
    const capability = match[1] ?? "";
    const declared = match[2] ?? "";
    rows += 1;
    if (!isStatus(declared)) {
      issues.push(
        error(
          "packaging.unknown-capability-status",
          CAPABILITY_TABLE_FILE,
          `§3's row for '${capability}' states the status '${declared}', which is not one of ${CAPABILITY_STATUSES.join(", ")}. §3 calls the Status column a controlled vocabulary and puts nuance in Detail, because a compound status is a value no consumer can act on. '${capability}' now has no status on any host, so every skill requiring it is capped as if the table never mentioned it.`,
        ),
      );
      continue;
    }
    // First row wins, so a capability stated twice is decided by the one a
    // reader reaches first rather than by the end of the loop.
    if (!status.has(capability)) status.set(capability, declared);
  }

  if (rows === 0) return blank(`${CAPABILITY_TABLE_FILE}'s '## 3.' section holds no capability rows.`);
  return { available: true, status, issues };
}

/**
 * The most autonomy a skill may be packaged with, given what it requires.
 *
 * `adapters/claude-code/CONTRACT.md` §4: "A host that cannot enforce a
 * restriction an autonomous run requires **exposes the affected skill in
 * guided/manual mode and rejects autonomous mode.** It never runs the skill
 * with the restriction silently absent." `guided` is the ceiling and not
 * `manual` because §4 offers both and this is the most the rule permits; a
 * skill may still declare less.
 */
export interface Ceiling {
  /** `null` only when the table was unavailable: no ceiling, not a permissive one. */
  mode: SkillMode | null;
  /** Required capabilities the table gives a blocking status, in the order declared. */
  blocking: string[];
  /**
   * Required capabilities with no row in the table at all.
   *
   * Capped like a blocking one rather than waved through. A capability absent
   * from §3 has no stated status on any host, and reading absence as
   * `satisfied` certifies a skill against a table that never mentioned what it
   * needs -- which is the shape codex §3 records having had for three
   * capabilities its prose restatement silently omitted.
   */
  unknown: string[];
}

export function ceilingFor(requires: readonly string[], table: CapabilityTable): Ceiling {
  if (!table.available) return { mode: null, blocking: [], unknown: [] };

  const blocking: string[] = [];
  const unknown: string[] = [];
  for (const capability of requires) {
    const declared = table.status.get(capability);
    if (declared === undefined) unknown.push(capability);
    else if (BLOCKING.has(declared)) blocking.push(capability);
  }

  const mode: SkillMode = blocking.length > 0 || unknown.length > 0 ? "guided" : "autonomous";
  return { mode, blocking, unknown };
}
