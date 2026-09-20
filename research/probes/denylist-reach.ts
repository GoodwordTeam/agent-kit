/**
 * Does the model-routing denylist reach `evals/`, the tree §9 commissions?
 *
 * AUTHORING.md §7 says `ak validate` "fails on a hit anywhere outside the
 * exempt prefixes, which are `DENYLIST_EXEMPT_PREFIXES`", and closes with
 * "Read the symbol rather than this sentence for whether a given tree is
 * scanned." Reading that symbol answers the question wrongly for `evals/`.
 * `DENYLIST_EXEMPT_PREFIXES` is a subtraction applied by `isExempt` to what
 * `collect` already gathered, and `collect` is called with `SCAN_DIRS` -- an
 * allow-list of thirteen directories that §7 never names and `evals` is not in.
 * A tree in neither list is never offered to the scanner at all.
 *
 * §9 requires every skill author to create `evals/<skill-id>/<case-id>/case.yaml`
 * with a free-prose `execution.prompt`, so this is not a corner of the tree that
 * happens to be empty. It is a populated, authored, shipped surface on which the
 * one prohibition §7 states without qualification is unenforced.
 *
 * The probe writes the term's own `probe` string -- never a literal typed here --
 * into a copy of the tree at three paths and asks the full run what it says.
 *
 *   docs/          in SCAN_DIRS            control: must be reported
 *   research/      in the exempt prefixes  control: silent, and silent on purpose
 *   evals/         in neither              subject: silent, and silent by omission
 *
 * The second control is what makes the first two readable. Silence alone does
 * not distinguish a tree someone decided not to scan from a tree nobody decided
 * anything about, and only the second is the defect (§8, "An instrument asserts
 * the outcome only its hypothesis predicts").
 *
 * WHAT A FAILING RUN MEANS
 *   A denylisted term in an eval prompt ships. Closing it is one entry in
 *   `SCAN_DIRS` (`src/validation/content.ts`) -- or, if `evals/` is meant to be
 *   out of scope, an entry in `DENYLIST_EXEMPT_PREFIXES` so the omission is
 *   deliberate and visible, plus the sentence in §9 telling a writer so.
 *
 * WHAT A PASSING RUN IS NOT EVIDENCE OF
 *   - That the eval cases are clean. It measures reach, not content.
 *   - That every unscanned tree is now scanned. Three paths are tested.
 *
 * Nothing is written inside the repository.
 *
 * Usage: bun run research/probes/denylist-reach.ts
 * Exits 0 once a denylisted term under `evals/` is reported, 1 while it is not,
 * and 1 without judging the tree if the probe has lost its grip on its inputs.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DENY_TERMS } from "../../src/denylist.ts";
import { walkFiles } from "../../src/util/fs.ts";
import { runValidation } from "../../src/validation/run.ts";

const REPO = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

/** Everything `runValidation` reads that this probe's three paths sit inside. */
const COPIED = [
  "catalog.yaml",
  "AGENTS.md",
  "AUTHORING.md",
  "README.md",
  "NOTICE",
  "schemas",
  "policies",
  "profiles",
  "adapters",
  "templates",
  "docs",
  "skills",
  "packs",
  "protocols",
  "roles",
  "references",
  "evals",
  "src",
  "tests",
  "research",
];

/** The marker is the filename, so a hit is attributed without parsing the message. */
const MARKER = "denylist-reach-probe";

interface Case {
  readonly rel: string;
  readonly where: string;
  readonly expectReported: boolean;
}

function main(): number {
  const term = DENY_TERMS.find((t) => t.kind === "model-name" && !t.anchored);
  if (term === undefined) {
    console.error("PROBE UNGROUNDED: no unanchored model-name term in DENY_TERMS to write.");
    return 1;
  }

  const root = mkdtempSync(join(tmpdir(), "ak-denylist-reach-"));
  try {
    for (const entry of COPIED) {
      const from = join(REPO, entry);
      if (existsSync(from)) cpSync(from, join(root, entry), { recursive: true });
    }

    // §10: a probe reports on itself rather than on the tree when its input is
    // empty. An `evals/` with no case file would make the subject silent for a
    // reason that has nothing to do with the scanner.
    const cases = walkFiles(root, "evals").filter((f) => f.endsWith("case.yaml"));
    if (cases.length === 0) {
      console.error("PROBE UNGROUNDED: evals/ holds no case.yaml, so its silence measures nothing.");
      return 1;
    }
    const subjectDir = dirname(cases[0] as string);

    const plan: ReadonlyArray<Case> = [
      { rel: `docs/${MARKER}.md`, where: "docs/ -- in SCAN_DIRS", expectReported: true },
      { rel: `research/${MARKER}.md`, where: "research/ -- in DENYLIST_EXEMPT_PREFIXES", expectReported: false },
      { rel: `${subjectDir}/${MARKER}.yaml`, where: "evals/ -- in neither list", expectReported: true },
    ];

    const reported = new Map<string, boolean>();
    for (const probeCase of plan) {
      const target = join(root, probeCase.rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, `# ${MARKER}\nnote: ${term.probe}\n`);
      const hits = runValidation(root).issues.filter(
        (i) => (i.file ?? "").includes(MARKER) && i.rule.startsWith("content."),
      );
      unlinkSync(target);

      reported.set(probeCase.rel, hits.length > 0);
      const verdict = hits.length > 0 ? "reported" : "SILENT  ";
      console.log(`  ${verdict}  ${probeCase.rel}`);
      console.log(`            ${probeCase.where}`);
    }

    const control = reported.get(`docs/${MARKER}.md`) === true;
    const exempt = reported.get(`research/${MARKER}.md`) === false;
    const subject = reported.get(`${subjectDir}/${MARKER}.yaml`) === true;

    if (!control || !exempt) {
      console.error(
        `\nPROBE UNGROUNDED: the controls did not behave as the scanner's own configuration says they must` +
          ` (docs reported=${control}, research silent=${exempt}). The subject's result is not readable` +
          ` against controls that disagree with SCAN_DIRS and DENYLIST_EXEMPT_PREFIXES, so this run judges` +
          ` nothing about evals/.`,
      );
      return 1;
    }

    if (subject) {
      console.log("\nevals/ is reached by the content scan. This gap is closed.");
      return 0;
    }

    console.error(
      `\nA denylisted term under evals/ is reported by no check, while the same term in docs/ fails the run.\n` +
        `evals/ is in neither SCAN_DIRS nor DENYLIST_EXEMPT_PREFIXES (src/validation/content.ts), so it is\n` +
        `never offered to the scanner -- and AUTHORING.md §7 sends a writer to the second symbol to decide.\n` +
        `Filed as a contract defect in CONTRACT-DEFECTS.md; this probe is the executable half of it.`,
    );
    return 1;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

process.exit(main());
