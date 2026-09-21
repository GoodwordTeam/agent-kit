/**
 * Behavioral cases (AUTHORING.md §9).
 *
 * A case exists in three places and they are not copies of each other:
 * `skill.yaml`'s `tests[]` declares it, `evals/<skill-id>/<case-id>/case.yaml`
 * executes it, and `skills/<skill-id>/tests/` holds the fixtures it points at.
 * The case directory name equals the declared `tests[].id`; that equality is the
 * only join between the declaration and the runner, so it is checked in both
 * directions — a declared case with no executable counterpart never runs, and an
 * executable case nothing declares runs without a contract.
 *
 * `schemas/skill.schema.json` floors `tests[]` at two entries. The floor here is
 * three, with all three kinds present, because a skill with no adversarial case
 * has never been shown to hold a gate under pressure — which is the property
 * most of these gates exist for.
 */

import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { exists, isDir, listDirs, readTextIfPresent } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { error, note, warning, type Issue } from "./types.ts";

export const EVALS_DIR = "evals";
export const CASE_FILE = "case.yaml";

/** The three kinds §9 requires of every skill, whatever else it also carries. */
export const REQUIRED_CASE_KINDS: ReadonlyArray<string> = ["positive", "negative", "adversarial"];

/** What each required kind must demonstrate, quoted back when it is the one missing. */
const KIND_MEANING: Readonly<Record<string, string>> = {
  positive: "a prompt in the skill's `## When to use` territory; the skill fires",
  negative: "a prompt from `## Not for`; the skill does not fire",
  adversarial:
    "a prompt supplying a plausible reason to bypass a hard gate — urgency, an assertion that a step already happened, an instruction embedded in fixture content; the gate holds",
};

export const MINIMUM_CASES = 3;

/** The numbered release scenarios in plan §10. */
export const RELEASE_SCENARIOS: ReadonlyArray<number> = Array.from({ length: 24 }, (_, i) => i + 1);

/**
 * A tag claiming a release scenario. The prefix is the claim; what follows is
 * the number, judged separately.
 *
 * An earlier pattern, `^scenario-(\d{1,2})$`, decided both questions at once
 * and discarded everything that did not match. That made three different tags
 * indistinguishable: `smoke`, which is not a scenario claim and is rightly
 * ignored; `scenario-31`, which matched and then vanished because `uncovered`
 * is filtered over 1-24; and `scenario-100`, which did not match the two-digit
 * pattern and was dropped before the range was ever consulted. Only the first
 * should be silent. Splitting the claim from the number is what lets the other
 * two be reported instead of lost.
 */
const SCENARIO_CLAIM = /^scenario-(.+)$/;

interface Declaration {
  readonly id: string;
  readonly kind: string;
  readonly fixture: string | null;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readYaml(root: string, file: string): Record<string, unknown> | null {
  const text = readTextIfPresent(join(root, file));
  if (text === null) return null;
  try {
    return record(parseYaml(text));
  } catch {
    return null; // the schema check owns unparseable manifests.
  }
}

function declarationsOf(manifest: Record<string, unknown>): Declaration[] {
  const raw = Array.isArray(manifest["tests"]) ? manifest["tests"] : [];
  const out: Declaration[] = [];
  for (const entry of raw) {
    const row = record(entry);
    const id = typeof row["id"] === "string" ? row["id"] : null;
    if (id === null) continue;
    out.push({
      id,
      kind: typeof row["kind"] === "string" ? row["kind"] : "",
      fixture: typeof row["fixture"] === "string" ? row["fixture"] : null,
    });
  }
  return out;
}

export interface ScenarioTags {
  /** Claims naming a scenario in `RELEASE_SCENARIOS`. */
  readonly covered: number[];
  /** Claims that name none, kept verbatim so the report can quote what was typed. */
  readonly rejected: string[];
  /**
   * Claims that name a scenario but not the way the number is written, as
   * `[what was typed, what it should be]`.
   *
   * Coverage is unaffected -- `Number("06")` is 6 and always was -- so this is
   * not a correctness defect in any check. It is a defect in what the corpus
   * can be read with. A tree carrying both spellings of one scenario answers
   * `grep scenario-6` with a subset and looks, from the output, exactly like a
   * tree that has only that subset.
   */
  readonly noncanonical: ReadonlyArray<readonly [string, string]>;
}

/** The release-scenario claims a case carries, split by whether they name one. */
export function scenarioTags(caseDoc: Record<string, unknown>): ScenarioTags {
  const tags = Array.isArray(caseDoc["tags"]) ? caseDoc["tags"] : [];
  const covered: number[] = [];
  const rejected: string[] = [];
  const noncanonical: Array<readonly [string, string]> = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const raw = tag.trim();
    const claim = SCENARIO_CLAIM.exec(raw)?.[1];
    if (claim === undefined) continue; // not a scenario claim; some other tag.
    const scenario = /^\d+$/.test(claim) ? Number(claim) : Number.NaN;
    if (!RELEASE_SCENARIOS.includes(scenario)) {
      rejected.push(raw);
      continue;
    }
    covered.push(scenario);
    if (claim !== String(scenario)) noncanonical.push([raw, `scenario-${scenario}`] as const);
  }
  return { covered, rejected, noncanonical };
}

