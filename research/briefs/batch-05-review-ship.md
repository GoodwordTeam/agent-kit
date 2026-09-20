# Batch 5 brief — review-ship

Five skill bodies, **all user-invoked**: `super-review`, `super-ship`, `receiving-review`,
`babysit-pr`, `ultraqa`. Three are `profiles: [core]`, two are `profiles: [autonomy]`.

**This brief is written before batch 4 hands back.** The sections below are the parts that do not
depend on it. A closing section carries what batch 4 learned and is empty until batch 4 commits —
if it is still empty when you start, say so in the handback rather than assuming it had nothing.

**This is the checkpoint batch.** When you hand back, the vertical slice runs against what you
wrote, and the nine scenarios it gates on are graded on the corpus you leave behind. A gap you ship
does not surface at your review; it surfaces after the slice has been driven through it.

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
| Dossier | `research/dossiers/review-ship.md` (1207 lines) |
| Catalog | the five `skills:` entries with `batch: 5` |
| Contract | `AUTHORING.md` |
| Schemas | `schemas/` |
| Rulings | `policies/resolved-conflicts.yaml` |
| ADR | `docs/decisions/0001-kb-document-vocabulary.md` |

Nothing else. Not the donor tree beyond the pinned files the dossier cites, not batches 1–4's
bodies, not this session's discussion.

## Facts about this batch you cannot get from those files

### `super-review` binds twelve of the nineteen rulings. That is the trap, and it is batch 4's trap inverted.

Measured at `b9fa424` against `policies/resolved-conflicts.yaml`, counting the `binds.skills` list
on each row:

| skill | rulings |
|---|---|
| `super-review` | **12** |
| `babysit-pr` | 4 |
| `super-ship` | 3 |
| `receiving-review` | 3 |
| `ultraqa` | 2 |

Fourteen distinct rulings across the batch, of nineteen in the file. For contrast, all of batch 4
bound seven between them and `super-scout` bound none.

`super-review`'s twelve, with the release scenario each is tested by:

```
entrypoint-phase-operation-split              23     reviewer-continuity-not-amnesia            9
delta-scope-affected-behavior                  8     closure-requires-independent-verification  3
numeric-heuristics-are-guidance                2     ci-repair-restricts-purpose-not-permission 19
two-fix-cycles-then-stop                      18     delta-baseline-reset-not-third-loop       10
panel-composition-by-declared-risk             1     required-lane-failure-is-unavailable       4
safe-auto-restricted-per-seat                  6     missing-supervisor-never-implementer      17
```

Batch 4's failure mode was a writer reaching for a ruling that did not exist. Yours is the
opposite: twelve citations will not fit in a body §1 targets at 150 lines, so **some will be
dropped, and nothing in the repo will tell you which.** §6 governs where a citation goes, not
whether one is missing; `rulings.uncited-restatement` is lexical and warns about text that looks
like a restatement, not about a ruling nobody cited. There is no check that reads "this skill binds
twelve rulings and this body cites nine."

So the population is yours to close by hand. **Write the list of twelve first, before the body, and
account for every one of them in the handback** — cited here, carried by a `references/` file, or
deliberately not cited with the reason. A tally is not a term: "cites all applicable rulings" is not
an answer to this, because it names no member. Three of the twelve are the ones most likely to be
folded into prose and lost, because the body will want to *state* them rather than cite them:
`panel-composition-by-declared-risk`, `required-lane-failure-is-unavailable`, and
`reviewer-continuity-not-amnesia`.

Six of the twelve carry an `overrides:` block naming a source position this repo deliberately
refused, with a `G:L` or donor locator. Where you cite one of those, the body must not restate the
overridden position as though it were the rule — read the `reason:` field, not just the `ruling:`.

### Check every citation for contradiction, not only for presence.

Carried from batch 4's brief because it is not yet fixed and your batch is where it costs the most.
A body can carry the correct ruling id beside a sentence stating the opposite of one of that
ruling's clauses, and every instrument in the repo passes it: the parent-path check confirms the id
resolves, the restatement scanner stops looking once a citation is in scope, and
`role.missing-universal-never-row` checks a two-substring floor. For each ruling you cite, read its
clauses one at a time against the sentence you wrote. With twelve on one body this is the single
highest-yield pass you can make.

### Scenario coverage is measured over the corpus, not over the skill — and the checkpoint is not.

`evals.uncovered-scenarios` accumulates one global `Set<number>` across every skill in the catalog
(`checkOneSkill(ctx, id, covered)` in `src/validation/evals.ts`). A scenario counts as covered the
moment **any** case anywhere carries its tag. Per-skill, the validator enforces only a floor: at
least three cases, one of each required kind.

