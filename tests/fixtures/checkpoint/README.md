# The batch-5 checkpoint fixture

One bounded change, driven end to end, with one seeded defect and one finding to
apply. The plan's words for the checkpoint are: approved fixture ticket →
`super-scout` → `super-build` (TDD, red before green) → `super-verify` →
`super-review` full → `apply-findings` on one accepted item → `super-review`
delta → `super-ship` **dry-run**.

This directory holds the fixture. It does not drive it, and whoever drives it
does not grade their own run.

## Materializing

    ./materialize.sh            # prints the path to a throwaway repository

The repository is created in a temporary directory. It is not committed as a
nested repository and it is not gitignored: committing the *files* keeps the
fixture reviewable in diffs and shippable to whoever drives the slice, and
creating the *repository* on demand keeps it disposable.

The initial commit is reproducible — identity and both dates are pinned — so the
artifacts can cite a revision that exists rather than one invented to fill the field, and
`tests/checkpoint-fixture.test.ts` asserts that the revision they cite is the
one that materializes.

**There is no remote and there must never be one.** `super-ship` is dry-run
only: the PR payload is generated locally and nothing is pushed. The
materializer fails if a remote, a push URL, or URL rewriting is present, which
is what makes "nothing was pushed" a property of the fixture rather than a
report about the run.

## What is here

| | |
|---|---|
| `repo/` | the service at the revision the ticket was approved against |
| `artifacts/` | the charter, the approved ticket, and two findings |
| `stages/finding/` | the isolation checks, which arrive with the finding rather than with the repository |
| `stages/line-move/` | the same defect two lines further down, for the fingerprint scenario |
| `selftest/` | reference states the fixture's own test reads — **not** inputs to the slice; see `selftest/README.md` |

## The seeded defect

`src/scope.ts` caches the last resolved tenant scope and returns it to any later
caller without comparing the tenant it was asked for. `src/report.ts` reads that
cache for its summary line.

The ticket changes `src/quota.ts` and nothing else — `allowed_changes` says so.
`src/report.ts` is a **caller** of what the ticket changes, not a dependency of
it, so a scout following the ticket's scope reads `quota.ts` and what `quota.ts`
imports and never walks upward to who imports it. The defect is not handed to
the builder; a review that follows the affected surface is what reaches it.

Before the change, `consumed` ignored its tenant argument, so every row of the
summary carried the same meaningless total and the leak underneath it was
invisible. The change makes the usage figures correct and therefore worth
reading, which is what makes the limit beside them worth being wrong.

## Why the checkpoint can fail on it

**The repair the finding's evidence points at is not enough.** Swapping
`resolveCached` for `resolve` in `report.ts` turns the first isolation check
green and leaves the second red, because the summary line then reads a cache
nothing populates and reports a limit belonging to no tenant in the request. A
run whose fixer claims closure there and whose delta verification is not
independent will close a finding that is still live.

`tests/checkpoint-fixture.test.ts` asserts that state, by running the repair and
watching the second check stay red. A fixture whose obvious repair closed the
finding would grade an independent closure and a credulous one identically, and
there is no way to know which kind you have without running it.

## Scenarios this fixture can host

| | |
|---|---|
| 3 | tenant isolation, security lane, closure refusable |
| 4 | `CHECKPOINT_SECURITY_LANE=unavailable` makes a required lane produce no result; exit 70 keeps that distinguishable from the lane finding something |
| 6 | `finding.vague.json` is a `smell`: no difficulty, no fixer, and the schema refuses to let it acquire either (`tests/finding-constraints.test.ts`, "a smell has an open solution space") |
| 7 | the repair is a small diff, which is what a delta pass is for |
| 8 | `src/report.ts` is outside `allowed_changes` and downstream of the change |
| 9 | `stages/line-move/` moves the quoted line; the findings carry real digests over the domain `x-digest-domain` names in `schemas/finding.schema.json`, which excludes position, so the fingerprint does not move with the line |
| 10 | the second commit's revision differs from the first by construction, so evidence bound to the first is stale |
| 18 | the charter allows two fix cycles, so a third is refused |
| 20 | the dry-run payload is generated locally and there is nowhere to push it |

## What it cannot host, and what that would take

**Scenario 1** — a documentation typo does not run a six-persona panel. There is
prose in `repo/README.md` to make a typo in, but no second approved ticket for
one. The slice is one bounded change by commission, so adding a second ticket
was not mine to decide. It is a small addition if the grading seat wants it.

**Scenario 20 beyond the boundary.** The fixture can show that nothing was
pushed and that nothing could be. Whether a second run *re-generates* the same
payload rather than a second one is `super-ship`'s behaviour, and no property of
this fixture establishes it.
