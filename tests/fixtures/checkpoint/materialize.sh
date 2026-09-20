#!/usr/bin/env bash
# Materialize the batch-5 checkpoint fixture as a throwaway git repository.
#
# The fixture is committed as ordinary files and the git repository is created
# here, on demand, in a temporary directory. A repository committed inside this
# repository would need a submodule, and a gitignored one would be unreviewable
# in diffs and unshippable to whoever drives the slice.
#
# The plan's super-ship step is dry-run only: the PR payload is generated
# locally and nothing is pushed. This script is where that stops being a
# procedure and becomes a property. The repository is created with no remote and
# the assertion below fails if one exists, so the distinction between "we did
# not push" and "we could not have pushed" is decided here rather than by
# whoever is driving.
set -euo pipefail

FIXTURE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${1:-}"
if [[ -z "$DEST" ]]; then
  DEST="$(mktemp -d "${TMPDIR:-/tmp}/checkpoint-fixture.XXXXXX")"
fi
if [[ -e "$DEST/.git" ]]; then
  echo "refusing to materialize over an existing repository at $DEST" >&2
  exit 1
fi

mkdir -p "$DEST"
cp -R "$FIXTURE_DIR/repo/." "$DEST/"

cd "$DEST"
git init --quiet
git config user.email "fixture@checkpoint.invalid"
git config user.name "Checkpoint Fixture"
git config commit.gpgsign false
git symbolic-ref HEAD refs/heads/main
git add -A
# Identity and both dates are pinned so the initial commit is reproducible. The
# fixture's artifacts cite this revision -- a receipt is bound to the revision it
# was taken at, and a ticket's work_source names one -- and an artifact citing a
# revision that changes per materialization cites nothing. It also makes the
# stale-evidence scenario testable: the second commit's revision differs from
# this one by construction, which is the whole of what that scenario needs.
GIT_AUTHOR_DATE="2026-09-19T09:00:00+00:00" \
GIT_COMMITTER_DATE="2026-09-19T09:00:00+00:00" \
  git commit --quiet -m "tenant-quota at the revision the fixture ticket was approved against"

# The hard boundary, asserted rather than assumed.
if [[ -n "$(git remote)" ]]; then
  echo "FAIL: the fixture repository has a remote; super-ship is dry-run only and nothing may be pushable" >&2
  exit 1
fi
# A remote can also be reached through a configured push URL with no named
# remote, and through insteadOf rewriting, so neither is left to inspection.
if git config --get-regexp '^remote\.' >/dev/null 2>&1; then
  echo "FAIL: the fixture repository has remote configuration" >&2
  exit 1
fi
if git config --get-regexp 'insteadof' >/dev/null 2>&1; then
  echo "FAIL: the fixture repository rewrites URLs, which can reach a remote without naming one" >&2
  exit 1
fi

echo "$DEST"
