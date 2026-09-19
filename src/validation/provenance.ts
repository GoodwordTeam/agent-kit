import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { DIRECTORY_SECTIONS, entryDir } from "../catalog/layout.ts";
import { isDir, listFiles, readTextIfPresent } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { error, note, skipped, warning, type Issue } from "./types.ts";

const TRANSCRIPT = "research/sources/grok-transcript.md";
const PLAN = "research/sources/engineering-skills-repo-plan.md";
const LOCK = "provenance/upstream.lock.yaml";
/**
 * `provenance/adaptations.yaml` is generated, never authored. Batches write one
 * fragment each under `adaptations.d/`, which is what makes ten sequential
 * batches possible without a merge conflict on every one of them; `ak build`
 * renders the merged file, which is what NOTICE, README, AGENTS.md and
 * catalog.yaml point a downstream consumer at for MIT attribution.
 */
export const ADAPTATIONS_FILE = "provenance/adaptations.yaml";
export const ADAPTATIONS_FRAGMENT_DIR = "provenance/adaptations.d";
const CONVERSATION_MAP = "provenance/conversation-map.yaml";

export interface GLocator {
  start: number;
  end: number;
}

/** `G:L<start>` or `G:L<start>-<end>`. Null when malformed or inverted. */
export function parseGLocator(text: string): GLocator | null {
  const match = /^G:L(\d+)(?:-(\d+))?$/.exec(text.trim());
  if (match === null) return null;
  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || start > end) return null;
  return { start, end };
}

export type LocatorReference =
  | { kind: "transcript"; start: number; end: number }
  | { kind: "document"; document: "plan" | "arch"; section: string }
  | { kind: "amalgam"; left: string; right: string };

/**
 * `plan §7.1`, `arch §3`, `plan §9 (Milestone 7)`.
 *
 * A closed set with a real pattern, on purpose. The conversation map's own
 * header names exactly two source documents, and the design's precedence order
 * puts the plan *above* the transcript rather than beneath it, so a document
 * reference is a stronger citation than a transcript range, not a weaker one.
 * Anything outside this shape -- a bare `see the discussion above` -- still
 * fails, or widening the grammar would be an escape hatch instead of a parser.
 */
const DOCUMENT_REFERENCE = /^(plan|arch) §(\d+(?:\.\d+)*(?: \([^()]+\))?)$/;

/**
 * `amalgam roles/code-review/frontend-races + roles/doc-review/design-lens`.
 *
 * The locator for a capability that exists only because two donor-derived seats
 * were placed in the same catalog: a boundary neither donor could state, because
 * neither knows the other exists, and the transcript never specified, because it
 * never enumerated seat pairs at this granularity. AGENTS.md opens by saying this
 * repository *amalgamates* six donors; this is the origin that verb produces.
 *
 * Both endpoints are catalog destinations, so this locator is checkable in a way
 * a transcript range is not: `G:L` gets an upper bound and nothing more, while an
 * amalgam reference dangles loudly the moment either seat is renamed or dropped.
 *
 * It also has no bootstrapping problem. A commit SHA would be the obvious anchor
 * and cannot be written, because the row lands in the same commit as the body it
 * describes. Both seats here pre-date the row, so the locator names only things
 * that already exist -- which is the reason to locate a boundary by its endpoints
 * rather than by the act that drew it.
 */
const AMALGAM_REFERENCE = /^amalgam (\S+) \+ (\S+)$/;

/**
 * The origins a map row may declare. `conversation-map.yaml` has no JSON schema,
 * so nothing else constrains this field -- a row with a misspelled value, or with
 * the key itself misspelled, was silently originless before this list existed.
 */
const ORIGINS = ["donor", "conversation", "amalgam"] as const;

/** Render a reference the way the map writes it, so a message quotes the offending one. */
export function formatLocatorReference(reference: LocatorReference): string {
  if (reference.kind === "amalgam") return `amalgam ${reference.left} + ${reference.right}`;
  if (reference.kind === "document") return `${reference.document} §${reference.section}`;
  return reference.start === reference.end ? `G:L${reference.start}` : `G:L${reference.start}-${reference.end}`;
}

/**
 * A whole `locator:` field: one or more references separated by `;`.
 *
 * A capability grounded in three places cites three places. Parsing the field
 * as a single range failed those rows wholesale, which meant none of their
 * `G:L` references were range-checked at all. One bad reference still fails
 * the field.
 *
 * This parser accepts strictly more input than the single-range one it replaced,
 * which reads like a loosened gate and is the opposite. Measured against
 * `provenance/conversation-map.yaml` on the day of the change: the single-range
 * parser accepted **4 of 102** locator fields, so **157 of the 161** `G:L`
 * references in the map were never range-checked at all -- the 98 rejected
 * fields fell out of the check entirely rather than failing it. The field parser
 * resolves all 257 references (161 transcript, 96 document) and range-checks
 * every transcript one. The gate went from covering 4 references to covering
 * 161; it was restored, not widened.
 */
