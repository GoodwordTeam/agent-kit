#!/usr/bin/env bash
# A fork's main history may omit commits catalog-expansions.yaml cites from other refs.
set -euo pipefail

commits=$(bun -e 'import YAML from "yaml"; import { readFileSync } from "node:fs"; const sections = YAML.parse(readFileSync("research/probes/catalog-expansions.yaml", "utf8")); for (const section of Object.values(sections)) for (const entry of section.expansions ?? []) for (const sha of entry.commits ?? []) console.log(sha);' | sort -u)

while IFS= read -r sha; do
  [ -n "$sha" ] || continue
  if [[ ! "$sha" =~ ^[0-9a-f]{7,40}$ ]]; then
    echo "invalid catalog commit: $sha" >&2
    exit 1
  fi
  if git cat-file -e "${sha}^{commit}" 2>/dev/null; then continue; fi

  remote=$(git remote get-url origin)
  case "$remote" in
    https://github.com/*) repo=${remote#https://github.com/} ;;
    git@github.com:*) repo=${remote#git@github.com:} ;;
    *) echo "origin is not a GitHub repository: $remote" >&2; exit 1 ;;
  esac
  repo=${repo%.git}
  if command -v gh-axi >/dev/null 2>&1; then api=gh-axi; else api=gh; fi
  full=$($api api "repos/$repo/commits/$sha" --jq .sha)
  if [[ ! "$full" =~ ^[0-9a-f]{40}$ ]]; then
    echo "catalog commit $sha did not resolve to a full SHA" >&2
    exit 1
  fi
  git fetch --no-tags origin "$full"
  git cat-file -e "${sha}^{commit}"
done <<< "$commits"
