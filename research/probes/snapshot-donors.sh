#!/usr/bin/env bash
#
# Write a pristine copy of every donor file an adaptations row derives from.
#
#   ./research/probes/snapshot-donors.sh           # write, prune stale, report
#   ./research/probes/snapshot-donors.sh --check   # report only; exit 1 on any drift
#
# For each `source: donor@commit:path` row in provenance/adaptations.d/*.yaml it
# writes `git -C <clone> show <commit>:<path>` to
# provenance/donor-snapshots/<donor>@<sha12>/<path>, where <clone> is the path
# the donor's entry in provenance/upstream.lock.yaml names. Files under that
# root that no row names are removed, so the directory is always exactly the
# set the fragments cite. Running it twice changes nothing the second time.
#
# It needs every cited donor cloned at its pin, full-depth: a shallow clone
# resolves the tip and fails at the pin. A row whose clone is missing is
# reported and left alone rather than deleted, so a partial clone set never
# erases a snapshot someone else took. tests/donor-snapshots.test.ts holds the
# result to the fragments on every `bun test`.

set -euo pipefail
cd "$(dirname "$0")/../.."
exec bun --eval '
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { SNAPSHOT_ROOT, expectedSnapshots, pinnedBytes } from "./src/validation/donor-snapshots.ts";

const check = process.argv.includes("--check");
const root = process.cwd();
const expected = expectedSnapshots(root);
const wanted = new Set(expected.map((s) => s.file));
let written = 0, unchanged = 0, unresolved = 0, pruned = 0;

for (const snap of expected) {
  const bytes = pinnedBytes(root, snap);
  if (bytes === null) {
    unresolved++;
    console.error(`unresolved  ${snap.donor}@${snap.commit.slice(0, 12)}:${snap.donorPath} (clone ${snap.clone ?? "not in lock"})`);
    continue;
  }
  const target = join(root, snap.file);
  if (existsSync(target) && readFileSync(target).equals(bytes)) { unchanged++; continue; }
  written++;
  if (check) { console.error(`drift       ${snap.file}`); continue; }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}
for (const abs of walk(join(root, SNAPSHOT_ROOT))) {
  const rel = relative(root, abs);
  if (rel === `${SNAPSHOT_ROOT}/README.md` || wanted.has(rel)) continue;
  pruned++;
  if (check) { console.error(`stale       ${rel}`); continue; }
  rmSync(abs);
}

console.log(`snapshot-donors: ${expected.length} donor files cited; ${unchanged} unchanged, ${written} ${check ? "drifted" : "written"}, ${pruned} ${check ? "stale" : "pruned"}, ${unresolved} unresolved`);
if (check && (written > 0 || pruned > 0 || unresolved > 0)) process.exit(1);
if (unresolved > 0) process.exit(2);
' -- "$@"
