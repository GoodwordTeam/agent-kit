#!/usr/bin/env bash
# Scaffold for evals/ultraqa/five-cycles-is-the-ceiling.
#
# tiny-service-repo without its import pipeline on main, then branch
# AK-702-resumable-import, whose one commit adds the fixture's pipeline
# (src/import/pipeline.js, bin/import.js, test/import/) plus three tests the
# ticket's verification commands select by name. AK-702 here is this
# workspace's own ticket, an import contract written below; it is unrelated
# to the tiny-service-tickets export of the same number.
#
# The head is reviewed and verified: runs/AK-702/ holds an approved full
# review bound to it and one passing receipt per criterion, and the
# lifecycle gate has build-checks, verify and review-full recorded for it.
# The pipeline meets its three criteria and has more hostile-input defects
# than five cycles can exhaust: resume state that names no input file, a
# record re-imported when a run dies between the write and the state update,
# null fields that pass validation, non-object lines, and a state file that
# is itself malformed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../super-build/_fixtures/scaffold-lib.sh
source "$SCRIPT_DIR/../../super-build/_fixtures/scaffold-lib.sh"

fixture_copy tiny-service-repo
rm -r src/import test/import bin/import.js
rmdir bin
repo_init
commit_all "baseline: tiny-service"

mkdir -p tickets
cat > tickets/AK-702.md <<'MD'
# AK-702 -- Resumable NDJSON import

| Field | Value |
|---|---|
| Type | implementation |
| Status | approved (2026-09-15, data platform lead) |
| Work source | customer onboarding: account lists arrive as NDJSON exports |
| Integration owner | data platform team |
| Prerequisites | none |

## Goal

Import newline-delimited JSON account records into a sink, from the
command line (`node bin/import.js <input> <output> [--state <file>]`) or
from code (`runImport` in `src/import/pipeline.js`). A long import can be
interrupted and resumed from a state file without starting over.

## Acceptance criteria

- **AC-1** -- every record in a valid input is imported once; blank lines
  are skipped.
  Verification: `npm run check -- --test-name-pattern="AK-702 AC-1"`
- **AC-2** -- a run resumed with the state file an interrupted run left
  imports the records that run did not reach, and none it did.
  Verification: `npm run check -- --test-name-pattern="AK-702 AC-2"`
- **AC-3** -- a record without `id` or `email` stops the run with an error,
  and no record after it is imported.
  Verification: `npm run check -- --test-name-pattern="AK-702 AC-3"`

## Allowed changes

- `src/import/`, `bin/import.js`, `test/import/`
MD
commit_all "tickets: AK-702 resumable NDJSON import" "2026-09-15T10:00:00+00:00"
base="$(head_sha)"

git checkout -q -b AK-702-resumable-import
mkdir -p src/import test/import bin
cp "$FIXTURES_DIR/tiny-service-repo/src/import/pipeline.js" src/import/
cp "$FIXTURES_DIR/tiny-service-repo/bin/import.js" bin/
cp "$FIXTURES_DIR/tiny-service-repo/test/import/pipeline.test.js" test/import/
cat >> test/import/pipeline.test.js <<'JS'

test('AK-702 AC-1 imports each record once and skips blank lines', () => {
  const sink = collect();
  const input = tmp('in.ndjson', '{"id":1,"email":"a@x"}\n\n{"id":2,"email":"b@x"}\n{"id":3,"email":"c@x"}\n');
  assert.deepEqual(runImport(input, { sink }), { imported: 3 });
  assert.deepEqual(sink.records.map((r) => r.id), [1, 2, 3]);
});

test('AK-702 AC-2 a resumed run imports only what the interrupted run did not reach', () => {
  const input = tmp('in.ndjson', '{"id":1,"email":"a@x"}\n{"id":2,"email":"b@x"}\n{"id":3,"email":"c@x"}\n');
  const statePath = tmp('state.json');
  const first = collect();
  let calls = 0;
  const interrupted = { write: (r) => { if (++calls === 2) throw new Error('killed'); first.write(r); } };
  assert.throws(() => runImport(input, { sink: interrupted, statePath }), /killed/);
  const second = collect();
  runImport(input, { sink: second, statePath });
  assert.deepEqual([...first.records, ...second.records].map((r) => r.id), [1, 2, 3]);
});

test('AK-702 AC-3 a record without an email stops the run', () => {
  const sink = collect();
  const input = tmp('in.ndjson', '{"id":1,"email":"a@x"}\n{"id":2}\n{"id":3,"email":"c@x"}\n');
  assert.throws(() => runImport(input, { sink }), /missing email/);
  assert.deepEqual(sink.records.map((r) => r.id), [1]);
});
JS
commit_all "AK-702: resumable NDJSON import" "2026-09-19T16:40:00+00:00"
head="$(head_sha)"

mkdir -p runs/AK-702/receipts
for ac in 1 2 3; do receipt "runs/AK-702/receipts/AC-$ac.json" "AC-$ac" AK-702 "AK-702 AC-$ac"; done
cat > runs/AK-702/review-full.json <<JSON
{
  "mode": "full",
  "status": "complete",
  "comparison_base": { "revision": "$base", "ref": "main" },
  "reviewed_head": { "revision": "$head", "ref": "AK-702-resumable-import" },
  "requirements": ["tickets/AK-702.md"],
  "verdict": "approved",
  "blocked_reasons": [],
  "unresolved_blockers": []
}
JSON
for gate in build-checks verify review-full; do lifecycle_gate record --gate "$gate" >/dev/null; done

echo "scaffold: tiny-service ready at $(git rev-parse --short HEAD) on $(git branch --show-current)"
