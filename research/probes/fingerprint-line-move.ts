/**
 * Does `finding.schema.json`'s fingerprint survive a moved line?
 *
 * The schema says it does: `fingerprint.inputs` is closed, carries no
 * line-number member, and its description states outright that "a finding whose
 * line moved keeps its fingerprint (release scenario 9)". Two of the three
 * inputs are line-free by construction -- the rule or cause, and the symbol or
 * path, which `finding.fingerprint-stable-across-line-moves` additionally
 * refuses to let carry a `:42` suffix.
 *
 * The third is `evidence_digest`, typed only as a hash. Nothing in the schema,
 * in `src/`, or anywhere else in the tree says what it is a digest *of*. It is
 * never computed: it appears as a synthetic literal in three templates and two
 * test files and nowhere else. So the guarantee rests entirely on a convention
 * that has never been written down, and the description's phrase "a digest of
 * the evidence" most naturally reads as the evidence array -- which contains
 * `location.line_range`.
 *
 * This runs both readings against the shipped rule and reports what it says.
 *
 *   over-evidence   the digest covers the evidence array, line_range included
 *   over-excerpt    the digest covers the quoted text and path, not the position
 *
 * The question is not which is better. It is whether a fixture author, or an
 * implementer of the review seats, can pick the wrong one and be told.
 *
 * The domain is now stated on `evidence_digest` itself: the excerpt and the
 * path, never the position. This probe is what established that it had to be,
 * and it stays as the regression guard, because the schema states the domain
 * and nothing enforces it. `finding.fingerprint-stable-across-line-moves`
 * inspects the input names and compares values across documents; it never sees
 * what a digest was taken over, so a corpus built on the other reading passes
 * every check and fails scenario 9. What that would take to enforce is in the
 * closing note below.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalJson, sha256Hex } from "../../src/util/hash.ts";
import { checkDocumentRules } from "../../src/validation/docrules.ts";
import { checkSchemas } from "../../src/validation/schemas.ts";
import { loadCatalog } from "../../src/catalog/load.ts";

const SRC = join(import.meta.dir, "..", "..");
const SCHEMAS = join(SRC, "schemas");
const RULE = "finding.fingerprint-stable-across-line-moves";
const REV = "a".repeat(40);
const AT = "2026-09-19T10:00:00Z";
const EXCERPT = "return cache.get(scopeKey) ?? loadScope(scopeKey);";

/** The same defect, in the same function, before and after an import is added above it. */
function evidence(startLine: number) {
  return [
    {
      location: { repo: "demo", revision: REV, path: "src/report.ts", symbol: "buildTenantSummary", line_range: { start: startLine, end: startLine } },
      observation: "the scope key is read from a cache populated by the previous request, so a second tenant reads the first tenant's scope",
      excerpt: EXCERPT,
    },
  ];
}

type Reading = "over-evidence" | "over-excerpt";

function digest(reading: Reading, ev: ReturnType<typeof evidence>): string {
  if (reading === "over-evidence") return `sha256:${sha256Hex(canonicalJson(ev))}`;
  // Position deliberately excluded: what was quoted, and out of which file.
  return `sha256:${sha256Hex(canonicalJson(ev.map((e) => ({ path: e.location.path, excerpt: e.excerpt }))))}`;
}

function finding(id: string, reading: Reading, startLine: number, value: string) {
  const ev = evidence(startLine);
  return {
    schema: "finding",
    schema_version: 1,
    id,
    project: { id: "demo" },
    run_id: null,
    created_by: { role: "reviewer" },
    inputs: [],
    source_revision: { repo: "demo", revision: REV },
    created_at: AT,
    status: "open",
    title: "A cached tenant scope is reused across requests in the summary builder",
    lane: "security",
    fingerprint: {
      value,
      inputs: { rule: "tenant-isolation", symbol_or_path: "src/report.ts#buildTenantSummary", evidence_digest: digest(reading, ev) },
    },
    severity: "P1",
    confidence_anchor: 100,
    spec_quality: "patch",
    difficulty: "mechanical",
    autofix_class: "manual",
    evidence: ev,
    verification: [{ check: "bun test tests/isolation.test.ts" }],
  };
}

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
schemas:
${readdirSync(SCHEMAS)
  .filter((n) => n.endsWith(".schema.json"))
  .map((n) => `  - id: ${n.replace(".schema.json", "")}\n    status: authored`)
  .join("\n")}
