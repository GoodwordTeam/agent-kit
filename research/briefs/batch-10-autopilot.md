# Batch 10 brief: autopilot

One skill body, `autopilot` (U, `profiles: [autonomy]`). It is the supervisor that composes every
phase operation in `policies/invocation.yaml` whose `callable_by` names it. It runs last because
it composes everything the earlier batches landed.

## Your inputs

| | |
|---|---|
| Dossier | `research/dossiers/autopilot.md` |
| Primary source | the design conversation, `research/sources/grok-transcript.md` G:L2040–2251 (`origin: conversation` for what no donor carries) |
| Counter-examples only | OMC and OMX autopilot (dossier §3). Read them for what autopilot is not |
| Catalog | the `autopilot` entry |
| Contract | `AUTHORING.md` §1–§11 |
| Schemas | `schemas/`, especially `charter`, `decision`, `event` and `review-event` |
| Rulings | `policies/resolved-conflicts.yaml` |
| Invocation | `policies/invocation.yaml`, every operation whose `callable_by` includes `autopilot` |
| Adapters | `adapters/runner-contract/CONTRACT.md`, `adapters/firstmate/CONTRACT.md` |

## Rulings `autopilot` binds

| ruling | scenario |
|---|---|
| `entrypoint-phase-operation-split` | 23 |
| `prototype-human-experience-needs-human` | 4 |
| `two-fix-cycles-then-stop` | 18 |
| `supervisor-agreement-is-not-authority` | 16 |
| `missing-supervisor-never-implementer` | 17 |
| `sensitive-actions-need-approved-charter-entry` | 5 |

Write the list before the body, and account for all six by name in the handback.

## Facts you can't get from those files

- **"No second run-everything entrypoint"** (`full-catalog-opt-in-profiles`, and `AGENTS.md`
  "Things that are deliberately absent"). Autopilot composes gated phase operations under a
  charter. It does not reproduce any phase's logic inline, and it has no side door: where a grant
  can't be validated, it stops for explicit invocation.
- **Supervisor seats are declared independent, and independence is enforced by the runner.** A
  seat that can't be filled independently is unavailable, and that blocks the checkpoint. It is
  never backfilled. That is the right-hand column of `AGENTS.md`'s model-routing table. Don't name a
  model, family or vendor anywhere, including when you explain why two seats must differ.
- **Autonomy direction.** Every mode ceiling in the body must be configurable through the charter
  or install configuration (`fail-closed-adapter-lifts-ceiling`, `src/packaging/capability-table.ts`),
  not hard-coded.
- **Scenarios.** Dossier §8.2 lists them. At least cover 16, 17, 18, 23 and 5 with cases on
  `autopilot` itself, and 20 (resumability) if autopilot performs any remote side effect directly.
- **Fragment name:** `provenance/adaptations.d/autopilot.yaml`. Conversation-origin claims use
  `origin: conversation` with a `G:L` locator, per §5.

## What governs this batch

`AUTHORING.md` governs. This brief reproduces none of it. Where this brief and the contract seem to
disagree, the contract wins and the disagreement is a defect in this brief: report it, don't
reconcile it. Where the contract is silent or wrong for your material, file an entry in
`CONTRACT-DEFECTS.md` as §10 describes and stop on that item. Don't work around it.

## How this run differs from batches 1–5

These are facts about the run, not the contract.

- **Shared worktree, concurrent lanes.** Other writers are authoring other batches in the same
  checkout at the same time. Write only the files this brief assigns you. Never stage, commit, or
  edit `catalog.yaml`, `provenance/adaptations.yaml` or another batch's files. The run owner
  commits each batch and flips its `status:` rows. Do not run `ak build`: it rewrites shared
  generated files. Use `bun run ak validate` and `bun test`.
- **Read validator output through your own ids.** Until the owner runs `ak build`, expect
  `provenance.adaptations-out-of-sync` and findings on files other lanes have half-written. Filter
  with `bun run ak validate 2>&1 | grep -E '<your ids>'`. Any error on a path you own blocks your
  handback.
- **Donor text.** Cite a donor file as `donor@<full pin>:<path>`, with the pin taken from
  `provenance/upstream.lock.yaml`. Read the pinned bytes with `git -C .donors/<clone> show
  <pin>:<path>`. Never read the clone's working tree, which is not at the pin. Pristine copies of
  already-cited files are under `provenance/donor-snapshots/`, and the owner snapshots your new
  rows after handback. Read only the donor files your dossier names. If you cite one it doesn't
  name, list it in the handback.
- **Your provenance fragment** is `provenance/adaptations.d/<name given below>.yaml`. That name
  follows the repo's existing fragment convention (named for the dossier). Model its header on
  `provenance/adaptations.d/build.yaml`.
- **Model routing is stripped.** Donor model tiers, vendor-named panels, effort ladders and "use a
  cheaper model" become the role and evidence equivalents in `AGENTS.md`. The denylist
  (`src/denylist.ts`) fails the batch on a hit.
- **Scenario tags** are unpadded (`scenario-4`) and must fall in 1–24. Take the assignments from
  your dossier's eval-design section and from the `scenario:` of each ruling that binds you.
- **Templates.** Some dossiers describe `templates/…` files. No catalog entry owns those, so they
  are out of scope here. If a skill needs a template, put it in that skill's `assets/`.

## Handback

The reviewer is an independent seat that hasn't seen your reasoning. Hand back artifacts and
claims:

- every file written
- per body, its line count and the §1 decision (what moved to `references/` and why, or why nothing
  did)
- per id, every binding ruling by name: cited where, or deliberately left bare and why
- scenarios tagged, and on which case
- donor files cited that the dossier didn't name
- any `CONTRACT-DEFECTS.md` entry filed
- `bun run ak validate` output filtered to your ids, plus the summary line
