---
name: super-bound
description: >-
  Turns an approved direction into a decision-level specification, a reviewed plan and a dependency
  graph of zero-context implementation tickets with interfaces, owned files, acceptance criteria and
  a named verification command. Use when the direction is agreed and bound to the current revision
  but the specification, slicing, blocking edges, file ownership or multi-module capability map are
  unsettled. Not for deciding what to build (super-align), a reviewed ticket that already carries
  its acceptance criteria and verification command (it enters at build), charting a multi-session
  effort into decision tickets (wayfind), reviewing a specification (doc-review), or a single
  mechanical rename.
license: MIT
metadata:
  ak_catalog_id: super-bound
---

## When to use

Selection is carried by the description. Start from an approved alignment result; never reopen it.

## Not for

Exclusions are in the description. A reviewed, fully specified
ticket is named as entering at build, with no specification or slicing pass.

## Authority

Authority: `explicit` at the public entrypoint, `delegated-grant` at the phase operation
`bound.run`. A human starts the public entrypoint with `/ak:super-bound`. A delegated controller
starts `bound.run` only under a runner-validated grant covering `spec-approval`, and only with a
second grant covering `ticket-approval` when the operation emits implementation tickets
(`adapters/runner-contract/CONTRACT.md`). Where the host cannot validate a grant, the operation
stops for explicit invocation rather than approving on the controller's word (ruling
`entrypoint-phase-operation-split`). No skill starts this skill directly; it calls `doc-review`,
which is model-invoked, and that direction is the legal one.

## Inputs

- **Approved alignment result** bound to the current source revision. Absent, or bound to another
  revision: `needs-input`. A direction approved against other code is not an approval of this one.
- **Recorded context** via the knowledgebase adapter's `readContext`: the `prd` in scope, settled
  `adr` pages, the glossary. An empty result is a fact; an unreachable knowledgebase is `failed`.
  No `kb-write` on the host is `needs-input` naming `kb-write`; never write the plan or tickets
  into the repository instead.
- **Project guidance** (`schemas/project.schema.json`) for change size and test shape. Absent: the
  starting points in Limits are advisory and nothing enforces them.
- At `bound.run` only: a `charter` (`schemas/charter.schema.json`) listing `spec-approval`, and
  `ticket-approval` where tickets will be emitted. Absent: `needs-input`.

## Workflow

1. Detect before asking: read the dependency manifest, test runner, lint and CI configuration,
   report the findings in two lines, and ask only what is left.
2. If the direction spans modules, draw the capability map first (stable kebab-case module ids,
   responsibility, dependencies); a human reviews it before any module's specification is written.
3. Write the specification at decision level: problem, solution, non-goals, acceptance criteria,
   test seams, verification commands, out of scope. No file paths or code, except a fragment a
   prototype already settled exactly (a state machine, reducer, schema or type shape).
4. Choose test seams before slices: as few as the feature allows, ideally one. Name the seam and why
   it is the highest available. Reuse the vocabulary alignment established, per
   [the domain-modeling reference pack](../../references/domain-modeling/REFERENCE.md).
5. Run `/ak:doc-review` on the specification and resolve everything it returns.
6. Take the specification approval, bound to its artifact hash, before cutting any ticket.
7. Slice into tickets. Each slice is a narrow but complete path through every layer, demoable or
   verifiable on its own, and sized for one fresh context window.
8. Give every ticket its interfaces: what it consumes from earlier tickets (exact signatures) and
   what it produces for later ones (exact names, parameters, return types). Write for a skilled
   developer who knows almost nothing about this toolset or domain.
9. Declare blocking edges, then what edges miss: exclusive file ownership per ticket, shared
   generated artifacts, global migration numbering. Unlinked tickets writing one file still collide.
10. When one mechanical change breaks call sites across the tree and no vertical slice can land
    green, use the wide-refactor shape: expand; migrate in batches, one ticket per batch, each
    blocked by the expand; contract, blocked by every batch.
11. If an implementer with an empty context window could not do a ticket, reshape it or reclassify
    it `type: decision` and send it back.
12. Self-review, then publish: every acceptance criterion is covered by a ticket; no ticket holds an
    unfinished-content marker or a "same as the earlier ticket" pointer; each ticket's produced
    names and types match the next one's consumed names exactly.

