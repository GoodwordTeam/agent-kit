/**
 * Does the packager rewrite every occurrence of a path it relocates, or only
 * the first one the extractor happened to keep?
 *
 * `ak build` moves a shared dependency to `references/shared/<source path>` and
 * rewrites the referring skill body so the link still resolves in the bundle.
 * The rewrite is driven by `extractRelativeLinks` (`src/util/links.ts`), which
 * recognises two spellings of a relative reference -- a markdown `](target)`
 * and a backticked path -- and then deduplicates its own output per
 * `(line, path)`. When one line carries the same path in both spellings, which
 * a markdown link whose display text is the path does by construction, the
 * extractor returns one of them. `rewriteLinks` (`src/packaging/plan.ts`)
 * rewrites by substring of that one `raw`, so the other spelling keeps the
 * pre-move path.
 *
 * The stale copy is not cosmetic. Before the rewrite the two spellings are
 * identical, so the dedup hides one; after it they differ, so the dedup stops
 * applying, and `checkBundleLinks` (`src/validation/links.ts`) re-extracts the
 * bundled text, finds the stale spelling, and raises `links.broken-bundle`
 * against a file the packager itself wrote. Its remedy text -- copy the file
 * into `references/shared/` or remove the reference -- is wrong in both halves:
 * the file is already in the bundle, and the reference is the one the catalog
 * requires. The author's source link was valid the whole time and
 * `checkSourceLinks` says so.
 *
 * Three cases, because silence alone would not say which mechanism is at work:
 *
 *   code span only        control: rewritten, so the extractor does see the
 *                         backticked spelling when nothing masks it
 *   markdown link only    control: rewritten, the ordinary case
 *   both, same line       subject: the markdown target is rewritten and the
 *                         code span is left pointing at the pre-move path
 *
 * WHAT A FAILING RUN MEANS
 *   Any body that writes a relocated path in both spellings on one line ships a
 *   bundle the tree's own validator rejects, with an error naming the author's
 *   source rather than the packager. Closing it is either a `raw` that spans
 *   the whole occurrence, or dropping the per-line dedup and rewriting each
 *   occurrence -- both in code this probe does not own.
 *
 * WHAT A PASSING RUN IS NOT EVIDENCE OF
 *   - That bundle links are correct. Three constructed lines are tested, and
 *     only for the one-line collision.
 *   - That the same path in the two spellings on *different* lines is safe.
 *     The dedup is keyed on the line, so that case never collided; it is not
 *     measured here.
 *   - That no other check re-reads rewritten output and disagrees with it.
 *
 * Nothing is written anywhere; the probe is pure.
 *
 * Usage: bun run research/probes/bundle-link-rewrite.ts
 * Exits 0 once both spellings survive a relocation, 1 while one is left stale,
 * and 1 without judging the packager if the probe has lost its grip on its
 * inputs.
 */

import { readFileSync } from "node:fs";

import { extractRelativeLinks, relativeLinkBetween, resolveFromFile } from "../../src/util/links.ts";
import { SHARED_ROOT } from "../../src/packaging/plan.ts";

const REPO = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

/**
 * The probe reimplements three lines of `rewriteLinks` because they are not
 * exported. That is only sound while they are still the three lines the
 * packager runs, so each is asserted against the file it was taken from. A
 * refactor here is not a verdict about the packager -- it is the probe losing
 * its subject, and it says so rather than passing or failing.
 */
const GROUNDING: ReadonlyArray<{ file: string; fragment: string; why: string }> = [
  {
    file: "src/packaging/plan.ts",
    fragment: "const replacement = link.raw.replace(`${link.target}${anchor}`, `${wanted}${anchor}`);",
    why: "the rewrite this probe reproduces",
  },
  {
    file: "src/packaging/plan.ts",
    fragment: "out = out.split(link.raw).join(replacement);",
    why: "the substitution this probe reproduces",
  },
  {
    file: "src/util/links.ts",
    fragment: "const key = `${i}:${path}`;",
    why: "the per-line dedup that is the mechanism under test",
  },
];

for (const { file, fragment, why } of GROUNDING) {
  const text = readFileSync(`${REPO}/${file}`, "utf8");
  if (!text.includes(fragment)) {
    console.error(`PROBE UNGROUNDED: ${file} no longer contains ${why}.`);
    console.error(`  expected to find: ${fragment}`);
    console.error("  The probe reproduces packager internals; re-read them before trusting a verdict.");
    process.exit(1);
  }
}

/** `rewriteLinks`, reduced to the relocation of one dependency. */
function rewriteOneBody(sourcePath: string, text: string): string {
  let out = text;
  for (const link of extractRelativeLinks(text)) {
    const resolved = resolveFromFile(sourcePath, link.target);
    if (resolved === null) continue;
    const wanted = relativeLinkBetween(sourcePath, `${SHARED_ROOT}/${resolved}`);
    if (wanted === link.target) continue;
    const anchor = link.anchor === undefined ? "" : `#${link.anchor}`;
    const replacement = link.raw.replace(`${link.target}${anchor}`, `${wanted}${anchor}`);
    out = out.split(link.raw).join(replacement);
  }
  return out;
}

const BODY = "skills/probe-subject/SKILL.md";
const TARGET = "../../references/probe-pack/REFERENCE.md";

const CASES: ReadonlyArray<{ role: "control" | "subject"; name: string; line: string }> = [
  { role: "control", name: "code span only", line: `Load \`${TARGET}\` before naming any term.` },
  { role: "control", name: "markdown link only", line: `Load [the pack](${TARGET}) before naming any term.` },
  { role: "subject", name: "both spellings, one line", line: `Load [\`${TARGET}\`](${TARGET}) before naming any term.` },
];

let controlsHeld = true;
let subjectStale = false;

for (const { role, name, line } of CASES) {
  const after = rewriteOneBody(BODY, line);
  // The pre-move path survives exactly when some spelling was not rewritten.
  // Matching on the path alone would also match the relocated path, which
  // contains it, so the test is on the two spellings as they are written.
  const stale = after.includes(`\`${TARGET}\``) || after.includes(`](${TARGET})`);
  const verdict = stale ? "STALE" : "rewritten";
  console.log(`${verdict.padEnd(9)} ${role.padEnd(7)} ${name}`);
  console.log(`          ${after}`);
  if (role === "control" && stale) controlsHeld = false;
  if (role === "subject") subjectStale = stale;
}

if (!controlsHeld) {
  console.error("");
  console.error("PROBE UNGROUNDED: a control was left stale, so a stale subject would say nothing");
  console.error("  about the one-line collision. The extractor's handling of a lone spelling changed;");
  console.error("  read `extractRelativeLinks` before reading anything into the subject.");
  process.exit(1);
}

console.log("");
if (subjectStale) {
  console.error("OPEN: the packager rewrites the markdown target and leaves the code span on the same");
  console.error("  line pointing at the pre-move path. `checkBundleLinks` then reports");
  console.error("  `links.broken-bundle` against the packager's own output, naming the author's source.");
  console.error("  Owned by the packaging lane: `src/packaging/plan.ts` and `src/util/links.ts`.");
  process.exit(1);
}

console.log("CLOSED: both spellings of a relocated path survive the rewrite.");
process.exit(0);
