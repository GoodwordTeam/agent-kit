/**
 * Grader surfaces (AUTHORING.md §9): an `llm` grader that makes a claim about
 * files must say which surface it reads.
 *
 * An `llm` grader with no `focus` is scored against the run's last message.
 * A criterion such as "no file is created in the working repository" is then
 * judged on what the run said rather than what it did, and passes a run that
 * wrote files and did not mention them. Before this check, 25 of the corpus's
 * `llm` graders were in that position and nothing reported it, because a
 * grader that cannot fail leaves no artifact.
 *
 * The rule: a criterion sentence that names a filesystem object and a write to
 * it is a file claim, and a file claim needs an explicit `focus`. The remedy is
 * usually not an `llm` grader at all: `file_exists` with `exists: false` for
 * "no file created", `tool_used` with `max: 0` for "no edit", a `regex` with
 * `target: files` for a named path. Where judgement is genuinely needed, write
 * `focus: trace`, `focus: files` or `focus: {source: file, path}`. A grader
 * whose sentence only mentions a file in passing and is about what the run
 * says may declare `focus: last_message`; the explicit key is the author's
 * statement that the default was chosen rather than inherited.
 *
 * The heuristic is deliberately narrow: both halves must appear in one
 * sentence. Measured against the corpus when this was written, the noun half
 * alone also hits "file extensions" and "happy path"; the verb half alone hits
 * every criterion about a record or a ticket. Claims with no filesystem noun
 * ("no ticket is cut", "no test is removed") are not caught here, and the
 * corpus aims those at `focus: trace` by hand.
 */

import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { listDirs, readTextIfPresent } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { CASE_FILE, EVALS_DIR } from "./evals.ts";
import { error, type Issue } from "./types.ts";

/** A filesystem object: the noun half of a file claim. */
export const FILE_NOUN =
  /\b(files?|director(?:y|ies)|folders?|on disk|disk|paths?|worktrees?|working tree|working repository|documentation tree)\b/i;

/** A write to one: the verb half. */
export const WRITE_VERB =
  /\b(creat\w*|edit\w*|writ\w*|wrote|modif\w*|delet\w*|save[sd]?|saving|stag(?:e[sd]?|ing)|remov\w*|commit\w*)\b/i;

/** Sentences as a judge would read them: split after a full stop or a semicolon. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/** The first sentence of `criteria` that makes a file claim, or null. */
export function fileClaim(criteria: string): string | null {
  for (const sentence of sentences(criteria)) {
    if (FILE_NOUN.test(sentence) && WRITE_VERB.test(sentence)) return sentence;
  }
  return null;
}

/** One `llm` grader making a file claim with no `focus`. */
export interface UnaimedClaim {
  readonly grader: string;
  readonly sentence: string;
}

/** The unaimed file claims in one parsed case. */
export function unaimedClaims(caseDoc: unknown): UnaimedClaim[] {
  const graders = (caseDoc as Record<string, unknown> | null)?.["graders"];
  if (!Array.isArray(graders)) return [];
  const out: UnaimedClaim[] = [];
  for (const g of graders) {
    if (typeof g !== "object" || g === null) continue;
    const grader = g as Record<string, unknown>;
    if (grader["type"] !== "llm" || grader["focus"] !== undefined) continue;
    const criteria = grader["criteria"];
    if (typeof criteria !== "string") continue; // the schema check owns a missing criteria.
    const sentence = fileClaim(criteria);
    if (sentence === null) continue;
    out.push({ grader: typeof grader["name"] === "string" ? grader["name"] : "(unnamed)", sentence });
  }
  return out;
}

/** One parsed `case.yaml` under `evals/`, with the skill directory it sits in. */
export interface ParsedCase {
  readonly skill: string;
  readonly casePath: string;
  readonly doc: unknown;
}

/** Every parseable case in the corpus. An unparseable one is the schema check's. */
export function readCases(root: string): ParsedCase[] {
  const out: ParsedCase[] = [];
  const evals = join(root, EVALS_DIR);
  for (const skill of listDirs(evals)) {
    for (const caseId of listDirs(join(evals, skill))) {
      const casePath = `${EVALS_DIR}/${skill}/${caseId}/${CASE_FILE}`;
      const text = readTextIfPresent(join(root, casePath));
      if (text === null) continue;
      try {
        out.push({ skill, casePath, doc: parseYaml(text) });
      } catch {
        continue;
      }
    }
  }
  return out;
}

export function checkGraderSurfaces(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  for (const { casePath, doc } of readCases(ctx.root)) {
    for (const claim of unaimedClaims(doc)) {
      issues.push(
        error(
          "evals.llm-file-claim-without-focus",
          casePath,
          `llm grader \`${claim.grader}\` makes a claim about files — "${claim.sentence}" — and has no \`focus\`, so the host scores it against the run's last message: a run that wrote the file and did not mention it passes. Write the deterministic form where one exists (\`file_exists\` with \`exists: false\`, \`tool_used\` with \`max: 0\`, \`regex\` with \`target: files\`), or set \`focus\` to the surface the claim is about (\`trace\`, \`files\`, \`{source: file, path}\`). AUTHORING.md §9.`,
        ),
      );
    }
  }
  return issues;
}

