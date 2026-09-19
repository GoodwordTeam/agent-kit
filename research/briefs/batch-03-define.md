# Batch 3 brief — define

Four skill bodies — `super-align` (U), `super-bound` (U), `wayfind` (U), `doc-review` (M) — and
two reference packs, `references/codebase-design` and `references/domain-modeling`.

**The two reference packs are in this batch after all.** `references/codebase-design` and
`references/domain-modeling` were held on an open `CONTRACT-DEFECTS.md` entry, because §12 governed
three body shapes and a reference pack was none of them. That is resolved. §12.5 now governs the
shape; the ruling is in `f04a4d0` and the entry was retired at `9232ee9`. Author both packs, and
treat the dossier's `references/codebase-design` and `references/domain-modeling` sections as
commissioned.

## What governs this batch

`AUTHORING.md` governs. §1–§11 govern skill bodies; §10 governs the process you are working under;
§11 governs the handback. This brief reproduces none of it, and where this brief and `AUTHORING.md`
appear to disagree, `AUTHORING.md` wins and the disagreement is a defect in this brief — report it
rather than reconciling it yourself.

That rule is not decorative. Batch 1's brief restated a heading name that the contract had moved,
and the writer, correctly following the more specific instruction, carried the wrong heading into
seven files. The writer was not at fault. Briefs restate nothing for that reason.

## Your inputs

| | |
|---|---|
| Dossier | `research/dossiers/define.md` |
| Catalog | the four `skills:` entries and the two `references:` entries with `batch: 3` |
| Contract | `AUTHORING.md` |
| Schemas | `schemas/` |
| Rulings | `policies/resolved-conflicts.yaml` |
| ADR | `docs/decisions/0001-kb-document-vocabulary.md` |

Nothing else. Not the donor tree beyond the pinned files the dossier cites, not batch 1's or
batch 2's bodies, not this session's discussion.

## Facts about this batch you cannot get from those files

**You are the first writer to author a skill.** Batches 1 and 2 produced protocols and roles, which
§12 governs and for which §12.4 replaces §11's checklist entirely. §3's required section list, §4's
frontmatter law, §4.1 and §4.2, §9's eval obligation and §11's handback have never been exercised by
anyone. There is **no worked example of a skill in this tree**, and the thirty-six bodies that are
here are the wrong shape. Batch 2's brief could point at batch 1 as a reviewed example of form;
this one cannot, and that difference is the single most important line in this brief. Where a
protocol or a role suggests a shape, ignore it and read §3.

**You are also the first writer to author a reference pack.** §12.5 was written after the sections
around it, in response to the defect that held these two packs, and **nothing has been authored
against it** — it has no worked example for the same reason §3 has none. Read it rather than
reasoning from the packs' neighbours: a reference pack takes no frontmatter and no `*.yaml`
sidecar, §9's eval obligation does not reach it, §1's numbers do not apply to it, and its handback
is §12.4's checklist with the two role-specific bullets skipped — not §11's. §12.5 states each of
those directly, so none of it is this brief's word against the contract's.

**§12.5 says there is no required section list, and that sentence is the one most likely to be
undone by this batch specifically.** It also forbids inferring a heading set from a sibling pack,
and it was written expecting the sibling to arrive in a later batch, authored by someone else. It
does not: you author both. So the trap is inside your own handback — writing `codebase-design`,
then giving `domain-modeling` the same headings because they are now the house style, manufactures
in one batch exactly the convention §12.5 declined to create, and it will read as consistency to a
reviewer. Organise each pack for the skills in its `loaded_by`, and if the two land on the same
shape, let that be because the material did, and say so in the handback.

**`codebase-design` has a consumer you are not writing.** Its `loaded_by` is `[super-align,
improve-architecture]`, and `improve-architecture` is batch 9 and does not exist. A pack written as
super-align's appendix will have to be rewritten when its second consumer arrives. `domain-modeling`
does not have this problem — both its consumers, `super-align` and `super-bound`, are yours. Write
`codebase-design` from the dossier's material and check it against super-align, rather than deriving
it from super-align and checking it against the dossier; those two orders produce different packs
and only the first survives batch 9.

**Eval cases ship with this batch.** The plan's batch table lists this batch as skills and
references and never mentions cases; that is a silence in the table, not permission. §9 requires
three kinds and §11's handback requires them to exist. I probed the gate against a clean extract of
`1e32a9a` before writing this, so the numbers are measured rather than assumed: a skill declaring
three cases with no `evals/` tree produces three blocking `evals.declaration-without-case` errors,
and a skill declaring none produces `evals.too-few-cases` plus three `evals.missing-case-kind`.
**There is no value of `tests[]` that lands clean without the case files.** The reachable end state
was probed too, because a gate nothing can satisfy would be a different finding and this brief asks
you to satisfy it: three declared cases with three matching `evals/<skill-id>/<case-id>/case.yaml`
files clears every eval error, leaving only the informational note that the corpus does not yet
cover all twenty-four release scenarios — which is a Phase 5 criterion across the catalog, not
something this batch can or should close. `evals/` does not exist yet; you are creating it.
The dossier's "Eval design" section already designs the behaviors per skill, including the
non-trigger neighbours and the pressure cases — work from it.

**Two of your four skills are U, which makes the invocation law load-bearing for the first time.**
`super-align` and `super-bound` are both user-invoked. Batch 1 authored `protocols/phase-operations`
and `protocols/invocation-authority.md` for exactly this situation. If one must reach the other,
that is the entrypoint / phase-operation split and not a call; the dossier's own header for item 4
records the legal direction (`doc-review` is M, called by `super-bound`).

