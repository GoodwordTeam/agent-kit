---
name: super-review
description: >-
  Reviews a code change with a panel of independent specialist seats. `full` judges an immutable
  snapshot against requirements, the project's declared standards and the tests; `delta` gives an
  accepted fix a bounded second look inside the review run already open; `readiness` is the
  two-lane gate on whether the evidence behind an otherwise-ready change holds up. Use when a change
  needs judgment before merge, or when a caller asks whether it is safe to merge and the answer
  depends on evidence nobody has read yet. Reviewers do not edit the source. Not for writing the
  fix, running acceptance checks or producing receipts, repairing a red pipeline, failing a change
  on its size or test ratio, or reviewing a requirements document, plan or ADR (those go to
  doc-review).
license: MIT
metadata:
  ak_catalog_id: super-review
---

## When to use

Selection is in the description. Pick the mode: `full` for a first review, `delta` for a fix to an
accepted finding inside an open run, `readiness` for the evidence gate before ship.

## Not for

Fixes, acceptance checks and CI repair belong to other lanes; accepted findings leave this skill
through the apply-findings protocol, where an implementer with write authority acts on them.

## Authority

`full` and `readiness`: authority `explicit-or-delegated`, invocation U. A human starts either
directly, or a delegated controller starts the same protocol through the declared phase operations
`review.full` and `review.readiness` under a runner-validated grant covering finding-adjudication.
`delta`: authority `active-review-run`, invocation M, through `review.delta`.

There is one protocol behind both doors, not a public wrapper and a second pipeline. Where the host
cannot validate a grant, the entrypoint stops for explicit invocation rather than reproducing the
delegated effect through a side door (ruling `entrypoint-phase-operation-split`).

Under a Firstmate binding, Firstmate is the delegated controller and the host validates the grant with
`ak firstmate grant --binding <path> --operation review.full` (or `review.readiness`). Exit 0 is the
grant: cite the record it prints on the review. A refusal means stop and report `needs-decision` to
Firstmate (ADR-0004).

`review.delta` does not open a review run. Invoked where none is open, it stops with `needs-input`
naming `super-review full` as the next permitted action.

## Inputs

- The comparison base and the reviewed head, both named. Without them, stop with `needs-input`: a
  review with no base is an opinion about a file tree.
- The requirements the change claims to satisfy, by id. If none resolve, the spec lane returns
  `unavailable`; do not invent an intent to review against.
- The project's declared standards, discovered from the project's own record. None declared means
  the standards seat returns empty (`policies/review.yaml`).
- The test evidence for the change and the packs it earned. Packs select conditional seats, so read
  them rather than guessing from file names (ruling `panel-composition-by-declared-risk`).
- `delta` only: the open review run, its persisted findings with fingerprints and dispositions, its
  input hashes, and the fix diff (`schemas/review.schema.json` `packet`). A replacement seat gets
  the durable prior-finding packet (ruling `reviewer-continuity-not-amnesia`).

## Workflow

Done means every selected lane has a state, the verdict follows from those states, and the review
and findings are emitted as run artifacts. Finish the requested review without re-asking for
permission already given; report anything beyond it as a follow-up rather than doing it.

1. Resolve the mode and its authority. For `delta`, confirm a review run is open.
2. Freeze the snapshot: its hash, the comparison base, the reviewed head, the source revision and
   the input hashes. Every seat reads this one object.
3. Select seats from declared risk and attached packs, not a fixed roster. Correctness always runs;
   standards runs when the project declares standards or discovery was uncertain; the rest fire
   only when the change earns them. A typo does not convene the panel, and security, API and data
   seats are not dropped because a classifier was unsure (ruling
   `panel-composition-by-declared-risk`). Record which seats ran and which signal selected or
   skipped each. Read `./references/panel.md` for the seat catalog, selection signals, evidence
   anchors, suppression and synthesis rules.
4. Build one packet per seat: the snapshot plus that seat's requirements, standards and test
   context. Leave out the implementer's narrative or self-assessment, other seats' findings, and any
   approval context from the author lane; a seat reading those judges the account, not the change.
5. Dispatch the seats concurrently, each in its own isolated context. Two seats sharing a scratchpad
   are one seat. A seat that cannot be filled independently of the author is `unavailable`; the
   security seat is filled by neither the implementer nor whoever approved the spec (ruling
   `missing-supervisor-never-implementer`).
6. Record each lane as `covered`, `skipped` or `unavailable` (`schemas/review.schema.json`). A seat
   that ran and found nothing is `covered`, not `skipped`. A lane that could not run or failed is
   `unavailable` with its reason (ruling `required-lane-failure-is-unavailable`). Store each covered
   seat's raw output as a run artifact referenced by hash before synthesis reads it.
7. Synthesize without merging: dedupe by fingerprint, keep each seat's evidence on its finding, and
   do not rewrite a severity to reconcile seats or to match a majority. Suppress only for the
   catalogued reasons, and keep a suppressed finding readable with its reason.
8. `delta`: first check whether architecture, requirements, the comparison base or the affected
   surface changed materially. If so, invalidate the affected approvals and open a new baseline with
   its own pass 1 (ruling `delta-baseline-reset-not-third-loop`). Otherwise run the spec and
   standards lanes over the fix, scoped by affected behavior rather than changed lines, so a serious
   issue in an untouched affected caller is still reported with its novelty evidence (ruling
   `delta-scope-affected-behavior`). A product-code change found during CI repair comes back here as
   a delta over the affected behavior, not a second full panel. Read `./references/delta.md` for the
   packet, continuity, closure and baseline mechanics.
