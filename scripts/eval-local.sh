#!/usr/bin/env bash
# Run the built bundle's eval suite on this machine and print a per-arm table.
#
#   scripts/eval-local.sh [claude plugin eval options…]
#   scripts/eval-local.sh --tag firstmate --runs 3 --max-cost-usd 2
#
# Why the ~/.docker shuffle: the eval sandbox refuses to start a Bash-granting case while any symlink
# sits under ~/.docker, and Docker Desktop keeps symlinks in ~/.docker/cli-plugins and ~/.docker/bin.
# The script moves those two directories aside for the run and puts them back on every exit path,
# including Ctrl-C. Nothing else under ~/.docker is touched. Run it only by hand; CI never calls it.
#
# Reads: dist/claude-code (run `bun run build` first). Writes: evals/results/ under the bundle, and
# the JSON result to $AK_EVAL_JSON (default: a temp file whose path is printed).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
bundle="$root/dist/claude-code"
[[ -d "$bundle" ]] || { echo "eval-local: no $bundle; run 'bun run build' first" >&2; exit 2; }
command -v jq >/dev/null || { echo "eval-local: jq is required" >&2; exit 2; }

revision="$(git -C "$root" rev-parse HEAD 2>/dev/null || echo unknown)"
[[ -z "$(git -C "$root" status --porcelain 2>/dev/null)" ]] || revision+=" (dirty)"
if [[ -n "$(cd "$root" && find catalog.yaml skills packs protocols roles references adapters schemas policies profiles provenance src -newer "$bundle" -print -quit 2>/dev/null)" ]]; then
  echo "eval-local: $bundle is older than its sources; run 'bun run build' to measure this tree" >&2
fi

aside="$(mktemp -d "${TMPDIR:-/tmp}/ak-docker-aside.XXXXXX")"
moved=()
# shellcheck disable=SC2329 # invoked by the EXIT trap
restore() {
  local name
  for name in "${moved[@]+"${moved[@]}"}"; do
    if [[ -e "$HOME/.docker/$name" ]]; then
      echo "eval-local: ~/.docker/$name reappeared during the run; the original is kept at $aside/$name" >&2
    else
      mv "$aside/$name" "$HOME/.docker/$name"
    fi
  done
  rmdir "$aside" 2>/dev/null || true
}
trap restore EXIT
trap 'exit 130' INT TERM

for name in cli-plugins bin; do
  if [[ -e "$HOME/.docker/$name" || -L "$HOME/.docker/$name" ]]; then
    mv "$HOME/.docker/$name" "$aside/$name"
    moved+=("$name")
  fi
done
if [[ -d "$HOME/.docker" ]] && find "$HOME/.docker" -type l -print -quit | grep -q .; then
  echo "eval-local: ~/.docker still holds a symlink outside cli-plugins/ and bin/; Bash-granting cases may not start" >&2
fi

json="${AK_EVAL_JSON:-$(mktemp -d "${TMPDIR:-/tmp}/ak-eval.XXXXXX")/result.json}"
set +e
claude plugin eval "$bundle" --no-publish --json "$json" "$@"
status=$?
set -e

if [[ -s "$json" ]]; then
  echo
  jq -r '
    # fired: with-arm runs that have with-only graders (the skill-fired indicators) and passed them all.
    def n: if type == "number" then (. * 1000 | round / 1000 | tostring) else "-" end;
    def fired: (.arms.with // []) as $r
      | if ([$r[].graders[]? | select(.withOnly)] | length) == 0 then "-"
        else "\([$r[] | select([.graders[]? | select(.withOnly) | .passed] | length > 0 and all)] | length)/\($r | length)" end;
    (["case", "with", "without", "delta", "fired"] | @tsv),
    (.cases[] | [.name[0:60],
                 (.aggregates.score | n),
                 (.aggregates.scoreWithout | n),
                 (.aggregates.delta | n),
                 fired] | @tsv),
    (["overall", (.aggregates.overallScore | n), "-", (.aggregates.meanDelta | n), "-"] | @tsv),
    "cost $\(.costUsd | n)  \(.durationSeconds | n)s  partial=\(.partial)"
  ' "$json" | column -t -s $'\t' || echo "eval-local: could not summarise $json" >&2
  echo "eval-local: measured $bundle with the tree at $revision"
  echo "eval-local: full result in $json"
fi
exit "$status"
