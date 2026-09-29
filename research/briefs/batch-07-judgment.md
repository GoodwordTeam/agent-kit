# Batch 7 brief: judgment

Seven skill bodies. Four are user-invoked (`ideate`, `pov`, `bakeoff`, `doubt-driven`) and three
are model-invoked (`research`, `source-driven`, `prototype`). None of them writes production code.

## Your inputs

| | |
|---|---|
| Dossier | `research/dossiers/judgment.md` |
| Catalog | the seven `skills:` entries with `batch: 7` |
| Contract | `AUTHORING.md` §1–§11 |
| Schemas | `schemas/` |
| Rulings | `policies/resolved-conflicts.yaml` |
| Invocation | `policies/invocation.yaml` |
| Worked examples of the shape | `skills/diagnose/`, `skills/wayfind/`, and their `evals/` |

## Rulings each id binds

| id | rulings (scenario) |
|---|---|
| ideate | `prototype-human-experience-needs-human` (4) |
| pov | `prototype-human-experience-needs-human` (4) |
| prototype | `prototype-human-experience-needs-human` (4) |
| bakeoff, doubt-driven, research, source-driven | none. These are schema- and policy-governed. Say so in the handback, and don't manufacture a citation to make the lists look uniform |

## Facts you can't get from those files

- **Your dossier is wrong in one place, and the law beats it.** Dossier §4 (line 200 onward) says
  `bakeoff` "invokes `ak:pov`" through the ordinary skill-invocation mechanism, and line 216 calls
  that fine. It isn't. Both are user-invoked, and `u-may-not-call-u` (`policies/invocation.yaml`)
  allows a U→U path only for a delegated controller under a runner-validated grant. A bakeoff a
  human started is not one, so no phase operation on `pov` makes the call lawful. **Ruled during
  this batch:** an earlier draft of this brief directed a `pov.judge` operation, and the writer
  correctly stopped on it. `bakeoff` does not invoke `pov`. Its judge runs in an independent
  context internal to `bakeoff`: candidates are frozen before judging, and the judge gets the
  artifacts and the contract, never the author's claim. It uses the same grade vocabulary and
  evidence floors, carried in `bakeoff`'s own `references/` and adapted from the same donor rows.
  `policies/invocation.yaml` is not edited by this batch. `bakeoff` may cite
  `entrypoint-phase-operation-split` where it explains why it can't call `pov`.
- **The dossier predates `docs/decisions/0003-model-invocation.md`.** Its line 11 says U skills get
  `disable-model-invocation`. They don't any more. Follow ADR 0003 and `AUTHORING.md` §4: the U
  class is held by the description's non-trigger clause and a first-step authority check.
- **Scenario 4 is the one this batch owns.** It turns on a human judging a human experience
  (`prototype-human-experience-needs-human`). Write it on `prototype`, where the ruling bites
  hardest, and read the ruling's `reason:` before tagging a second case.
- **Your dossier §1 is binding within your batch.** It covers no repo-local docs tree, no named
  model or vendor, "recommendation is not authorization", and insufficient evidence as a nameable
  outcome. Carry each one into every body it names.
- **Fragment name:** `provenance/adaptations.d/judgment.yaml`.

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
