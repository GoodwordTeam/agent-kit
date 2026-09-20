import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { readTextIfPresent } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { error, skipped, warning, type Issue } from "./types.ts";

/**
 * The U/M partition and the closure that finishes it.
 *
 * `policies/invocation.yaml` states the same partition three times: two skill
 * lists with their own `count`, an operations table, and `no_operation_exposed`
 * with a prose census. `checkPolicies` already compares each list against
 * catalog.yaml entry by entry -- an unknown id, a disagreeing invocation, a
 * count that is not the list length, a skill in neither list. What it cannot
 * see is what the lists say about *each other*:
 *
 *   - A skill in both classes. Each listing is judged against the catalog
 *     separately, so a skill the catalog calls U passes the U listing and fails
 *     only the M one, and a skill whose catalog `invocation` is unset passes
 *     both. Membership in both lists is wrong whatever the catalog says.
 *   - A skill listed twice in one class, or twice in the closure. The repeat
 *     keeps the list's length right and pushes a real skill out, so what gets
 *     reported is the *other* skill -- as unclassified, or as a gap in the
 *     closure -- and nothing mentions the duplicate that displaced it.
 *   - The closure. `no_operation_exposed` says no controller, grant or charter
 *     entry can start the skills it names, while `operations[].exposed_by`
 *     hands a controller exactly that. Nothing compared the two, and the block
 *     claims in its own note to be complete for user-invoked skills.
 *
 * Scoped to the policy's own classification rather than the catalog's on
 * purpose: where the two disagree, `policy.invocation-disagrees-with-catalog`
 * is the report, and repeating it here would put the same fact on two lines
 * under two rules with neither owner able to remove it.
 */

const POLICY_FILE = "policies/invocation.yaml";
const CLOSURE_KEY = "no_operation_exposed";

function obj(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function list(values: Iterable<string>): string {
  return [...values].join(", ");
}

/** Ids appearing more than once, in first-seen order. */
function repeated(ids: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id) && !out.includes(id)) out.push(id);
    seen.add(id);
  }
  return out;
}

/**
 * A count the census prose restates, and the phrase that identifies it.
 *
 * The phrases are how the authored note is written. Matching on a phrase means
 * a rewrite stops matching, which would make the check go quiet on a claim it
 * used to verify -- so every digit the prose contains that no phrase accounted
 * for is reported too. That is the half that keeps a rephrase visible.
 *
 * Every gap inside a phrase is `\s+` rather than a space. A YAML `>-` scalar
 * folds its line breaks into spaces and a `|-` scalar keeps them, so which of
 * the two an author picked decides whether a phrase arrives contiguous. A
 * literal-space pattern would demote a stated falsehood to the unrecognized-
 * number warning on a formatting choice, which reports the wording and leaves
 * the wrong count unchecked.
 */
interface Census {
  readonly pattern: RegExp;
  readonly label: string;
  readonly of: (counts: Counts) => number;
}

interface Counts {
  readonly userInvoked: number;
  readonly modelInvoked: number;
  readonly closed: number;
}

const CENSUS: ReadonlyArray<Census> = [
  { pattern: /(\d+)\s+user-invoked/g, label: "user-invoked skills", of: (c) => c.userInvoked },
  { pattern: /(\d+)\s+model-invoked/g, label: "model-invoked skills", of: (c) => c.modelInvoked },
  { pattern: /(\d+)\s+expose\s+no\s+operation/g, label: "skills exposing no operation", of: (c) => c.closed },
];

function checkCensus(field: string, text: string, counts: Counts): Issue[] {
  const issues: Issue[] = [];
  const accounted = new Set<number>();

  for (const census of CENSUS) {
    census.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = census.pattern.exec(text)) !== null) {
      accounted.add(match.index);
      const stated = Number(match[1]);
      const actual = census.of(counts);
      if (stated === actual) continue;
      issues.push(
        error(
          "partition.census-disagrees",
          POLICY_FILE,
          `${CLOSURE_KEY}.${field} says ${stated} ${census.label}; the lists in this file hold ${actual}.`,
        ),
      );
    }
  }

  for (const match of text.matchAll(/\d+/g)) {
    if (match.index === undefined || accounted.has(match.index)) continue;
    issues.push(
      warning(
        "partition.census-unrecognized",
        POLICY_FILE,
        `${CLOSURE_KEY}.${field} states the number ${match[0]}, which no census phrase accounted for, so it was not checked against any list here. Either it restates a count under wording this check does not know, or it is a claim nothing in this file verifies.`,
      ),
    );
  }

  return issues;
}