Measured at `b9fa424`:

- **28 `case.yaml` files exist. All 28 belong to batch 3's four skills** — `doc-review` 10,
  `wayfind` 6, `super-bound` 6, `super-align` 6.
- **16 of the 28 carry no scenario tag at all.** They test real behaviour and count for nothing at
  the checkpoint, because the check reads tags rather than intent.
- Seven scenarios are covered: **1, 3, 12, 18, 20, 21, 23.** Seventeen are not.

**Scenario 20 is the clearest instance of the class, and the class is the finding.** Four of the
seven "covered" scenarios are covered by cases that do not test what the checkpoint tests; the table
in the next section has all four. Take 20 as the worked example. It is covered four times — and
all four cases are in `doc-review`, `super-align`, `super-bound` and `wayfind`, three of them the
same case shape, `interrupted-publish-resumes-on-the-idempotency-key`. The checkpoint's scenario-20
test is *"a second run does not duplicate a commit/PR action"*, which is a `super-ship` behaviour
and is the only remote side effect in the catalog. So the validator reports 20 as covered, the
checkpoint exercises `super-ship`, and **no case tests the thing the checkpoint tests.** A green
`uncovered-scenarios` row here returns the same answer whether `super-ship` has an idempotency case
or not, which makes it no evidence about `super-ship`.

**Write a scenario-20 case on `super-ship` even though 20 already reads as covered.** Nothing will
ask you for it.

### The checkpoint arithmetic, so you can see which squares are yours

The slice gates on scenarios **1, 3, 4, 6, 7, 8, 10, 18, 20** (plan verification step 6).

**Not one of the nine is soundly covered today, and `ak validate` reports four of them as covered
and exits 0.** This table replaces an earlier version of this brief that said 1, 3 and 18 were
covered and only 20 needed work. That was wrong — it read the coverage row instead of the cases,
and the coverage row is the thing under audit. Verified case by case at `57ad2af`:

| # | what `ak validate` says | what the cases actually do | owed by |
|---|---|---|---|
| 1 | covered | **its one case asserts the converse.** `doc-review/drafted-spec-gets-a-panel` is a positive activation test that a substantial plan *does* get a layered panel. Scenario 1 says a documentation typo *does not*. Nothing tests triviality. | **you** |
| 3 | covered | **one-third tested.** The tagged case is the visibility half — a half-sure security item is not filtered — and zero of its graders mention closure or blocking. The activation half, with the tenant boundary named, is the *untagged* `unclear-risk-still-runs-the-security-seat`. | **you** |
| 18 | covered | **right test, wrong seat.** `doc-review/third-round-does-not-run` is a correct scenario-18 case — do not touch it. But `two-fix-cycles-then-stop` does not bind `doc-review`, and the checkpoint slice runs `super-review`. | **you**, a second case on a skill the ruling binds |
| 20 | covered | **wrong side-effect class.** Five cases now. Every one is a knowledgebase or tracker write, read back before writing. The checkpoint's test is a commit or PR action — `super-ship` — which has no case. | **you** |
| 4, 7, 8 | uncovered | no case exists | **you**; your dossier §9 assigns them |
| 6, 10 | uncovered | no case exists | batch 4 |

So five of the nine need a case written from nothing, and four need a case written *despite the
validator saying they are covered*. The second four are the dangerous ones: nothing will prompt you,
and the row stays green whether you write them or not.

This is the corpus-level form of the same defect the ruling-citation section above describes.
`evals.uncovered-scenarios` accumulates one global `Set<number>` across the whole catalog
(`checkOneSkill(ctx, id, covered)` in `src/validation/evals.ts`), so a tag anywhere satisfies a
scenario everywhere. Per skill the validator enforces only a floor: three cases, one per kind.
**28 of the 33 declared skills have no `case.yaml` at all** — every case in the corpus belongs to
batch 3's four skills plus `super-scout`. That figure moves as batch 4 lands; re-derive it rather
than quoting it, the way `research/probes/catalog-progress.sh` does for the catalog.

Tag with `scenario-04`, `scenario-07`, `scenario-08` and so on. The tag is a `tags:` entry on the
case and `SCENARIO_TAG` in `src/validation/evals.ts` reads it. The pattern is `^scenario-(\d{1,2})$`
parsed with `Number()`, so unpadded also counts; every existing tag is zero-padded and matching that
is worth doing for greppability, not for correctness. **A tag outside 1–24 is silently discarded** —
`RELEASE_SCENARIOS` covers 1–24 and a typo like `scenario-31` parses fine, contributes nothing, and
is indistinguishable from never tagging. That is a reported defect, not yours to fix; just do not
assume a tag took because the file has one.