/**
 * The skill-fired indicator (AUTHORING.md §9): a positive or adversarial case
 * says whether the skill under test loaded at all.
 *
 * Without one, a case's score cannot tell a run where the skill fired and
 * behaved from a run where the host's own defaults happened to satisfy the
 * graders. The first live run of the corpus showed that shape: positives
 * scoring the same with and without the plugin, and nothing in the case to
 * say which runs had loaded the skill. The indicator is a `tool_used` grader
 * on `Skill` with `arm: with-only`, so it reports on the plugin arm and stays
 * out of the score.
 *
 * Kinds are read from `tags`, which is what the host filters on. A negative
 * is not asked for one: a Skill grader there is `max: 0`, and only for a
 * model-invoked skill.
 */
export const FIRED_KINDS: ReadonlyArray<string> = ["positive", "adversarial"];

/** Whether one grader is a fired indicator for `skill`. */
export function isFiredIndicator(grader: Record<string, unknown>, skill: string): boolean {
  if (grader["type"] !== "tool_used" || grader["tool"] !== "Skill" || grader["arm"] !== "with-only") return false;
  if (grader["max"] === 0) return false; // a must-not-load assertion, not an indicator.
  const match = grader["input_match"];
  if (typeof match !== "string") return true;
  // Tested the way the host tests it, against a serialized Skill call, so that
  // `compound` does not pass as the indicator for `compound-refresh`.
  try {
    return new RegExp(match).test(JSON.stringify({ skill: `ak:${skill}` }));
  } catch {
    return false;
  }
}

/**
 * Whether the case's prompt is a typed slash invocation of its own skill.
 *
 * Checked live on claude 2.1.282 (2026-09-25, a direct `claude -p` session): a
 * prompt beginning with `/ak:<id>` expands on the client. The model follows the
 * skill, and the run makes no Skill tool call and writes no user stream line
 * for it. A `tool_used: Skill` indicator on such a case therefore always fails,
 * so the typed command stands as the invocation and the workflow graders show
 * that the skill ran. This is how a user-invoked skill's positive is written
 * (AUTHORING.md §9).
 */
export function isSlashInvocation(caseDoc: unknown, skill: string): boolean {
  const execution = ((caseDoc ?? {}) as Record<string, unknown>)["execution"];
  const prompt = (execution ?? {}) as Record<string, unknown>;
  const text = prompt["prompt"];
  return typeof text === "string" && new RegExp(`^/ak:${skill}(?:\\s|$)`).test(text.trimStart());
}

/** The kinds a case claims that require an indicator it does not carry, or none. */
export function missingFiredIndicator(caseDoc: unknown, skill: string): string[] {
  const doc = (caseDoc ?? {}) as Record<string, unknown>;
  if (isSlashInvocation(doc, skill)) return [];
  const tags = Array.isArray(doc["tags"]) ? doc["tags"] : [];
  const kinds = FIRED_KINDS.filter((k) => tags.includes(k));
  if (kinds.length === 0) return [];
  const graders = Array.isArray(doc["graders"]) ? doc["graders"] : [];
  const fired = graders.some(
    (g) => typeof g === "object" && g !== null && isFiredIndicator(g as Record<string, unknown>, skill),
  );
  return fired ? [] : kinds;
}

export function checkFiredIndicators(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  for (const { skill, casePath, doc } of readCases(ctx.root)) {
    const kinds = missingFiredIndicator(doc, skill);
    if (kinds.length === 0) continue;
    issues.push(
      error(
        "evals.no-fired-indicator",
        casePath,
        `a ${kinds.join(" and ")} case with no skill-fired indicator: no \`tool_used\` grader on \`Skill\` with \`arm: with-only\` whose \`input_match\` names \`${skill}\`. Without it the run cannot say whether the skill loaded, so a score from the host's defaults reads the same as a score from the skill. Add the grader AUTHORING.md §9 shows, with \`input_match: '"skill"\\s*:\\s*"(?:[^"]*:)?${skill}"'\`.`,
      ),
    );
  }
  return issues;
}

/**
 * Case names are unique across the corpus.
 *
 * The host reports, filters (`--case`) and publishes results by `name`, not by
 * directory. Five skills once carried a case named
 * `interrupted-publish-resumes-on-the-idempotency-key`, so a report row under
 * that name was one of five cases and nothing in it said which. The directory
 * is the join to `tests[].id` and stays as it is; the name is what needs to
 * identify one case.
 */
export function checkCaseNames(ctx: CheckContext): Issue[] {
  const byName = new Map<string, string[]>();
  for (const { casePath, doc } of readCases(ctx.root)) {
    const name = (doc as Record<string, unknown> | null)?.["name"];
    if (typeof name !== "string") continue; // the schema check owns a missing name.
    byName.set(name, [...(byName.get(name) ?? []), casePath]);
  }
  const issues: Issue[] = [];
  for (const [name, paths] of [...byName].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (paths.length < 2) continue;
    for (const casePath of paths) {
      issues.push(
        error(
          "evals.duplicate-case-name",
          casePath,
          `case name \`${name}\` is also used by ${paths.filter((p) => p !== casePath).join(", ")}. The host reports, filters and publishes results by name, so a row under this name cannot say which case it measured. Rename the case; the directory is the join to tests[].id and can stay.`,
        ),
      );
    }
  }
  return issues;
}
