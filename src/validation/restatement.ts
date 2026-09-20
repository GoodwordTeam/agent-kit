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
 * - `>= 0.65`: 3 rows, all genuine.
 * - `>= 0.55`: 8 rows, and every one of them has since been cited or rewritten
 *   by the seat that owns the file, with the ruling this check ranked first.
 * - `>= 0.40`: 40 rows. The class that arrives in bulk is the field list,
 *   which at 0.55 sits below the line -- see `apply-findings-snapshot-bullet`
 *   in the labelled corpus, a genuine rejection at 0.49.
 *
 * Read that repair rate as evidence and not as proof. A warning is cheap to
 * silence, and a check whose reports are easy to make go away can manufacture
 * its own confirmation. What raises it above that here is that each repair
 * names the ruling this check named, and that three of the eight were argued
 * through independently, in text, before anyone had looked at the repairs.
 *
 * I recorded four of those eight as false in earlier revisions of this comment
 * -- `AUTHORING.md:431`, a donor-mapping table row, README's digest bullet and
 * a field list -- and all four were wrong in the same direction, for the same
 * reason. Each time I argued from the container rather than the sentence: it
 * is a back-reference, it is a table cell, it is a digest, it is an
 * enumeration. The sentences said otherwise. The field list carries its
 * ruling's closing clause verbatim; the table cell states its ruling's closing
 * sentence in the repo's own voice; the digest bullet is one of six that each
 * restate a ruling.
 *
 * 6 decides all four the same way. It requires the citation "inline at the
 * sentence it governs" and gives the reason: the inline citation is what the
 * executing agent sees at the moment it would otherwise improvise. An agent
 * that loads one paragraph never sees the line above it, and it does not care
 * what kind of container the sentence arrived in. Reading the file the way a
 * human scrolls it is the wrong test, and so is reading it by shape.
 *
 * `AUTHORING.md:607` is why the threshold is not 0.65: it cites
 * `delta-baseline-reset-not-third-loop` and restates `two-fix-cycles-then-stop`
 * without naming it. A block carrying one citation looks attributed to a reader
 * skimming for backticks, and that is exactly the miss worth catching.
 *
 * What the number cannot buy, at any setting.
 *
 * The honest recall measurement is on the sample this check did not select.
 * Five clauses were found to restate a ruling by reading `78f8918`, before this
 * scan existed, and fixed at `36e7cf4`; this scan reports two of them and
 * misses three, at 0.48, 0.49 and 0.30. Two more found later in `AUTHORING.md`
 * at `a13ccc0` by matching verbatim runs score 0.40 and 0.50. An eighth is the
 * `lesson.publish` hard gate in `policies/invocation.yaml` at `6c3c60c`, which a
 * human cited by hand at `e15be71` -- thirteen minutes before `3e29c75` added
 * this scan, so that fix is not this instrument's output either. Two of eight.
 *
 * All six sub-threshold misses rank the correct ruling first, so ranking is
 * not what fails.
 * Nor is the cutoff: `:419` quotes its ruling for 80 characters and scores
 * 0.40 where `:607` quotes 79 and scores 0.55, and `:31` quotes 65 and scores
 * 0.50 where `AGENTS.md:136` quotes the same 65 and scores 0.78. Cosine is not
 * monotone in how much a passage quotes, so lowering the cutoff to reach them
 * reorders nothing -- it buys the forty-row band and still leaves 34-character
 * paraphrases above 80-character quotations. The signal that reaches this class
 * is the verbatim run itself, which needs no corpus, no threshold and no
 * revision to mean something.
 *
 * The eighth was not a cutoff question and is now half of one. `invocation.yaml`
 * cites the ruling on the *neighbouring* operation; under the file scope this
 * check used until `citationScope` was narrowed, the operation that actually
 * needed the citation produced no window at all, so no threshold could reach it.
 * Ancestor scope ends that: the sibling's key no longer covers it, the claim is
 * scored, and it lands at 0.52. Still a miss, and now a miss of the same kind as
 * the other five rather than a second kind -- it sits in the band between 0.30
 * and 0.52 that the cutoff argument above already covers.
 *
 * Recall is unchanged at two of eight. Narrowing scope moved one case from
 * unreachable to merely under the line, which is worth doing because a claim
 * nothing scores cannot be argued about, but it is not a recall improvement and
 * the note below does not claim one.
 *
 * All eight are in the labelled corpus, the six as known misses; see
 * `tests/fixtures/restatement-cases.ts`.
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
 * In YAML it is the mapping the citation is attached to, and everything nested
 * beneath it. §6 gives YAML a different citation form -- a `ruling:` or
 * `rulings:` key -- and that key attaches at a mapping level rather than beside
 * the clause it governs, so block scope is too narrow: measured on the authored
 * tree it reports the `forbidden:` line of a list item whose `rulings:` key sits
 * two levels up, which is a true claim, a real citation and a wrong finding.
 *
 * This was the whole file until `021d36e`, and that was too wide by exactly the
 * same argument. A key cannot attribute what it is not attached to, and file
 * scope let a citation on one operation silence a restatement of the same
 * ruling in every other operation of the document. It was not a tuning
 * question and no threshold reached it, because the window was never scored --
 * the scope cleared it before the cosine was computed. That is miss eight of
 * the eight the coverage note counts, and it is the only one a scope change
 * could ever have fixed.
 *
 * Ancestor scope is not a compromise between the two. It is what the citation
 * form means: a key covers the mapping it sits in, and everything nested under
 * that mapping, and nothing to either side.
 *
 * Two consequences worth naming rather than discovering.
 *
 * A sequence of scalars has nowhere to carry a citation, so the coarsest legal
 * attachment for one of its items is the mapping above the sequence --
 * `policies/review.yaml`'s `synthesis.may_not` is the live case. A key placed
 * there necessarily covers every sub-mapping of `synthesis` too, including ones
 * carrying their own precise `ruling:` keys, so a later uncited restatement
 * anywhere under `synthesis` is silent. That is inherent in ancestor scope and
 * in the shape of the file, not in where anyone put the key.
 *
 * And the direction is asymmetric on purpose: a citation nested *under* a claim
 * attributes nothing, because it is attached to something narrower than the
 * claim it would have to cover. Without that, ancestor scope collapses back
 * into file scope the moment any key in the document cites anything.
 *
 * A window that overlaps the governed range is covered by it, rather than one
 * that sits wholly inside. Requiring containment was the first rule here and it
 * produced three findings on the authored tree, every one of them wrong in the
 * same way: a window is a run of consecutive sentences and nothing makes it stop
 * at a mapping boundary, so it routinely begins on the `# ---` banner above a
 * key, or on the last line of the previous sibling, and then runs into the
 * material that actually matches. `policies/limits.yaml` `not_gates`,
 * `policies/review.yaml` `baseline_reset` and `policies/authority-defaults.yaml`
 * `seat_separation` are the three, and in each the restated clause and its
 * `ruling:` key are both inside the mapping -- only the window's first sentence
 * was outside it. Overlap is the lenient reading and leniency is this check's
 * standing bias: it should miss rather than accuse.
 */
