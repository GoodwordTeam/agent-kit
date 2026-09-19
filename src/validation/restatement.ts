/**
 * Claims that restate a ruling without attributing it (AUTHORING.md §6).
 *
 * The `binds` checks run one direction: a row names an entry, and the entry has
 * to cite it. This runs the other -- a body states a ruling's substance and
 * cites nothing, so the rule reads as this file's own invention and its real
 * width is lost. Nothing in `binds` can find that, because the row does not know
 * the file exists.
 *
 * It is a lexical instrument and it is built to say so:
 *
 * - **Windows, not files.** The unit is one to three consecutive sentences,
 *   because the question is whether *this claim* is attributed. A file-level
 *   test clears a body that cites a ruling in one section and restates it
 *   uncited in another, which is the shape the live tree actually had.
 * - **Ranked candidates, never one.** Measured against known instances, the top
 *   match is the wrong sibling roughly as often as it is right: two rulings that
 *   overlap in substance score close, and the scan reliably finds the right line
 *   while naming the wrong row. Reporting only the leader would instruct an
 *   author to cite a ruling they are not the one narrowing, producing a citation
 *   that looks correct and leaving the omission in place.
 * - **Warning, never a gate, and it declares its own blindness.** A restatement
 *   that shares none of its ruling's vocabulary scores zero, and at least one
 *   known instance does exactly that. A check that misses part of its target
 *   class and prints clean is worse than no check, so the coverage note runs on
 *   every pass -- including a clean one -- and says the silence proves nothing.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { readTextIfPresent, walkFiles } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { RULINGS_FILE, loadRulings } from "./rulings.ts";
import { note, warning, type Issue } from "./types.ts";

/**
 * Cosine at which a window is reported.
 *
 * This number is a volume control, not a correctness boundary. Nothing about
 * 0.55 makes a window a restatement; it is the point where the output stays
 * short enough that someone reads every row, which is the only mode in which a
 * candidate generator is worth anything.
 *
 * Calibrated at `e15be71` on the pinned corpus (see `checkRestatements`)
 * against the whole tree, every row read and classified rather than sampled.
 * The revision is part of the measurement: the tree moves, and a figure
 * without one cannot be checked later.
 *
 * - `>= 0.65`: 3 rows, all three genuine. Tempting, and rejected -- three
 *   points is not a calibration, and it drops the most interesting row below.
 * - `>= 0.55`: 8 rows, 5 genuine -- `AGENTS.md:55`, `AGENTS.md:136`,
 *   `AUTHORING.md:431`, `AUTHORING.md:607`, `tdd:79`. The 3 false are a
 *   donor-mapping table row, README's bulleted digest of the rulings, and a
 *   field list that shares a ruling's nouns.
 * - `>= 0.40`: 40 rows. The class that arrives in bulk is the field list.
 *
 * So five of eight at 0.55 are worth acting on. That figure replaces the much
 * better one measured on a handful of files, which never covered a corpus this
 * size.
 *
 * `AUTHORING.md:431` was first classified false here, on the reasoning that it
 * reaches a citation seven lines up through the words "that ruling" and a
 * reader can see what it means. Two others reached the same reading and then
 * the same correction, so it is worth stating why it is wrong: 6 requires the
 * citation "inline at the sentence it governs", and says why -- the inline
 * citation is what the executing agent sees at the moment it would otherwise
 * improvise. An agent that loads one paragraph never sees the line above it.
 * Reading the file the way a human scrolls it is the wrong test.
 *
 * `AUTHORING.md:607` is why the threshold is not 0.65: it cites
 * `delta-baseline-reset-not-third-loop` and restates `two-fix-cycles-then-stop`
 * without naming it. A block carrying one citation looks attributed to a reader
 * skimming for backticks, and that is exactly the miss worth catching.
 */
export const RESTATEMENT_THRESHOLD = 0.55;

/** How many candidate rulings a report names. */
const CANDIDATES = 3;

/** Longest window, in sentences. */
const MAX_WINDOW = 3;

