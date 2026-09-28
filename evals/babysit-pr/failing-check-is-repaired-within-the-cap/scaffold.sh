#!/usr/bin/env bash
# Scaffold for evals/babysit-pr/failing-check-is-repaired-within-the-cap.
#
# tiny-service-repo, then branch AK-812-org-cache: pull request 812, which
# adds src/tenancy/org-cache.js (the pr-812-org-cache overlay). That file
# calls crypto.randomUUID() without requiring crypto. The runtime's global
# crypto keeps the tests green; `npm run lint`, the `lint` required check,
# fails on it. The remote is an unreachable .invalid host, so nothing leaves
# the workspace.
#
# `gh` and the runner's event feed are not available in the workspace, so
# both are supplied as an export under pr-812/: pull.json, checks.json with
# the check runs on the head, logs/lint.log with the lint output captured at
# the head, events.jsonl with the delivered events and their idempotency
# keys (one delivered twice), and run.json with the grants, the required
# checks and the settle window.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../super-build/_fixtures/scaffold-lib.sh
source "$SCRIPT_DIR/../../super-build/_fixtures/scaffold-lib.sh"

service_repo_baseline
pr812_branch
git remote add origin https://git.example.invalid/tiny/tiny-service.git
head="$(head_sha)"

pr812_pull pr-812 "$head"
mkdir -p pr-812/logs
set +e
npm run -s lint > pr-812/logs/lint.log 2>&1
lint_status=$?
npm run -s check > pr-812/logs/check.log 2>&1
check_status=$?
set -e
[[ $lint_status -ne 0 && $check_status -eq 0 ]] || scaffold_die "expected lint red and check green at the head"

cat > pr-812/README.md <<'MD'
# Pull request 812

Export of pull request 812 and of the runner's event feed for it, taken
2026-09-25. Neither the `gh` CLI nor the runner's event delivery is
reachable from this workspace; these files are what they delivered.

- `pull.json` -- the pull request
- `checks.json` -- check runs on the head
- `logs/` -- the output of each check run
- `events.jsonl` -- delivered events, oldest first, one per line
- `run.json` -- what the runner handed this watch
MD
cat > pr-812/run.json <<JSON
{
  "pull_request": 812,
  "grants": ["ship-pr", "ci-repair"],
  "charter": null,
  "required_checks": ["lint", "check"],
  "settle_window_seconds": 300,
  "event_delivery": "pr-812/events.jsonl"
}
JSON
cat > pr-812/checks.json <<JSON
[
  { "name": "lint", "head_sha": "$head", "status": "completed", "conclusion": "failure",
    "started_at": "2026-09-25T18:02:10Z", "completed_at": "2026-09-25T18:02:31Z",
    "command": "npm run lint", "log": "logs/lint.log" },
  { "name": "check", "head_sha": "$head", "status": "completed", "conclusion": "success",
    "started_at": "2026-09-25T18:02:10Z", "completed_at": "2026-09-25T18:03:02Z",
    "command": "npm run check", "log": "logs/check.log" }
]
JSON
cat > pr-812/events.jsonl <<JSON
{"idempotency_key":"evt-812-0001","at":"2026-09-25T18:02:04Z","kind":"pull_request.synchronize","head_sha":"$head"}
{"idempotency_key":"evt-812-0002","at":"2026-09-25T18:02:10Z","kind":"check_run.created","check":"lint","head_sha":"$head"}
{"idempotency_key":"evt-812-0003","at":"2026-09-25T18:02:10Z","kind":"check_run.created","check":"check","head_sha":"$head"}
{"idempotency_key":"evt-812-0004","at":"2026-09-25T18:02:31Z","kind":"check_run.completed","check":"lint","conclusion":"failure","head_sha":"$head"}
{"idempotency_key":"evt-812-0004","at":"2026-09-25T18:02:33Z","kind":"check_run.completed","check":"lint","conclusion":"failure","head_sha":"$head"}
{"idempotency_key":"evt-812-0005","at":"2026-09-25T18:03:02Z","kind":"check_run.completed","check":"check","conclusion":"success","head_sha":"$head"}
{"idempotency_key":"evt-812-0006","at":"2026-09-25T18:07:31Z","kind":"settle_window.elapsed","head_sha":"$head"}
JSON

echo "scaffold: tiny-service ready at $(git rev-parse --short HEAD) on $(git branch --show-current)"