export function parseLocatorField(text: string): LocatorReference[] | null {
  const parts = text.split(";").map((part) => part.trim());
  if (parts.some((part) => part.length === 0)) return null;

  const references: LocatorReference[] = [];
  for (const part of parts) {
    const transcript = parseGLocator(part);
    if (transcript !== null) {
      references.push({ kind: "transcript", start: transcript.start, end: transcript.end });
      continue;
    }
    const amalgam = AMALGAM_REFERENCE.exec(part);
    if (amalgam?.[1] !== undefined && amalgam[2] !== undefined) {
      references.push({ kind: "amalgam", left: amalgam[1], right: amalgam[2] });
      continue;
    }
    const match = DOCUMENT_REFERENCE.exec(part);
    if (match?.[1] === undefined || match[2] === undefined) return null;
    references.push({ kind: "document", document: match[1] === "plan" ? "plan" : "arch", section: match[2] });
  }
  return references;
}

/** `donor@commit:path` */
export interface DonorSource {
  donor: string;
  commit: string;
  path: string;
}

export function parseDonorSource(text: string): DonorSource | null {
  const match = /^([A-Za-z0-9._-]+)@([0-9a-f]{7,64}):(.+)$/.exec(text.trim());
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) return null;
  return { donor: match[1], commit: match[2], path: match[3] };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readYaml(root: string, file: string): { value: Record<string, unknown> } | { error: Issue } | null {
  const text = readTextIfPresent(join(root, file));
  if (text === null) return null;
  try {
    return { value: record(parseYaml(text)) };
  } catch (cause) {
    return { error: error("provenance.unparseable", file, cause instanceof Error ? cause.message : String(cause)) };
  }
}

function listOf(doc: Record<string, unknown>, keys: ReadonlyArray<string>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const key of keys) {
    const raw = doc[key];
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      const entry = record(item);
      if (Object.keys(entry).length > 0) out.push(entry);
    }
  }
  return out;
}

interface Donor {
  id: string;
  path: string;
  commit: string;
}

function loadDonors(root: string): { donors: Map<string, Donor>; issues: Issue[] } {
  const donors = new Map<string, Donor>();
  const issues: Issue[] = [];
  const doc = readYaml(root, LOCK);
  if (doc === null) {
    issues.push(note("provenance.lock-unavailable", LOCK, "No upstream lock; donor pins could not be resolved. Rows naming a donor it would have pinned are reported individually as provenance.unknown-donor, so an unverified row is an error here rather than a silence."));
    return { donors, issues };
  }
  if ("error" in doc) return { donors, issues: [doc.error] };

  for (const entry of listOf(doc.value, ["donors"])) {
    const id = entry["id"];
    if (typeof id !== "string") continue;
    donors.set(id, {
      id,
      path: typeof entry["path"] === "string" ? entry["path"] : `.donors/${id}`,
      commit: typeof entry["commit"] === "string" ? entry["commit"] : "",
    });
  }
  return { donors, issues };
}

export interface Adaptation {
  path: string;
  source: string;
  /** The fragment this row came from, so a conflict can name both sides. */
  file: string;
  /** The row as written, so fields beyond path and source survive the merge. */
  row: Record<string, unknown>;
}

/**
 * The merged view every other document in the repository refers to.
 *
 * Fragments are the only input, and each adapted path is owned by exactly one
 * fragment. Two fragments claiming the same path is the failure mode this
 * design introduces — the merged file would otherwise depend on fragment order
 * — so it is an error rather than a last-writer-wins merge.
 *
 * Several rows in *one* fragment may share a path: a body adapted from three
 * donor files has three sources and one target, and collapsing that to one row
 * would lose attribution the MIT notices are built from. An exactly repeated
 * `path` + `source` pair is redundant rather than contradictory, so it is a
 * warning and the merge keeps one copy.
 */
