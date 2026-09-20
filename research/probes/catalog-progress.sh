#!/usr/bin/env bash
#
# What fraction of the catalog is authored, derived rather than remembered.
#
# This repository has paid three times for a figure written into prose and
# left there: two dossier line counts that said 2264 when the file was 2265,
# and a §5 passage that named both of them as examples of the defect after
# they had been repaired. A count that can be derived should never be
# transcribed, because the transcription has no way to notice it went stale.
#
#   ./research/probes/catalog-progress.sh           # working tree
#   ./research/probes/catalog-progress.sh 7a83f25   # any revision
#
# WHAT IT COMPARES AGAINST
#
# The plan's §"Decisions taken" fixes the catalog's size: 33 skills, 8 packs,
# 7 protocols, 29 roles, 4 reference packs, 14 schemas, plus 5 policies, 4
# profiles and 4 adapters. Those targets are duplicated below, which is the
# one transcription this script cannot avoid -- so it flags a section whose
# total disagrees with its target rather than silently reporting a percentage
# of the wrong denominator. A disagreement here is a real finding either way:
# the catalog gained an entry the plan does not account for, or the plan moved.
#
# WHAT IT DOES NOT TELL YOU
#
# `status: authored` means a body exists and the entry says so. It does not
# mean the body passed review, that its evals are tagged, or that anything is
# correct. `ak validate` answers the first; `evals.uncovered-scenarios`
# answers the second and answers it over the whole corpus rather than per
# skill, which is a distinction that has already produced one checkpoint gate
# reading green on a skill that has no case at all. Progress here is progress
# through the authoring queue and nothing more.
set -euo pipefail

REV="${1:-}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [ -n "$REV" ]; then
  if ! SHA="$(git rev-parse --verify --quiet "${REV}^{commit}")"; then
    echo "catalog-progress: '${REV}' is not a commit in this repository." >&2
    exit 1
  fi
  SRC="$(mktemp)"
  trap 'rm -f "$SRC"' EXIT
  # ${SHA}:catalog.yaml, braced: in zsh a bare $SHA:catalog.yaml is read as a
  # parameter modifier and expands to nothing, which returns an empty file for
  # every revision and looks like a catalog that lost all its entries.
  git show "${SHA}:catalog.yaml" > "$SRC"
  SUBJECT="$SHA"
else
  SRC="catalog.yaml"
  SUBJECT="working tree"
  [ -n "$(git status --porcelain -- catalog.yaml)" ] && SUBJECT="working tree (catalog.yaml modified)"
fi

SUBJECT="$SUBJECT" python3 - "$SRC" <<'PY'
import os, sys, yaml, collections

TARGETS = {
    "skills": 33, "packs": 8, "protocols": 7, "roles": 29, "references": 4,
    "schemas": 14, "policies": 5, "profiles": 4, "adapters": 4,
}

catalog = yaml.safe_load(open(sys.argv[1]))
print(f"catalog progress at {os.environ['SUBJECT']}")
print()
print(f"  {'section':12} {'authored':>8} {'contract':>9} {'total':>6} {'target':>7}")

grand_a = grand_t = 0
mismatches = []
for section, target in TARGETS.items():
    entries = catalog.get(section)
    if not isinstance(entries, list):
        mismatches.append(f"{section}: absent from catalog.yaml, target {target}")
        continue
    counts = collections.Counter(
        e.get("status") for e in entries if isinstance(e, dict)
    )
    authored, contract, total = counts["authored"], counts["contract"], len(entries)
    grand_a += authored
    grand_t += total
    flag = "" if total == target else "  <-- disagrees with the plan"
    print(f"  {section:12} {authored:>8} {contract:>9} {total:>6} {target:>7}{flag}")
    if total != target:
        mismatches.append(f"{section}: catalog has {total}, plan says {target}")
    unexpected = {s: n for s, n in counts.items() if s not in ("authored", "contract")}
    if unexpected:
        print(f"  {'':12} statuses that are neither: {unexpected}")

pct = (100 * grand_a / grand_t) if grand_t else 0
print(f"  {'TOTAL':12} {grand_a:>8} {'':>9} {grand_t:>6}         {pct:.0f}% authored")

by_batch = collections.Counter()
for entry in catalog.get("skills") or []:
    by_batch[(entry.get("batch"), entry.get("status"))] += 1
batches = sorted({b for b, _ in by_batch}, key=lambda b: (b is None, b))
if batches:
    print()
    print("  skills by batch:")
    for b in batches:
        row = {s: n for (bb, s), n in by_batch.items() if bb == b}
        done = "landed" if set(row) == {"authored"} else "open"
        print(f"    batch {str(b):>4}  {row}  {done}")

if mismatches:
    print()
    for m in mismatches:
        print(f"  DISAGREEMENT  {m}", file=sys.stderr)
    sys.exit(1)
PY
