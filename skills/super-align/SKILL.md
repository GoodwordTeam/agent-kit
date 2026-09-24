---
name: super-align
description: >-
  Grills an unsettled request into agreed direction: classifies the work, isolates one coherent
  outcome, works a design tree in question rounds, settles named terms, offers two or three
  approaches with a recommendation, and requires an explicit human yes to a restated direction
  before anything is built. Use when what to build is not yet agreed: no acceptance criteria, an
  open approach, several bundled outcomes, an unrecorded seam or interface decision, or a term that
  means different things to different readers. Not for a request that already states acceptance
  criteria and the pattern to follow, a single-file rename or typo fix, turning an approved
  direction into a specification and tickets (super-bound), reviewing a written spec, plan or ADR
  (doc-review), or resolving a decision ticket inside a map a charting session is working.
license: MIT
metadata:
  ak_catalog_id: super-align
---

## When to use

Selection is carried by the description. Ceremony scales with the work; the approval gate does not.

## Not for

Exclusions are in the description. A fully specified request gets a
two-sentence confirmation, a yes and a hand-off; a typo or rename enters at build with no round.

## Authority

Authority: `explicit` at the public entrypoint, `delegated-grant` at the phase operation
`align.run`. A human starts the public entrypoint with `/ak:super-align`. A delegated controller
starts `align.run` only under a runner-validated grant covering `align-answer`
(`adapters/runner-contract/CONTRACT.md`), and only for a bounded question inside the charter's work
source. Where the host cannot validate that grant, the operation stops for explicit invocation
rather than answering (ruling `entrypoint-phase-operation-split`); a controller's own assertion of
its charter is not a validated grant. No skill starts this skill directly. A decision ticket that
belongs to a map reaches it only when the map's owner brings it to a fresh, human-started run; a
charting session may not start it.

## Inputs

- **The request**, as prose from the human. Absent: `needs-input`. A request inferred from
  repository state is not a request.
- **Recorded context** via the knowledgebase adapter's `readContext`: the glossary, the `concept`
  and `system` pages in scope, and any `adr` that already settles part of the question. An empty
  result is a fact: say the project has recorded none and continue. An unreachable knowledgebase
  is `failed`; stop rather than proceed from memory. A host that provides no `kb-write` at all is
  `needs-input` naming `kb-write`; write nothing into the repository as a substitute.
- At `align.run` only: a `charter` (`schemas/charter.schema.json`) listing the `align-answer`
  checkpoint category. Absent, or listing another category: `needs-input`.
- Codebase facts are yours to look up. Never ask the human something you could read, and never let
  looking it up block a round.

## Workflow

1. Classify the work as **bounded**, **standard** or **architectural** by ambiguity and how far it
   cuts across the system, with a one-line reason. When unsure, pick the heavier class.
2. Coherent-work gate: list every outcome in the request that has its own acceptance boundary and
   could ship without the others. If there is more than one, propose a plain-language breakdown,
   state only the relationships the material supports, and ask which one this run owns. The rest
   are context, not scope.
3. State a hypothesis for what the human wants with a confidence number. Below roughly 70, give the
   reason on the same line.
4. Load [the domain-modeling reference pack](../../references/domain-modeling/REFERENCE.md) before
   naming any term, and [the codebase-design reference pack](../../references/codebase-design/REFERENCE.md)
   when the question turns on where a seam or interface goes.
5. Build the design tree: each decision branches into the decisions that depend on it. The frontier
   is every decision whose prerequisites are settled.
6. Ask the whole frontier in one round: numbered questions, each with the answer you would give and
   why. Then stop and wait.
7. When an answer names a convention rather than a want, probe once: what would they want if they
   did not have to justify it to anyone?
8. Recompute the frontier and run the next round. Stop asking when the frontier is empty and you can
   predict the human's answers to the next three questions.
9. Present two or three approaches with trade-offs, leading with your recommendation and why. Name
   what you rejected and on what grounds. A fork with only one real option is presented as one.