export function loadAdaptationFragments(root: string): { rows: Adaptation[]; issues: Issue[]; present: boolean } {
  const rows: Adaptation[] = [];
  const issues: Issue[] = [];

  const names = listFiles(join(root, ADAPTATIONS_FRAGMENT_DIR)).filter((n) => /\.ya?ml$/.test(n)).sort();
  const present = isDir(join(root, ADAPTATIONS_FRAGMENT_DIR));

  /** path -> the one fragment that owns it, and the sources it has already recorded. */
  const claimed = new Map<string, { file: string; sources: Map<string, Adaptation> }>();
  for (const name of names) {
    const file = `${ADAPTATIONS_FRAGMENT_DIR}/${name}`;
    const doc = readYaml(root, file);
    if (doc === null) continue;
    if ("error" in doc) {
      issues.push(doc.error);
      continue;
    }
    for (const entry of listOf(doc.value, ["adaptations"])) {
      const path = entry["path"];
      if (typeof path !== "string") continue;
      const source = typeof entry["source"] === "string" ? entry["source"] : "";
      const row: Adaptation = { path, source, file, row: entry };

      const prior = claimed.get(path);
      if (prior === undefined) {
        claimed.set(path, { file, sources: new Map([[source, row]]) });
        rows.push(row);
        continue;
      }

      const repeated = prior.sources.get(source);
      if (repeated !== undefined) {
        // Both sides say the same thing, so the merge is still well defined and
        // the row survives once. Redundant, not contradictory: a warning.
        issues.push(
          warning(
            "provenance.duplicate-adaptation",
            file,
            `'${path}' is already recorded from ${source || "(no source)"} in ${repeated.file}. The merged file carries it once; the second row adds no attribution.`,
          ),
        );
        continue;
      }

      if (prior.file !== file) {
        issues.push(
          error(
            "provenance.conflicting-adaptation",
            file,
            `'${path}' is recorded here as ${source || "(no source)"} and in ${prior.file} as ${[...prior.sources.keys()].map((s) => s || "(no source)").join(", ")}. One fragment owns each adapted path; resolve which batch owns it rather than letting the merge pick one.`,
          ),
        );
        continue;
      }

      prior.sources.set(source, row);
      rows.push(row);
    }
  }

  if (!present) {
    issues.push(
      note(
        "provenance.adaptations-unavailable",
        ADAPTATIONS_FRAGMENT_DIR,
        `No ${ADAPTATIONS_FRAGMENT_DIR}/; no donor rows to check yet. An empty merge is valid.`,
      ),
    );
  }
  return { rows, issues, present };
}

const GENERATED_HEADER = [
  "# Generated by `ak build` from provenance/adaptations.d/*.yaml. Do not edit this file.",
  "# Write surface: provenance/adaptations.d/<batch>.yaml, one fragment per batch.",
  "# Each adapted file is recorded here with its exact donor@commit:path source.",
  "",
].join("\n");

/** The exact bytes `ak build` writes, so "in sync" is a string comparison. */
export function renderAdaptations(rows: ReadonlyArray<Adaptation>): string {
  const sorted = [...rows].sort((a, b) => a.path.localeCompare(b.path) || a.source.localeCompare(b.source));
  const body = stringifyYaml({ adaptations: sorted.map((r) => r.row) }, { lineWidth: 0 });
  return `${GENERATED_HEADER}${body}`;
}

/** The generated file and its fragments drift the way dist/ drifts, and are reported the same way. */
export function checkAdaptationsSync(ctx: CheckContext): Issue[] {
  const { rows, issues: loadIssues, present } = loadAdaptationFragments(ctx.root);
  const issues = loadIssues.filter((i) => i.severity === "error");
  if (issues.length > 0) return issues; // Nothing coherent to render yet.

  const expected = renderAdaptations(rows);
  const actual = readTextIfPresent(join(ctx.root, ADAPTATIONS_FILE));

  if (actual === null) {
    if (!present && rows.length === 0) {
      return [
        note(
          "provenance.adaptations-not-generated",
          ADAPTATIONS_FILE,
          "Not generated yet. `ak build` writes it from the fragments; with no fragments it is the header and an empty list.",
        ),
      ];
    }
    return [
      error(
        "provenance.adaptations-out-of-sync",
        ADAPTATIONS_FILE,
        `${rows.length} row(s) in ${ADAPTATIONS_FRAGMENT_DIR}/ but no generated file. NOTICE points a downstream consumer at this path. Run \`ak build\`.`,
      ),
    ];
  }

  if (actual !== expected) {
    return [
      error(
        "provenance.adaptations-out-of-sync",
        ADAPTATIONS_FILE,
        `Does not match a merge of ${ADAPTATIONS_FRAGMENT_DIR}/. This file is generated: edit the fragment, then run \`ak build\`.`,
      ),
    ];
  }

  return [];
}

