# Carried forward — obligations that must reach a later batch

Written because the obligations below existed only in messages and in the team lead's context,
which is the same defect found in §12.2 on 2026-09-19: a durable obligation recorded in a handback
leaves no trace in the tracked tree, so a resolved obligation and a forgotten one are
indistinguishable to anyone reading the repo. `.omc/` is gitignored and no handback has ever been
committed. This file is tracked; that is the whole point of it.

**How to use it.** Each entry names the batch that must carry it and the reason it cannot be
re-derived from the contract. When a brief is written for one of these batches, the entry is copied
into that brief and **deleted here in the same commit**. An entry left standing after its batch has
landed is a defect, not a record — the same retirement discipline `d664d00` applied to §10's
disclosure paragraphs.

---

## Batch 3 — in flight

Nothing carried. `research/briefs/batch-03-define.md` is complete and the writer is running against
it.

## Batch 5 — review-ship

**§6.2 is an input to this brief, not background.** Two rows of
`provenance/conversation-map.yaml` settle here rather than earlier, and the brief must say so
explicitly or the writer will treat them as already dispositioned. Confirmed with `provmap`.

**The implementer-approval-context sentence is flagged "ruled elsewhere."** The brief must carry the
flag so the writer does not re-derive the ruling or, worse, restate it in narrower terms — the
failure mode that produced F-1 and F-2 in batch 2.

**The batch-5 checkpoint gates on arch §10 scenarios 1, 3, 4, 6, 7, 8, 10, 18, 20.** Scenarios **7
and 20 have no ruling** in `policies/resolved-conflicts.yaml`. That is a gap to close before the
checkpoint runs, not at it: a checkpoint gating on a scenario with no ruling has nothing to check the
behaviour against.

**`super-ship` is dry-run only at the checkpoint.** The PR payload is generated locally and nothing
is pushed. This is a constraint from the implementation plan, not a suggestion.

**Three verification rules belong in this brief, and they are one family.** Each was found by an
agent being wrong about their own instrument, which is why they are worth stating rather than
assuming:

- **The population check.** Name the population the check owns, then verify every member reaches a
  term in the output. Replaces the counterfactual form, which requires naming the hypothesis — and
  the hypothesis that catches you is the one you did not think of. In `AUTHORING.md` §8 as of
  `9e8ca8e`. Predicts where to look: any check whose output is a tally rather than a list.
- **Reporting on the tree versus reporting on itself.** A gap in the tree is a fact the probe
  reports, and whether to gate on it is a per-probe call. A source the probe can no longer read is a
  fact about the probe, and every number underneath it is worthless — that exits non-zero
  unconditionally, in any probe, whatever its reporting half does.
- **The clause narrower than its rule.** Three separate findings in batch 2 were one defect: a
  clause whose population is narrower than the rule it cites, surviving because the narrower clause
  is the one a reader supplies unprompted. The instruction that generalises is not "check the
  citations" but "name the population the cited rule owns, then check the citing sentence reaches
  every member."

**A clean validate is evidence about the instruments, not about the tree.** The 29-body row-2 sweep
changed no `ak validate` output at all — 0 errors, 4 warnings, 49 notes before and after — because
nothing enforced §12.2's mandated rows. A handback saying a check came back clean owes a second
sentence saying what that check could not have seen. §8 requires this as of `9e8ca8e`.

## Batch 6 — packs and references

**Three retroactive edits land with this batch**, each touching a body authored in an earlier,
now-closed batch:

| Body | Authored in |
|---|---|
| `super-build` | batch 4 |
| `super-review` | batch 5 |
| `doc-review` | batch 3 |

These are cross-batch edits, which §12.2's backward-reach paragraph normally routes to the earlier
batch's fix cycle. Batches 3, 4 and 5 will be closed and out of cycles by then, so the routing the
paragraph specifies will not exist. Decide the mechanism when the brief is written; do not let the
writer improvise it.

**`references/prose-quality` arrives in this batch** and batch 3's `doc-review` names it as a
backticked path with no `./` prefix — deliberately not a link, so it does not break while the pack is
absent. Batch 6 converts it to a real link. See `research/briefs/batch-03-define.md` for why that
spelling was chosen; `src/util/links.ts` is what makes the distinction real.

**`v0.1.0` is tagged at the end of this batch.** The plan's "useful first operational release" is
reached here.

## Unrouted — reaches backwards into a closed batch

**`doc-review/feasibility` / `plan-review/architect`** is an unresolved candidate pair in §12.2's
table. Both seats are `status: authored`; `plan-review/architect` was authored in batch 1, which is
closed and out of fix cycles. §12.2 says leaving a candidate unresolved is not an option and routes
backward-reaching pairs to the earlier batch's fix cycle — a cycle that no longer exists. Routed to
`authoring` as a contract-level question on 2026-09-19; it has no owner until that is answered.