## Hard gates

- A decision ticket is never emitted as executable work. A slice that fails the zero-context check
  is reclassified as `type: decision` naming the open fork, even when a human asks to ship it and
  "let the implementer ask".
- Approval binds to the specification's artifact hash. Any edit changes the hash; take approval
  again before cutting tickets.
- No ticket ships with an unfinished-content marker, "add appropriate error handling" or "handle
  the edge cases" in place of specifics, or a pointer to another ticket in place of the work.
- Evidence that invalidates a decision settled earlier in the session stops the write. Return a
  blocked-or-replan result naming the decision and the evidence; do not resolve it silently.
- Enter the consensus plan gate only on genuine architectural disagreement, declared high risk, or
  a review-driven replan, not on a routine breakdown. It is a protocol this skill enters, not a
  skill it starts: [the consensus plan gate protocol](../../protocols/consensus-plan-gate/PROTOCOL.md).

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| I'll put file paths in the specification so nobody has to guess. | A path settles an implementation decision the specification has not made, and the first refactor makes it wrong while it still reads authoritative. | Keep paths in tickets, and in the specification only where a prototype settled them. |
| The guidance says about a hundred lines per change, so this must become three tickets. | Change size and test shape are starting points, not gates (see Limits). | Slice on verifiable behavior; record any exception in the project record. |

## Outputs

- `prd` page: the requirements when newly stated, published through the knowledgebase adapter's
  `publishArtifact` under a `kb-document` placement naming kind `prd` and the scope. The
  knowledgebase resolves the location and this skill supplies no path (ruling
  `central-kb-owns-project-artifacts`).
- Plan record: the specification, seams, slicing and dependency graph, published under a
  `run-artifact` placement and linked from the `prd`.
- `ticket` (`schemas/ticket.schema.json`), `type: implementation`, id shape `bound-<spec>-<slice>`:
  one per slice, with interfaces, owned files, blocking edges, acceptance criteria and a
  verification command.
- `ticket`, `type: decision`: one for each fork the zero-context check exposed, in place of the
  implementation ticket that could not be written.
- At `bound.run`: the same artifacts as knowledgebase drafts; that operation does not publish.

## Side effects

`artifact-write`, `scratch-write`, `kb-draft`, `kb-publish`. No `workspace-write`: this skill plans
the change and never makes it.

`kb-publish` is a remote side effect. Its idempotency key derives from the run, the operation, the
knowledgebase record identity and the published artifact's hash. The read-back is the record ref
and stored hash `publishArtifact` returns, read before the write and confirmed after it
(`adapters/runner-contract/CONTRACT.md`, "Idempotency"). A publication whose read-back cannot be
performed is `failed`, never complete. On resume after an interrupted publish, read back first; if
the earlier write is there, continue to the next step instead of publishing again.

## Stop conditions

- `complete`: the specification is approved at its hash, every acceptance criterion is covered by a
  ticket, and every published artifact's read-back matched what was sent.
- `needs-input`: no approved alignment result, an approval bound to another revision, a missing
  grant at `bound.run`, no `kb-write` on the host, or a settled decision that new evidence
  invalidated. Return the blocking item; do not proceed on a substitute.
- `cap-reached`: the plan gate hit its round cap (escalate the open question as a
  plan-conflict-ruling checkpoint) or the ticket budget ran out (return the undecomposed remainder).
- `cancelled`: the human ended the run before approving the specification. Publish nothing.
- `failed`: the knowledgebase is unreachable, or a read-back cannot be performed.

Finish the requested bounding without re-asking for approvals already given at the current hash.
Report anything outside the approved direction as a follow-up rather than planning it in.

## Limits

- Consensus plan-gate rounds: 5 (gate, `policies/limits.yaml`).
- Implementation tickets started per run: the runner-supplied `ticket-budget` (gate when supplied).
  A cap the runner did not supply is not enforced or guessed; the run records that it was absent.
- Test seams per feature: as few as possible, ideally one (guidance).
- Change size roughly one hundred lines, test shape roughly 80 / 15 / 5 unit / integration /
  end-to-end: configurable starting points in the project record, not enforced here, and not
  grounds for a finding on their own (ruling `numeric-heuristics-are-guidance`).