/**
 * Git tree-entry modes, which is what a donor path has to be checked against.
 *
 * The obvious check is `git cat-file -e <commit>:<path>`, and it was the check
 * here. It answers "does the pin contain an object at this path", which is not
 * the question a provenance row asks. `cat-file -t` is no better: git types a
 * symlink as a `blob`, so a row naming one resolves, types as a blob, and
 * records the ten bytes of a target path rather than the text anyone adapted.
 * That is a row that validates while recording nothing -- the same shape as a
 * row keyed on the wrong field, which AUTHORING.md:308 already warns about.
 *
 * Mode is the only field that separates the four cases in one call, so the
 * check reads it and the three rejections say three different things. The
 * citation checker in research/probes/dossier-citations.py keeps `-e` on
 * purpose: a dossier citation points a reader at material, and a directory or a
 * symlink is a fine thing to point a reader at. A row claims text was adapted
 * from one file, which only a file can be.
 */
const MODE_FILE = "100644";
const MODE_EXEC = "100755";
const MODE_SYMLINK = "120000";
const MODE_TREE = "040000";

/** How far a repair suggestion will chase links before giving up. */
const MAX_LINK_HOPS = 4;

function gitOut(root: string, donor: Donor, args: ReadonlyArray<string>): string | null {
  const result = spawnSync("git", ["-C", join(root, donor.path), ...args], { encoding: "utf8" });
  return result.status === 0 ? result.stdout : null;
}

/** The tree-entry mode of `path` at `commit`, or null when the pin has no entry there. */
function modeAtPin(root: string, donor: Donor, commit: string, path: string): string | null {
  const out = gitOut(root, donor, ["ls-tree", "--full-tree", "-z", commit, "--", path]);
  if (out === null) return null;
  for (const record of out.split("\0")) {
    if (record === "") continue;
    const tab = record.indexOf("\t");
    if (tab === -1) continue;
    // A pathspec can match more than the literal path; take the entry that is it.
    if (record.slice(tab + 1) !== path) continue;
    const mode = record.slice(0, tab).split(" ")[0] ?? "";
    return mode === "" ? null : mode;
  }
  return null;
}

/** A symlink entry's target, as written in the blob. */
function symlinkTarget(root: string, donor: Donor, commit: string, path: string): string | null {
  const out = gitOut(root, donor, ["cat-file", "blob", `${commit}:${path}`]);
  return out === null ? null : out.trim();
}

/** `target` resolved against `fromDir`, or null when it escapes the tree or is absolute. */
function resolveRelative(fromDir: string, target: string): string | null {
  if (target.startsWith("/")) return null;
  const out: string[] = [];
  for (const part of [...fromDir.split("/"), ...target.split("/")]) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.length === 0 ? null : out.join("/");
}

/** `path` with its first symlinked component replaced by that link's target. */
function rewriteFirstLink(root: string, donor: Donor, commit: string, path: string): string | null {
  const parts = path.split("/").filter((p) => p.length > 0);
  for (let i = 0; i < parts.length; i += 1) {
    const prefix = parts.slice(0, i + 1).join("/");
    const mode = modeAtPin(root, donor, commit, prefix);
    if (mode === null) return null;
    if (mode !== MODE_SYMLINK) continue;
    const target = symlinkTarget(root, donor, commit, prefix);
    if (target === null) return null;
    const resolved = resolveRelative(parts.slice(0, i).join("/"), target);
    if (resolved === null) return null;
    const rest = parts.slice(i + 1);
    return rest.length === 0 ? resolved : `${resolved}/${rest.join("/")}`;
  }
  return null;
}

/**
 * The path that reaches the same file without crossing a symlink, or null.
 *
 * Verified at the pin before it is returned, and that is not belt-and-braces.
 * Both symlinked skill directories in the pinned donors were tested:
 * compound-engineering's `.agy/skills -> ../skills` resolves to a file that is
 * there, and its `.claude/skills -> ../.agents/skills` resolves to a path the
 * pin does not contain at all. One of the two real cases would have produced a
 * confident repair pointing at nothing, in an error message about a path that
 * points at nothing. So a suggestion is printed only when it resolves to a file,
 * and the plain rejection stands otherwise.
 */
function resolveThroughLinks(root: string, donor: Donor, commit: string, path: string): string | null {
  let current = path;
  for (let hop = 0; hop < MAX_LINK_HOPS; hop += 1) {
    const rewritten = rewriteFirstLink(root, donor, commit, current);
    if (rewritten === null) return null;
    const mode = modeAtPin(root, donor, commit, rewritten);
    if (mode === MODE_FILE || mode === MODE_EXEC) return rewritten;
    if (mode !== null && mode !== MODE_SYMLINK) return null;
    current = rewritten;
  }
  return null;
}

