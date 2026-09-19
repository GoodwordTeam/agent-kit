/**
 * Is every document under `templates/` owned by some check, or can a file sit
 * there validating nothing?
 *
 * Two loaders walk `templates/` independently and decide for themselves what
 * is a document. `loadArtifacts` (src/validation/artifacts.ts) gates the 45
 * artifact and document rules; `collectTargets` (src/validation/schemas.ts)
 * gates ajv. Both skip a file that does not carry a string `schema` member,
 * and both skip a top-level array, in each case with a bare `continue`. A file
 * that trips either condition is dropped by both and no check anywhere in the
 * run reports it.
 *
 * That is the failure shape `templates/` was populated to end. An empty
 * directory made `ak validate` green over forty-five rules iterating nothing.
 * A document nothing claims is the same result at file granularity: it is
 * present, it looks validated, and the run says nothing about it either way.
 * The cost is not hypothetical -- `schema` is the one member an author has no
 * schema to check, because which schema applies is the thing it names.
 *
 * `artifacts.ts` carries `// checkSchemas owns unparseable documents.` at the
 * one skip where that is true. The three skips above it have no owner, and the
 * comment sits close enough to read as if it covered them.
 *
 * This probe writes one malformed document at a time into a copy of the tree
 * and asks whether the full run says anything about it.
 *
 * WHAT A FAILING RUN MEANS
 *   The named case is silently dropped today. The fix is an owner for it --
 *   most naturally an error from whichever loader is authoritative about what
 *   counts as a document -- not a rule in any individual schema.
 *
 * WHAT A PASSING RUN IS NOT EVIDENCE OF
 *   - That every malformed shape is owned. Five cases are tested, chosen
 *     because they are the exact branches the two loaders `continue` on.
 *   - That the document is correct. Being owned means some check reports it;
 *     the two cases that pass today do so via ajv and the catalog, which are
 *     the checks that would report it anyway.
 *
 * Nothing is written inside the repository.
 *
 * Usage: bun run research/probes/unowned-template-documents.ts
 * Exits 0 when every case is reported by some check, 1 while any is silent.
 */

import { cpSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runValidation } from "../../src/validation/run.ts";

const REPO = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const COPIED = ["catalog.yaml", "schemas", "templates", "policies", "AUTHORING.md"];

/** Written, run against, and removed one at a time. The name is the marker. */
const REL = "templates/unowned-probe.json";

const CASES: ReadonlyArray<{ name: string; body: string; why: string }> = [
  {
    name: "no schema member",
    body: JSON.stringify({ id: "example-unowned", project: "example-project" }, null, 2),
    why: "artifacts.ts and schemas.ts both require a string `schema`; neither reports its absence.",
  },
  {
    name: "schema is not a string",
    body: JSON.stringify({ schema: 7, id: "example-unowned" }, null, 2),
    why: "A typo that makes `schema` a number reads as a document to a human and to neither loader.",
  },
  {
    name: "top-level array",
    body: JSON.stringify([{ schema: "finding", id: "example-unowned" }], null, 2),
    why: "A document wrapped in a list -- the shape a generator emits when it forgets to unwrap.",
  },
  {
    name: "unparseable",
    body: "{ not json",
    why: "Owned: schemas.document-unparseable. Included as the control the comment in artifacts.ts names.",
  },
  {
    name: "unknown schema name",
    body: JSON.stringify({ schema: "not-a-catalog-schema", id: "example-unowned" }, null, 2),
    why: "Owned: schemas.unknown-schema-id. The second control.",
  },
];

function main(): number {
  const root = mkdtempSync(join(tmpdir(), "ak-unowned-"));
  for (const entry of COPIED) cpSync(join(REPO, entry), join(root, entry), { recursive: true });

  const silent: string[] = [];
  for (const testCase of CASES) {
    writeFileSync(join(root, REL), testCase.body);
    const issues = runValidation(root).issues.filter((i) => (i.file ?? "").includes("unowned-probe"));
    unlinkSync(join(root, REL));

    if (issues.length === 0) {
      silent.push(testCase.name);
      console.log(`  UNOWNED  ${testCase.name}`);
    } else {
      const rules = [...new Set(issues.map((i) => `${i.severity}:${i.rule}`))].join(", ");
      console.log(`  owned    ${testCase.name} -- ${rules}`);
    }
    console.log(`           ${testCase.why}`);
  }

  rmSync(root, { recursive: true, force: true });
  console.log(`\n${silent.length} of ${CASES.length} cases are dropped by both loaders and reported by no check.`);
  if (silent.length === 0) return 0;
  console.error(
    "\nA file in templates/ matching any case above validates nothing and says so nowhere.\n" +
      "src/validation/artifacts.ts:42-45 and src/validation/schemas.ts:163-165 are the two skips.\n" +
      "Neither is this probe's to fix: both are outside the schemas lane.",
  );
  return 1;
}

process.exit(main());