9. `readiness`: run the two independent lanes as a gate over the panel's verdict, not a substitute
   for it. A missing lane is `unavailable`, and a blocking lane vetoes approval whatever the panel
   said.
10. Set the verdict — `approved`, `changes-requested`, `blocked` or `unavailable` — emit the review
    and findings, and report what is still open.

## Hard gates

- Reviewers do not edit the source they review (`policies/review.yaml`
  `reviewers_may_edit_source: false`), and the snapshot stays immutable for the run. Propose the
  fix in the finding instead.
- A required lane that is `unavailable` blocks approval. It is never downgraded to empty or
  backfilled by the author, the implementer, another seat or synthesis, and the run stays
  resumable. "We could not look" and "we looked and found nothing" are different results (ruling
  `required-lane-failure-is-unavailable`).
- A finding closes only on independent verification evidence bound to the revision under review,
  plus a policy rule saying that evidence suffices. A receipt carries the command or probe, exit
  status, output digest, revision and environment identity (`schemas/verification.schema.json`); an
  agent's description of a green run is not one. Reviewer confidence, classifier scores, seat
  agreement and the implementer's word are advisory, and an author never closes their own finding
  (ruling `closure-requires-independent-verification`). A receipt or verdict is stale once its
  revision or working-tree diff hash differs from the snapshot being judged.
- At most two fix-and-verify cycles after the first pass (ruling `two-fix-cycles-then-stop`). The
  run records its comparison base, reviewed head and last head verified in the delta loop
  separately so they are never conflated (ruling `delta-baseline-reset-not-third-loop`).
- A `smell` (open solution space) keeps a null difficulty, never gets an automatic action class, and
  is dispatched to exactly one of sharpen, diagnose or escalate, never to a fixer (ruling
  `safe-auto-restricted-per-seat`).
- A standards finding cites the project rule it rests on, with file and rule id. A seat that cannot
  cite a rule returns empty; absent standards never become invented preferences.

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| "Autopilot needs two independent judgments; I will start two reviewers myself, or reuse the standards seat I already started." | A helper this run started is not independent of this run (ruling `missing-supervisor-never-implementer`), and supervisor judgments are not seats of this panel (ruling `firstmate-outer-loop-agent-kit-inner`). | Finish the panel's own lanes and return the request for the two judgments to the supervisor that owns the task (Firstmate, where one supervises), which dispatches them as separate agents. |
| "Give the reviewer the implementer's summary so it knows what the change was for." | A seat that reads the author's account judges the account rather than the change. | Hand the seat the frozen snapshot and its own requirements, standards and test context only. |

## Outputs

- The review (`schemas/review.schema.json`): mode, comparison base, reviewed head, the snapshot with
  its hash and exclusions, the authorship record, one entry per lane with its state and verdict, the
  fix-cycle count, the verdict, and, where a baseline was reset, what changed materially, which
  approvals it invalidated and the new comparison base.
- The findings (`schemas/finding.schema.json`), each with evidence quoting the line it is about, a
  fingerprint (rule-or-cause plus location-or-symbol plus evidence, never the line number) and an
  action class. No code-review seat emits `safe_auto`: classification is a proposal, and applying it
  is the caller's decision under its own authorization. A `safe_auto` from a peer lane is remapped
  to `gated_auto`, never dropped. Each `smell` records which single dispatch it took.
- A lesson candidate marked on any finding that teaches a durable rule. This skill marks it and
  publishes nothing; the knowledgebase write is outside the review operations' envelope.

All of it is emitted as run artifacts under `artifact-write`. This skill names no repository path
for project-derived content.

## Side effects

`artifact-write`.

No `workspace-write`, no `local-commit`, no `remote-push`: a seat that edits, commits or pushes has
left the envelope the runner validated. No `pr-comment`: posting onto a pull request is a separate
granted action owned by another skill.

## Stop conditions

- `complete`: every selected lane has a state, every required lane is `covered`, the verdict is set,
  and the review and findings are emitted. A `blocked` verdict is complete; the block is the result.
  A delta that ends by establishing a new baseline is complete too: the new scope opens at pass 1,
  which is not a third loop (ruling `delta-baseline-reset-not-third-loop`).
- `needs-input`: no comparison base or reviewed head was named, or `delta` was invoked with no open
  review run. Return what is needed and no partial verdict.
- `cap-reached`: a third fix cycle was requested. Stop with an explicit blocked-or-replan decision
  and every open finding attached; repeated failure is a signal about the plan (ruling
  `two-fix-cycles-then-stop`).
- `failed`: a required lane returned `unavailable` and the run cannot proceed, or the snapshot could
  not be frozen. Name the lane and the reason; the run stays resumable.
- `cancelled`: the caller withdrew mid-run. Keep the lane results already collected and emit them as
  what they are.

## Limits

- Fix cycles: 2 (gate), `policies/limits.yaml` `fix_cycles`. The third stops with the
  blocked-or-replan decision.
- Review rounds: 3 (gate), `policies/limits.yaml` `review_rounds`, counted across the run.
- Panel size: no cap (guidance). It is an outcome of selection, not a target to hit or trim to.
- Change size and test ratios: guidance, not gates, carried in `references/engineering-principles`
  and set per project. Raise size only where it names a concrete review or maintenance consequence
  in this change (ruling `numeric-heuristics-are-guidance`).
- CI repair restricts the purpose and scope of a repair, never the standard the change must meet
  (ruling `ci-repair-restricts-purpose-not-permission`).
- Runner budgets: a cap the runner did not supply is not enforced and not guessed
  (`policies/limits.yaml`).