const CITATION_KEY = /^\s*(?:-\s+)?rulings?\s*:/;

/** Indentation in columns, or -1 for a blank line, which belongs to no level. */
function indentOf(line: string): number {
  return line.search(/\S/);
}

/**
 * The lines a YAML citation key governs: its parent mapping and that mapping's
 * whole subtree, which is the range from the nearest line above it at a shallower
 * indent through the last line before the next one.
 */
function governedRange(lines: ReadonlyArray<string>, at: number, indent: number): { from: number; to: number } {
  let from = 0;
  for (let i = at - 1; i >= 0; i--) {
    const above = indentOf(lines[i] ?? "");
    if (above >= 0 && above < indent) {
      from = i;
      break;
    }
  }
  let to = lines.length - 1;
  for (let i = at + 1; i < lines.length; i++) {
    const below = indentOf(lines[i] ?? "");
    if (below >= 0 && below < indent) {
      to = i - 1;
      break;
    }
  }
  return { from, to };
}

/**
 * The column the citation key itself starts at, which is past the dash in the
 * sequence-item form `- ruling: <id>`. The key's siblings sit at this column,
 * so measuring from the dash instead would read them as part of its value --
 * `policies/limits.yaml` is written that way throughout.
 */
function keyColumn(line: string): number {
  return line.search(/rulings?\s*:/);
}