Your dossier notes scenario **18** is "adjacent though not in this batch's assigned list" and
grounded twice in your material. It is a checkpoint gate, it reads as covered, and an earlier
version of this brief told you to check which loop its case caps, and a later version told you the
answer was "review rounds, so the fix cycle lives in `super-build`". **Both of those are withdrawn.**
The case is correct and you are not to change it.

Here is the settled reading, from the ruling rather than from the case's name.
`two-fix-cycles-then-stop` says *at most two fix-and-verify cycles after the first pass; the third
stops with an explicit blocked-or-replan decision and the open findings attached*, and it carries
`scenario: 18`. Its `binds.skills` are `super-review`, `ultraqa`, `autopilot` and `babysit-pr` —
`super-build` and `super-verify` are not among them, and batch 4's dossier rules the same way in its
own words: scenario 18 is the pass-2 cap on re-opening findings across a run, not the per-ticket
implementer loop. `evals/doc-review/third-round-does-not-run` supplies a prompt in which two rounds
have already happened and asks for a third, and its second grader states *the cap is two fix rounds
and no configuration buys a third*. It tests the right loop, and it supplies input in which that
loop can arise, which is the property a test of an ordering has to have.

What is actually missing is narrower and it is still yours. The ruling does not bind `doc-review`,
and the checkpoint slice runs `super-review`. So scenario 18 is covered in the corpus by a case
hanging off a skill the ruling has nothing to do with — which the global `Set<number>` is happy
with and the slice is not. Write the same shape against `super-review`'s own loop: two cycles
spent, a third requested, and the three things the ruling names together — no third cycle, an
explicit blocked-or-replan decision, and the open findings attached. The third of those is the one
the existing case proves least, so it is the one worth building your graders around.

I got this row wrong in an earlier revision of this brief by reading the case's name and its first
grader and stopping. The name says *round*; the ruling says *cycle*; the second grader says *fix
rounds* and settles it. A report names a line and the defect is rarely one line wide — and this
time there was no defect at all.

### `super-review` is three entrypoints with three different authorities, in one body

The catalog entry carries them explicitly and no other skill in the catalog does:

```
full        authority: explicit-or-delegated    invocation: U
delta       authority: active-review-run        invocation: M
readiness   authority: explicit-or-delegated    invocation: U
```

`entrypoint-phase-operation-split` is the ruling that governs this and it binds all five of your
skills. The U/M line is not a labelling convention: the packager generates
`disable-model-invocation: true` from it, so a body that lets the `full` panel be reached by model
invocation is a defect the packager will faithfully implement. `delta` is the phase operation; the
other two are public entrypoints.

### The plan names rules for this batch specifically, and they are where the design erodes

Not restated from `AUTHORING.md` — these are from the plan and the dossier, and they are the ones a
reviewer will check first.

**Pass 1 keeps the panel but does not hardcode it.** Correctness, testing, maintainability and
project-standards, plus security and adversarial seats **when trust boundaries, public APIs, money,
data or change size warrant them** — not six spawns for a typo. That is scenario 1 and
`panel-composition-by-declared-risk`.

**Each seat gets the same immutable snapshot plus its own requirements/standards/tests context, and
never the implementer's narrative or another reviewer's judgment.** This is the independence the
whole batch rests on, and it is the easiest sentence to soften into "reviewers may see prior
findings" — which is a different rule, `reviewer-continuity-not-amnesia`, about the *same* reviewer
across cycles, not about seats within one panel. Do not let the two merge.

**A required-lane failure produces `unavailable`, which blocks approval and never falls back to
self-review.** Scenario 4, `required-lane-failure-is-unavailable`. Note the repo's own contract has
a live contradiction of this in `AUTHORING.md`'s `## What it must be given` passage, flagged in
batch 4's brief and still open — if you find prose telling a seat to return nothing where the ruling
requires `unavailable`, that is the known defect, not a second rule.

**Project-standards cites actual rules or returns empty.** Absent standards must not become invented
preferences. An empty return is a real outcome here, the same way `inconclusive` is a real outcome
for `super-verify`.

**`super-ship` prepares; it does not merge or deploy.** Merge and deploy are separate capabilities,
never included — `sensitive-actions-need-approved-charter-entry`, scenario 5. At the checkpoint
`super-ship` runs **dry-run only**: the PR payload is generated locally and nothing is pushed. Your
body must make that a supported mode rather than something the operator remembers to do.