**`doc-review` depends on seven bodies that are under review right now.** The `roles/doc-review/`
seats are `status: contract` and `batch2-reviewer` is running against them. Reference them by
catalog id; do not reproduce their content, and do not assume their wording is final. If your body
needs a guarantee one of those seats makes, cite the seat, do not restate the guarantee.

**ADR-0001 binds `super-align`'s hard gate.** The transcript specifies `CONTEXT.md` and
`docs/solutions/` as app-local; the architecture document centralises them. The ADR is the
resolution and it is the one your body follows. This is the one input on the list that is neither
contract nor dossier, and it exists because the two design sources disagree.

## Which bodies must link which packs, and the one path spelling that decides it

Nothing in this tree references `references/` today: not one of the thirty-six bodies, and not the
loose doctrine file either. Zero mentions. This batch writes the first ones, so the conventions
below have no precedent to copy, and getting them wrong fails in two opposite directions — one of
which passes validation.

Three links must exist when you hand this batch back:

| From | To |
|---|---|
| `super-align` | `references/codebase-design/REFERENCE.md` |
| `super-align` | `references/domain-modeling/REFERENCE.md` |
| `super-bound` | `references/domain-modeling/REFERENCE.md` |

That is `catalog.yaml`'s `loaded_by` read in the only direction that makes it mean anything. A pack
whose declared loader never loads it is a pack nobody reaches, and `loaded_by` is §12.5's *defining*
property of the shape — so an unlinked pack is not a missing nicety, it is a reference pack that
isn't one.

**Do not expect the validator to tell you when a link is missing.** `loaded_by` has always been
enforced in the direction that catches a pack naming a loader that does not exist; the reciprocal —
a loader that never links its pack — is a check I have commissioned and whose state when you read
this I cannot predict. Find out by running it rather than by trusting this paragraph. Either way it
changes nothing about what you owe: write the three links because they are correct, not because
something might catch you. A rule you satisfy only when watched is one you will drop in batch 9,
when the watcher is looking somewhere else.

**The spelling decides whether a link is a link.** `src/util/links.ts` extracts two forms — a
markdown `](target)`, and a path inside backticks *that starts with `./` or `../`*. A backticked
path without that prefix is invisible to it. So:

- ``[codebase design](../../references/codebase-design/REFERENCE.md)`` — a link. Resolved, and an
  error if it does not exist.
- ``` `../../references/domain-modeling/REFERENCE.md` ``` — also a link, same treatment.
- ``` `references/domain-modeling/REFERENCE.md` ``` — **not** a link. A path-shaped sentence.

`AUTHORING.md` writes paths the third way throughout, because it is prose about the tree rather
than a body reaching into it. Your three rows above must use one of the first two.

**`doc-review` is the exception, and it is the one to get right.** Its `loaded_by` pack is
`references/prose-quality`, which is batch 6. Link it and you get `links.broken-source`, an error,
because the file does not exist yet — the batch cannot pass. Omit it entirely and the batch passes
while the connection quietly does not exist. Neither is acceptable, so take the third spelling
deliberately: name `references/prose-quality/REFERENCE.md` in backticks, without a dot prefix, in
the body section where its material would be loaded, and say in that sentence that the pack arrives
in batch 6. It is not a link, so nothing breaks; it is a named anchor, so batch 6 has something to
find and convert. Do not invent the pack's contents or headings to fill the gap — you have no
dossier for it and it is not yours to write.

This is the only forward reference in the batch. `codebase-design`'s second consumer,
`improve-architecture`, is batch 9 and runs the other way: the pack exists and the consumer does
not, which needs nothing from you beyond what the paragraph above already says.

## The three failure modes I expect, named so you can report them rather than absorb them

**Writing a skill like a role.** Thirty-six bodies in this tree, none of them a skill. Pattern-matching
on them will produce something that reads as finished and satisfies none of §3. The tell is a body
that judges rather than acts, or one that has `## Not this seat` where §3 wants `## Not for`.

**Eval cases written to pass.** An adversarial case that supplies a reason the skill would obviously
reject is a positive case wearing a different `kind`. §9 asks whether the gate holds under pressure,
so the case has to supply pressure a reasonable agent might yield to — the dossier's entries under
"Behaviors worth testing, per skill" are built that way, and *"whatever you think is best"* as an
attempted approval is the model to follow.
If you cannot construct real pressure against one of your gates, that is a finding about the gate.

**A hard gate whose anti-rationalization rows are invented.** §3.1 governs the table and the dossier
supplies recorded failures. A row you reasoned your way to, rather than found, is worse than a
shorter table — and this batch's gates are the ones most likely to tempt it, because an alignment
skill's failure modes are conversational and easy to imagine.

## Review

§10 governs the review — who the reviewer is, what it is given, what it must record, and what
happens when the cycle limit is reached. Read it there. This brief states none of it.

The previous batch's brief explains at length why it restates nothing of §10, having watched a
four-line summary narrow the section three times. That reasoning applies here unchanged and is not
reproduced. One thing about it is worth carrying forward as a live warning rather than history: the
clauses a summary drops are the ones a reader would not have supplied unprompted, which is precisely
the set that exists to constrain you.

Apply the same suspicion to your own bodies. §3's section list will tempt you to fold two required
sections into one where the content feels adjacent, and the fold will read as complete.
