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

export function checkGraderSurfaces(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  const evals = join(ctx.root, EVALS_DIR);
  for (const skill of listDirs(evals)) {
    for (const caseId of listDirs(join(evals, skill))) {
      const casePath = `${EVALS_DIR}/${skill}/${caseId}/${CASE_FILE}`;
      const text = readTextIfPresent(join(ctx.root, casePath));
      if (text === null) continue;
      let doc: unknown;
      try {
        doc = parseYaml(text);
      } catch {
        continue; // the schema check owns an unparseable case.
      }
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
  }
  return issues;
}
