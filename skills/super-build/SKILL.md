---
name: super-build
description: >-
  Executes one approved implementation ticket in a worktree the ticket owns, test first, then has the
  result checked on two independent axes (spec and standards) before the ticket is reported done. Use
  when an approved ticket typed implementation names its acceptance criteria and the verification
  that shows each one met, including a review finding or diagnostic packet already sharpened into
  such a ticket. Not for a decision ticket, an unapproved or post-approval-edited ticket, a finding
  graded smell or with null difficulty, an undiagnosed bug report or an already-verified diagnose
  patch, or a quick fix with no ticket behind it.
license: MIT
metadata:
  ak_catalog_id: super-build
---

## When to use

Selection is in the description.

## Not for

Exclusions are in the description; return such work to its owner.

## Authority

Authority: `model`. A controller or a parent skill starts it when an approved ticket is ready; no
slash command exposes it and no human act is required to start it.

No grant covers delegation, because no phase operation exposes this skill —
`policies/invocation.yaml` records model-invoked skills as exposing none by construction. The
authority that governs is the ticket's, not the caller's: the approval the ticket carries, and the
charter checkpoint the run took before its build phase opened. If you cannot see either, stop; your
own invocation is not the approval.

## Inputs

- One approved ticket typed `implementation` (`schemas/ticket.schema.json`) with
  `acceptance_criteria`, `verification`, `allowed_changes`, `read_dependencies`, `write_ownership`
  and `integration_owner`. Approval binds to the ticket's artifact hash, so a ticket edited after
  approval is unapproved again. Absent, unapproved, or typed `decision`: stop with `needs-input`
  naming the field that decided it.
- A writable checkout the run owns and a worktree this ticket alone holds (`repository-write`,
  `isolated-worktree`, `vcs-local`). Unavailable, or the branch is checked out elsewhere: `failed`.
- Two independent contexts for the check seats (`independent-context`). A seat that cannot be filled
  independently is `unavailable`, which blocks the ticket. It is never backfilled by the
  implementer, the author, whoever approved the spec, or the other seat (ruling
  `missing-supervisor-never-implementer`).
- The source finding, if the ticket came from one (`schemas/finding.schema.json`). A peer-lane
  finding graded `autofix_class: safe_auto` is remapped to `gated_auto` on intake and not dropped:
  the restriction is on which seat may emit the class, not on the class itself (ruling
  `safe-auto-restricted-per-seat`).
- Optionally a ticket budget from the runner. Absent: record that, and do not enforce or guess one
  (`policies/limits.yaml`).

## Workflow

The goal: one ticket, one worktree, one implementer, one bounded check loop, one commit, with a
receipt for every acceptance criterion.

1. **Intake.** Start only a ticket with no unfinished dependency, including dependencies no edge
   expresses. Refuse what this lane does not execute: a `decision` ticket, however
   implementation-shaped its prose reads (the type field settles it; choosing one option and
   building it answers the open question by doing it), a missing approval, or a source finding
   graded `spec_quality: smell` or `difficulty: null` (difficulty without a solution class is not a
   specification). Name the field that decided it and return the work for sharpening, diagnosis,
   escalation or decision. Do not re-type, re-grade or rewrite it to make it executable. A bug with
   a reproduction but no diagnosis enters through `diagnose`; a packet that already carried a
   verified bounded patch is finished work (ruling `diagnose-patch-or-packet-never-both`).
2. **Batches and resume.** When several tickets are ready, or a ledger from an earlier run exists,
   read `references/batches-and-resume.md` first. In short: a missing dependency edge is not
   evidence of independence, so inspect write surfaces and serialize only pairs that contend; and a
   resume reads the ledger, redoes no committed work, and keeps spent rounds counted against the cap.
3. **Worktree.** Record the base commit, then open the worktree this ticket owns
   (`protocols/worktree-ownership/PROTOCOL.md`). The handle is bound to this ticket and retired when
   it integrates, never retasked.
4. **Implement.** Dispatch one implementer (`roles/implementer/ROLE.md`) with the ticket as its only
   source of requirements. It starts no agents of its own, and no second implementer touches this
   worktree. Work test first (`protocols/tdd/PROTOCOL.md`): a failing test naming the behaviour, then
   the change that passes it. Where a behaviour is genuinely untestable, record the alternative
   verification plan in the ticket.
5. **Handle the report.** Address correctness or scope concerns before any check runs; supply
   missing context and re-dispatch the same implementer; assess a blocker rather than sending the
   implementer back at the same wall. Record anything noticed but out of scope (file, line,
   observation, why) as a candidate ticket, not an edit.
6. **Check.** Give both seats the diff as a file plus the ticket's constraints copied verbatim. Leave
   out the implementer's account and any hint of what to expect: a prompt that says what to expect
   tells the seat where to stop looking. `reviewer-spec` checks the ticket's obligations;
   `reviewer-standards` checks the project's designated rules, rule by rule. Keep the axes separate:
   no merging or re-ranking findings across them, and one passing does not cover the other.
