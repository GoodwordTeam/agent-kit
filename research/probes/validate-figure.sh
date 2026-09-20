#!/usr/bin/env bash
#
# Quote an `ak validate` figure that someone else can land on.
#
# Three `ak validate` figures disagreed between three lanes in one day. None of
# them was wrong. Each was a faithful count of the tree in front of the person
# running it, and the output has no term for which tree that was -- so a number
# taken from a working tree is a timestamp, not a measurement.
#
# This extracts a named revision, puts `.donors/` beside it, runs the validator
# there, and prints the figure with the provenance that makes it re-derivable.
#
#   ./research/probes/validate-figure.sh              # HEAD
#   ./research/probes/validate-figure.sh 5d5e1dc      # any revision
#
# THE THREE SIGNATURES
#
# Two of these are measurements of different populations and one is the
# convention. None of them is broken, and the next person to see two of them
# side by side will otherwise spend an hour deciding which one to trust.
#
#   warnings up, notes down by the same amount
#       Bodies authored with `catalog.yaml` still at `status: contract`. Each
#       body converts an `entry-not-authored` note into a `status-behind-body`
#       warning, so the sum is conserved. This is a lane mid-batch.
#
#   warnings up, notes unchanged
#       **At least three causes, and the summary line names none of them.** Read
#       the check name before reading anything into the delta: diff the WARNING
#       rows between the two revisions, never the totals.
#
#       `rulings.doctrine-unreachable` -- markdown the reachability walker can
#       see but no catalog entry claims, one per file. Usually someone's working
#       files, which the validator cannot distinguish from repository content.
#       `looseDoctrineFiles` walks the catalog's directory sections *and* root
#       markdown, so 22 loose `.md` at the root and 22 loose `.md` inside
#       `roles/` produce character-identical summary lines. Both were measured.
#       Do not read this row as identifying a location -- grep the paths, which
#       is the only thing that distinguishes them. Files under `research/` move
#       this count by zero: the walker only ever enumerates catalog sections and
#       the root, at any depth.
#
#       `rulings.uncited-restatement` -- and this cause does not require that
#       anything the warning points at changed. The check scores a window
#       against the rulings with cosine over a corpus, and the corpus is the
#       whole tree: adding text anywhere shifts the term weights, so a window
#       crosses the threshold untouched. Measured across eleven commits in one
#       afternoon: a warning on AUTHORING.md appeared at 7f159d8 and was gone by
#       daef077, with the window it named byte-identical at all three revisions
#       (12 lines, diffed each time) and its ruling byte-identical (md5 equal).
#       Corpus 18605 -> 18752 windows. Nothing beneath the warning ever changed.
#
#       That is stronger than the coverage NOTE's own caveat, which says a clean
#       run is evidence about the instrument rather than the tree. This says a
#       passage clean when it landed can be flagged later, and flagged text can
#       clear itself, with nothing done to either -- so neither "it passed when
#       I wrote it" nor "it stopped warning" is a claim about that passage. Diff
#       the flagged text across the revisions before crediting an author with
#       introducing it or with fixing it.
#
#       **The locator is the window's first line and the claim runs forward from
#       it.** `window.line` in `src/validation/restatement.ts` is the start, not
#       a midpoint. Reading it as a midpoint puts a sentence two lines above the
#       locator inside the window, and if that sentence happens to be about the
#       named ruling the report looks like corroboration from a second
#       instrument. I did that here and was one step from reporting that a
#       lexical scanner and a reviewer had independently converged on one
#       ruling. They had not: the scanner was pointed at the four lines below,
#       which are about reviewer continuity, and the row was the wrong-sibling
#       false positive its own warning text predicts. A manufactured convergence
#       is worse than no convergence, because corroboration is exactly what
#       stops the next person checking.
#
#   notes one high, one check skipped: donor paths at pin
#       A bare `git archive` with no `.donors/`. The skip is correct behaviour,
#       not a defect: the check is honestly reporting that its subject is absent.
#       This script copies `.donors/` in precisely so that term reads 0.
#
# WHY COPY AND NOT SYMLINK
#
# A symlinked `.donors/` measures the same thing and reports the same numbers.
# It is still wrong for a figure that gets quoted, because the link points out
# of the extract: the figure silently stops being reproducible the moment anyone
# touches that path in the working tree. An extract exists to make a number
# depend on nothing but the revision it names. Ruled by team-lead; symlinking
# remains fine for a quick local check, which is not what this script is for.
#
# WHAT THIS DOES NOT PIN
#
# `node_modules/` is symlinked from the working tree rather than installed, so
# the figure is pinned to the revision's *source* and not to its dependency
# tree. Pass --install to resolve `bun.lock` inside the extract instead, which
# is slower and is what to use if a dependency is what is in question. The
# provenance line below always says which of the two produced the figure.
set -euo pipefail

REV="HEAD"
INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=1 ;;
    # The header runs from line 2 to the line before `set -euo pipefail`, and is
    # printed by that relation rather than by a line count: `2,50p` was correct
    # when written and silently truncated the moment the header grew past it.
    -h|--help) sed -n '2,/^set -euo pipefail$/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) REV="$arg" ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if ! SHA="$(git rev-parse --verify --quiet "${REV}^{commit}")"; then
  echo "validate-figure: '${REV}' is not a commit in this repository." >&2
  exit 1
fi

# A figure quoted from an extract of a dirty revision is still a figure about
# that revision, but the person reading it should know the tree had uncommitted
# work in it when the number was taken.
DIRTY=""
if [ -n "$(git status --porcelain)" ]; then
  DIRTY=" (working tree dirty at time of run; not included in this figure)"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
git archive "$SHA" | tar -x -C "$WORK"

DONORS="absent"
if [ -d "$ROOT/.donors" ]; then
  cp -R "$ROOT/.donors" "$WORK/.donors"
  DONORS="copied"
fi

DEPS="symlinked from the working tree"
if [ "$INSTALL" -eq 1 ]; then
  ( cd "$WORK" && bun install --frozen-lockfile >/dev/null 2>&1 )
  DEPS="installed from the revision's bun.lock"
else
  ln -s "$ROOT/node_modules" "$WORK/node_modules"
fi

FIGURE="$(cd "$WORK" && bun run src/cli.ts validate 2>&1 | tail -1)"

echo "$FIGURE"
echo "  revision: $SHA${DIRTY}"
echo "  .donors:  $DONORS"
echo "  deps:     $DEPS"
echo "  rederive: ./research/probes/validate-figure.sh $SHA"

# A figure is reported, not gated -- this says what the tree reports, and what
# the tree reports is not this script's to judge. But losing the subject is a
# fact about the instrument rather than about the tree, so an extract that could
# not be measured at all exits non-zero.
if [ -z "$FIGURE" ]; then
  echo "validate-figure: the validator produced no summary line; the figures above are not readable." >&2
  exit 1
fi
if [ "$DONORS" = "absent" ]; then
  echo "validate-figure: no .donors/ in the working tree to copy, so this figure reads one note high with one check skipped. It is not comparable to a figure taken with donors present." >&2
  exit 1
fi
