# Batch 9 brief: maintain-product

Six skill bodies: `simplify` (M), and `improve-architecture`, `deprecate`, `triage`, `strategy` and
`product-pulse`, all U.

## Your inputs

| | |
|---|---|
| Dossier | `research/dossiers/maintain-product.md` |
| Catalog | the six `skills:` entries with `batch: 9` |
| Contract | `AUTHORING.md` §1–§11 |
| Schemas | `schemas/` |
| Rulings | `policies/resolved-conflicts.yaml` |
| ADR | `docs/decisions/0003-model-invocation.md` |
| Worked examples of the shape | `skills/diagnose/`, `skills/wayfind/` and their `evals/` |

## Rulings each id binds

| id | rulings (scenario) |
|---|---|
| simplify | `numeric-heuristics-are-guidance` (2) |
| deprecate | `sensitive-actions-need-approved-charter-entry` (5) |
| improve-architecture, triage, strategy, product-pulse | none. Say so in the handback |

## Facts you can't get from those files

- **`simplify` loads `engineering-principles`,** which is being written concurrently at
  `references/engineering-principles/REFERENCE.md`. Name it in `skill.yaml` `references:` and link
  it the way `skills/super-align/SKILL.md:77` links `domain-modeling`. CE's `ce-simplify-code`
  carries model-tier language (dossier §7.2). Strip it.
- **`deprecate` versus `pack-delete`** (dossier §7.5). The pack is being written concurrently. The
  skill owns the deprecation workflow. The pack constrains any deletion wherever it attaches, and
  never starts one. A deletion or public-contract removal is a sensitive action: under
  `sensitive-actions-need-approved-charter-entry` it needs an approved charter entry, and a
  deprecation plan is not one.
- **`triage` and `product-pulse` touch the tracker.** The tracker is vendor-neutral and falls back
  to the KB (ruling `tracker-of-record-falls-back-to-kb`, contract
  `adapters/tracker/CONTRACT.md`). Neither ruling binds these two, so decide by reading whether
  either would be written differently, and say what you decided. Any `tracker-write` or
  `remote_side_effect` owes a resumability case (§9).
- **The repo-local docs-tree conflict is batch-wide** (dossier §7.1). Durable artifacts go through
  the KB adapter.
- **Fragment name:** `provenance/adaptations.d/maintain-product.yaml`.

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