The sibling pair, `doc-review/design-lens` / `code-review/frontend-races`, is entirely within batch 2
and is in that batch's cycle-2 fix.

## Open commissions — lanes holding work that is not in any batch

Recorded because a commission that lives only in a message has exactly the defect this file exists
to fix: an issued one and a completed one are indistinguishable to anyone reading the repo. Each
entry is deleted when its lane reports and the result lands.

**The §8 sweep of `AUTHORING.md`'s behaviour-specifying sections — `sweep-reviewer`.** §8 requires
naming the population a check owns, then verifying every member reaches a term in the output.
`authoring` applied it to §9, found §9 understating its own gate, fixed it at `d5b8c9c`, and asked
that the remaining sections be swept **by someone other than them** — §8 is theirs and they had
twice found what they were primed to find. Deriving the population is the first half of the job;
the twelve section headings are not it. The defect shape is a section whose prose describes a
weaker obligation than what it governs actually enforces, which reads as conservative rather than
wrong and so is never audited for. Reports to the lead; `authoring` owns the edits.

**The phantom-reference sweep — `personas`.** Both known instances are already handled: `arch §`
fixed at `5d5e1dc`, `scratchpad/gen.ts` disclosed in place at `tests/fixtures/restatement-cases.ts`.
Neither was found by looking; both were tripped over, and the population was never enumerated, so
"no known instances" describes what we happened to hit rather than the tree. The interesting cell
is a reference both invisible to `src/util/links.ts` (backticked, no `./` prefix) **and**
non-existent — neither the link check nor a grep covers it, and both known instances lived there.
Three buckets, not two: broken, disclosed-but-unfixed, and right-by-accident. The third is green
today, which is why nothing finds it.

**The construct census beyond `policies/` — `policies`, authorized.** Stays with the lane that
built the instrument; a second lane re-deriving the method would yield two censuses agreeing for
reasons neither could state.

**Block-sequence `rulings:` must leave its current state — `policies` + `cli`.** Zero instances at
every depth, still supported, and both tests that exercised it were written in that form and both
were broken. Every green run proves the fixture agrees with the parser, which a fixture written
against the parser does by construction. Two exits: produce a real instance (better, if a document
genuinely wants the form) or drop support so it fails loudly instead of misparsing. **A third
synthetic fixture is not an exit** — it adds no information about whether the parser is right.

**Falsifying the mandated-rows gate — `sweep-reviewer`, queued behind the §8 sweep.** First case is
a body whose row is correct in words but rewrapped.

## Needs an owner — not yet commissioned

**`scratchpad/gen.ts` was never committed.** `tests/fixtures/restatement-cases.ts` says to
regenerate against a revision and commit the diff; that instruction cannot be followed. The header
discloses this honestly and states what remains reproducible without the generator, so this is a
debt rather than a defect. Whoever restores it inherits one specific obligation the header names:
`invocation-lesson-publish-ship-clause` was **re-scored by hand** when YAML citation scope narrowed
from the file to the mapping, by running the same scan the generator would have run. That one
number is to be verified, not trusted.

**Where handbacks and review records live.** Open with `authoring`. `AUTHORING.md` says "handback"
ten times; six assign a durable obligation (§10:912, §12.2:1170, §12.2:1183, §12.2:1207, §12.4:979,
§12.5:1369); **none of the ten names a path, directory or filename.** `research/reviews/` exists as
of `7683fd9` but was created to correct one false commit message and is explicitly **not** a ruling
on the general question — do not cite it as precedent while the question is still with `authoring`.

## Standing traps — not batch-scoped

**`plan` and `arch` are two spellings of one document.** The architecture document is
`research/sources/engineering-skills-repo-plan.md`, 676 lines, registered in
`provenance/upstream.lock.yaml` as local source id `plan` and anchored by digest. The locator
grammar accepts both `plan §N` (255 rows use it) and `arch §N` (no row uses it). The file's
`-repo-plan` suffix is why two names grew for one file.

The *implementation* plan is a third document, is not in this tree, and `plan §N` does not mean it.
`policies/resolved-conflicts.yaml` uses `plan:` for the architecture document's sections, so reading
`plan` as the implementation plan misreads 255 rows.

**Nothing enforced §12.2's mandated verbatim rows** until the gate commissioned on 2026-09-19. The
narrowed row survived in 29 bodies from `ed81a69` through a writer, two reviewers and every
instrument in `src/`. If that gate is not in the tree when a later batch authors a role body, the
same failure is available again.

**`git log --author` cannot distinguish the lanes.** Every commit carries one identity. Authorship
lives in the commit message and the paths touched, both writer-controlled and neither checked; git
here records custody and nothing else. Anything routed by author silently returns the whole team.
