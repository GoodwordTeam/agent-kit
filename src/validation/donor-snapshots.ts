import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import { readTextIfPresent } from "../util/fs.ts";
import { loadAdaptationFragments, parseDonorSource } from "./provenance.ts";

/**
 * Pristine copies of every donor file an adaptations row derives from.
 *
 * `.donors/` is gitignored and reproducible from `provenance/upstream.lock.yaml`,
 * which makes a row checkable only by whoever has cloned it. The snapshots put
 * the exact bytes each row names into the repository, so a reader can compare an
 * adapted body against its source without a clone. They live under
 * `provenance/`, which the packager treats as source-only and the content
 * denylist exempts, so they never ship and never trip the denylist.
 */
export const SNAPSHOT_ROOT = "provenance/donor-snapshots";

/** Enough of the pin to be unambiguous in a directory name, short enough to read. */
const SHORT_SHA = 12;

export interface ExpectedSnapshot {
  /** Repository-relative path the snapshot is written to. */
  file: string;
  donor: string;
  commit: string;
  /** Path inside the donor tree at `commit`. */
  donorPath: string;
  /** The donor clone named by the lock, or null when the lock does not name the donor. */
  clone: string | null;
}

export function snapshotFile(donor: string, commit: string, donorPath: string): string {
  return `${SNAPSHOT_ROOT}/${donor}@${commit.slice(0, SHORT_SHA)}/${donorPath}`;
}

function lockedClones(root: string): Map<string, string> {
  const clones = new Map<string, string>();
  const text = readTextIfPresent(join(root, "provenance/upstream.lock.yaml"));
  if (text === null) return clones;
  const doc = parseYaml(text) as { donors?: Array<{ id?: unknown; path?: unknown }> };
  for (const entry of doc.donors ?? []) {
    if (typeof entry.id === "string" && typeof entry.path === "string") clones.set(entry.id, entry.path);
  }
  return clones;
}

/** One entry per distinct donor file named by any fragment row, sorted by snapshot path. */
export function expectedSnapshots(root: string): ExpectedSnapshot[] {
  const clones = lockedClones(root);
  const byFile = new Map<string, ExpectedSnapshot>();
  for (const row of loadAdaptationFragments(root).rows) {
    const parsed = parseDonorSource(row.source);
    if (parsed === null) continue;
    const file = snapshotFile(parsed.donor, parsed.commit, parsed.path);
    byFile.set(file, {
      file,
      donor: parsed.donor,
      commit: parsed.commit,
      donorPath: parsed.path,
      clone: clones.get(parsed.donor) ?? null,
    });
  }
  return [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file));
}

/** The pinned bytes, or null when the clone is absent or does not hold the path at the pin. */
export function pinnedBytes(root: string, snapshot: ExpectedSnapshot): Buffer | null {
  if (snapshot.clone === null) return null;
  try {
    return execFileSync("git", ["-C", join(root, snapshot.clone), "show", `${snapshot.commit}:${snapshot.donorPath}`], {
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}