10. Restate the direction in six fields (Outcome, User, Why now, Success, Constraint, Out of scope)
    and ask for approval. Out of scope is always present.
11. On an explicit yes, publish the settled vocabulary as a `concept` page and the direction as an
    `adr` with status `proposed`. On a fork the human cannot settle, publish a `type: decision`
    ticket instead and say what it blocks.

## Hard gates

- Nothing is implemented before approval. At every classification, write no source file, scaffold
  no project and start no implementation skill until the human approves the restated direction.
  A short design is still a design: write the two sentences, then take the approval.
- Approval is an explicit yes to the restatement. "Whatever you think is best", "sounds good",
  "sure, let's go" and silence hand the decision back; they agree to nothing. Put the six-field
  restatement in front of the human and ask again; do not pick a direction on their behalf.
- Complexity found mid-run upgrades the classification; nothing downgrades it. Say when it moves and
  why, and take the heavier path even when nearly done.
- A fork the human cannot settle in this session leaves as a `type: decision` ticket. A guess
  recorded as a settled decision is the failure this skill exists to prevent.
- At `align.run`, an unbounded or out-of-charter question returns `needs-input`, never a decided
  answer, and no implementation file is written in that operation.

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| The ask is clear enough; more questions waste their time. | An ask that is clear to the agent is the shape of an assumption, not of agreement. | Run the frontier round. If you can already predict the next three answers, say so and go to the restatement. |

## Outputs

- `concept` page: the settled vocabulary for this scope, published through the knowledgebase
  adapter's `publishArtifact` under a `kb-document` placement naming kind `concept` and the scope.
  The knowledgebase resolves the location and this skill supplies no path (ruling
  `central-kb-owns-project-artifacts`).
- `adr` page: the approved direction, published with status `proposed` through `publishArtifact`.
  This skill never accepts one: acceptance happens in review and never by the author
  (`docs/decisions/0001-kb-document-vocabulary.md`, "Authorship separation carries into the KB").
- `ticket` (`schemas/ticket.schema.json`), `type: decision`, id shape `align-<scope>-<topic>`,
  published through `publishArtifact` under a `run-artifact` placement when a fork is left open.
- At `align.run`: the alignment result as a run artifact carrying the approved direction or the
  open decision. That operation writes no knowledgebase page.

## Side effects

`artifact-write`, `scratch-write`, `kb-draft`, `kb-publish`. No `workspace-write`: this skill does
not edit the repository under discussion.

`kb-publish` is a remote side effect. Its idempotency key derives from the run, the operation, the
knowledgebase record identity and the published artifact's hash. The read-back is the record ref
and stored hash `publishArtifact` returns, read before the write and confirmed after it
(`adapters/runner-contract/CONTRACT.md`, "Idempotency"). A publication whose read-back cannot be
performed is `failed`, never complete. On resume after an interrupted publish, read back first and
publish only if the earlier write is absent.

## Stop conditions

- `complete`: the human approved the restated direction, and every published artifact's read-back
  matched what was sent.
- `needs-input`: no request, no explicit approval, no `kb-write` on the host, a question outside the
  charter at `align.run`, or a fork only the human can settle. Return what is settled so far and
  the one question that blocks.
- `cap-reached`: the runner-supplied alignment budget is exhausted. Return the settled part of the
  tree and the open frontier, and decide none of it.
- `cancelled`: the human ends the run. Nothing is published.
- `failed`: the knowledgebase is unreachable, or a publication's read-back cannot be performed.

After an explicit yes, finish publishing without asking again. Report ideas outside the approved
direction as follow-ups rather than folding them in.

## Limits

- Alignment exchanges: the runner-supplied `alignment-budget` (gate when supplied). A cap the runner
  did not supply is not enforced or guessed; the run records that it was absent
  (`policies/limits.yaml`).
- Questions per round: the whole frontier, asked once (gate). This skill sets no round cap of its
  own.
- Approaches per fork: two or three (guidance).
- Confidence below which a hypothesis carries its reason: roughly 70 (guidance).