/**
 * The last line of a citation key's value: the rest of its own line, plus a
 * block sequence under it. Items indented past the key are its value, and so
 * are items at the key's own column, which is legal YAML -- reading that form
 * as an empty value would drop a real citation and report the claim it covers,
 * and this check misses rather than accuses.
 */
function valueEnd(lines: ReadonlyArray<string>, at: number, column: number): number {
  let end = at;
  for (let i = at + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") continue;
    const indent = indentOf(line);
    const isItemAtKeyColumn = indent === column && /^\s*-\s/.test(line);
    if (indent <= column && !isItemAtKeyColumn) break;
    end = i;
  }
  return end;
}

function citationScope(file: string, lines: ReadonlyArray<string>, startLine: number, endLine: number): string {
  if (file.endsWith(".md")) {
    let first = Math.max(0, startLine - 1);
    let last = Math.min(lines.length - 1, endLine - 1);
    while (first > 0 && (lines[first - 1] ?? "").trim() !== "") first--;
    while (last < lines.length - 1 && (lines[last + 1] ?? "").trim() !== "") last++;
    return lines.slice(first, last + 1).join("\n");
  }

  // The window's own lines first: §6's inline form is legal in YAML too, and a
  // scalar that names its ruling in the sentence is attributed by the same rule
  // markdown uses.
  const parts: string[] = [...lines.slice(startLine - 1, endLine)];
  const first = startLine - 1;
  const last = endLine - 1;

  for (const [at, line] of lines.entries()) {
    if (!CITATION_KEY.test(line)) continue;
    const indent = indentOf(line);
    if (indent < 0) continue;
    const { from, to } = governedRange(lines, at, indent);
    if (last < from || first > to) continue;
    // The key's own value, not the range it governs. Pushing the range let an
    // id written anywhere beneath a cited mapping read as a citation of that
    // whole mapping, because the match is a substring test -- upward
    // attribution restored inside every mapping that carried a key, which is
    // what ancestor scope exists to prevent. Found by `policies` against
    // `edb7ecb`; the mapping-level key their commit added is what turned it on.
    parts.push(...lines.slice(at, valueEnd(lines, at, keyColumn(line)) + 1));
  }
  return parts.join("\n");
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
      `Measured ${windowCount} sentence window(s) across ${files.length} file(s) against ${rulings.length} ruling(s) at cosine >= ${threshold}. This is a lexical instrument and neither of its error rates is small. On the last full calibration every row at this threshold was later cited or rewritten by the seat owning the file, naming the ruling this check named -- but a warning is cheap to silence, so read a report as a candidate rather than treating that rate as precision. The commonest false one is a list that shares a ruling's field names, and at this threshold it sits just below the line. Recall is the weaker side and it is now a measurement rather than an estimate, taken on the only sample this instrument did not select: eight restatements in this repo were found without it, six by reading before it existed and two by matching verbatim runs, and it reports two of the eight. Six of the misses score 0.48, 0.49, 0.40, 0.30, 0.50 and 0.52, every one of them ranking the correct ruling first and falling short of the line. They are not a threshold setting. Cosine measures vocabulary shared with a corpus, not quotation, and does not order these by how much they quote: 80 verbatim characters score 0.40 where 79 score 0.55 and 34 score 0.60, so a cutoff low enough to admit the misses admitted forty rows at the calibration revision and still ranked them below shorter paraphrases. A restatement sharing none of its ruling's words scores zero by construction, which no threshold reaches at all. In YAML a citation covers the mapping it is attached to and everything nested beneath it, and nothing to either side; that scope is narrower than the whole file this check once used, under which a ruling named on one operation silenced a restatement of it in every other operation of the document. The sixth miss was hidden that way and is now scored, which changed no recall number and made one unreachable claim arguable. A clean run is therefore evidence about this instrument, not about the tree.`,
    ),
  );

  return issues;
}
