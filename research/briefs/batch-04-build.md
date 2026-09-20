# Batch 4 brief — build

Four skill bodies, all model-invoked, all in `profiles/core`: `super-scout`, `super-build`,
`super-verify`, `diagnose`.

**This brief is written before batch 3 hands back.** The sections below are the parts that do not
depend on it. A closing section carries what batch 3 learned and is empty until batch 3 commits —
if it is still empty when you start, say so in the handback rather than assuming it had nothing.

## What governs this batch

`AUTHORING.md` governs. §1–§11 govern skill bodies; §10 governs the process you are working under;
§11 governs the handback. §12 does not bind you — its own first line says §1–§11 are written for
skills, and this batch adds no protocol, role or reference pack.

This brief reproduces none of the contract, and where this brief and `AUTHORING.md` appear to
disagree, `AUTHORING.md` wins and the disagreement is a defect in this brief — report it rather
than reconciling it yourself. Batch 1's brief restated a heading name the contract had moved, and
the writer, correctly following the more specific instruction, carried the wrong heading into seven
files. The writer was not at fault. Briefs restate nothing for that reason.

## Your inputs

| | |
|---|---|
| Dossier | `research/dossiers/build.md` |
| Catalog | the four `skills:` entries with `batch: 4` |
| Contract | `AUTHORING.md` |
| Schemas | `schemas/` |
| Rulings | `policies/resolved-conflicts.yaml` |
| ADR | `docs/decisions/0001-kb-document-vocabulary.md` |

Nothing else. Not the donor tree beyond the pinned files the dossier cites, not batch 1's, 2's or
3's bodies, not this session's discussion.

## Facts about this batch you cannot get from those files

**`super-scout` binds no ruling at all.** Measured at `85e4d6a`: `super-scout` appears zero times in
`policies/resolved-conflicts.yaml`. The other three bind seven rulings between them.

| ruling | scenario | binds |
|---|---|---|
| `closure-requires-independent-verification` | 3 | `super-build`, `super-verify`, `diagnose` |
| `diagnose-patch-or-packet-never-both` | 6 | `super-build`, `super-verify`, `diagnose` |
| `ci-repair-restricts-purpose-not-permission` | 19 | `super-verify`, `diagnose` |
| `delta-baseline-reset-not-third-loop` | 10 | `super-verify` |
| `numeric-heuristics-are-guidance` | 2 | `super-build` |
| `safe-auto-restricted-per-seat` | 6 | `super-build` |
| `missing-supervisor-never-implementer` | 17 | `super-build` |

This asymmetry is the trap. A writer who has just cited four rulings in `super-build` arrives at
`super-scout` and reaches for one, and §6 gives no rule that stops them, because §6 governs *where*
a citation goes, not whether the ruling exists. `super-scout`'s discipline is schema-governed rather
than ruling-governed — plan §5.4 and `schemas/dossier.schema.json` carry the structured-hit shape,
the coverage limits, the unknowns, and the rule that it never returns an architectural verdict. Cite
the schema for those. **Do not cite a ruling that does not bind the body you are writing**, and if
`super-scout` genuinely needs one that does not exist, that is a finding for `policies`, not a
citation you write.

**Check every ruling citation for contradiction, not just presence.** A body can carry the correct
ruling id beside a sentence stating the opposite of one of that ruling's clauses, and every
instrument in the repo passes it: the parent-path check confirms the id resolves, the restatement
scanner stops looking once a citation is in scope, and `role.missing-universal-never-row` checks a
two-substring floor. There is a live instance in `AUTHORING.md` itself — the `## What it must be
given` passage tells a seat whose input no longer binds to return nothing, where
`required-lane-failure-is-unavailable` requires `unavailable` and says it is never downgraded to an
empty result. Twenty-six of twenty-nine role bodies disagree with their own contract and are right.
So: for each ruling you cite, read its clauses one at a time against the sentence you wrote.

**Length is a consequence here, not a rule.** §1 settles the rule — the target is advisory, the cap
is the gate, and a body between 151 and 300 lines is never shortened to clear the number. What §1
cannot tell you is that all four of your bodies are in `profiles/core`, which is 20 of the 33
skills and is the default install. Batch 3's four skills came in at 168–188 lines. Twenty core
bodies at that average is roughly 3,500 lines resident before a user has invoked anything. That is
the plan's "catalog size vs. context" risk in its concrete form. It does not make 151 a breach. It
does mean the question §1 asks — *is there material here that belongs behind a `references/` file?*
— is worth answering by looking, and recording the answer either way.

**`ak build` after you add a provenance fragment.** `provenance/adaptations.yaml` is generated from
`provenance/adaptations.d/`. Edit the fragment, run `ak build`, commit both. Hand-editing the
generated file produces `provenance.adaptations-out-of-sync`, which is the one error batch 3 was
still carrying when this brief was written.

**Commit before the batch is clean.** The session that preceded this repository produced seven
thousand lines of verified work in an untracked path and zero commits, and all of it had to be
rescued. Batch 3 reached about eleven hundred uncommitted lines before being told the same thing.
The resume model is git. A commit carrying known warnings beats a clean working tree that exists in
one process's memory. Land early, fix forward, and flip the four `catalog.yaml` entries from
`contract` to `authored` in the commit that lands the bodies — six `catalog.status-behind-body`
warnings is the expected mid-batch signature, not a defect.

## The failure modes I expect, named so you can report them rather than absorb them

**Scenario 6 is two cases and the dossier says so; write both.** A `smell` / `difficulty: null`
finding must be refused as an implementation ticket, and the same finding graded `patch` /
`safe_auto` must proceed. An eval that shows only the refusal proves the body can say no, not that
it can tell the two apart — an instrument that returns the same answer under both hypotheses.

**`diagnose` and `super-build` will want to overlap.** `diagnose-patch-or-packet-never-both` exists
because the tempting shape is for `diagnose` to produce a patch *and* hand a packet onward, after
which the same patch is implemented twice. Write the boundary from the ruling, and if the dossier's
§4 phase sequence appears to permit both, that is a conflict to report, not to average.

**`super-verify` will be asked to accept a description of green tests.** Plan §5.6 is explicit that
an agent's account of a passing run is not a receipt, and `delta-baseline-reset-not-third-loop`
plus scenario 10 are the cases where a stale receipt looks current. The body needs `inconclusive`
to be a real outcome beside `passed`, `failed`, `not-run` and `not-applicable`, for the same reason
a lane that could not run returns `unavailable` rather than empty.

**Two fix cycles after the review seat reports, then it is reported rather than looped.** That is
the same limit the skills you are writing enforce.

## Review

An independent seat that has not seen your narrative. Your handback carries artifacts and claims,
not reasoning: what you wrote, what you decided about each body's length and why, which rulings
each body cites and which it deliberately does not, and anything you could not resolve.

## What batch 3 learned

Empty until batch 3 commits. If it is still empty when you begin, that is a fact to report, not a
gap to fill.
