---
name: super-verify
description: >-
  Turns a completion claim into receipts: for each acceptance criterion, the command or probe that
  would prove it, run fresh, with exit status, output digest, revision and environment identity
  recorded, assembled into an acceptance-to-evidence matrix. Use when a specific implemented
  behaviour has to be shown to work, when a ticket's criteria need re-checkable evidence before it is
  reported done, or when the code moved since the last receipts or a repair landed. Not for judging
  whether code is well written (a review lane), not for fixing what fails (diagnose), not for a
  claim that names no criterion, and not for ratifying someone's account of a green run.
license: MIT
metadata:
  ak_catalog_id: super-verify
---

## When to use

Selection is in the description.

## Not for

Exclusions are in the description. Do not answer a quality question
by running the suite instead.

## Authority

Authority: `model`. A controller or a parent skill starts it when a claim needs evidence; no slash
command exposes it and no human act is required to start it.

No grant covers delegation, because no phase operation exposes this skill
(`policies/invocation.yaml`). Who starts the run does not change what it may conclude: the
implementer of the change may invoke it, and the receipts still close what they close, because
closure is a property of the evidence and of a policy rule saying that evidence suffices, not of the
caller's confidence (ruling `closure-requires-independent-verification`).

## Inputs

- The claim, resolved to named acceptance criteria (`schemas/ticket.schema.json`
  `acceptance_criteria`, by AC id). Absent, or no command could settle it: stop with `needs-input`
  naming the criterion it would need.
- The repository at the revision being verified, readable (`repository-read`). Unreadable, or no
  revision named: `failed`. A receipt whose revision is null is not a receipt.
- The project's own test, build and check commands, discovered rather than assumed. A command
  guessed from ecosystem convention verifies whatever it happens to do, which is a different claim.
- The execution environment, identified (`schemas/verification.schema.json`). Tests run in an
  isolated environment, and repository test code gets no production credentials by default.
- Optionally, receipts from an earlier run. A receipt is evidence only for the revision it names. The
  code moved when the revision or the working-tree diff hash differs from the receipt's
  (`common#/$defs/revision_ref`); an uncommitted edit on the same revision is a move, and a moved
  receipt is invalidated, not a head start.

## Workflow

The goal: every acceptance criterion has an outcome backed by a fresh receipt, or a recorded reason
why it has none, published as a matrix.

1. Resolve the claim into acceptance criteria by id. No criterion: stop with `needs-input`.
2. Discover the project's own commands (test runner, build, type check, the wrapper the repository
   actually uses) and note where you found them.
3. For each criterion, identify the command or probe that would prove it. Where no realistic check
   exists, record that on the criterion with the reason; do not invent a command or offer a proxy.
4. Run each command fresh and complete at the revision under verification. Partial runs, cached
   results and earlier output are not this run's evidence. On a resume, checks already receipted
   for this revision are not re-run just to confirm them.
5. Read the whole output: exit status, then the counts. When a suite reports failures but exits
   zero, set the outcome from the output and record the disagreement.
6. Record one receipt per check: the command as an argument vector (or probe and target), exit
   status, digest of the relevant output, revision, environment identity, and the criteria it
   supports. Every run is its own receipt; a flaky pass picked from retries is reported as
   instability and routed to diagnosis.
7. Set each outcome to what happened: confirmed, refuted, did not run, not applicable, or
   inconclusive. Every non-pass carries a reason.
8. Assemble the matrix: every criterion against every receipt, with no criterion left without a cell.
   A missing cell reads as covered to everyone downstream.
9. Invalidate, rather than rewrite, any earlier receipt this run supersedes, recording what changed
   and when. Whether a change was "material" is exactly what an old receipt cannot tell you.
10. Claim exactly what the receipts support. Publish the matrix and receipts through the
    knowledgebase adapter's `publishArtifact` with a run-artifact placement, and return a verdict per
    criterion, not a summary sentence.