/** Below this many distinct content words a window is too short to measure. */
const MIN_CONTENT_WORDS = 5;

const SCANNED_ROOTS = ["skills", "packs", "protocols", "roles", "references", "adapters", "policies", "profiles"];
const SCANNED_EXTENSIONS = [".md", ".yaml"];

/**
 * Words carried by every governance document in the tree, which therefore
 * separate nothing. IDF alone does not remove them: the ruling texts are part of
 * the same corpus, so a word common to rulings and bodies alike keeps a middling
 * weight and accumulates across a long window.
 */
const STOPWORDS = new Set(
  ("a an the and or but if then than that this these those is are was were be been being it its of to in on for from by with as at into not no never only own same so such can cannot could may might must shall should will would do does did done have has had here there where when who whom which what while each every any all both few more most other some one two three").split(
    " ",
  ),
);

function contentWords(text: string): string[] {
  const flattened = text.toLowerCase().replace(/[`_]/g, " ");
  return [...flattened.matchAll(/[a-z][a-z-]*/g)]
    .map((m) => m[0])
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

interface Sentence {
  readonly text: string;
  readonly line: number;
  /** Which run of non-blank lines this sentence came from. */
  readonly block: number;
}

/**
 * Sentences with the line they start on and the block they belong to.
 *
 * Split per line rather than across the whole file: a markdown body is mostly
 * headings, bullets and table rows, which end without a full stop and would
 * otherwise be glued to the next paragraph. The block index is what keeps a
 * window from spanning a blank line -- two sentences either side of a paragraph
 * break are two claims, and joining them invents a third that neither made.
 */
function sentencesOf(text: string): Sentence[] {
  const found: Sentence[] = [];
  let block = 0;
  for (const [index, line] of text.split("\n").entries()) {
    if (line.trim() === "") {
      block++;
      continue;
    }
    for (const piece of line.split(/(?<=[.!?])\s+/)) {
      const trimmed = piece.trim();
      if (trimmed.length > 25) found.push({ text: trimmed, line: index + 1, block });
    }
  }
  return found;
}

interface Window {
  readonly text: string;
  readonly line: number;
  readonly endLine: number;
  readonly block: number;
}

function windowsOf(sentences: ReadonlyArray<Sentence>): Window[] {
  const found: Window[] = [];
  for (let size = 1; size <= MAX_WINDOW; size++) {
    for (let i = 0; i + size <= sentences.length; i++) {
      const slice = sentences.slice(i, i + size);
      const first = slice[0];
      const last = slice[slice.length - 1];
      if (first === undefined || last === undefined) continue;
      if (slice.some((s) => s.block !== first.block)) continue;
      found.push({
        text: slice.map((s) => s.text).join(" "),
        line: first.line,
        endLine: last.line,
        block: first.block,
      });
    }
  }
  return found;
}

type Vector = Map<string, number>;

function vectorOf(words: ReadonlyArray<string>, idf: ReadonlyMap<string, number>): Vector {
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  const vector: Vector = new Map();
  for (const [word, n] of counts) vector.set(word, (1 + Math.log(n)) * (idf.get(word) ?? 0));
  return vector;
}

function cosine(a: Vector, b: Vector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [word, value] of a) {
    dot += value * (b.get(word) ?? 0);
    normA += value * value;
  }
  for (const value of b.values()) normB += value * value;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function scannedFiles(root: string): string[] {
  const found = new Set<string>();
  for (const dir of SCANNED_ROOTS) {
    for (const file of walkFiles(root, dir)) {
      if (SCANNED_EXTENSIONS.some((ext) => file.endsWith(ext))) found.add(file);
    }
  }
  // Root markdown is scanned by discovery rather than by name. `AUTHORING.md`
  // governs every body in the package and `AGENTS.md` states the rules bodies
  // restate, so they are the files most likely to state a ruling's substance --
  // and naming them explicitly would have missed `CONTRACT-DEFECTS.md` the day
  // it was added, which is the failure this check exists to catch.
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) found.add(entry.name);
    }
  } catch {
    // An unreadable root is the caller's problem, not this check's.
  }
  // The policy is the rulings; measuring it against itself would flag every row.
  found.delete(RULINGS_FILE);
  return [...found].sort();
}

/**
 * The scope a citation has to be in for it to attribute this claim.
 *
 * In markdown it is the block containing the window, and nothing wider. This is
 * a decision rather than a property, so the reasoning is here: a ruling with N
 * independent clauses generates N citation obligations, not one per file and
 * not one per neighbourhood. `protocols/tdd/PROTOCOL.md` is the worked case --
 * two consecutive `Gate:` paragraphs state different clauses of one ruling and
 * both cite it, which a scope reaching one block back would have told the
 * second gate it did not have to.
 *
 * A paragraph opening "That ruling also governs ..." is therefore reported
 * although a reader scrolling the file can see what it refers to. That is not
 * a cost being accepted, which is how this comment first put it; §6 requires
 * the citation "inline at the sentence it governs" and gives the reason -- the
 * inline citation is what the executing agent sees at the moment it would
 * otherwise improvise. An agent that loads one paragraph through progressive
 * disclosure never sees the line above it, so a back-reference discharges the
 * obligation for the human and not for the reader the rule exists to serve.
 *
 * Note which direction that leaves the scope in. §6 asks for the sentence;
 * this clears a claim when the ruling appears anywhere in its paragraph. The
 * check is the more lenient of the two by design -- a lexical instrument
 * should miss rather than accuse -- so a report here is a claim the contract
 * would also flag, never the reverse.
 *
 * Widening to the enclosing section was proposed and is refused, because it
 * clears the strongest true positive in the tree: `AUTHORING.md` 10 spans
 * 517-644, `:601` cites `two-fix-cycles-then-stop`, and `:607` reproduces that
 * ruling's third sentence verbatim while citing a different one. Section scope
 * finds the id six lines up and calls the restatement attributed.
 *
 * In YAML it is the file. §6 gives YAML a different citation form -- a `ruling:`
 * or `rulings:` key -- and that key attaches at a mapping level rather than
 * beside the clause it governs. Measured on the authored tree, block scope in
 * YAML reports the `forbidden:` line of a list item whose `rulings:` key sits
 * two levels up: a true claim, a real citation, and a finding that is wrong.
 * The scope follows the contract's citation form, not one rule for both.
 */
function citationScope(file: string, lines: ReadonlyArray<string>, startLine: number, endLine: number): string {
  if (!file.endsWith(".md")) return lines.join("\n");
  let first = Math.max(0, startLine - 1);
  let last = Math.min(lines.length - 1, endLine - 1);
  while (first > 0 && (lines[first - 1] ?? "").trim() !== "") first--;
  while (last < lines.length - 1 && (lines[last + 1] ?? "").trim() !== "") last++;
  return lines.slice(first, last + 1).join("\n");
}

export function checkRestatements(ctx: CheckContext, threshold: number = RESTATEMENT_THRESHOLD): Issue[] {
  const { root } = ctx;
  const { rows, present } = loadRulings(root);
  const rulings = rows.filter((row) => row.text.trim().length > 0);
  if (!present || rulings.length === 0) return [];

  const files = scannedFiles(root);
  const texts = new Map<string, string>();
  const fileWindows = new Map<string, Window[]>();

  for (const file of files) {
    const text = readTextIfPresent(join(root, file));
    if (text === null) continue;
    texts.set(file, text);
    fileWindows.set(file, windowsOf(sentencesOf(text)));
  }

  // IDF over the ruling texts alone, and nothing else.
  //
  // Weighting by the whole tree discriminates slightly better, and it makes a
  // score depend on every file in the repository. Measured: two hits at 0.41
  // fell below the 0.40 threshold when an unrelated commit touched
  // `AUTHORING.md`, with the flagged files untouched and `git status` clean on
  // both runs. That is not noise, it is a specific false conclusion -- a
  // reviewer who reruns and finds a warning gone reads it as fixed, so the
  // check would manufacture evidence of work nobody did.
  //
  // Pinned to the rulings, a score is a function of two versioned things: the
  // window being checked and `policies/resolved-conflicts.yaml`. Neither can
  // move without appearing in the diff. Raising the threshold above the cluster
  // would stop today's crossings and leave the scores drifting underneath, so
  // the next corpus shift re-opens it; this removes the drift instead of
  // out-running it.
  const documents: string[][] = rulings.map((row) => contentWords(row.text));
  const documentFrequency = new Map<string, number>();
  for (const document of documents) {
    for (const word of new Set(document)) documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [word, count] of documentFrequency) idf.set(word, Math.log(documents.length / (1 + count)));

  const rulingVectors = rulings.map((row) => ({ id: row.id, vector: vectorOf(contentWords(row.text), idf) }));

  const issues: Issue[] = [];
  let windowCount = 0;

  for (const file of files) {
    const text = texts.get(file);
    const windows = fileWindows.get(file);
    if (text === undefined || windows === undefined) continue;
    const lines = text.split("\n");

    // One finding per block per ruling. The windows over a paragraph are the
    // same claim measured several ways, and the repair is one citation in that
    // block, so reporting each window would ask an author to fix one sentence
    // three times.
    //
    // The surviving window is the block's highest-scoring one, not the first
    // over the threshold. Keeping the first made the reported line and number
    // move when the threshold moved: a weaker earlier window would claim the
    // block at a low threshold and hide the strong one behind it, so the same
    // paragraph reported 0.38 at one setting and 0.69 at another. A score that
    // depends on the cutoff cannot rank anything, and ranking is the only
    // thing this number is for.
    const reported = new Map<string, { window: Window; ranked: ReadonlyArray<{ id: string; score: number }> }>();

    for (const window of windows) {
      windowCount++;
      const words = contentWords(window.text);
      if (new Set(words).size < MIN_CONTENT_WORDS) continue;

      const vector = vectorOf(words, idf);
      const ranked = rulingVectors
        .map((ruling) => ({ id: ruling.id, score: cosine(vector, ruling.vector) }))
        .filter((scored) => scored.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, CANDIDATES);
      if (ranked.length === 0) continue;

      const scope = citationScope(file, lines, window.line, window.endLine);
      if (ranked.some((scored) => scope.includes(scored.id))) continue;
      const key = `${window.block}|${ranked[0]?.id ?? ""}`;
      const held = reported.get(key);
      if (held !== undefined && (held.ranked[0]?.score ?? 0) >= (ranked[0]?.score ?? 0)) continue;
      reported.set(key, { window, ranked });
    }

    for (const { window, ranked } of [...reported.values()].sort((a, b) => a.window.line - b.window.line)) {
      const named = ranked.map((scored) => `\`${scored.id}\` (${scored.score.toFixed(2)})`).join(", ");
      issues.push(
        warning(
          "rulings.uncited-restatement",
          file,
          `This claim reads as a restatement of ${ranked.length === 1 ? "a ruling it does not cite" : "one of these rulings and cites none of them"}: ${named}. Candidates are ranked and the leader is often the wrong sibling, so read the rows before citing one; if the claim is narrower than the ruling, that is the defect rather than the citation (AUTHORING.md §6). A window that merely lists the same field names as a ruling matches too, and that is not a finding.`,
          window.line,
        ),
      );
    }
  }

  issues.push(
    note(
      "rulings.restatement-scan-coverage",
      RULINGS_FILE,
      `Measured ${windowCount} sentence window(s) across ${files.length} file(s) against ${rulings.length} ruling(s) at cosine >= ${threshold}. This is a lexical instrument and neither of its error rates is small. On the last full calibration five of the eight rows at this threshold were worth acting on, so a report is a candidate to read, not a defect to fix; the commonest false one is a list that shares a ruling's field names. Recall is worse than precision and is not quoted here: a claim that restates a ruling in none of its words scores zero, and of the three uncited restatements found by hand in this repo this scan finds two, scoring the third at zero. A clean run is therefore evidence about this instrument, not about the tree.`,
    ),
  );

  return issues;
}
