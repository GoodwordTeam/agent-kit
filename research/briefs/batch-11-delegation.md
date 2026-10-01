# Batch 11 brief: delegation

Two reference packs and delegation-aware amendments to existing lifecycle bodies, packs, a protocol,
a role and policy. No new public entrypoint.

## Your inputs

| | |
|---|---|
| Mission | `research/sources/mission-brief-risk-tiering-and-slop-avoidance.md` |
| Dossier | `research/dossiers/delegation.md` |
| Reports | `research/sources/delegation-rubric-red-yellow-green.md`, `research/sources/slop-avoidance-agent-prs.md` |
| Catalog | the two `references:` entries with `batch: 11`, plus the existing entries named below |
| Contract | `AUTHORING.md` §1–§11, §12.1, §12.2, §12.4, §12.5 and §12.6 |
| Schemas | `schemas/ticket.schema.json`, `schemas/project.schema.json`, `schemas/common.schema.json`, `schemas/verification.schema.json` |
| Scorer | `src/delegation.ts` and the `ak delegation` command in `src/cli.ts` |
| Rulings | `policies/resolved-conflicts.yaml` |
| Authority policy | `policies/authority-defaults.yaml` |

## Rulings each id binds

| id | rulings (scenario) |
|---|---|
| delegation | `sensitive-surface-sets-the-floor` (25); `delegation-class-is-authority-not-finding` (26); `advisor-consultation-follows-class` (29) |
| structural-checks | `project-checks-block-only-as-constraints` (27); `unreviewed-work-needs-independent-oracle` (28) |
| super-bound | `sensitive-surface-sets-the-floor` (25); `delegation-class-is-authority-not-finding` (26); `advisor-consultation-follows-class` (29) |
| super-align | none. Say so in the handback |
| super-verify | `project-checks-block-only-as-constraints` (27); `unreviewed-work-needs-independent-oracle` (28); `advisor-consultation-follows-class` (29) |
| super-review | `sensitive-surface-sets-the-floor` (25); `delegation-class-is-authority-not-finding` (26); `project-checks-block-only-as-constraints` (27); `advisor-consultation-follows-class` (29) |
| super-ship | `sensitive-surface-sets-the-floor` (25); `delegation-class-is-authority-not-finding` (26) |
| doc-review/coherence | none. Say so in the handback |
| pack-test | `project-checks-block-only-as-constraints` (27); `unreviewed-work-needs-independent-oracle` (28) |
| pack-secure | `sensitive-surface-sets-the-floor` (25) |
| pack-data | `sensitive-surface-sets-the-floor` (25) |
| tdd | `unreviewed-work-needs-independent-oracle` (28) |
| authority-defaults | `sensitive-surface-sets-the-floor` (25); `delegation-class-is-authority-not-finding` (26) |
| autopilot | `sensitive-surface-sets-the-floor` (25); `delegation-class-is-authority-not-finding` (26) |

## Facts you can't get from those files

- **The ruling rows do not name your id yet.** In `policies/resolved-conflicts.yaml` the five
  delegation rows bind only `schemas`, the record surfaces that landed first, so reading your id
  out of the `binds` groups finds nothing. The table above is the assignment. The change that
  lands each body also adds its id to the matching `binds` group of every ruling the table gives
  it (`references`, `skills`, `packs`, `protocols`, `roles` or `policies`), in the same commit as
  the citation, so `ak validate` checks the binding from then on.
- **The decisions board is closed.** D1 keeps ticket-time and merge-time assessments. D2 keeps
  factor semantics central while project weights and cut points remain configurable and advisory.
  D3 attributes report-derived material through exact anchored-local report citations. D4 records
  all six readiness criteria on each ticket. D5 adds `money-movement`. D6 keeps command declaration
  and receipt semantics in `structural-checks`. D7 requires acceptance tests written from criteria
  before implementation by a seat other than the implementer whenever work ships without human code
  review. D8 records author kind and host, never a model. D9 shipped the deterministic scorer with
  the schemas. D10 requires evidenced advisor consultation for `yellow-owner` and `red` on supported
  hosts, recommends it for `yellow-agent`, and says nothing for `green`.