export function checkInvocationPartition(ctx: CheckContext): Issue[] {
  const text = readTextIfPresent(join(ctx.root, POLICY_FILE));
  // An absent policy is `policy.invocation-unavailable`, a note checkPolicies
  // already emits. There is no partition to judge and nothing went unexamined.
  if (text === null) return [];

  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch {
    parsed = null;
  }
  const policy = obj(parsed);
  if (policy === null) {
    return [
      skipped(
        "partition.policy-unreadable",
        POLICY_FILE,
        "invocation partition",
        "The invocation policy exists and is not a readable mapping, so neither the two classes nor the closure was compared with anything. `policy.unparseable` reports the parse; it says nothing about the partition.",
      ),
    ];
  }

  const issues: Issue[] = [];
  const entrypoints = obj(policy["entrypoints"]) ?? {};
  const listed: Record<"user_invoked" | "model_invoked", string[]> = {
    user_invoked: strings(obj(entrypoints["user_invoked"])?.["skills"]),
    model_invoked: strings(obj(entrypoints["model_invoked"])?.["skills"]),
  };

  for (const group of ["user_invoked", "model_invoked"] as const) {
    const duplicates = repeated(listed[group]);
    if (duplicates.length === 0) continue;
    issues.push(
      error(
        "partition.duplicate-in-class",
        POLICY_FILE,
        `entrypoints.${group} lists ${list(duplicates)} more than once. The repeat keeps count right while pushing a skill out of the list, so the skill it displaced is reported as unclassified and the duplicate is reported as nothing.`,
      ),
    );
  }

  const userInvoked = new Set(listed.user_invoked);
  const modelInvoked = new Set(listed.model_invoked);
  const both = [...userInvoked].filter((id) => modelInvoked.has(id));
  if (both.length > 0) {
    issues.push(
      error(
        "partition.skill-in-both-classes",
        POLICY_FILE,
        `${list(both)} appears under both entrypoints.user_invoked and entrypoints.model_invoked. The law's two classes are exclusive: a skill a human alone may start is not one a model may start.`,
      ),
    );
  }

  /** Operations by the skill they expose, so the closure can be contradicted by name. */
  const exposedBy = new Map<string, string[]>();
  for (const item of Array.isArray(policy["operations"]) ? policy["operations"] : []) {
    const record = obj(item);
    if (record === null) continue;
    const skill = record["exposed_by"];
    const id = record["id"];
    if (typeof skill !== "string" || typeof id !== "string") continue;
    const existing = exposedBy.get(skill);
    if (existing === undefined) exposedBy.set(skill, [id]);
    else existing.push(id);
  }

  const closureBlock = obj(policy[CLOSURE_KEY]);
  const closureSkills = closureBlock === null ? null : closureBlock["skills"];
  if (closureBlock === null || !Array.isArray(closureSkills)) {
    issues.push(
      skipped(
        "partition.closure-unavailable",
        POLICY_FILE,
        "invocation closure",
        `${CLOSURE_KEY} declares no list of skills, so no user-invoked skill was checked for being both closed and exposed, and the block's completeness claim was not tested. The operations table is still open to every controller it names.`,
      ),
    );
    return issues;
  }

  const closed = strings(closureSkills);
  const closedSet = new Set(closed);
  const catalogSkills = new Set(ctx.catalog.bySection("skills").map((entry) => entry.id));

  const repeats = repeated(closed);
  if (repeats.length > 0) {
    issues.push(
      error(
        "partition.duplicate-in-closure",
        POLICY_FILE,
        `${CLOSURE_KEY}.skills lists ${list(repeats)} more than once. A repeat keeps the list's length right while pushing a skill out of it, so what surfaces is the displaced skill under partition.closure-incomplete and a census off by one, and neither names the repeat that produced both.`,
      ),
    );
  }

  for (const id of closed) {
    if (!catalogSkills.has(id)) {
      issues.push(
        error(
          "partition.closure-names-unknown-skill",
          POLICY_FILE,
          `${CLOSURE_KEY} closes ${id}, which catalog.yaml does not declare. A closure over a skill that does not exist leaves whichever skill was meant open.`,
        ),
      );
      continue;
    }
    if (modelInvoked.has(id)) {
      issues.push(
        error(
          "partition.closure-names-model-invoked-skill",
          POLICY_FILE,
          `${CLOSURE_KEY} closes ${id}, which entrypoints.model_invoked lists. This block's own rule scopes it to user-invoked skills: a controller already invokes a model-invoked skill directly, so there is no forbidden edge to withhold and nothing to close.`,
        ),
      );
    }
    const operations = exposedBy.get(id);
    if (operations !== undefined && operations.length > 0) {
      issues.push(
        error(
          "partition.closure-contradicts-operation",
          POLICY_FILE,
          `${CLOSURE_KEY} says no controller, grant or charter entry can start ${id}, while operation${operations.length === 1 ? "" : "s"} ${list(operations)} expose${operations.length === 1 ? "s" : ""} it to a delegated controller. One of the two statements is wrong and this file makes both.`,
        ),
      );
    }
  }

  for (const id of userInvoked) {
    if (closedSet.has(id)) continue;
    if ((exposedBy.get(id) ?? []).length > 0) continue;
    issues.push(
      error(
        "partition.closure-incomplete",
        POLICY_FILE,
        `user-invoked skill ${id} exposes no phase operation and ${CLOSURE_KEY} does not close it, though that block states it is complete for user-invoked skills. A reader checking either half alone concludes the other half covers it.`,
      ),
    );
  }

  const counts: Counts = { userInvoked: userInvoked.size, modelInvoked: modelInvoked.size, closed: closedSet.size };
  for (const field of ["rule", "note"]) {
    const value = closureBlock[field];
    if (typeof value !== "string") continue;
    issues.push(...checkCensus(field, value, counts));
  }

  return issues;
}
