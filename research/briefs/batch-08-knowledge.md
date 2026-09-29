# Batch 8 brief: knowledge

Four skill bodies: `handoff` (M), `wait-what` (M), `explain` (U) and `writing-skills` (U).
`compound` and `compound-refresh` are also batch 8 and are **already authored**. Don't touch them.

## Your inputs

| | |
|---|---|
| Dossier | `research/dossiers/knowledge.md` §3–§6 and §8–§11. §1–§2 are the landed skills and §7 is templates, both out of scope |
| Catalog | the four `skills:` entries with `batch: 8` and `status: contract` |
| Contract | `AUTHORING.md` §1–§11 |
| Schemas | `schemas/` |
| Rulings | `policies/resolved-conflicts.yaml` |
| ADR | `docs/decisions/0001-kb-document-vocabulary.md`, `docs/decisions/0003-model-invocation.md` |
| Worked examples of the shape | `skills/diagnose/`, `skills/compound/` and their `evals/` |

## Rulings each id binds

| id | rulings (scenario) |
|---|---|
| handoff | `central-kb-owns-project-artifacts` (21) |
| writing-skills | `central-kb-owns-project-artifacts` (21) |
| wait-what, explain | none. Say so in the handback |

## Facts you can't get from those files

- **`explain` and `writing-skills` load `prose-quality`.** It is being written concurrently at
  `references/prose-quality/REFERENCE.md`. Name it in `skill.yaml` `references:` and link it the
  way `skills/super-align/SKILL.md:77` links `domain-modeling`. If it isn't on disk when you
  validate, the link finding is expected; say so in the handback.
- **`writing-skills` is this package's own authoring skill.** Its workflow has to send the writer to
  `AUTHORING.md`, `catalog.yaml` and `ak validate`, not restate them. That is the §10 rule applied
  to a body, and a restated line cap in it goes stale the day §1 moves. The donor superpowers
  `writing-skills` carries a TDD-for-docs discipline. Keep it, bound by our §9.
- **`handoff` writes a continuity artifact.** Under `central-kb-owns-project-artifacts` its durable
  form goes to the KB adapter, not to a repo path. Read the ruling's `overrides:` block before
  writing the Outputs section.
- **`explain` describes and does not recommend.** That is the whole boundary, and it is the gate an
  adversarial case should press on.
- **Fragment name:** `provenance/adaptations.d/knowledge.yaml`. There is no knowledge fragment yet:
  `compound` and `compound-refresh` rows live in `learning.yaml`. Don't move them.

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