7. **Fix loop.** At most five rounds. Rounds 1–3 resume the implementer that holds the context;
   rounds 4–5 dispatch a fresh one, told how many attempts preceded it and that it now owns the task,
   and nothing of their framing. Each re-check is per finding (addressed or not) plus a read of the
   fix diff for new breakage.
8. **Round cap.** With findings still open after round five, adjudicate each one in writing: park it
   with a ruling naming why the code stands and what it costs if wrong, or rule it load-bearing and
   stop. Run no sixth round, drop nothing, and return `cap-reached`.
9. **Finish.** Run the ticket's named verification and collect receipts, commit on the ticket's
   branch, publish receipts and the ticket result through the knowledgebase adapter's
   `publishArtifact` with a run-artifact placement, and report every written ruling and
   out-of-scope observation to whoever invoked you.

Finish the requested ticket without re-asking for permission the approved ticket already gives;
report extra work you noticed as follow-up tickets rather than doing it.

## Hard gates

- A `decision` ticket, or a finding graded `smell` or with `difficulty: null`, is refused, not
  re-typed or re-graded (shared rule for applying findings: `protocols/apply-findings/PROTOCOL.md`).
- Neither check seat emits `autofix_class: safe_auto`; a seat's class is a proposal, so a seat here
  emits only `gated_auto`, `manual` or `advisory`.
- The implementer never sits on the panel that checks its work, and no seat approves a patch it
  produced. Two seats that are the same context in sequence are one seat.
- Only independent verification evidence, plus a policy rule saying that evidence suffices, closes a
  finding. A receipt carries the command or probe, exit status, output digest, revision and
  environment identity; a description of a green run is not one, and a patch that changed after a
  receipt was taken does not inherit it (ruling `closure-requires-independent-verification`).
- Writes stay inside `allowed_changes` and the declared ownership. A write outside every worker's
  exclusive set aborts the wave; a change no worker accounts for may be the user's, so preserve and
  reconcile it rather than discarding it.
- A stubbed or skipped test, an unimplemented branch, or a marker left in place of the work is a
  blocker, not progress: report the ticket blocked with what is missing.

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| "The implementer is right there; it can confirm its own fix." | The context that produced a change cannot tell you whether it is right. | Mark the seat `unavailable`, stop with `needs-input` naming the seat, and report the ticket not done. |
| "The report says the tests passed." | The author's account is what a receipt replaces. | Run the named verification and record a receipt per criterion. |

## Outputs

- One commit per ticket on the branch that ticket owns, recorded against the ticket id. This is the
  patch link the result carries; nothing is merged, pushed or opened as a PR here.
- Verification receipts (`schemas/verification.schema.json`), one per acceptance criterion, each
  naming the criteria it supports and bound to the revision it describes.
- The per-ticket check result: each axis's findings (`schemas/finding.schema.json`), their
  disposition, and every ruling written at the cap. It emits no `review` artifact, and a later panel
  does not treat it as a lane already covered.

All of it is published through the knowledgebase adapter's `publishArtifact` with a run-artifact
placement (`adapters/knowledgebase/CONTRACT.md`). This skill names no repository path for
project-derived content.

## Side effects

`workspace-write`, `branch-create`, `local-commit`, `process-exec`, `artifact-write`, `kb-publish`.

`kb-publish` is remote: the idempotency key is the content hash of the published set
(`adapters/runner-contract/CONTRACT.md` §5), and the returned record reference is read back before
the ticket reports. Republishing an unchanged set after an interruption is a no-op success, not a
second record.

No `remote-push`, no `pr-open`: this lane ends at a commit on an owned branch. Shipping belongs to
the worker through `super-ship`.

## Stop conditions

- `complete`: committed, every acceptance criterion has a receipt bound to the committed revision,
  and every finding is closed on that evidence or parked with a written ruling.
- `cap-reached`: round five ended with findings open. Return the cap, the commit as it stands, and
  every open finding with its adjudication. Not a pass; the ticket is not done.
- `needs-input`: no approved ticket, a `decision` ticket, a source finding too vague to specify, or a
  check seat that cannot be filled independently. Return what is missing and the lane that owns it,
  never a narrowed version of the work.
- `failed`: no writable worktree, the branch is checked out elsewhere, or the knowledgebase refuses
  the write. Leave the worktree and ledger intact for the resume.
- `cancelled`: the caller withdrew the ticket. Keep the branch, worktree and recorded rulings; the
  next run reads them instead of re-deriving them.

## Limits

- Fix rounds: 5 per ticket (gate). This is the per-ticket loop, not `policies/limits.yaml`
  `fix_cycles`, which bounds fix-and-verify cycles after a review run's first pass. Neither cap
  relaxes the other.
- Implementers per worktree: 1 (gate). Parallelism is across tickets, never inside one.
- Parallel tickets: a bounded batch (guidance); the runner's ticket budget is the only start cap.
- Changed-line target and test-pyramid shape: guidance, configured per project
  (`schemas/project.schema.json`), not validated or enforced here and not a finding on their own. A
  ticket over the target records the exception instead of an artificial file split or a meaningless
  test (ruling `numeric-heuristics-are-guidance`).
