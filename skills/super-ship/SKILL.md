---
name: super-ship
description: >-
  Prepares a verified, reviewed change for publication: release checks, a sensitive-data scan, the
  commit, the pull-request payload and a linked knowledgebase draft. Runs as `dry-run`, generating
  the payload locally and pushing nothing, or as `publish` under a grant. Use when implementation is
  done, verification receipts and a review verdict bind to the head being shipped, and what remains
  is a commit and a pull request; when a caller wants the PR payload without publishing; or when an
  interrupted ship must be resumed without duplicating a push or PR. Not for merging or deploying,
  force-pushing or rewriting history, deciding whether the change is correct, watching the PR once
  it is open, or writing project knowledge into the repository.
license: MIT
metadata:
  ak_catalog_id: super-ship
---

## When to use

Selection is in the description. Pick the mode: `dry-run` to produce and read the payload with no
remote call, `publish` to push and open the pull request.

## Not for

Merge, deploy, force-push and history rewrite are sensitive actions outside this run's authority;
correctness is super-review's call, and the open PR belongs to the watch lane.

## Authority

Authority `explicit-or-delegated`, invocation U. A human starts it directly, or a delegated
controller starts the same protocol through the declared phase operation `ship.prepare` under a
runner-validated grant covering `ship-pr`.

There is one protocol behind both doors. Where the host cannot validate a grant, the entrypoint stops
for explicit invocation rather than reproducing the delegated effect through a side door (ruling
`entrypoint-phase-operation-split`). A lesson candidate may be drafted inside the run; publishing it
needs explicit authority or a charter grant.

Under a Firstmate binding, Firstmate is the delegated controller and the host validates the grant with
`ak firstmate grant --binding <path> --operation ship.prepare`. Exit 0 is the grant: cite the record it
prints in the ship record. A refusal means stop and report `needs-decision` to Firstmate. The grant
covers the binding's delivery action and nothing more; merge is never on it (ADR-0004).

## Inputs

- The head being shipped, named; verification receipts bound to that head
  (`schemas/verification.schema.json`); and a review verdict bound to that head's artifact hash
  (`schemas/review.schema.json`). If any is missing or bound to a different revision, stop with
  `needs-input` naming which.
- The mode: `dry-run` or `publish`. `dry-run` is a supported mode, not a flag to remember: nothing
  leaves the machine.
- The charter, where one exists (`schemas/charter.schema.json`), with the actions it names and the
  approval bound to its hash. Without one the run has no sensitive-action authority and does not
  acquire any by running.
- The idempotency inputs the runner supplies: run id, operation id, target identity and input
  artifact hash (`adapters/runner-contract/CONTRACT.md` §5).
- The project's own release checks, discovered rather than assumed.

## Workflow

Done means: in `dry-run`, the payload and pre-flight record exist as run artifacts; in `publish`,
the branch and pull request exist with read-backs recorded and the watch lane holds the PR. Finish
the requested ship without re-asking for permission already given; report anything beyond it, such
as merge, as a follow-up rather than doing it.

1. Resolve the mode. Both modes follow the same steps up to the first remote call; `dry-run` stops
   there.
2. Confirm receipts and the review verdict bind to the head. A `blocked` or `unavailable` verdict
   stops the run.
3. Scan what would be committed for sensitive data. A candidate secret stops the run.
4. Run dependency-audit triage and the project's release checks, and record each outcome against
   this head. A check that did not run is recorded as not run, with the reason.
5. Stage only the paths this change owns, named one by one. Report an unexpected modified path
   rather than committing it.
6. Compose the commit message and the PR payload: what changed, why, the linked ticket, the receipts
   and the review verdict, and the branch it would be opened from.
7. Look up an open pull request for this branch deterministically. Only an exit-0 empty result means
   none; any other outcome is unknown, and the run stops rather than opening one.
8. `dry-run`: emit the payload and check results as run artifacts and stop. Say what would have been
   sent and to where.
9. `publish`: for each remote effect, derive the idempotency key and read the target back before and
   after (see Hard gates). Where the project ships through no-mistakes, the push and PR go through
   it with review, document and rebase skipped, and a parked gate returns to the lifecycle instead of
   being answered in the pipeline (ruling `no-mistakes-as-ship-transport`). Read
   `./references/transport-no-mistakes.md` before any no-mistakes push.
10. Draft the lesson candidate through the knowledgebase adapter's draft operation and leave it
    unpublished, naming the authority that would publish it.
11. Hand the open PR to the watch lane. The ship is prepared, not finished, until that lane owns it.
12. Report what was done, what was skipped and why, and every action declined for want of a charter
    entry.

## Hard gates

