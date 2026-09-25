#!/usr/bin/env bash
# Run the built bundle's eval suite on this machine, print a per-arm table and write a receipt.
#
#   scripts/eval-local.sh [--inherit-env] [claude plugin eval options…]
#   scripts/eval-local.sh --tag firstmate --runs 3 --max-cost-usd 2
#
# Grants. Each case gets the gated tools its case.yaml declares and no others. The cases are
# grouped by those tools and each group runs as its own host invocation (see "Grants" below), so a
# full run is several invocations whose results are merged into one JSON and one receipt.
#
# Isolation. The host already gives every eval child a temporary home, working directory and
# configuration, so the user's settings, hooks, CLAUDE.md, plugins, MCP servers and memory are
# absent from both arms; research/evals/2026-09-25-isolation.md measured that. What the host does
# pass through is part of the invoking shell's environment: every ANTHROPIC_*, CLAUDE_CODE_* and
# EVAL_* variable. Run from inside an agent session, that is the session's id, messaging socket,
# feature flags and any model override. So by default the host runs under `env -i` with only the
# variables in `pass_env` below (plus LC_* and any names listed in $AK_EVAL_PASS_ENV).
# --inherit-env skips that and hands the host the whole shell environment; it exists for the
# control run in scripts/eval-isolation-probe.sh and is recorded in the receipt.
#
# Why the ~/.docker shuffle: the eval sandbox refuses to start a Bash-granting case while any symlink
# sits under ~/.docker, and Docker Desktop keeps symlinks in ~/.docker/cli-plugins and ~/.docker/bin.
# The script moves those two directories aside for the run and puts them back on every exit path,
# including Ctrl-C. Nothing else under ~/.docker is touched. Run it only by hand; CI never calls it.
#
# Reads: dist/claude-code (run `bun run build` first), or $AK_EVAL_BUNDLE. Writes: evals/results/
# under the bundle, the JSON result to $AK_EVAL_JSON (default: a temp file whose path is printed),
# and the receipt beside it as <result>.receipt.json.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
bundle="${AK_EVAL_BUNDLE:-$root/dist/claude-code}"
[[ -d "$bundle" ]] || { echo "eval-local: no $bundle; run 'bun run build' first" >&2; exit 2; }
command -v jq >/dev/null || { echo "eval-local: jq is required" >&2; exit 2; }

