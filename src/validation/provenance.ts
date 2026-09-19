import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { DIRECTORY_SECTIONS, entryDir } from "../catalog/layout.ts";
import { isDir, listFiles, readTextIfPresent } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { error, note, warning, type Issue } from "./types.ts";

const TRANSCRIPT = "research/sources/grok-transcript.md";
const LOCK = "provenance/upstream.lock.yaml";
const ADAPTATIONS = "provenance/adaptations.yaml";
const ADAPTATIONS_DIR = "provenance/adaptations.d";
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

interface Adaptation {
  path: string;
  source: string;
  file: string;
}

function loadAdaptations(root: string): { rows: Adaptation[]; issues: Issue[]; present: boolean } {
  const rows: Adaptation[] = [];
  const issues: Issue[] = [];
  let present = false;

  const files = [ADAPTATIONS, ...listFiles(join(root, ADAPTATIONS_DIR)).filter((n) => /\.ya?ml$/.test(n)).map((n) => `${ADAPTATIONS_DIR}/${n}`)];
  for (const file of files) {
    const doc = readYaml(root, file);
    if (doc === null) continue;
    present = true;
    if ("error" in doc) {
      issues.push(doc.error);
      continue;
    }
    for (const entry of listOf(doc.value, ["adaptations"])) {
      const path = entry["path"];
      const source = entry["source"];
      if (typeof path !== "string") continue;
      rows.push({ path, source: typeof source === "string" ? source : "", file });
    }
  }

  if (!present) issues.push(note("provenance.adaptations-unavailable", ADAPTATIONS, "No adaptations record; donor rows could not be checked."));
  return { rows, issues, present };
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
  const { rows, issues: adaptationIssues } = loadAdaptations(root);
  issues.push(...adaptationIssues);

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

function checkEntryOrigins(ctx: CheckContext, rows: ReadonlyArray<Adaptation>): Issue[] {
  const { root, catalog } = ctx;
  const issues: Issue[] = [];

  const mapDoc = readYaml(root, CONVERSATION_MAP);
  const mapRows = mapDoc !== null && !("error" in mapDoc) ? listOf(mapDoc.value, ["entries", "capabilities", "mechanisms"]) : [];
  if (mapDoc !== null && "error" in mapDoc) issues.push(mapDoc.error);
  const mapAvailable = mapDoc !== null;
  if (!mapAvailable) {
    issues.push(note("provenance.conversation-map-unavailable", CONVERSATION_MAP, "No conversation map; conversation-origin entries could not be checked."));
  }

  const transcriptLines = transcriptLineCount(root);
  if (transcriptLines === null) {
    issues.push(note("provenance.transcript-unavailable", TRANSCRIPT, "Transcript absent; G:L locator ranges could not be checked."));
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of mapRows) {
    const id = row["id"];
    if (typeof id === "string") byId.set(id, row);
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
              `${section}/${entry.id} declares provenance_origin: donor but no row in ${ADAPTATIONS} covers a file under ${dir}/.`,
            ),
          );
        }
        continue;
      }

      if (entry.provenanceOrigin !== "conversation") continue;
      if (!mapAvailable) continue;

      const row = byId.get(entry.id);
      if (row === undefined) {
        issues.push(
          error(
            "provenance.missing-conversation-origin",
            CONVERSATION_MAP,
            `${section}/${entry.id} declares provenance_origin: conversation but ${CONVERSATION_MAP} has no entry for '${entry.id}'.`,
          ),
        );
        continue;
      }

      if (typeof row["source"] === "string" && row["source"].length > 0) {
        issues.push(
          error(
            "provenance.fabricated-source",
            CONVERSATION_MAP,
            `'${entry.id}' has origin: conversation but carries a donor source '${String(row["source"])}'. A capability absent upstream carries a G:L locator, never a source path.`,
          ),
        );
      }

      const locatorRaw = row["locator"] ?? row["g_locator"] ?? row["gl"];
      if (typeof locatorRaw !== "string") {
        issues.push(
          error("provenance.g-locator-missing", CONVERSATION_MAP, `'${entry.id}' has origin: conversation but no G:L locator.`),
        );
        continue;
      }
      const locator = parseGLocator(locatorRaw);
      if (locator === null) {
        issues.push(
          error(
            "provenance.g-locator-invalid",
            CONVERSATION_MAP,
            `'${entry.id}' has locator '${locatorRaw}', which is not a valid G:L<start>[-<end>] with start <= end.`,
          ),
        );
        continue;
      }
      if (transcriptLines !== null && locator.end > transcriptLines) {
        issues.push(
          error(
            "provenance.g-locator-out-of-range",
            CONVERSATION_MAP,
            `'${entry.id}' has locator '${locatorRaw}' but ${TRANSCRIPT} has ${transcriptLines} lines.`,
          ),
        );
      }
    }
  }

  return issues;
}
