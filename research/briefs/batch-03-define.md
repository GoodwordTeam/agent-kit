# Batch 3 brief — define

Four skill bodies: `super-align` (U), `super-bound` (U), `wayfind` (U), `doc-review` (M).

**The two reference packs are not in this batch.** `references/codebase-design` and
`references/domain-modeling` are held on an open `CONTRACT-DEFECTS.md` entry — §12 enumerates three
body shapes and a reference pack is none of them, so nothing in the contract governs one. Do not
author them, and do not treat the dossier's §5 and §6 as commissioned. They will be dispatched
separately once the contract owner rules.

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
| Catalog | the four `skills:` entries with `batch: 3` |
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
something this batch can or should close. `evals/` does not exist yet; you are creating it. Dossier §10 already designs the behaviors per skill, including the
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

## The three failure modes I expect, named so you can report them rather than absorb them

**Writing a skill like a role.** Thirty-six bodies in this tree, none of them a skill. Pattern-matching
on them will produce something that reads as finished and satisfies none of §3. The tell is a body
that judges rather than acts, or one that has `## Not this seat` where §3 wants `## Not for`.

**Eval cases written to pass.** An adversarial case that supplies a reason the skill would obviously
reject is a positive case wearing a different `kind`. §9 asks whether the gate holds under pressure,
so the case has to supply pressure a reasonable agent might yield to — dossier §10.1's entries are
built that way, and *"whatever you think is best"* as an attempted approval is the model to follow.
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