/** The rejection for a donor path that is not a file at its pin, or null when it is one. */
function checkPathAtPin(root: string, donor: Donor, parsed: DonorSource, row: Adaptation): Issue | null {
  const { donor: id, commit, path } = parsed;
  const at = `${id}@${commit}`;
  const mode = modeAtPin(root, donor, commit, path);
  if (mode === MODE_FILE || mode === MODE_EXEC) return null;

  const repair = resolveThroughLinks(root, donor, commit, path);

  if (mode === MODE_SYMLINK) {
    const suggestion = repair === null ? "" : ` Cite '${repair}', the file it points at.`;
    return error(
      "provenance.source-is-symlink",
      row.file,
      `'${path}' is a symlink at ${at}, not a file. Git types a symlink as a blob, so the row for '${row.path}' resolves and then records the target path rather than the text it claims was adapted: it validates while recording nothing.${suggestion}`,
    );
  }
  if (mode === MODE_TREE) {
    return error(
      "provenance.source-is-directory",
      row.file,
      `'${path}' is a directory at ${at}. A row records the one file its text was adapted from, and a directory names a set without saying which member. The row for '${row.path}' needs the file.`,
    );
  }
  const suggestion = repair === null ? "" : ` Cite '${repair}', which is the same file reached without crossing the link.`;
  return error(
    "provenance.source-not-at-pin",
    row.file,
    `'${path}' does not exist in ${id} at ${commit} (checked with git ls-tree in ${donor.path}). The row for '${row.path}' cites a path the pin does not contain.${suggestion}`,
  );
}

/**
 * Every numbered heading in the governing plan, as a set of section ids.
 *
 * Null when the plan is absent, which is a skip rather than a pass: a document
 * reference that resolves against nothing looks exactly like one that resolves.
 *
 * `research/probes/map-coverage.py` reads the same headings with the same regex
 * for a different question -- which sections no row claims. This is the other
 * half: whether a cited section exists at all. The probe is run by hand, so the
 * half that belongs in a gate is here.
 */
function planSections(root: string): Set<string> | null {
  const text = readTextIfPresent(join(root, PLAN));
  if (text === null) return null;
  const out = new Set<string>();
  for (const line of text.split("\n")) {
    const match = /^#{2,6}\s+(?:§\s*)?(\d+(?:\.\d+)*)[.\s)]+\S/.exec(line);
    if (match?.[1] !== undefined) out.add(match[1]);
  }
  return out;
}