A failing check is a reproduction: record it, report it, and route the repair to `diagnose`, which
emits either a verified bounded patch or a work packet, never both (ruling
`diagnose-patch-or-packet-never-both`). Do not edit the code you are verifying, even for a small fix.

Finish the verification requested without re-asking for permission already given; report anything
else you noticed as a follow-up rather than acting on it.

## Hard gates

- No completion claim without fresh evidence for the revision claimed. A description of a green run
  is not a receipt; a receipt carries command or probe, exit status, output digest, revision and
  environment identity, and a patch that changed after the receipt does not inherit it (ruling
  `closure-requires-independent-verification`).
- Classifiers, confidence scores and reviewer judgement are advisory and recorded as such. None turns
  missing proof into a pass; a criterion with no check is reported as having none.
- Do not skip a check, weaken an assertion, lower a threshold or remove coverage to get a passing
  receipt. Each is a separate decision, recorded on the receipt that follows it. A required
  product-code change is not a repair this lane absorbs: what comes back is a bounded patch with new
  verification, not the old receipt read again (ruling `ci-repair-restricts-purpose-not-permission`).
- A receipt names the head it verified, kept distinct from a review run's comparison base and
  reviewed head. When architecture, requirements, the comparison base or the affected surface changed
  materially, invalidate the affected receipts and establish a new baseline: a new scope with its own
  first pass, not another delta loop (ruling `delta-baseline-reset-not-third-loop`).
- Every non-pass outcome is recorded with its reason. A run whose every check failed has completed,
  and the failures are the result.

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| "The caller already ran the tests and says they pass." | Their account is the thing a receipt exists to replace, at a revision you cannot name. | Run it fresh; if you mention their statement, mark it as not evidence. |
| "The change since the last green receipt was trivial." | Materiality is what the old receipt cannot tell you. | Re-run, and record the invalidation against the old receipt. |

## Outputs

- One receipt per check (`schemas/verification.schema.json`), each naming the criteria it supports
  and bound to the revision it describes. A receipt that supports nothing is not evidence.
- The acceptance-to-evidence matrix: every criterion with its outcome and receipt, including those
  not run, not applicable, or inconclusive.
- Invalidation records against superseded receipts, naming what changed; nothing is rewritten.

All of it is published through the knowledgebase adapter's `publishArtifact` with a run-artifact
placement (`adapters/knowledgebase/CONTRACT.md`). This skill names no repository path for
project-derived content.

## Side effects

`process-exec`, `scratch-write`, `artifact-write`, `kb-publish`.

`kb-publish` is remote: the idempotency key is the content hash of the receipt set
(`adapters/runner-contract/CONTRACT.md` §5), and the returned record reference is read back before
the run reports. Republishing an unchanged set after an interruption returns the existing record, not
a second one, and no receipt is regenerated with a new digest for the same run.

No `workspace-write`, no `local-commit`: verification does not change what it verifies. What a check
writes lives in scratch and is cleaned up; a check that can only pass by editing the tree is
reported, not accommodated.

## Stop conditions

- `complete`: every criterion has an outcome, with a reason where it is not a pass, and the receipts
  are published. A run whose checks all failed is complete.
- `needs-input`: the claim resolves to no criterion, or no revision was named. Return what is needed;
  no partial matrix presented as a verdict.
- `failed`: the repository is unreadable at the named revision, the environment cannot be
  identified, or the knowledgebase refuses the write. Return the receipts unpublished with the
  refusal rather than writing them to a repository path.
- `cancelled`: the caller withdrew the claim. Receipts already taken are kept and published as
  evidence about the checks that ran.

## Limits

- No numeric cap of its own. The runner's elapsed-time budget is the only bound; if the runner
  supplied none, do not enforce or guess one (`policies/limits.yaml`).
- Receipts per criterion: at least one (gate); none replaces another, and a re-run never overwrites
  an earlier receipt.
- Commands: the project's own, discovered (gate). A criterion with no discoverable check gets a
  recorded outcome, not an invented command.