- **The ticket shape is already fixed.** `delegation` carries `class`, `stage`, a floor of packs and
  sensitive actions, five evidenced factors (`reversibility`, `size`, `complexity`, `spec` and
  `verification`), and nullable `lowered_by`. `readiness` carries the six individually evidenced
  criteria and `vague_terms`; `assumptions` resolves each item as `criterion`, `non-goal` or `open`.
  A lowering records `human`, `reason`, `at` and `from`. `from` is the computed class the human
  lowered: a later computed class above it supersedes that lowering and records `superseded: true`.
- **Consume the scorer record; do not reproduce the formula.** `ak delegation <ticket> --project
  <path>` prints the complete JSON delegation record: `class`, `stage`, `floor`, `factors` and
  `lowered_by`. The bodies cite or persist that result. They do not derive their own cut points,
  weights, floor table or lowering logic.
- **Checkpoint authority follows the class.** `green` may delegate `ticket-approval`, `build-go`,
  `finding-adjudication`, `delta-closure`, `ci-repair` and `ship-pr`; `yellow-agent` may delegate
  `ticket-approval`, `build-go`, `delta-closure` and `ci-repair`; `yellow-owner` may delegate only
  `build-go` after owner ticket approval; `red` delegates none. A human still merges every class,
  and `merge` and `deploy` remain sensitive actions.
- **Advisor placement is host-conditional and model-free.** Apply ruling
  `advisor-consultation-follows-class` through short hooks in `super-bound`, `super-verify` and
  `super-review`, with shared detail in `delegation` if needed. The captain's words are: "/advisor
  is a great skill on claude code, can we call it out on our super skills on agent kit? Based on
  risk scoring we could leverage advisors to chime in". Consultation adds judgment evidence; it
  grants no authority and hosts without that facility remain valid.
- **Keep the bodies small by using the new references.** Skill bodies keep the `AUTHORING.md` §1
  150-line target and 300-line cap. Shared scoring, floor, consultation, command and receipt detail
  belongs in `delegation` or `structural-checks`; each body keeps only its operational hook.
- **Batch 11 changes these existing entries.** `super-bound` writes delegation, readiness and
  assumptions per ticket and orders stacks as refactor, schema expand, flagged behavior, consumer,
  backfill, then schema contract as a separate ticket. `super-align` turns vague terms such as
  "fast", "clean up" and "as needed" into frontier questions. `doc-review/coherence` applies the
  six readiness criteria as a lens without grading its own artifact. `super-review` readiness runs
  `ak attach` over changed files, consumes a merge-stage scorer record, raises the class when needed
  and records the result in its gate record. `super-ship` adds the class and factors, predicted
  versus touched sensitive areas, and rollback method to the PR body. `pack-secure` adds amount
  calculation, capture, refund, payout and reconciliation activation. `pack-data` makes a contract
  migration a separate ticket and a `destructive-data` action. `pack-test` adds
  `test-strength-evidence` only when the project declares a mutation command,
  `oracle-from-criteria`, and `protected-tests-unchanged`. `tdd` adds the independent-oracle step
  for `green` tickets. `policies/authority-defaults.yaml` records the class-to-checkpoint map, and
  `autopilot` enforces it.
- **Two loader edits accompany the references.** `super-bound`, `super-review` and `super-ship`
  declare and link `delegation`; `super-verify` declares and links `structural-checks`, then consumes
  project-check receipts under ruling `project-checks-block-only-as-constraints`.
- **The money action already exists.** `policies/authority-defaults.yaml` already lists
  `money-movement` among the actions no charter grants by default; batch 11 consumes that vocabulary
  rather than adding another action.
