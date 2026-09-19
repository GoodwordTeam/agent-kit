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

const SCENARIO_TAG = /^scenario-(\d{1,2})$/;

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

/** The `scenario-NN` tags a case carries, as numbers. */
export function scenarioTags(caseDoc: Record<string, unknown>): number[] {
  const tags = Array.isArray(caseDoc["tags"]) ? caseDoc["tags"] : [];
  const out: number[] = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const match = SCENARIO_TAG.exec(tag.trim());
    if (match?.[1] === undefined) continue;
    out.push(Number(match[1]));
  }
  return out;
}

function checkOneSkill(ctx: CheckContext, id: string, covered: Set<number>): Issue[] {
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
    for (const scenario of scenarioTags(doc)) covered.add(scenario);
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
  const covered = new Set<number>();

  for (const id of [...skillIds].sort()) issues.push(...checkOneSkill(ctx, id, covered));

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
  if (covered.size > 0) {
    const uncovered = RELEASE_SCENARIOS.filter((n) => !covered.has(n));
    if (uncovered.length > 0) {
      issues.push(
        note(
          "evals.uncovered-scenarios",
          EVALS_DIR,
          `release scenarios with no case tagged scenario-NN: ${uncovered.join(", ")}. The corpus must cover all ${RELEASE_SCENARIOS.length} across the catalog.`,
        ),
      );
    }
  }

  return issues;
}
