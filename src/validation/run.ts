/**
 * The validation run: every check, one sorted issue list, no crash.
 *
 * A missing or half-written file is a reported validation failure, never an
 * exception, so a check that throws is itself reported and the remaining checks
 * still run. Twenty skills are being authored against this contract while it
 * runs; a crash would tell their authors nothing.
 */

import { loadCatalog, type Catalog } from "../catalog/load.ts";
import type { BuildOptions } from "../packaging/build.ts";
import { checkArtifacts } from "./artifacts.ts";
import { checkBodyShapes } from "./bodies.ts";
import { checkBudget } from "./budget.ts";
import { checkCompleteness } from "./completeness.ts";
import { checkCatalogRules, checkPackManifests, checkSkillManifests } from "./configrules.ts";
import type { CheckContext } from "./context.ts";
import { checkContent } from "./content.ts";
import { checkDocumentRules } from "./docrules.ts";
import { checkTemplateDocuments } from "./documents.ts";
import { checkEvals } from "./evals.ts";
import { checkFrontmatter } from "./frontmatter.ts";
import { checkInvocation } from "./invocation.ts";
import { checkBundleLinks, checkLoaderLinks, checkSourceLinks } from "./links.ts";
import { checkPolicies } from "./policies.ts";
import { checkSchemaRuleCoverage } from "./rulemap.ts";
import { checkProvenance } from "./provenance.ts";
import { checkRestatements } from "./restatement.ts";
import { checkRulings } from "./rulings.ts";
import { checkSchemas } from "./schemas.ts";
import { checkSideEffects } from "./sideeffects.ts";
import { error, hasErrors, sortIssues, type Issue } from "./types.ts";

export interface Check {
  readonly name: string;
  readonly run: (ctx: CheckContext) => Issue[];
}

export interface RunOptions {
  /** Restrict the run to these check names. */
  readonly only?: readonly string[];
  /** Extra checks, for tests and for callers that extend the run. */
  readonly extraChecks?: readonly Check[];
  /** Passed to the packaging-dependent checks. */
  readonly build?: BuildOptions;
}

export interface ValidationRun {
  readonly catalog: Catalog | null;
  readonly issues: readonly Issue[];
  readonly ok: boolean;
}

const DEFAULT_BUILD: BuildOptions = { profile: undefined };

export const CHECKS: readonly Check[] = [
  { name: "completeness", run: checkCompleteness },
  { name: "catalog-rules", run: checkCatalogRules },
  { name: "schemas", run: checkSchemas },
  { name: "template-documents", run: checkTemplateDocuments },
  { name: "schema-rule-coverage", run: checkSchemaRuleCoverage },
  { name: "frontmatter", run: checkFrontmatter },
  { name: "budget", run: checkBudget },
  { name: "invocation", run: checkInvocation },
  { name: "policies", run: checkPolicies },
  { name: "side-effects", run: checkSideEffects },
  { name: "skill-manifests", run: checkSkillManifests },
  { name: "pack-manifests", run: checkPackManifests },
  { name: "links-source", run: checkSourceLinks },
  { name: "links-loader", run: checkLoaderLinks },
  { name: "links-bundle", run: (ctx) => checkBundleLinks(ctx, DEFAULT_BUILD) },
  { name: "content", run: checkContent },
  { name: "provenance", run: checkProvenance },
  { name: "artifacts", run: checkArtifacts },
  { name: "document-rules", run: checkDocumentRules },
  { name: "body-shapes", run: checkBodyShapes },
  { name: "rulings", run: checkRulings },
  { name: "restatements", run: checkRestatements },
  { name: "evals", run: checkEvals },
];

export function runValidation(root: string, options: RunOptions = {}): ValidationRun {
  const loaded = loadCatalog(root);
  const issues: Issue[] = [...loaded.issues];
  if (loaded.catalog === null) {
    return { catalog: null, issues: sortIssues(issues), ok: false };
  }

  const ctx: CheckContext = { root, catalog: loaded.catalog };
  const build = options.build ?? DEFAULT_BUILD;
  const checks = [...CHECKS, ...(options.extraChecks ?? [])].map((check) =>
    check.name === "links-bundle" ? { name: check.name, run: (c: CheckContext) => checkBundleLinks(c, build) } : check,
  );

  // A narrowing that matches nothing used to run nothing and say nothing.
  // `only` is a pure `includes`, so a misspelled name selected zero checks and
  // returned a clean, short result -- which reads exactly like a check that ran
  // and found no problems. The cost is not hypothetical: two tests in this
  // repository narrow the run to a single check and assert on what comes back,
  // and one of them is the check that this package does not trip its own
  // content scan. Either would have passed while measuring nothing.
  const known = new Set(checks.map((check) => check.name));
  for (const name of options.only ?? []) {
    if (known.has(name)) continue;
    issues.push(
      error(
        "run.unknown-check",
        "catalog.yaml",
        `run narrowed to '${name}', which is not a check in this run; nothing was selected for that name. Known checks: ${[...known].sort().join(", ")}.`,
      ),
    );
  }

  for (const check of checks) {
    if (options.only !== undefined && !options.only.includes(check.name)) continue;
    try {
      issues.push(...check.run(ctx));
    } catch (cause) {
      issues.push(
        error(
          "check.threw",
          "catalog.yaml",
          `check ${check.name} threw ${(cause as Error).message}; the remaining checks still ran, but this check reported nothing`,
        ),
      );
    }
  }

  const sorted = sortIssues(issues);
  return { catalog: loaded.catalog, issues: sorted, ok: !hasErrors(sorted) };
}