- Merge, deploy, production credentials, destructive data operations, new dependencies,
  public-contract redesign, sensitive trust-boundary changes, scope expansion, force-push and
  history rewrite are not granted by default. Each needs an explicit charter entry a human approved
  up front, naming the action and exactly what is permitted, with a human approval bound to that
  charter's hash and any expiry or single-use bound. An approval whose charter was amended
  afterwards no longer binds, and the run cannot enlarge its own authority. An approved ticket, a
  green pipeline and reviewer sign-off are evidence about the change, not authority to land it
  (ruling `sensitive-actions-need-approved-charter-entry`).
- `dry-run` makes no remote call at all. A run that pushed a branch to show what the push would look
  like was not a dry run.
- Every remote effect carries an idempotency key derived from the run id, operation id, target
  identity and input artifact hash, never from a timestamp, random value, attempt counter or session
  id, with a read-back before and after (`adapters/runner-contract/CONTRACT.md` §5). A resumed run
  re-derives the same key and returns the existing branch or PR rather than creating a second.
- Stage by named path. No whole-tree staging and no wildcards: what a wildcard adds is decided by the
  working directory, not by this change.
- A candidate secret in what would be committed stops the run. If it already reached history, report
  it for rotation; removing it from the payload does not un-leak it, and "nobody pulled the branch"
  is not evidence it is safe.
- No project-derived artifact is written to a repository path. Decisions, lessons, reviews and
  sanitized run receipts go through the knowledgebase adapter, and no application-local
  documentation tree is created as a substitute (ruling `central-kb-owns-project-artifacts`).
- The run asks no blocking question mid-flight. Where a decision is required, stop with
  `needs-input` and name the decision.

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| "The PR lookup errored, so there is probably no open PR — open one." | An error is not an empty result; treating unknown as none is how a second PR for the same branch gets created. | Treat only an exit-0 empty result as none. Otherwise stop and report the lookup as unknown. |
| "The run was interrupted after the push, so push again to be sure." | A second push without the key is a second effect. | Re-derive the key from the same inputs, read the target back, and let the unchanged result be the success. |

## Outputs

- The pull-request payload: title, description, linked ticket, the receipts and review verdict it
  rests on, and the branch it would be opened from. In `dry-run` this is the whole output.
- The pre-flight record: the sensitive-data scan, dependency-audit triage and each project release
  check, with its outcome against this head and a reason wherever it did not run.
- The ship record: which remote effects were performed, the idempotency key each carried, and the
  read-back before and after.
- The declined list: every sensitive action not taken, with the charter entry it would have needed.
  An empty declined list is a claim, so state it rather than omit it.
- A lesson candidate, drafted through the knowledgebase adapter and left unpublished.

## Side effects

`local-commit`, `branch-create`, `remote-push`, `pr-open`, `kb-draft`, `artifact-write`.

`remote-push` and `pr-open` are remote effects and occur only in `publish`, each with its
idempotency key and read-backs (`adapters/runner-contract/CONTRACT.md` §5), so a resumed run returns
the existing branch or pull request rather than creating a second.

Through the no-mistakes transport these are still this skill's effects, with the same keys: the
transport performs them, and super-ship remains the single creator of the pull request. No merge is
among them (ruling `no-mistakes-as-ship-transport`).

`kb-draft` writes a draft and nothing else; `kb-publish` is not in this skill's envelope. No
`pr-comment` and no `pr-thread-resolve`: replying on a pull request and resolving its threads are
separately granted actions belonging to the feedback lane.

In `dry-run` the only effect performed is `artifact-write`.

## Stop conditions

- `complete`: in `dry-run`, the payload and the pre-flight record are emitted. In `publish`, the
  branch and pull request exist with their read-backs recorded, the lesson candidate is drafted, and
  the watch lane holds the pull request.
- `needs-input`: receipts or the review verdict are missing or bound to another revision, the mode
  was not named, or a sensitive action is required and no charter entry covers it. Return what is
  needed and perform no remote effect.
- `failed`: a candidate secret was found, a required release check failed, or the pull-request
  lookup returned something other than success or an empty list. Name the reason; the run stays
  resumable.
- `cancelled`: the caller withdrew mid-run. Report effects already performed with their idempotency
  keys so a resumed run recognises them.

## Limits

- Remote effects per operation: one (gate). The idempotency key prevents repetition, not an attempt
  count.
- Sensitive actions: zero without a charter entry (gate), however well the run is going.
- Staged paths: named, never wildcarded (gate), at any size.
- Pull-request size: guidance, not a gate. Size targets are configurable starting points and never a
  reason to withhold a prepared change.
- Runner budgets: a cap the runner did not supply is not enforced and not guessed
  (`policies/limits.yaml`).