`;

/** Both findings in one tree, as a later closure pass would see them. */
function issuesFor(reading: Reading, sameValue: boolean): { rules: string[]; messages: string[]; inputsMatch: boolean } {
  const root = mkdtempSync(join(tmpdir(), "fp-"));
  mkdirSync(join(root, "schemas"), { recursive: true });
  mkdirSync(join(root, "templates"), { recursive: true });
  for (const n of readdirSync(SCHEMAS)) {
    if (n.endsWith(".schema.json")) writeFileSync(join(root, "schemas", n), readFileSync(join(SCHEMAS, n), "utf8"));
  }
  writeFileSync(join(root, "catalog.yaml"), CATALOG);

  const before = finding("finding-before", reading, 42, `sha256:${"1".repeat(64)}`);
  const after = finding("finding-after", reading, 58, sameValue ? `sha256:${"1".repeat(64)}` : `sha256:${"2".repeat(64)}`);
  writeFileSync(join(root, "templates", "before.json"), JSON.stringify(before, null, 2));
  writeFileSync(join(root, "templates", "after.json"), JSON.stringify(after, null, 2));

  const { catalog } = loadCatalog(root);
  const ctx = { root, catalog: catalog! };
  const schemaErrors = checkSchemas(ctx).filter((i) => i.severity === "error" && i.file.startsWith("templates/"));
  if (schemaErrors.length > 0) {
    rmSync(root, { recursive: true, force: true });
    throw new Error(`fixture does not validate: ${schemaErrors.map((i) => i.message).join("; ")}`);
  }
  const issues = checkDocumentRules(ctx).filter((i) => i.rule === RULE);
  const inputsMatch =
    canonicalJson(before.fingerprint.inputs) === canonicalJson(after.fingerprint.inputs);
  rmSync(root, { recursive: true, force: true });
  return { rules: issues.map((i) => i.rule), messages: issues.map((i) => i.message ?? ""), inputsMatch };
}

function main(): number {
  console.log("The same defect, in the same function, after a line moved from 42 to 58.\n");
  const verdicts: string[] = [];

  for (const reading of ["over-excerpt", "over-evidence"] as Reading[]) {
    console.log(`--- evidence_digest taken ${reading} ---`);
    const kept = issuesFor(reading, true);
    console.log(`  identity inputs match across the move: ${kept.inputsMatch}`);
    console.log(`  keeping the fingerprint  -> ${kept.rules.length === 0 ? "accepted" : "REPORTED: " + kept.messages[0]}`);
    const changed = issuesFor(reading, false);
    console.log(`  changing the fingerprint -> ${changed.rules.length === 0 ? "accepted" : "REPORTED: " + changed.messages[0]}`);

    const keepsOk = kept.rules.length === 0;
    const changeOk = changed.rules.length === 0;
    verdicts.push(`${reading}: keeping=${keepsOk ? "ok" : "refused"} changing=${changeOk ? "ok" : "refused"}`);
    console.log();
  }

  console.log("Scenario 9 is 'moving a line number does not duplicate or falsely suppress a finding'.");
  console.log("A reading under which keeping the fingerprint is refused cannot host that scenario.\n");
  for (const v of verdicts) console.log(`  ${v}`);

  // The schema now names the excerpt-and-path reading. This asserts that the
  // named one is the one that works and that the other is still refused --
  // together, that the choice matters and the tree has made it. A change that
  // made both readings behave alike would fail here and should, because it
  // would mean the rule had stopped distinguishing them.
  const specified = issuesFor("over-excerpt", true);
  const other = issuesFor("over-evidence", true);
  const wrong: string[] = [];
  if (!specified.inputsMatch) wrong.push("the specified domain does not survive the move");
  if (specified.rules.length > 0) wrong.push("keeping the fingerprint is refused under the specified domain");
  if (other.rules.length === 0) wrong.push("the unspecified domain is no longer distinguishable, so this probe has stopped measuring");

  if (wrong.length > 0) {
    console.error();
    for (const w of wrong) console.error(`  ${w}`);
    return 1;
  }

  console.log("\nThe schema names the excerpt-and-path reading, and it is the one that works.");
  console.log("Nothing enforces it. The rule reads the input *names* and compares values across");
  console.log("documents; it never sees what a digest was taken over, so a corpus built on the");
  console.log("other reading passes every check and fails scenario 9 at the checkpoint.");
  console.log("What would catch it: two findings sharing a rule, a symbol_or_path and an excerpt");
  console.log("set, but carrying different evidence_digest values, have taken the digest over");
  console.log("something outside the stated domain -- which for evidence differing only in");
  console.log("line_range is the position. That is checkable from the corpus alone.");
  return 0;
}

process.exit(main());