- **Report figures stay project guidance.** No threshold, percentage, file count, line count,
  cadence or other number from either report becomes a package-wide gate. A project may separately
  make a named check blocking through `mandatory_constraints`.
- **The six eval cases have owners.** `super-bound` owns the delegated twelve-line refresh-token
  fix, the ticket whose only criterion is "make checkout faster", and the refused split of a
  900-line change. `super-review` readiness owns the `src/auth/` diff whose ticket predicted no
  sensitive area. `super-build` owns the `green` ticket whose implementer rewrites the acceptance
  tests, because it is the skill that exercises `tdd`. `super-ship` owns the PR body with no
  rollback method. Put each at `evals/<id>/<case>/case.yaml`, where `<id>` is the owning skill, and
  declare it in that skill's `skill.yaml` `tests[]`; cases 1–3 form the first vertical slice.
- **Only skills hold eval cases.** `ak validate` reads cases under catalog skill ids and nowhere
  else, so the `tdd` case sits at `evals/super-build/<case>/case.yaml`, not under `evals/tdd/`. Any
  case written for `pack-test`, `pack-secure`, `pack-data`, `doc-review/coherence` or
  `policies/authority-defaults.yaml` likewise sits under the skill that exercises that body.

## What governs this batch

`AUTHORING.md` governs. This brief reproduces none of its body shapes. Where this brief and the
contract seem to disagree, the contract wins and the disagreement is a defect in this brief: report
it, don't reconcile it. Where the contract is silent or wrong for this material, file an entry in
`CONTRACT-DEFECTS.md` as §10 describes and stop on that item. Don't work around it.

## How this run differs from batches 1–5

These are facts about the run, not the contract.

- **Isolated branch, assigned ownership.** This commissioning change was prepared in an isolated
  Orca worktree on `fm/agent-kit-delegation-catalog-brief`; batch 11 lanes should likewise edit only
  their assigned files and must not assume a shared checkout or copy batch 9's concurrent-worktree
  instructions. Integrate through explicit ownership rather than staging another lane's files.
- **Every delivery goes through no-mistakes.** Commit on a feature branch and push with `git push
  no-mistakes <branch>`, never directly to `origin`. The gate owns review, tests, lint, documentation
  checks, origin push and PR creation.
- **Contract entries deliberately have no bodies yet.** `delegation` and `structural-checks` remain
  `status: contract` until their `REFERENCE.md` files are authored. Do not create empty directories
  or dummy bodies to suppress `catalog.entry-not-authored` notes.
- **The scorer and schemas are inputs, not batch-owned code.** Body writers consume the landed
  fields and `ak delegation` output. They do not modify schema or scoring behavior in this batch.
- **Report provenance uses anchored local sources.** Add exact report ranges to
  `provenance/adaptations.d/delegation.yaml` for each authored file that adapts report material. The
  brief itself needs no row unless report text is quoted.
- **Model routing remains stripped.** Host-conditional advisor language names a facility and an
  evidence obligation, never a model, provider route, price or effort ladder. `src/denylist.ts`
  remains a batch gate.
- **Scenario tags are unpadded.** Use `scenario-25` through `scenario-29` only where the binding
  ruling and case require them; do not infer a tag merely because the case discusses delegation.

## Handback

The reviewer is an independent seat that hasn't seen your reasoning. Hand back artifacts and
claims:

- every file written
- per body, its line count and the §1 decision (what moved to a reference and why, or why nothing did)
- per id, every binding ruling by name: cited where, or deliberately left bare and why
- scenarios tagged, and on which case
- exact anchored-local report rows added, including any report range not named by the dossier
- any `CONTRACT-DEFECTS.md` entry filed
- `ak delegation` records consumed by each scoring body; no recomputed formula
- `bun run ak validate` output filtered to batch-11 ids, plus the summary line
- `bun test`, lint, format and denylist results
