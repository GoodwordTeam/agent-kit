# Reference states — not inputs to the slice

These three files are the fixture's own self-test, read by
`tests/checkpoint-fixture.test.ts` to prove the four states of the fixture are
reachable and distinct. They are not stages for whoever drives the checkpoint.

Driving the slice by copying `ticket-done/quota.ts` or either repair produces a
run with no scouting, no red-before-green, and no independent closure, and the
artifacts it emits will say so. The checkpoint grades the run, not the diff.

They are committed because the alternative is a fixture nobody has verified. A
seeded defect that the obvious repair fully fixes cannot host a refused closure,
and there is no way to establish that this one does not without running the
obvious repair and watching the second check stay red.

| | |
|---|---|
| `ticket-done/quota.ts` | AC-1 and AC-2 satisfied. The defect is untouched and now unmasked. |
| `repair-incomplete/report.ts` | The repair at the leak site named by the finding's evidence. First isolation check green, second still red. |
| `repair-complete/report.ts` | Both green. |
