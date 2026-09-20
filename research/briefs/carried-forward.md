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

**Two practices belong in this brief, not in `AUTHORING.md`** — both govern how lanes talk to each
other rather than how bodies are written.

*A correction you send to a teammate is checked by rebuilding the measurement, not by re-reading what
you sent.* Re-reading finds a claim consistent with itself, because it was consistent when written —
the same instrument under both hypotheses, pointed at your own output. Re-deriving runs a different
instrument against the world. Proposed by `provmap` after they caught and retracted their own
incorrect correction of another lane.

*Sweep for the figure; do not repair the surface you were handed.* The transcript line count was
reported wrong on one surface. Sweeping for it found two more, one of which was **enforcing**:
`schemas/common.schema.json` `$defs.g_locator` ended `226[0-4]`, rejecting `G:L2265` — the
transcript's last line — while the description beside it stated the bound as `1..2264`. A wrong rule
plus wrong documentation of that rule is one defect with its own alibi: every instrument a confused
author reaches for confirms the error, and they renumber a correct citation down to fit. Latent, like
the `arch` trap, and the same shape — a rule that has never fired, waiting for the first person to do
the correct thing.

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

**Make `tsc --noEmit` a gate at this boundary, with the `v0.1.0` tag** — not before. Deliberately
not inside a batch: measured 2026-09-19, `bunx tsc --noEmit` exits **1** with **30 errors, all
`TS7006` in a single untracked `tests/sideeffects.test.ts`** belonging to a lane mid-flight. That is
the attribution problem the timing rule exists for, observed rather than predicted. **Pinning is a
separate question and is not deferred** — see the open commission.

Until it gates, the standing rule is that an invariant expressed as a type must also have a test,
because the two instruments are blind in complementary directions on the same fact.
`DOCUMENT_REFERENCE` is a runtime regex and `DocumentKeyword` is a declaration — one fact on two
surfaces with no link between them:

| mutation | `tsc --noEmit` | the runtime test |
|---|---|---|
| widen the regex, leave the type | exit 0 — blind | 2 fail |
| widen the type, leave the regex | exit 1, TS2741 | 0 fail — blind |

Neither instrument substitutes for the other, and a fact carried on two unlinked surfaces is §5's
rule appearing inside `src/`.

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

**The §8 sweep — `sweep-reviewer`, four findings edited and landed, three members still owed.**
Findings 1–4 are discharged and verified at `82b663f`: §12.2's doubled "verbatim" and the live
`BUDGETED` gate described as hypothetical, both at `2e3b091` — "hypothetical" now occurs zero times
in the file; §11's six hand-checks at `1b28463`; and §1, which owned the length rule while naming no
symbol, now names `budget.skill-over-target` and `budget.skill-over-cap` at its first statement of
it. **§10's register half, §12.1 and §12.5 are declared-not-cleared** — the sweep is not discharged
until they are reached, and reporting them unaudited rather than implying a clean population is the
reason the rest of the result can be trusted.

An expectation of mine was falsified in the process and the correction matters more than the finding:
I said a section overstating its enforcement gets caught the first time someone relies on it. It does
not. **Overstatement is caught when reliance fails, and reliance on an over-strong claim fails
silently, because the gate still passes.** §12.2's "verbatim" was relied on from `ed81a69` by a
writer, two reviewers and me, and caught by none of us.

**Original commission, for the record —** §8 requires
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

**§12's "returns nothing" contradicts the ruling it routes into — `authoring`, reported at
`82b663f`.** The `## What it must be given` passage says a seat whose input no longer binds "returns
nothing rather than judging a stale artifact". `required-lane-failure-is-unavailable` says a lane
that could not be given its required context returns `unavailable`, which "is a result, not an
absence" and "is never downgraded to an empty result" — and §12's own table defines the heading that
sentence routes into as the conditions under which *empty* is the correct answer. Measured across
all 29 tracked role bodies: 26 return `unavailable` in that section, **0** say "returns nothing",
and the three core roles each carry their own blocking vocabulary, `supervisor/ROLE.md:84` using
§12's identical phrase "no longer binds" and returning no choice. The bodies are right without the
contract's help; the contract governs whoever writes the thirtieth.

Nothing in the repo could have found it. `UNIVERSAL_NEVER_ROWS` row 2 is
`["lane that could not run", "unavailable"]`, so the violated clause is one of the three the gate
does not check — the same three `authoring`'s own disclosure paragraph names, about fifty lines
below the violation. One omission on two surfaces, which is why neither corrects the other.
**The cheap fix is the one that hides it:** adding the ruling id to that sentence yields a sentence
citing the rule it breaks, after which every citation check in the repo passes.
`rulings.uncited-restatement` warns that a claim *narrower* than its ruling is the defect rather
than the citation — a claim that contradicts its ruling is a second case, and the message names
only the first.

**Pin `typescript` in `devDependencies` — `cli`, now, not at batch 6.** `bunx` resolves from the
network, so every "tsc clean" anyone has reported is a claim about whatever `bunx` fetched that
minute, not about a pinned tool. Pinning changes no behaviour and defers nothing; it makes an
existing capability reproducible.

**The two-surface inventory — `provmap`, list only, do not fix.** The original framing of this
commission was wrong and is corrected here rather than quietly dropped: the claim was that this
repository has no typechecker and every annotation in `src/` is therefore documentation. It is
reachable via `bunx` and it runs. What is true is narrower and more useful — a fact carried on both
a runtime surface and a type surface is enforced by neither instrument alone, because each is blind
to the mutation the other catches. Enumerate those pairs in `src/`: regex-plus-union, parsed-shape-
plus-interface, catalog-key-plus-`Record`. Some will want a test, some a type, some both, and
`DOCUMENT_FILE`'s index check is the case no `tsc` run would ever produce, because it asserts a
relationship between a mapping and a resource rather than a shape.

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

**A validator figure taken from the working tree is a timestamp, not a measurement.** Five lanes
write to one tree; eleven commits landed in one afternoon inside stretches of two or three minutes.
Every figure disagreement between lanes so far — three in one day — was a faithful count of a
different tree. Quote figures from a revision: `research/probes/validate-figure.sh <sha>` prints the
sha, says whether `.donors/` was copied and deps installed, and prints the command to re-derive it.

Two corollaries the script now carries, both measured rather than reasoned. **A warning can appear
and vanish with nothing done to the text it names** — `rulings.uncited-restatement` scores windows
against term weights derived from the whole tree, so prose added anywhere moves every score; one row
appeared at `7f159d8` and was gone by `daef077` with the window byte-identical at all three
revisions and its ruling byte-identical too. So neither "it passed when I wrote it" nor "it stopped
warning" is a claim about that passage. **And the locator is the window's first line, with the claim
running forward from it** — reading it as a midpoint pulls earlier sentences into the window, and if
one of them concerns the named ruling the row reads as corroboration from a second instrument. That
nearly happened at `82b663f`, and a manufactured convergence is worse than none, because
corroboration is what stops the next person checking.

**`git log --author` cannot distinguish the lanes.** Every commit carries one identity. Authorship
lives in the commit message and the paths touched, both writer-controlled and neither checked; git
here records custody and nothing else. Anything routed by author silently returns the whole team.
