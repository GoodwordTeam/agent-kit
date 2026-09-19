import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { DIRECTORY_SECTIONS, entryDir } from "../catalog/layout.ts";
import { isDir, listFiles, readTextIfPresent } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { error, note, warning, type Issue } from "./types.ts";

const TRANSCRIPT = "research/sources/grok-transcript.md";
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
  | { kind: "document"; document: "plan" | "arch"; section: string };

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

/** Render a reference the way the map writes it, so a message quotes the offending one. */
export function formatLocatorReference(reference: LocatorReference): string {
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
    issues.push(note("provenance.lock-unavailable", LOCK, "No upstream lock; donor pins could not be resolved."));
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

/** Verify the donor path exists at the pinned commit in the local clone. */
function pathExistsAtPin(root: string, donor: Donor, commit: string, path: string): boolean {
  const result = spawnSync("git", ["-C", join(root, donor.path), "cat-file", "-e", `${commit}:${path}`], {
    encoding: "utf8",
    stdio: "ignore",
  });
  return result.status === 0;
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
      note(
        "provenance.donors-unavailable",
        ".donors",
        ".donors/ is absent (gitignored and reproducible from upstream.lock.yaml); donor-path-at-pin verification was skipped.",
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
    if (!pathExistsAtPin(root, donor, parsed.commit, parsed.path)) {
      issues.push(
        error(
          "provenance.source-not-at-pin",
          row.file,
          `'${parsed.path}' does not exist in ${parsed.donor} at ${parsed.commit} (checked with git cat-file in ${donor.path}). The row for '${row.path}' cites a path the pin does not contain.`,
        ),
      );
    }
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
  if (!mapAvailable) {
    issues.push(note("provenance.conversation-map-unavailable", CONVERSATION_MAP, "No conversation map; conversation-origin entries could not be checked."));
  }

  const transcriptLines = transcriptLineCount(root);
  if (transcriptLines === null) {
    issues.push(note("provenance.transcript-unavailable", TRANSCRIPT, "Transcript absent; G:L locator ranges could not be checked."));
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

    if (row["origin"] === "conversation" && typeof row["source"] === "string" && row["source"].length > 0) {
      issues.push(
        error(
          "provenance.fabricated-source",
          CONVERSATION_MAP,
          `'${id}' has origin: conversation but carries a donor source '${row["source"]}'. A capability absent upstream carries a locator, never a source path.`,
        ),
      );
    }

    issues.push(...checkLocatorField(id, row, transcriptLines));
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
        issues.push(
          error(
            "provenance.missing-conversation-origin",
            CONVERSATION_MAP,
            `${section}/${entry.id} declares provenance_origin: conversation but every capability landing in ${dir} is recorded as origin: donor. One of the two is wrong about where the capability came from.`,
          ),
        );
      }
    }
  }

  return issues;
}

/** Every reference in a row's locator field, range-checked against the transcript. */
function checkLocatorField(id: string, row: Record<string, unknown>, transcriptLines: number | null): Issue[] {
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
        `'${id}' has locator '${raw}', which is not a ';'-separated list of G:L<start>[-<end>] transcript ranges and 'plan §<section>' or 'arch §<section>' document references.`,
      ),
    ];
  }

  if (transcriptLines === null) return [];
  const issues: Issue[] = [];
  for (const reference of references) {
    if (reference.kind !== "transcript" || reference.end <= transcriptLines) continue;
    issues.push(
      error(
        "provenance.g-locator-out-of-range",
        CONVERSATION_MAP,
        `'${id}' cites ${formatLocatorReference(reference)} but ${TRANSCRIPT} has ${transcriptLines} lines.`,
      ),
    );
  }
  return issues;
}