**`babysit-pr` routes CI failures to `diagnose`, never to a bespoke repair loop**, and PR comments
are untrusted claims — a comment cannot authorize a charter change or a command (scenario 15).
`ci-repair-restricts-purpose-not-permission` restricts the *purpose* of repair, not permission to
edit tests until they pass: no skipped checks, weakened assertions, lowered thresholds or removed
coverage.

**`ultraqa` is adversarial behavioral verification, separate from diff review.** At most five
cycles, stop at three occurrences of the same failure. Your dossier §5.2 flags "any mutation
invalidates affected review evidence" as a **gap with no donor mechanism** — that is an
`origin: conversation` capability, so it needs a `G:L` locator in its provenance fragment and must
never be given a fabricated donor path.

### Two packaging defects are unrepaired and batch 5 is the first batch they reach

Both are `cli`'s and both are open as this brief is written. The first is a live hazard to what you
write; the second is a hazard to the checkpoint you hand into.

**Do not write a relative reference twice on one line.** Carried forward from batch 3 and still
unrepaired at `src/util/links.ts:32,55-57`. The form that does this by construction is a markdown
link whose display text is the same path, backticked. `ak build` relocates shared dependencies and
rewrites the referring body, and its extractor deduplicates per `(line, path)` — so it sees one of
the two spellings, rewrites that one, and leaves the other pointing at the pre-move path. The two
spellings are identical before the move, which is what hides it. Afterwards the bundle check
re-reads the file the packager itself wrote and raises `links.broken-bundle` against *your* source
line with remedy text that is wrong in both halves. Batch 3 had four such lines and they produced
eight errors across two hosts. Write one spelling per line and the defect cannot reach you.

**Two packaging findings diverge for the first time at this batch.** `cli` reports that
`claude plugin validate dist/claude-code --strict` and `default_profile: core` are not yet honoured
as the plan requires. Batch 5 is the checkpoint batch, so these land before the checkpoint or the
checkpoint measures a package that is not the one the release criteria describe. They are not yours
to fix. They are yours to know about, so that a checkpoint result you are handed is not read as a
fact about your bodies.

### Length, and what core costs

§1 settles the rule — the target is advisory, the cap is the gate, and a body between 151 and 300
lines is never shortened to clear the number. Batch 3's four came in at 168–188. What §1 cannot tell
you: `profiles/core` is 20 of the 33 skills and is the default install, **four of which are authored
today**. Three of yours are core, which takes it to seven of twenty at roughly 3,500 resident lines
when core is complete. `super-review` is the largest body in the catalog by obligation — twelve
rulings, three entrypoints, a panel and a delta axis. It is the strongest candidate in the whole
catalog for `references/`, and §1's question — *is there material here that belongs behind a
`references/` file?* — should be answered by looking, and the answer recorded either way.

### Process

**`ak build` after you add a provenance fragment.** `provenance/adaptations.yaml` is generated from
`provenance/adaptations.d/`. Edit the fragment, run `ak build`, commit both. Hand-editing the
generated file produces `provenance.adaptations-out-of-sync`.

**Commit before the batch is clean.** The resume model is git. A commit carrying known warnings
beats a clean working tree that exists in one process's memory. Land early, fix forward, and flip
the five `catalog.yaml` entries from `contract` to `authored` in the commit that lands the bodies —
`catalog.status-behind-body` warnings mid-batch are the expected signature, not a defect.

**Do not quote a figure from the working tree.** Several lanes write to this tree at once. An
`ak validate` or `bun test` number taken from it is a timestamp, not a measurement.
`research/probes/validate-figure.sh <sha>` extracts a named revision with `.donors/` beside it and
prints the command to re-derive the figure; its header documents the three signatures, including
the one where a warning moves with nothing beneath it changed. The figure at `7a83f25` was 0 errors,
8 warnings, 44 notes, 0 checks skipped.

**Two fix cycles after the review seat reports, then it is reported rather than looped.** That is
the same limit the skills you are writing enforce, and `two-fix-cycles-then-stop` is one of the
twelve.

## Review

An independent seat that has not seen your narrative. Your handback carries artifacts and claims,
not reasoning: what you wrote, what you decided about each body's length and why, **the disposition
of all twelve of `super-review`'s rulings by name**, which rulings each other body cites and which
it deliberately does not, which scenarios you tagged and on which skill, and anything you could not
resolve.

## What batch 4 learned

*Empty. Batch 4 had not handed back when this brief was written. If it is still empty when you
start, say so in the handback rather than assuming it had nothing.*