# The script reads four of the host's options itself: --case and --tag (to know which cases run),
# --eval-dir (where they live) and --max-cost-usd (one budget across every invocation). The first
# three still go through to the host. --allow-tools is taken out and replaced by the case grants
# unless the user passed it, in which case it goes through unchanged and overrides them.
isolation=env-allowlist
args=()
case_globs=()
tags=()
user_tools=()
budget=
eval_dir=
while [[ $# -gt 0 ]]; do
  case "$1" in
    --inherit-env) isolation=inherited-env; shift ;;
    --case) case_globs+=("$2"); args+=("$1" "$2"); shift 2 ;;
    --case=*) case_globs+=("${1#*=}"); args+=("$1"); shift ;;
    --eval-dir) eval_dir="$2"; args+=("$1" "$2"); shift 2 ;;
    --eval-dir=*) eval_dir="${1#*=}"; args+=("$1"); shift ;;
    --max-cost-usd) budget="$2"; shift 2 ;;
    --max-cost-usd=*) budget="${1#*=}"; shift ;;
    --tag | --allow-tools)
      flag="$1"; shift
      while [[ $# -gt 0 && "$1" != -* ]]; do
        if [[ "$flag" == --tag ]]; then tags+=("$1"); args+=(--tag "$1"); else user_tools+=("$1"); fi
        shift
      done ;;
    *) args+=("$1"); shift ;;
  esac
done

revision="$(git -C "$root" rev-parse HEAD 2>/dev/null || echo unknown)"
dirty=false
[[ -z "$(git -C "$root" status --porcelain 2>/dev/null)" ]] || dirty=true
# The packager writes no build stamp, so freshness is the mtime comparison: no source newer than
# the bundle. It is only asked of the repository's own dist/.
fresh=null
if [[ "$bundle" == "$root/dist/claude-code" ]]; then
  fresh=true
  if [[ -n "$(cd "$root" && find catalog.yaml skills packs protocols roles references adapters schemas policies profiles provenance src evals -newer "$bundle" -print -quit 2>/dev/null)" ]]; then
    fresh=false
    echo "eval-local: $bundle is older than its sources; run 'bun run build' to measure this tree" >&2
  fi
fi
bundle_sha="$(cd "$bundle" && find . -type f ! -path './evals/results/*' -print0 | LC_ALL=C sort -z \
  | xargs -0 shasum -a 256 | shasum -a 256 | cut -d' ' -f1)"
install=default
[[ -f "$root/ak.install.yaml" ]] && install=ak.install.yaml
donors=false
[[ -d "$root/.donors" ]] && donors=true
host_version="$(claude --version 2>/dev/null || echo unknown)"

pass_env=(HOME USER LOGNAME PATH SHELL TERM LANG TMPDIR
  HTTP_PROXY HTTPS_PROXY NO_PROXY http_proxy https_proxy no_proxy NODE_EXTRA_CA_CERTS SSL_CERT_FILE
  ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL CLAUDE_CODE_OAUTH_TOKEN
  CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX CLAUDE_CONFIG_DIR)
read -r -a extra <<<"${AK_EVAL_PASS_ENV:-}"
while IFS= read -r name; do pass_env+=("$name"); done < <(compgen -e | grep '^LC_' || true)
runner=()
passed=()
if [[ "$isolation" == env-allowlist ]]; then
  runner=(env -i)
  for name in "${pass_env[@]}" "${extra[@]+"${extra[@]}"}"; do
    if [[ -n "${!name+set}" ]]; then runner+=("$name=${!name}"); passed+=("$name"); fi
  done
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
mkdir -p "$(dirname "$json")"
receipt="${json%.json}.receipt.json"

# Grants. The host adds an --allow-tools grant to every case in the invocation, not only to the cases
# that list the tool (research/evals/2026-09-25-isolation.md), so one union grant would widen every
# case that lists fewer. The selected cases are grouped by the gated tools they declare, and each
# group runs in its own invocation against a staged copy of the bundle whose eval directory holds
# only that group's cases. One group runs against the bundle itself.
[[ -n "$eval_dir" ]] || eval_dir="$(jq -r '.experimental.evals // "evals"' "$bundle/.claude-plugin/plugin.json" 2>/dev/null || echo evals)"
groups=()
if [[ ${#user_tools[@]} -gt 0 ]]; then
  grant_source=user
  groups=("$(IFS=,; echo "${user_tools[*]}")")
else
  grant_source=cases
  listing="$(cd "$root" && AK_EVALS_DIR="$bundle/$eval_dir" \
    AK_CASE_GLOBS="$(printf '%s\n' "${case_globs[@]+"${case_globs[@]}"}")" \
    AK_TAGS="$(printf '%s\n' "${tags[@]+"${tags[@]}"}")" bun -e '
      import { parse } from "yaml";
      import { readdirSync, readFileSync } from "fs";
      import { basename, dirname, join, relative } from "path";
      const root = process.env.AK_EVALS_DIR!;
      const lines = (v?: string) => (v ?? "").split("\n").filter(Boolean);
      const globs = lines(process.env.AK_CASE_GLOBS).map((g) => new Bun.Glob(g));
      const tags = lines(process.env.AK_TAGS);
      const gated = (t: string) => /^(Bash|Write|Edit|WebFetch|NotebookEdit)(\(|$)/.test(t) || t.startsWith("mcp__");
      const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? (d === root && e.name === "results" ? [] : walk(join(d, e.name)))
          : e.name === "case.yaml" ? [join(d, e.name)] : []);
      for (const file of walk(root).sort()) {
        const doc = parse(readFileSync(file, "utf8")) ?? {};
        const name = String(doc.name ?? basename(dirname(file)));
        const selected = (globs.length === 0 || globs.some((g) => g.match(name)))
          && (tags.length === 0 || (doc.tags ?? []).some((t: string) => tags.includes(t)));
        const tools = [...new Set<string>((doc.execution?.allowed_tools ?? doc.allowed_tools ?? []).filter(gated))].sort();
        console.log([selected ? "run" : "skip", tools.join(","), relative(root, dirname(file)), name].join("\t"));
      }')" || { echo "eval-local: could not read the cases under $bundle/$eval_dir" >&2; exit 2; }
  while IFS= read -r key; do groups+=("$key"); done < <(awk -F'\t' '$1 == "run" { print $2 }' <<<"$listing" | sort -u)
  if [[ ${#groups[@]} -eq 0 ]]; then
    echo "eval-local: no case under $bundle/$eval_dir matches the --case and --tag filters; nothing run" >&2
    exit 2
  fi
fi

aggregate=0
spent=0
invocations="${json%.json}.invocations.jsonl"
: >"$invocations"
parts=()
for i in "${!groups[@]}"; do
  key="${groups[$i]}"
  target="$bundle"
  out="$json"
  if [[ ${#groups[@]} -gt 1 ]]; then
    target="${json%.json}.groups/$i/$(basename "$bundle")"
    out="${json%.json}.group-$i.json"
    rm -rf "$target"
    mkdir -p "$(dirname "$target")"
    cp -R "$bundle" "$target"
    rm -rf "${target:?}/$eval_dir/results"
    while IFS= read -r dir; do
      if [[ "$dir" != . ]]; then rm -rf "${target:?}/$eval_dir/${dir:?}"; fi
    done < <(awk -F'\t' -v k="$key" '!($1 == "run" && $2 == k) { print $3 }' <<<"$listing")
  fi
  grant=()
  [[ -z "$key" ]] || { IFS=, read -r -a tools_list <<<"$key"; grant=(--allow-tools "${tools_list[@]}"); }
  cap=()
  if [[ -n "$budget" ]]; then
    left="$(jq -n --argjson b "$budget" --argjson s "$spent" '($b - $s) * 10000 | floor / 10000')"
    if jq -e -n --argjson l "$left" '$l <= 0' >/dev/null; then
      echo "eval-local: budget spent; group [${key:-no gated tools}] not run" >&2
      jq -nc --arg tools "$key" '{grant: ($tools | split(",") | map(select(. != ""))), skipped: "budget", partial: true}' >>"$invocations"
      aggregate=2
      continue
    fi
    cap=(--max-cost-usd "$left")
  fi
  command=(claude plugin eval "$target" --no-publish --json "$out" "${args[@]+"${args[@]}"}" "${grant[@]+"${grant[@]}"}" "${cap[@]+"${cap[@]}"}")
  printf -v cmdline '%q ' "${command[@]}"
  echo "eval-local: group $((i + 1))/${#groups[@]}: grant [${key:-none}]" >&2
  set +e
  "${runner[@]+"${runner[@]}"}" "${command[@]}"
  status=$?
  set -e
  if (( status > aggregate )); then aggregate=$status; fi
  cost=0
  partial=true
  if [[ -s "$out" ]]; then
    parts+=("$out")
    cost="$(jq '.costUsd // 0' "$out")"
    partial="$(jq '.partial == true' "$out")"
    spent="$(jq -n --argjson a "$spent" --argjson b "$cost" '$a + $b')"
  fi
  target_sha="$(cd "$target" && find . -type f ! -path "./$eval_dir/results/*" -print0 | LC_ALL=C sort -z \
    | xargs -0 shasum -a 256 | shasum -a 256 | cut -d' ' -f1)"
  jq -nc --arg tools "$key" --arg command "${cmdline% }" --argjson status "$status" --argjson cost "$cost" \
    --argjson partial "$partial" --arg bundle "$target" --arg sha "$target_sha" --arg out "$out" \
    --argjson cases "$(if [[ "$grant_source" == cases ]]; then awk -F'\t' -v k="$key" '$1 == "run" && $2 == k { print $4 }' <<<"$listing" | jq -Rsc 'split("\n") | map(select(. != ""))'; else echo null; fi)" \
    '{grant: ($tools | split(",") | map(select(. != ""))), cases: $cases, bundle: $bundle, bundleSha256: $sha,
      command: $command, exitStatus: $status, costUsd: $cost, partial: $partial, result: $out}' >>"$invocations"
done
status=$aggregate

[[ ${#parts[@]} -gt 0 ]] || { echo "eval-local: no result at $json" >&2; exit "$status"; }
if [[ ${#groups[@]} -gt 1 ]]; then
  # The host's overall figures are per invocation; the merged ones are unweighted means over cases.
  jq -s '{cases: [.[].cases[]], costUsd: (map(.costUsd // 0) | add),
          durationSeconds: (map(.durationSeconds // 0) | add), partial: any(.[]; .partial == true),
          aggregates: {overallScore: ([.[].cases[].aggregates.score | numbers] | if length > 0 then add / length else null end),
                       meanDelta: ([.[].cases[].aggregates.delta | numbers] | if length > 0 then add / length else null end)},
          merged: length}' "${parts[@]}" >"$json"
fi

# Per case and arm: n runs, passes (a run passes when every grader that counts toward the score
# passed; with-only graders are the fired indicator, not the score), the rate with its 95% Wilson
# interval, and the fired count on the with arm.
# shellcheck disable=SC2094 # reads $json, writes $receipt: two files
jq --arg revision "$revision" --argjson dirty "$dirty" --arg bundle "$bundle" \
   --arg bundle_sha "$bundle_sha" --argjson fresh "$fresh" --arg install "$install" \
   --argjson donors "$donors" --arg host "$host_version" --arg isolation "$isolation" \
   --argjson status "$status" --arg json "$json" --arg grant_source "$grant_source" \
   --slurpfile invocations "$invocations" \
   --args '
  def wilson($k; $n): if $n == 0 then {lo: 0, hi: 1} else
      ($k / $n) as $p | 3.8416 as $z2
      | (($p + $z2 / (2 * $n)) / (1 + $z2 / $n)) as $c
      | ((1.96 * ((($p * (1 - $p)) / $n + $z2 / (4 * $n * $n)) | sqrt)) / (1 + $z2 / $n)) as $h
      | {lo: ([0, $c - $h] | max), hi: ([1, $c + $h] | min)} end;
  def pass: [.graders[]? | select(.withOnly | not) | .passed] | length > 0 and all;
  def arm($runs): ($runs | length) as $n | ([$runs[] | select(pass)] | length) as $k
      | {n: $n, passes: $k, rate: (if $n == 0 then null else $k / $n end), wilson95: wilson($k; $n)};
  def fired($runs): [$runs[] | [.graders[]? | select(.withOnly) | .passed]]
      | if (map(length) | add // 0) == 0 then null
        else {n: length, fired: map(select(length > 0 and all)) | length} end;
  {
    measured: {revision: $revision, dirty: $dirty},
    bundle: {path: $bundle, sha256: $bundle_sha, freshAgainstSources: $fresh},
    install: $install,
    donorsPresent: $donors,
    host: $host,
    isolation: {method: ("host-sandbox+" + $isolation), envPassed: (if $isolation == "inherited-env" then "all" else $ARGS.positional end)},
    grants: {source: $grant_source, union: ([$invocations[].grant[]] | unique)},
    invocations: $invocations,
    exitStatus: $status,
    result: $json,
    cases: [.cases[] | {name, with: arm(.arms.with // []), without: arm(.arms.without // []),
                        fired: fired(.arms.with // []), score: .aggregates.score,
                        scoreWithout: .aggregates.scoreWithout, delta: .aggregates.delta}],
    overall: {score: .aggregates.overallScore, meanDelta: .aggregates.meanDelta,
              mergedFrom: (.merged // 1)},
    costUsd: .costUsd, durationSeconds: .durationSeconds,
    partial: (.partial or any($invocations[]; .partial))
  }' "${passed[@]+"${passed[@]}"}" <"$json" >"$receipt" \
  || echo "eval-local: could not write the receipt for $json" >&2

echo
jq -r '
  def n: if type == "number" then (. * 1000 | round / 1000 | tostring) else "-" end;
  def ci: "\(.passes)/\(.n) [\(.wilson95.lo | n),\(.wilson95.hi | n)]";
  (["case", "with", "without", "delta", "fired"] | @tsv),
  (.cases[] | [.name[0:60], (.with | ci), (.without | ci), (.delta | n),
               (if .fired then "\(.fired.fired)/\(.fired.n)" else "-" end)] | @tsv),
  (["overall", (.overall.score | n), "-", (.overall.meanDelta | n), "-"] | @tsv),
  "cost $\(.costUsd | n)  \(.durationSeconds | n)s  partial=\(.partial)"
' "$receipt" | column -t -s $'\t' || echo "eval-local: could not summarise $receipt" >&2
jq -r '"eval-local: measured \(.bundle.path) (sha256 \(.bundle.sha256[0:12]), fresh=\(.bundle.freshAgainstSources))",
       "eval-local: tree \(.measured.revision)\(if .measured.dirty then " (dirty)" else "" end)  .donors=\(.donorsPresent)  install=\(.install)",
       "eval-local: host \(.host)  isolation \(.isolation.method)"' "$receipt" 2>/dev/null || true
echo "eval-local: full result in $json"
echo "eval-local: receipt in $receipt"
exit "$status"