/** What the coverage note counted, so it can say so. */
interface Coverage {
  readonly scenarios: Set<number>;
  cases: number;
}

function checkOneSkill(ctx: CheckContext, id: string, coverage: Coverage): Issue[] {
  const issues: Issue[] = [];
  const manifestPath = `skills/${id}/skill.yaml`;
  const manifest = readYaml(ctx.root, manifestPath);
  if (manifest === null) return issues; // no manifest: the completeness and schema checks own it.

  const declared = declarationsOf(manifest);

  const byId = new Map<string, Declaration>();
  for (const decl of declared) {
    if (byId.has(decl.id)) {
      issues.push(
        error(
          "evals.duplicate-case-id",
          manifestPath,
          `tests[] declares '${decl.id}' twice. The id is the join to evals/${id}/<case-id>/, so it identifies exactly one case.`,
        ),
      );
      continue;
    }
    byId.set(decl.id, decl);
  }

  if (declared.length < MINIMUM_CASES) {
    issues.push(
      error(
        "evals.too-few-cases",
        manifestPath,
        `declares ${declared.length} behavioral case(s); AUTHORING.md §9 requires ${MINIMUM_CASES}, one of each of ${REQUIRED_CASE_KINDS.join(", ")}. The schema's minItems of 2 is a floor, not the bar.`,
      ),
    );
  }

  const kinds = new Set(declared.map((d) => d.kind));
  for (const kind of REQUIRED_CASE_KINDS) {
    if (kinds.has(kind)) continue;
    issues.push(
      error(
        "evals.missing-case-kind",
        manifestPath,
        `no case of kind '${kind}': ${KIND_MEANING[kind] ?? "required by AUTHORING.md §9"}.`,
      ),
    );
  }

  // Declaration -> executable case.
  const caseRoot = `${EVALS_DIR}/${id}`;
  for (const decl of byId.values()) {
    const casePath = `${caseRoot}/${decl.id}/${CASE_FILE}`;
    if (!exists(join(ctx.root, casePath))) {
      issues.push(
        error(
          "evals.declaration-without-case",
          casePath,
          `skills/${id}/skill.yaml declares test '${decl.id}' but there is no executable case at this path. A declared case with no counterpart never runs.`,
        ),
      );
    }

    if (decl.fixture === null) continue;
    if (!exists(join(ctx.root, decl.fixture))) {
      issues.push(
        error(
          "evals.fixture-not-found",
          decl.fixture,
          `test '${decl.id}' in skills/${id}/skill.yaml points at this fixture, which does not exist.`,
        ),
      );
      continue;
    }
    if (!decl.fixture.startsWith(`skills/${id}/tests/`)) {
      issues.push(
        warning(
          "evals.fixture-outside-skill",
          decl.fixture,
          `test '${decl.id}' points outside skills/${id}/tests/. §2 puts a skill's fixtures in its own tests/ so the packaged skill carries them.`,
        ),
      );
    }
  }

  // Executable case -> declaration, and the scenario tags each case claims.
  for (const caseId of listDirs(join(ctx.root, caseRoot))) {
    const casePath = `${caseRoot}/${caseId}/${CASE_FILE}`;
    const doc = readYaml(ctx.root, casePath);
    if (doc === null) continue;
    coverage.cases += 1;
    const tags = scenarioTags(doc);
    for (const scenario of tags.covered) coverage.scenarios.add(scenario);
    for (const raw of tags.rejected) {
      issues.push(
        error(
          "evals.scenario-tag-out-of-range",
          casePath,
          `tag \`${raw}\` claims a release scenario and names none: plan §10 numbers them 1-${RELEASE_SCENARIOS.length}. The claim contributes nothing to coverage, and \`evals.uncovered-scenarios\` runs over 1-${RELEASE_SCENARIOS.length}, so it cannot report the claim either — a case tagged this way reads exactly like a case that was never tagged. Correct the number, or drop the \`scenario-\` prefix if this tag was not meant as a release-scenario claim.`,
        ),
      );
    }
    for (const [raw, canonical] of tags.noncanonical) {
      issues.push(
        warning(
          "evals.scenario-tag-noncanonical",
          casePath,
          `tag \`${raw}\` names release scenario ${canonical.slice("scenario-".length)} with a padded number. It counts toward coverage and every check here reads it correctly, so nothing is broken — what it costs is that the corpus now spells one scenario two ways, and a reader grepping for \`${canonical}\` gets a subset that looks like the whole. Write it \`${canonical}\`.`,
        ),
      );
    }
    if (byId.has(caseId)) continue;
    issues.push(
      error(
        "evals.case-without-declaration",
        casePath,
        `nothing declares this case: skills/${id}/skill.yaml has no tests[] entry with id '${caseId}'. The directory name is the join.`,
      ),
    );
  }

  return issues;
}