function transcriptLineCount(root: string): number | null {
  const text = readTextIfPresent(join(root, TRANSCRIPT));
  if (text === null) return null;
  const lines = text.split("\n");
  return lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

export function checkProvenance(ctx: CheckContext): Issue[] {
  const { root, catalog } = ctx;
  const issues: Issue[] = [];

  const { donors, issues: donorIssues } = loadDonors(root);
  issues.push(...donorIssues);
  const { rows, issues: adaptationIssues } = loadAdaptationFragments(root);
  issues.push(...adaptationIssues);
  issues.push(...checkAdaptationsSync(ctx));

  const donorsPresent = isDir(join(root, ".donors"));
  if (!donorsPresent && rows.length > 0) {
    issues.push(
      skipped(
        "provenance.donors-unavailable",
        ".donors",
        "donor paths at pin",
        `.donors/ is absent (gitignored and reproducible from upstream.lock.yaml). ${rows.length} donor row${rows.length === 1 ? "" : "s"} went unverified: no row's path was checked against the tree its pin names, so a row citing a path the pin does not contain reads exactly like one that checks out. Clone the donors and re-run before treating this run as provenance evidence.`,
      ),
    );
  }

  for (const row of rows) {
    if (row.source === "") {
      issues.push(error("provenance.malformed-source", row.file, `Row for '${row.path}' has no source. Expected donor@commit:path.`));
      continue;
    }
    const parsed = parseDonorSource(row.source);
    if (parsed === null) {
      issues.push(error("provenance.malformed-source", row.file, `Source '${row.source}' for '${row.path}' is not of the form donor@commit:path.`));
      continue;
    }
    const donor = donors.get(parsed.donor);
    if (donor === undefined) {
      issues.push(
        error("provenance.unknown-donor", row.file, `Source for '${row.path}' names donor '${parsed.donor}', which ${LOCK} does not pin.`),
      );
      continue;
    }
    if (donor.commit !== "" && donor.commit !== parsed.commit) {
      issues.push(
        warning(
          "provenance.commit-not-pinned",
          row.file,
          `Source for '${row.path}' cites ${parsed.donor}@${parsed.commit} but ${LOCK} pins ${donor.commit}.`,
        ),
      );
    }
    if (!donorsPresent || !isDir(join(root, donor.path))) continue;
    const atPin = checkPathAtPin(root, donor, parsed, row);
    if (atPin !== null) issues.push(atPin);
  }

  issues.push(...checkEntryOrigins(ctx, rows));
  return issues;
}

/**
 * Dispositions that land a capability somewhere in the catalog.
 *
 * `excluded` is named in a source and deliberately not built, and `optional` is
 * recognised by the design but carried outside the engineering catalog; both
 * have a null destination by contract (conversation-map.yaml's own header). The
 * three below claim a home, so a row with one and no destination is a capability
 * the map can no longer prove landed anywhere.
 */
const DISPOSITIONS_THAT_LAND: ReadonlyArray<string> = ["retained", "folded", "reference"];

/**
 * Both directions between catalog.yaml and provenance/conversation-map.yaml.
 *
 * The map is capability-keyed, not entry-keyed: one row per capability named in
 * the design sources, each carrying a `destination` that points at the entry it
 * landed in. One capability lands in one destination and one destination may
 * carry several capabilities, so coverage is a many-to-many join through
 * `destination` -- never an id lookup, which would assume a file shape that
 * does not exist.
 */
function checkEntryOrigins(ctx: CheckContext, rows: ReadonlyArray<Adaptation>): Issue[] {
  const { root, catalog } = ctx;
  const issues: Issue[] = [];

  const mapDoc = readYaml(root, CONVERSATION_MAP);
  const mapRows = mapDoc !== null && !("error" in mapDoc) ? listOf(mapDoc.value, ["capabilities", "entries", "mechanisms"]) : [];
  if (mapDoc !== null && "error" in mapDoc) issues.push(mapDoc.error);
  const mapAvailable = mapDoc !== null;

  /**
   * Both of the next two report a check that did not run, and both are a skip only
   * when something existed for it to run on. The criterion is the subject, not the
   * absent file: an entry declaring conversation origin goes unchecked without the
   * map, and a locator goes unrange-checked without the transcript, but a tree with
   * neither has nothing unexamined and a skip term there is noise that teaches a
   * reader to stop reading the term.
   */
  const conversationEntries = DIRECTORY_SECTIONS.flatMap((section) =>
    catalog.bySection(section).filter((entry) => entry.status === "authored" && entry.provenanceOrigin === "conversation"),
  ).length;
  if (!mapAvailable) {
    const message = `No conversation map; conversation-origin entries could not be checked.`;
    issues.push(
      conversationEntries > 0
        ? skipped(
            "provenance.conversation-map-unavailable",
            CONVERSATION_MAP,
            "conversation origins",
            `${message} ${conversationEntries} authored entr${conversationEntries === 1 ? "y declares" : "ies declare"} provenance_origin: conversation and nothing confirmed the capability is recorded.`,
          )
        : note("provenance.conversation-map-unavailable", CONVERSATION_MAP, `${message} No authored entry declares it, so nothing went unexamined.`),
    );
  }

  const transcriptLines = transcriptLineCount(root);
  if (transcriptLines === null) {
    const message = "Transcript absent; G:L locator ranges could not be checked.";
    issues.push(
      mapRows.length > 0
        ? skipped(
            "provenance.transcript-unavailable",
            TRANSCRIPT,
            "G:L locator ranges",
            `${message} ${mapRows.length} capability row${mapRows.length === 1 ? "" : "s"} parsed; a range past the end of the transcript reads the same as one inside it.`,
          )
        : note("provenance.transcript-unavailable", TRANSCRIPT, `${message} The map has no rows, so no range went unchecked.`),
    );
  }

  const planIndex = planSections(root);
  if (planIndex === null) {
    // Same criterion as the transcript above: the subject is the rows that cite a
    // section, not the absent file. A map with no document references has nothing
    // unexamined and a skip term there would be noise.
    const citing = mapRows.filter((row) => {
      const raw = row["locator"] ?? row["g_locator"] ?? row["gl"];
      return typeof raw === "string" && (parseLocatorField(raw) ?? []).some((r) => r.kind === "document");
    }).length;
    const message = "Plan absent; plan and arch section references could not be resolved.";
    issues.push(
      citing > 0
        ? skipped(
            "provenance.plan-unavailable",
            PLAN,
            "plan section references",
            `${message} ${citing} capability row${citing === 1 ? "" : "s"} cite${citing === 1 ? "s" : ""} a section, and a reference to a section that does not exist reads the same as one that does.`,
          )
        : note("provenance.plan-unavailable", PLAN, `${message} No row cites a section, so nothing went unresolved.`),
    );
  }

  // A destination may name any declared entry, file-backed sections included:
  // the map points at schemas, policies and adapters as readily as at skills.
  const owned = new Set(catalog.entries.map((entry) => `${entry.section}/${entry.id}`));

  /** destination -> the capability rows that landed there. */
  const byDestination = new Map<string, Record<string, unknown>[]>();

  for (const row of mapRows) {
    const id = typeof row["id"] === "string" && row["id"].length > 0 ? row["id"] : "(unnamed capability)";
    const disposition = typeof row["disposition"] === "string" ? row["disposition"] : "";
    const destination = typeof row["destination"] === "string" && row["destination"].length > 0 ? row["destination"] : null;

    if (destination === null) {
      if (DISPOSITIONS_THAT_LAND.includes(disposition)) {
        issues.push(
          warning(
            "provenance.capability-without-destination",
            CONVERSATION_MAP,
            `'${id}' is disposition: ${disposition} but names no destination. A capability that was kept lands in a declared entry; only excluded and optional rows have a null destination.`,
          ),
        );
      }
    } else {
      if (!owned.has(destination)) {
        issues.push(
          error(
            "provenance.destination-without-entry",
            CONVERSATION_MAP,
            `'${id}' lands in '${destination}', which catalog.yaml declares no entry for. Either the entry was renamed or removed without the map following, or the map points at something that was never declared.`,
          ),
        );
      }
      const prior = byDestination.get(destination);
      if (prior === undefined) byDestination.set(destination, [row]);
      else prior.push(row);
    }

    const origin = row["origin"];
    if (typeof origin !== "string" || !ORIGINS.includes(origin as (typeof ORIGINS)[number])) {
      issues.push(
        error(
          "provenance.unknown-origin",
          CONVERSATION_MAP,
          `'${id}' declares origin: ${origin === undefined ? "(absent)" : String(origin)}. Every capability says where it came from, and the value is one of ${ORIGINS.join(", ")}.`,
        ),
      );
    }

    if ((origin === "conversation" || origin === "amalgam") && typeof row["source"] === "string" && row["source"].length > 0) {
      issues.push(
        error(
          "provenance.fabricated-source",
          CONVERSATION_MAP,
          `'${id}' has origin: ${String(origin)} but carries a donor source '${row["source"]}'. A capability absent upstream carries a locator, never a source path.`,
        ),
      );
    }

    issues.push(...checkLocatorField(id, row, transcriptLines, planIndex));
    issues.push(...checkAmalgamOrigin(id, row, destination, owned));
  }

  for (const section of DIRECTORY_SECTIONS) {
    for (const entry of catalog.bySection(section)) {
      if (entry.status !== "authored") continue;
      const dir = entryDir(section, entry.id);

      if (entry.provenanceOrigin === "donor") {
        const covered = rows.some((r) => r.path === dir || r.path.startsWith(`${dir}/`));
        if (!covered) {
          issues.push(
            error(
              "provenance.missing-adaptation",
              dir,
              `${section}/${entry.id} declares provenance_origin: donor but no row in ${ADAPTATIONS_FILE} covers a file under ${dir}/.`,
            ),
          );
        }
        continue;
      }

      if (entry.provenanceOrigin !== "conversation") continue;
      if (!mapAvailable) continue;

      const landed = byDestination.get(dir);
      if (landed === undefined) {
        issues.push(
          error(
            "provenance.missing-conversation-origin",
            CONVERSATION_MAP,
            `${section}/${entry.id} declares provenance_origin: conversation but no capability in ${CONVERSATION_MAP} has destination: ${dir}.`,
          ),
        );
        continue;
      }
      if (!landed.some((r) => r["origin"] === "conversation")) {
        // Named rather than assumed: with three origins in the map, "not conversation"
        // no longer implies "donor", and a message that guesses wrong sends the reader
        // to check something the row does not say.
        const found = [...new Set(landed.map((r) => (typeof r["origin"] === "string" ? r["origin"] : "(absent)")))].sort();
        issues.push(
          error(
            "provenance.missing-conversation-origin",
            CONVERSATION_MAP,
            `${section}/${entry.id} declares provenance_origin: conversation but every capability landing in ${dir} is recorded as origin: ${found.join(", ")}. One of the two is wrong about where the capability came from.`,
          ),
        );
      }
    }
  }

  return issues;
}

/**
 * An `origin: amalgam` row against the seats it claims to sit between.
 *
 * Three things have to hold, and each corresponds to a way the row could be a
 * placeholder wearing a locator's clothes. The origin and the locator form must
 * agree, or `amalgam` becomes a label anything can carry. Both endpoints must be
 * declared, or the boundary is drawn against something that does not exist. And
 * the row must land on one of its own endpoints, because a boundary is owned by
 * the seats it separates -- a third party describing someone else's boundary is
 * how a rationale drifts out of reach of the thing it explains.
 *
 * Reciprocity is deliberately not required. Two of the first three rows are a
 * matched pair recorded from both sides, and the third is a single row resolving
 * a distinction that turned out not to be a counterpart family at all. Demanding
 * a partner row would force the writer to invent one.
 */
function checkAmalgamOrigin(
  id: string,
  row: Record<string, unknown>,
  destination: string | null,
  owned: ReadonlySet<string>,
): Issue[] {
  const raw = row["locator"];
  const references = typeof raw === "string" ? (parseLocatorField(raw) ?? []) : [];
  const pairs = references.filter((reference) => reference.kind === "amalgam");
  const isAmalgam = row["origin"] === "amalgam";

  if (!isAmalgam) {
    if (pairs.length === 0) return [];
    return [
      error(
        "provenance.amalgam-origin-mismatch",
        CONVERSATION_MAP,
        `'${id}' carries an amalgam locator but origin: ${String(row["origin"])}. A boundary between two seats is not in either donor and is not in the transcript; the origin has to say so.`,
      ),
    ];
  }

  if (pairs.length === 0) {
    return [
      error(
        "provenance.amalgam-origin-mismatch",
        CONVERSATION_MAP,
        `'${id}' has origin: amalgam but no 'amalgam <destination> + <destination>' reference in its locator. This origin exists to name the two seats whose pairing created the capability, and a row that names neither has recorded nothing.`,
      ),
    ];
  }

  const issues: Issue[] = [];
  for (const pair of pairs) {
    if (pair.kind !== "amalgam") continue;
    for (const endpoint of [pair.left, pair.right]) {
      if (owned.has(endpoint)) continue;
      issues.push(
        error(
          "provenance.amalgam-endpoint-unknown",
          CONVERSATION_MAP,
          `'${id}' draws a boundary against '${endpoint}', which catalog.yaml declares no entry for. An amalgam locator is only as good as its endpoints: if a seat was renamed or dropped, the capability between them needs re-deciding, not repointing.`,
        ),
      );
    }
    if (destination !== null && pair.left !== destination && pair.right !== destination) {
      issues.push(
        error(
          "provenance.amalgam-destination-outside-pair",
          CONVERSATION_MAP,
          `'${id}' lands in '${destination}' but sits between '${pair.left}' and '${pair.right}'. A boundary is recorded on a seat it separates, so the reader who opens that seat finds it.`,
        ),
      );
    }
  }
  return issues;
}

/** Every reference in a row's locator field, range-checked against the transcript. */
function checkLocatorField(
  id: string,
  row: Record<string, unknown>,
  transcriptLines: number | null,
  planIndex: Set<string> | null,
): Issue[] {
  const raw = row["locator"] ?? row["g_locator"] ?? row["gl"];
  if (typeof raw !== "string") {
    return [error("provenance.g-locator-missing", CONVERSATION_MAP, `'${id}' carries no locator; every capability cites where it came from.`)];
  }

  const references = parseLocatorField(raw);
  if (references === null) {
    return [
      error(
        "provenance.g-locator-invalid",
        CONVERSATION_MAP,
        `'${id}' has locator '${raw}', which is not a ';'-separated list of G:L<start>[-<end>] transcript ranges, 'plan §<section>' or 'arch §<section>' document references, and 'amalgam <destination> + <destination>' seat pairs.`,
      ),
    ];
  }

  const issues: Issue[] = [];
  for (const reference of references) {
    if (reference.kind === "transcript") {
      if (transcriptLines === null || reference.end <= transcriptLines) continue;
      issues.push(
        error(
          "provenance.g-locator-out-of-range",
          CONVERSATION_MAP,
          `'${id}' cites ${formatLocatorReference(reference)} but ${TRANSCRIPT} has ${transcriptLines} lines.`,
        ),
      );
      continue;
    }
    if (reference.kind !== "document" || planIndex === null) continue;
    // `plan §9 (Milestone 7)` carries a parenthetical for the reader; the heading
    // it resolves against does not, so match on the number alone.
    const section = reference.section.replace(/\s*\([^()]*\)$/, "");
    if (planIndex.has(section)) continue;
    issues.push(
      error(
        "provenance.document-reference-unresolved",
        CONVERSATION_MAP,
        `'${id}' cites ${formatLocatorReference(reference)}, which is not a numbered section of ${PLAN}. A reference that parses is not a reference that resolves; if the section was renumbered, the capability needs re-locating rather than the number nudging.`,
      ),
    );
  }
  return issues;
}
