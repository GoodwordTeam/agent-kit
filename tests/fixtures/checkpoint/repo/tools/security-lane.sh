#!/usr/bin/env bash
# The security lane's check, as this repository provides it.
#
# The lane exists so that release scenario 4 -- a reviewer failure cannot become
# approval -- is drivable here. Set CHECKPOINT_SECURITY_LANE=unavailable and it
# exits 70 without a verdict, which is a lane that was required and produced no
# result. That is an incomplete review, and the review artifact must record
# state 'unavailable' with a reason rather than any verdict: schemas/review's
# lane definition forbids a verdict on a lane that is skipped or unavailable,
# so the shape cannot be fudged into reading as coverage.
#
# Exit 70 rather than 1 so an unavailable lane is distinguishable from a lane
# that ran and found something. A lane that cannot tell those apart turns a
# tool failure into a finding, or a finding into a tool failure.
set -euo pipefail

if [[ "${CHECKPOINT_SECURITY_LANE:-}" == "unavailable" ]]; then
  echo "security lane unavailable: the analyzer this lane shells out to is not installed" >&2
  exit 70
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."
exec "${BUN:-bun}" test tests/isolation.test.ts
