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
