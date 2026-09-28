# Batch 6 brief: packs and reference packs

Ten bodies in two lanes that share one dossier and one provenance fragment.

- **Reference packs:** `engineering-principles` and `prose-quality`, governed by `AUTHORING.md`
  §12.5. This lane goes first, because four skills in batches 8 and 9 load these packs.
- **Domain packs:** `pack-api`, `pack-delete`, `pack-test`, `pack-secure`, `pack-frontend`,
  `pack-data`, `pack-perf` and `pack-deps`, governed by `AUTHORING.md` §12.6. §12.6 was written
  for this batch in its own commit. **Don't dispatch the domain lane until that commit is in
  `HEAD`.** Before it landed, §12.5 told a pack writer to report a defect instead of writing.

## Your inputs

| | |
|---|---|
| Dossier | `research/dossiers/packs.md`. §1 is shared, §2 covers each domain pack, §3–§4 the reference packs |
| Catalog | the eight `packs:` entries and the two `references:` entries with `status: contract` |
| Contract | `AUTHORING.md`: §12.5 for the reference lane, §12.6 for the domain lane, §12.4 for both |
| Schemas | `schemas/`, and `pack.schema.json` above all for the domain lane |
| Rulings | `policies/resolved-conflicts.yaml` |
| Attachment | `policies/invocation.yaml` (`packs-never-start-a-phase`), `protocols/attach-pack/PROTOCOL.md`, `src/attach/` |
| Plan | §3 at `research/sources/engineering-skills-repo-plan.md:169-188` |

## Rulings each id binds, from `binds` at the time of this brief

Each one is owed a citation (§6), or a stated reason for leaving it bare.

| id | rulings (scenario) |
|---|---|
| engineering-principles | `numeric-heuristics-are-guidance` (2), `full-catalog-opt-in-profiles` (24) |
| prose-quality | `central-kb-owns-project-artifacts` (21), `full-catalog-opt-in-profiles` (24) |
| pack-api | `panel-composition-by-declared-risk` (1), `sensitive-actions-need-approved-charter-entry` (5) |
| pack-data | `panel-composition-by-declared-risk` (1), `sensitive-actions-need-approved-charter-entry` (5) |
| pack-delete | `sensitive-actions-need-approved-charter-entry` (5) |
| pack-deps | `sensitive-actions-need-approved-charter-entry` (5) |
| pack-frontend | `panel-composition-by-declared-risk` (1) |
| pack-perf | `panel-composition-by-declared-risk` (1), `safe-auto-restricted-per-seat` (6) |
| pack-secure | `panel-composition-by-declared-risk` (1), `low-confidence-security-adjudicated` (3), `safe-auto-restricted-per-seat` (6), `sensitive-actions-need-approved-charter-entry` (5) |
| pack-test | `numeric-heuristics-are-guidance` (2), `ci-repair-restricts-purpose-not-permission` (19), `panel-composition-by-declared-risk` (1) |

## Facts you can't get from those files

- **`loaded_by` is fixed by the catalog.** `engineering-principles` is loaded by `super-build`,
  `super-review` and `simplify`. `prose-quality` is loaded by `doc-review`, `compound`, `explain`
  and `writing-skills`. Five of those seven loaders already exist. Read them to see what each one
  expects from the pack: `doc-review/SKILL.md:31` and `super-review/SKILL.md:45,262` already point
  at these packs. The other two (`simplify`, and `explain` with `writing-skills`) are being written
  concurrently in batches 9 and 8.
- **The numeric heuristics are the trap in `engineering-principles`.** The ~100-line change target
  and the 80/15/5 pyramid belong in that pack, and every sentence carrying them has to survive a
  reading of `numeric-heuristics-are-guidance` clause by clause. A pack that says "keep PRs under
  100 lines" has narrowed the ruling.
- **`pack-delete` shares scope with the `deprecate` skill** (maintain-product dossier §7.5), which
  the batch-9 lane is writing now. The pack constrains deletion work wherever it attaches. It never
  starts a deprecation. Name the boundary from the pack's side only.
- **Fragment name:** `provenance/adaptations.d/packs.yaml`, one fragment for both lanes. If the
  lanes run separately, the second lane appends to it and doesn't replace it.
- **Domain packs have no `skill.yaml` and don't reach §9 evals** unless §12.6 says otherwise. Their
  activation examples and `tests/` fixtures are what §12.6 specifies.

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
