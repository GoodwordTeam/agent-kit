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
# The plan's count for each section -- 33 skills, 8 packs, 7 protocols, 29
# roles, 4 reference packs, 14 schemas, 5 policies, 4 profiles and 4 adapters,
# first declared in catalog.yaml at a185bd1 -- is duplicated below, which is
# the one transcription this script cannot avoid. A section is allowed to grow
# past it only through research/probes/catalog-expansions.yaml, which records
# each added id with the reason and the commit or decision record that added
# it. The target a section is compared against is the plan's count plus the
# ids recorded there, so a recorded expansion reads clean and an unrecorded one
# still flags.
#
# Recording rather than moving the numbers below is the deliberate part: a
# permanent DISAGREEMENT row is a broken exit status that everyone learns to
# read past, and a target moved in place loses the reason it moved. The script
# once carried two such reasons in this comment (the case and rulings schemas);
# they now live in the expansions file beside every other one.
#
# The probe also flags a recorded id missing from its catalog section, a
# recorded `plan` that differs from the count below, and a recorded `catalog`
# size that no longer matches -- so an entry added without a record, or a
# record left behind by a removal, is a DISAGREEMENT and not a silent pass.
#
# Output: the table on stdout, one `EXPANDED` line per section with recorded
# expansions, and `DISAGREEMENT` lines on stderr with exit status 1.
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
EXPANSIONS="research/probes/catalog-expansions.yaml"

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
  EXP="$(mktemp)"
  trap 'rm -f "$SRC" "$EXP"' EXIT
  # A revision from before the expansions file existed has no expansions.
  git show "${SHA}:${EXPANSIONS}" > "$EXP" 2>/dev/null || : > "$EXP"
  SUBJECT="$SHA"
else
  SRC="catalog.yaml"
  EXP="$EXPANSIONS"
  [ -f "$EXP" ] || EXP=/dev/null
  SUBJECT="working tree"
  [ -n "$(git status --porcelain -- catalog.yaml)" ] && SUBJECT="working tree (catalog.yaml modified)"
fi

SUBJECT="$SUBJECT" python3 - "$SRC" "$EXP" <<'PY'
import os, sys, yaml, collections

PLAN = {
    "skills": 33, "packs": 8, "protocols": 7, "roles": 29, "references": 4,
    "schemas": 14, "policies": 5, "profiles": 4, "adapters": 4,
}

catalog = yaml.safe_load(open(sys.argv[1]))
expansions = yaml.safe_load(open(sys.argv[2])) or {}
mismatches = []
expanded = []
TARGETS = dict(PLAN)
for section, record in expansions.items():
    if section not in PLAN:
        mismatches.append(f"{section}: expansions recorded for a section the plan does not count")
        continue
    if record.get("plan") != PLAN[section]:
        mismatches.append(f"{section}: expansions record plan {record.get('plan')}, the probe's plan says {PLAN[section]}")
    ids = [i for e in record.get("expansions") or [] for i in e.get("ids") or []]
    present = {e.get("id") for e in catalog.get(section) or [] if isinstance(e, dict)}
    for i in ids:
        if i not in present:
            mismatches.append(f"{section}: recorded expansion {i} is not in catalog.yaml")
    TARGETS[section] = PLAN[section] + len(ids)
    if record.get("catalog") != TARGETS[section]:
        mismatches.append(f"{section}: expansions record catalog {record.get('catalog')}, plan {PLAN[section]} plus {len(ids)} recorded is {TARGETS[section]}")
    expanded.append(f"{section}: plan {PLAN[section]} + {len(ids)} recorded = {TARGETS[section]}")

print(f"catalog progress at {os.environ['SUBJECT']}")
print()
print(f"  {'section':12} {'authored':>8} {'contract':>9} {'total':>6} {'target':>7}")

grand_a = grand_t = 0
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
    flag = "" if total == target else "  <-- disagrees with the plan and its recorded expansions"
    print(f"  {section:12} {authored:>8} {contract:>9} {total:>6} {target:>7}{flag}")
    if total != target:
        mismatches.append(f"{section}: catalog has {total}, plan {PLAN[section]} plus recorded expansions says {target}")
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

if expanded:
    print()
    for e in expanded:
        print(f"  EXPANDED  {e}")

if mismatches:
    print()
    for m in mismatches:
        print(f"  DISAGREEMENT  {m}", file=sys.stderr)
    sys.exit(1)
PY
