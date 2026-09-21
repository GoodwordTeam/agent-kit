#!/usr/bin/env bash
#
# What `claude plugin validate` actually checks in our bundle.
#
# Written because that command is the plan's release criterion ("`claude plugin
# validate dist/claude-code --strict` passes") and was cited in four source
# comments as an authority before anyone ran it against this bundle. Three of
# the arms below contradict what those citations assume.
#
#   ./research/probes/host-validator-reach.sh          # HEAD
#   ./research/probes/host-validator-reach.sh cdea8a7  # any revision
#
# THE THREE MODES ARE DISJOINT, AND ONE INVOCATION REACHES ONE POPULATION
#
# `claude plugin validate <path>` picks a mode from what it finds, and the
# modes do not nest:
#
#   .claude-plugin/marketplace.json present -> validates THAT FILE ONLY.
#       The plugin manifest beside it is not read. The skills are not read.
#   marketplace.json absent, plugin.json present -> validates the plugin
#       manifest only. The skills are still not read.
#   neither present -> "Validating components in:", which reads SKILL.md files.
#
# So the release criterion as written -- the command pointed at a bundle root
# that carries a marketplace file -- certifies one JSON file and reports nothing
# about the eleven skills under it. Fixing the warning it emits would make the
# criterion pass while certifying no more than it does today.
#
# WHAT DIRECTORY MODE DOES AND DOES NOT CATCH
#
# Measured by mutation, not by reading the help text. Each arm mutates one copy
# of the built bundle and reports whether --strict failed. The baseline and the
# empty arm are the controls: a validator that silently examined nothing would
# agree with every hypothesis here, and the empty arm is what detects that --
# except that it does not, because an empty directory passes. That is the
# finding, not an artifact of the harness: `SKILL.md deleted` and `all skills
# removed` both pass, so this command cannot distinguish a complete bundle from
# an empty one and must never be quoted as evidence that the skills shipped.
#
# `ak validate` covers all four of the blind arms -- frontmatter `name` matching
# its directory is a check it owns, and catalog completeness is what refuses a
# missing body. The host validator is therefore not a superset of ours and
# cannot stand in for any part of it. It adds exactly three checks we do not
# have, all about frontmatter presence and parseability.
set -euo pipefail

REV="${1:-HEAD}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
command -v claude >/dev/null || { echo "host-validator-reach: no 'claude' on PATH; this probe needs the host CLI." >&2; exit 1; }
SHA="$(git rev-parse --verify "${REV}^{commit}")"

WORK="$(cd "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$WORK"' EXIT
git archive "$SHA" | tar -x -C "$WORK"
[ -d "$ROOT/.donors" ] && cp -R "$ROOT/.donors" "$WORK/.donors"
ln -s "$ROOT/node_modules" "$WORK/node_modules"
( cd "$WORK" && bun run src/cli.ts build >/dev/null 2>&1 )

BUNDLE="$WORK/dist/claude-code"
echo "host validator reach at $SHA  (claude: $(claude --version 2>&1 | head -1))"
echo

echo "MODE SELECTION"
for spec in "bundle root (marketplace.json present):$BUNDLE" \
            "skills directory:$BUNDLE/skills"; do
  label="${spec%%:*}"; path="${spec#*:}"
  printf '  %-42s %s\n' "$label" "$(claude plugin validate "$path" 2>&1 | grep -E '^Validating' | head -1)"
done
NOMKT="$WORK/nomkt"; cp -R "$BUNDLE" "$NOMKT"; rm "$NOMKT/.claude-plugin/marketplace.json"
printf '  %-42s %s\n' "bundle root (marketplace.json removed)" "$(claude plugin validate "$NOMKT" 2>&1 | grep -E '^Validating' | head -1)"
echo

echo "DIRECTORY-MODE MUTATION BATTERY  (--strict; 'caught' = validation failed)"
arm() {
  local label="$1" mutation="$2"
  local T; T="$(cd "$(mktemp -d)" && pwd -P)"
  cp -R "$BUNDLE/skills" "$T/skills"
  ( cd "$T" && eval "$mutation" )
  local verdict="BLIND "
  claude plugin validate "$T/skills" --strict >/dev/null 2>&1 || verdict="caught"
  printf '  %-36s %s\n' "$label" "$verdict"
  rm -rf "$T"
}
arm "baseline (unmutated)"          "true"
arm "description: deleted"          "sed -i '' '/^description:/d' skills/super-align/SKILL.md"
arm "frontmatter fence removed"     "sed -i '' '1d' skills/super-align/SKILL.md"
arm "frontmatter yaml malformed"    "sed -i '' '2i\\
  bad: [unclosed
' skills/super-align/SKILL.md"
arm "name: deleted"                 "sed -i '' '/^name:/d' skills/super-align/SKILL.md"
arm "name does not match directory" "sed -i '' 's/^name: super-align/name: not-the-dir/' skills/super-align/SKILL.md"
arm "SKILL.md deleted"              "rm skills/super-align/SKILL.md"
arm "all skills removed"            "rm -rf skills/*"
echo
echo "  The baseline must read BLIND and the first three must read caught, or this"
echo "  harness is measuring nothing and the four BLIND rows below them mean nothing."