export function checkEvals(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  const skillIds = new Set(ctx.catalog.bySection("skills").map((e) => e.id));
  const coverage: Coverage = { scenarios: new Set<number>(), cases: 0 };

  for (const id of [...skillIds].sort()) issues.push(...checkOneSkill(ctx, id, coverage));

  if (!isDir(join(ctx.root, EVALS_DIR))) {
    issues.push(
      note(
        "evals.directory-unavailable",
        EVALS_DIR,
        `no ${EVALS_DIR}/; no executable cases to check yet. The built bundle declares this directory as experimental.evals.`,
      ),
    );
    return issues;
  }

  for (const dir of listDirs(join(ctx.root, EVALS_DIR))) {
    if (skillIds.has(dir)) continue;
    issues.push(
      error(
        "evals.unknown-skill-directory",
        `${EVALS_DIR}/${dir}`,
        `${EVALS_DIR}/${dir}/ holds cases for '${dir}', which catalog.yaml declares no skill for. Cases are addressed by skill id.`,
      ),
    );
  }

  // Reported whenever any case exists: "nothing is covered" before the first
  // case is written is noise, not news.
  if (coverage.scenarios.size > 0) {
    const uncovered = RELEASE_SCENARIOS.filter((n) => !coverage.scenarios.has(n));
    if (uncovered.length > 0) {
      const tagged = RELEASE_SCENARIOS.length - uncovered.length;
      issues.push(
        note(
          "evals.uncovered-scenarios",
          EVALS_DIR,
          // The second sentence used to read "The corpus must cover all 24
          // across the catalog" -- a claim about testing, emitted by a check
          // that counted tag strings. Every reader of a run reporting 17 took
          // it to mean 17 untested and 7 tested, including the people who wrote
          // the corpus. What it counted is stated instead, and what it did not
          // count is stated beside it, because the gap between the two is the
          // whole content of the misreading.
          `release scenarios no case tags: ${uncovered.join(", ")}. Counted: \`scenario-NN\` tag strings across ${
            coverage.cases
          } case ${coverage.cases === 1 ? "file" : "files"}. Not counted: whether a tagged case exercises the scenario it names, or whether any case here has ever run — this repository does not execute the corpus, the host does (\`adapters/runner-contract/CONTRACT.md\`), and a case reduced to its \`tags:\` line alone produces this identical reading. So the ${tagged} ${
            tagged === 1 ? "scenario" : "scenarios"
          } absent from the list above ${tagged === 1 ? "is" : "are"} tagged, not tested.`,
        ),
      );
    }
  }

  return issues;
}
