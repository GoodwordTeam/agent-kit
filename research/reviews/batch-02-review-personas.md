# Batch 2 — review-personas: what closed it, and what `52d1cea` actually holds

Filed here under §10's durable-record rule. Batch 2 is closed: two review cycles, the limit reached,
committed at `52d1cea`.

## `52d1cea`'s message understates its contents

The message describes fix cycle 2 — nineteen citations re-pointed from `schemas/finding.schema.json`
`confidence_anchor` to `policies/review.yaml` `evidence.quote_the_line`, and thirteen table rows
attributed. The tree it captured also contains a **third** repair, made after cycle 2 and before I
committed, which the message does not mention. The commit is otherwise the only record of the
difference, which is why this file exists.

I verified the claim rather than accepting it: `git show 52d1cea` contains 21 lines carrying narrowed
child-key citations, which cycle 2 as described would not have produced.

## The third repair, and why it is the most interesting thing in the batch

The writer ran §6's population test — *read each sentence of a ruling as naming a population, then
check that every population reaches a term in the restatement* — against their **own cycle-2 fix**,
and the fix failed it.

All nineteen bullets cited `evidence.quote_the_line`, the **parent mapping**. That key owns seven
populations across six children. Each bullet restated one of them. Five had no lexical trace in the
citing paragraph, and one of those five — `cannot_quote`, which says a finding that cannot be quoted
anchors at 50 rather than being discarded — changes what a reader does. A bound removed.

So the F-2 repair was the F-2 defect at a different granularity. A citation that resolves, to an
authority that exists, credited with a rule narrower or wider than it states — this time wider, by
naming the parent of the clause actually meant. `f47ea7d`'s title is the reason it bites: a citation
key covers its own value, and the value of that key is all six children.

The repair narrowed the citations rather than widening nineteen sentences, which would have been the
decoration §6's second limit warns against:

| citation | count |
|---|---|
| `evidence.quote_the_line.rule` | 14 |
| `evidence.quote_the_line.doc_review_bar` | 5 |
| `evidence.quote_the_line.cannot_quote` | 1 |

The test also overturned one of the writer's own earlier readings — `scope-guardian` was reported to
me as an instance of `rule`'s per-claim-type pattern, and belongs on `doc_review_bar`, because `rule`
carries `file:line` and names four claim types that are all code claims, none of which a document
has. That is the first time the test contradicted the person running it rather than confirming them,
which is the property that makes it worth having.

One F-3 row failed the converse direction and was rewritten rather than re-cited:
`code-review/learnings`' stale-lesson row argued reviewer independence where
`central-kb-owns-project-artifacts` argues ownership.

## Prior-findings packet for any later cycle

**Two items open, reported rather than absorbed, neither blocking closure.**

**`rule`'s second sentence has no lexical trace in the twelve standard code-review bullets.** The
writer judged it elaboration rather than bound and flagged the judgment as arguable for absence
claims specifically: `api-contract` and `correctness` both make "this field does not exist" claims,
and without that sentence a reader has no instruction to quote where the field *would* be defined.
This is a finding about the bodies, not the citations, and it is the one thing in the pass that was
decided rather than resolved.

**§12.2 asserts something false about this batch.** `21607c5` added a paragraph stating that nothing
in the tracked tree records either Unresolved-candidates pair as examined. That holds for the
`feasibility` / `plan-review/architect` row. It does not hold for `design-lens` / `frontend-races`:
`roles/doc-review/design-lens/ROLE.md:16` and `roles/code-review/frontend-races/ROLE.md:20` carry
committed reciprocal bullets, each opening "Examined and adjacent rather than the same seat" and
naming the other by catalog id. The paragraph's conclusion — that §10's durable-record rule governs
a repair here — is over-scoped by one row. Routed to the contract owner.

## What the instruments could not have seen

Recorded because a clean run means nothing without its population.

**Nothing checks the F-3 rule at all.** `bodies.ts` verifies the rationalization table exists with
§3.1's three columns and reads no row. The 13 and the 155 are both hand-measured, and a validator run
is identical whether the number is 13 or 0.

**The citation-scope repair is the least-guarded change in the batch.** `evidence.quote_the_line`,
`.rule` and `.doc_review_bar` all resolve. Parent key, correct child and *wrong* child validate
identically. A misplaced `doc_review_bar` would be visible only to a reader with the policy open.

**§6 specifies an instrument that does not exist.** It calls for a note reporting which of a ruling's
sentences have no lexical trace in the citing paragraph. `src/validation/restatement.ts` carries
`rulings.uncited-restatement` and `rulings.restatement-scan-coverage` and nothing of that kind. Every
population judgment above is a reading recorded for someone to check, not a result anything
reproduces.

**The forty-odd `RULE_*` constants never looked at this batch.** They are runtime obligations over
findings, decisions, charters, reviews and verifications. Not one reads a role body.

**Batch 2 was clean inside a red tree.** `ak validate` showed 8 errors at handback, all
`evals.declaration-without-case` against batch 3's in-flight `skills/`, zero against `roles/`. "Zero
errors against `roles/`" should always be read next to what the rest of the tree was doing.

## A near-miss worth keeping

The writer had `sweep-reviewer`'s finding that nothing in `src/` enforces §12.2's mandated `## Never`
rows, and was about to relay it as their own evidence. `src/validation/bodies.ts` has enforced them
since `d4033ba` — 133 commits earlier. The report was true when written and had expired. That is §5's
rule about provenance outliving its author, appearing as a live hazard in how lanes quote each other.
