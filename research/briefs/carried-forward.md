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

## Batch 3 — landed, review in flight

Six entries at `05a431d`: skills `super-align`, `super-bound`, `wayfind`, `doc-review` and
references `codebase-design`, `domain-modeling`. An independent reviewer is seated against the
artifacts and writes `research/reviews/batch-03-define.md`.

Two things it produced that outlived it. Its contract defect against §7 is **ruled and retired** at
`57ea582` — `evals/` is now in `SCAN_DIRS`, and §7 names both symbols that decide whether a tree is
scanned rather than the one that cannot answer. Its four over-target bodies (168, 175, 168, 188
against a 150-line target) are the reviewer's to judge, not a finding on their own; four of four is
a norm to test, not four accidents.

Carried to batch 4 and already written into its brief: write a relative reference once per line,
because the packager's two-spelling defect (`1afe016`) is unrepaired and raises `links.broken-bundle`
against the author's source line for a file the packager itself wrote.

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

**Gate the typecheck now — `cli`, ruling reversed at `76e57ba`.** The pin landed at `b06c73a` and
verifies three ways: `tsc --version` 7.0.2, `--noEmit` exits 0, `--listFiles` shows 72 `.ts` files
including every in-flight untracked one, and a planted `const x: number = "nope"` reports TS2322.
All three legs — it runs, it has a population, and it can fail. The gate was deferred to batch 6
because `tsc` was exiting 1 with thirty `TS7006` errors; that condition is gone, so the deferral
expires with it. A gate added to a clean tree costs one line. A gate added at batch 6 first has to
clean up whatever batches 4 and 5 accumulated unchecked, arriving exactly when the checkpoint and
the `v0.1.0` tag compete for the same attention. Open question inside it: `research/probes/
denylist-reach.ts` is outside `tsc`'s file set because `tsconfig.json` scopes to `src/` and
`tests/` — defensible as a choice, not as an unnoticed glob.

**The two-surface inventory — `provmap`, list only, do not fix.** The original framing of this
commission was wrong and is corrected here rather than quietly dropped: the claim was that this
repository has no typechecker and every annotation in `src/` is therefore documentation. It is
reachable via `bunx` and it runs. What is true is narrower and more useful — a fact carried on both
a runtime surface and a type surface is enforced by neither instrument alone, because each is blind
to the mutation the other catches. Enumerate those pairs in `src/`: regex-plus-union, parsed-shape-
plus-interface, catalog-key-plus-`Record`. Some will want a test, some a type, some both, and
`DOCUMENT_FILE`'s index check is the case no `tsc` run would ever produce, because it asserts a
relationship between a mapping and a resource rather than a shape.

**Falsifying the mandated-rows gate — `sweep-reviewer`, queued behind the §8 sweep, and a third
case added at `76e57ba`: a row carrying both required fragments and the citation that then states
the opposite of an unchecked clause.** The two existing cases both test whether the gate notices
*less* text than the ruling; nothing measures whether it can tell a compliant row from an inverted
one, which is the worse failure. The live proof that inversion happens is `ba02021`, where
AUTHORING.md's own §12 contradicted `required-lane-failure-is-unavailable` on the exact clause row 2
does not check. First case is
a body whose row is correct in words but rewrapped.

**The batch-5 checkpoint fixture repo — `schemas`, commissioned.** The plan's checkpoint drives one
bounded change end to end in a throwaway git repo, and the repo does not exist. Nothing in the batch
structure produces it: `tests/fixtures/{valid,invalid}` are validator fixtures, and every
"checkpoint" occurrence in `policies/` is the supervisor-checkpoint sense from `authority-defaults`,
a different concept sharing a word. Batch 5 hands straight into it, so it is the thing standing
between the catalog and its first evidence that the spine works.

It went to `schemas` because the fixture is mostly artifacts bound by contracts that lane wrote — an
approved ticket under `ticket.schema.json`, a seeded bug findable as a `finding.schema.json` whose
`fingerprint` is not line-number-derived, receipts that can say `inconclusive` distinctly from
`not-run`, review artifacts separating comparison base, reviewed head and last verified head. A
schema that cannot express what the slice needs is the most valuable thing the commission can
return, and now is far cheaper than during the checkpoint.

**The constraint the commission leads with: build it so the checkpoint can fail.** A seeded bug a
`super-scout` pass hands over directly proves nothing about the review seat that then "finds" it. If
every path through the fixture ends in closure, scenario 3 is untestable on it; if no required lane
can be made unavailable, scenario 4 is; if the bug does not sit in a caller the change leaves
untouched, scenario 8 is. A fixture that cannot produce a failing checkpoint is an instrument
returning the same answer under both hypotheses, which is the one thing a checkpoint may not be.

Two boundaries carried with it. `super-ship` is **dry-run only** and the fixture has no remote it
could push to — if any part of the slice appears to need one, that is a report, not an addition. And
the lane that builds the fixture does not drive the slice through it, which is the same
self-approval rule the catalog is written against.

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

**Before commissioning work to close a gap, read every input the consumer receives.** Scenario 7 —
a one-line fix still gets a delta review — binds no row in `resolved-conflicts.yaml`, and the two
rulings nearest it govern panel composition and delta scope, neither of which answers it. Batch
writers do not receive the plan, so the reasoning went: the fact is not in the writer's inputs, the
nearest thing in them points the wrong way, commission a ruling. The fact was in the writer's
inputs. `research/dossiers/review-ship.md` pairs scenarios 1 and 7 in one sentence at its line 167
and grounds scenario 7 in plan §6.3 at line 1196 — the exact disambiguation the ruling would have
restated, in an input that had not been opened.

The commission was not sent, so this cost nothing but the time to check. It is the same class as
the absence-claim repaired at `7f159d8`: a search run against where the record was expected to live
rather than against the population of places it could live. Naming one input a fact ought to be in
is not declaring the set of inputs the consumer gets, and only the second is checkable. For a lead
about to commission seven more batches, the population is the brief's own inputs table.

**An extract is not the tree until you have shown it reproduces the tree's own figure.** Building
one by hand with `rsync -a --exclude '.git'` silently removes every donor clone's git directory,
because the pattern is unanchored and matches at any depth. The result validated at 101 errors
where the source tree had 0 — all of them `provenance.source-not-at-pin`, a check that was
answering honestly about a tree I had quietly made different. Anchor root-only excludes as
`/.git`, and make the extract print the source tree's figure before you read anything else from
it: `research/probes/validate-figure.sh` avoids the whole class by using `git archive` rather than
a copy, and is the right tool whenever the figure will be quoted.

The general form is worth more than the flag. A copy made to isolate a measurement is itself an
instrument, and an instrument nobody calibrated returns numbers that look exactly like results.

**Seven undercounts across three lanes in one day, and they are not one failure.** Each wants a
different guard, and the guards do not substitute for one another.

*Memory wants a sweep.* Four of the seven were someone enumerating their own material from
recollection — §5's "four places", `baca1d3`'s "two research documents", one absolute-path file
that was six, two derivations that were three. Every one was corrected by somebody else's search.
The fix is to sweep a written-down population rather than list what you remember putting there.

*A moving tree wants a revision.* Three were correct sweeps over a tree that changed underneath
them: `bun test` at 807 and then 829 hours apart, a `const lines` population at 12 and 13 within
the hour, a test total quoted twice by people who had each just insisted on a revision for a
validator figure. Conflating this with the first gets you a sweep with no date, which fails the
second way while looking like it has addressed the first.

*A reading that passed through anything but the file itself wants a second reading by a different
route.* This one defeats both guards above and is the reason it is worth naming separately.
`authoring` read a file via `f=$(git show ...)` and then `echo "$f" | grep -n`; zsh's builtin
`echo` interprets backslash escapes, the file is full of `\n` inside TypeScript string literals,
and 259 phantom lines appeared. They had a revision. The tree had not moved — the file is
byte-identical at both commits. They ran a command rather than trusting memory. Every guard was in
place and none applies, **because a revision names which subject was measured, not whether the
instrument altered it in transit.** Their counts survived and every line number beside them was
wrong, because splitting a line changes which line a match is on and not how many lines contain
one. A sweep reporting *which* rather than *how many* would have been wrong in every row.

*Before reaching for a second route, check whether you already have a second reading and never
compared it.* `provmap`'s addition, and it is the cheap half: a second route is expensive and will
not be done routinely, while both of the day's worst instances were two readings already in hand.
`authoring` had the correct line numbers earlier in the same session and reported different ones
without comparing. `provmap` had the enumerated site list in front of them and stated a tally that
contradicted it. The classification sweep survived a moving tree for the same reason — it kept
every member visible instead of collapsing them into a number.

Two of my own from the same afternoon, both in the third class, and one of them is a repeat of a
trap already written down on this page. In zsh, `git show $rev:AUTHORING.md` inside a loop reads
`$rev:A` as a parameter modifier and yields nothing; every size in the table came back `0 lines`
and the shape of the result — three identical zeroes — is the only thing that gave it away. I had
recorded that exact trap earlier the same day after it produced a vacuous diff, and reproduced it
anyway, which is the argument for a guard that does not depend on remembering. Braced as
`${rev}:AUTHORING.md` it is correct. And a grep for `eturn nothing`, written to catch both
capitalisations, cannot match `returns nothing` at all: the `s` falls inside the span. It returned
two hits, I read the absence of a third as a fact about the corpus, and reported a zero that
`sweep-reviewer` then had to correct out of a commit message. The population is three across two
spellings. **A pattern narrowed to catch a variant is a pattern that excludes the others, and the
report does not say which ones.**

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

**Truncating an output truncates the population, and nothing in the result says so.** `git status
--short --branch | head -3` returned the branch line and two modified files and dropped the two `??`
rows beneath it. I read the shorter list as the tree and was one step from reporting that another
lane's untracked work had disappeared — a claim about someone else's files, from a pipe I wrote
myself. The tell is that the truncation is invisible at the point of reading: `head` succeeds, the
output is well-formed, and the missing rows leave no mark. This is the third member of the family
`carried-forward` already names — the narrowed grep pattern, the zsh `$rev:path` parameter modifier,
and now a pipe that discards the tail. Each one produces a clean, plausible, short answer. **Do not
put a length limit on a command whose output you are about to treat as a population.** Count first,
then limit for display if the count warrants it.

**A report names a line; the defect is rarely one line wide.** `d3bfacb` converted the absolute path
at `research/dossiers/protocols.md:15` because that is the line §5 named. Line 14 of the same file,
in the same bullet list, carried the same absolute path and survived the repair. A grep over the
whole tracked tree then closed it: five occurrences, four lines, three files — and note that a line
count reads 4 where an occurrence count reads 5, because one line carried two. Repaired at
`7a83f25`. **When a report hands you a locator, the first move is to measure the population that
locator is an instance of.** The locator tells you a defect exists; it does not tell you how many.
It is also where the locator's own bound matters — a line-based count and an occurrence-based count
are different populations, and neither is wrong.

**The plan's own placeholder gate is green partly because a fifth of its subject does not exist.**
Verification step 4 is `rg -n "TODO|TBD|lorem|placeholder" skills protocols roles packs references`,
and it returns nothing today. Counting the files under each of those five directories says why that
is weaker than it reads: `skills` 13, `protocols` 8, `roles` 29, `references` 4, and **`packs` 0** —
all eight packs are batch 6 and none is authored. A scan of an empty directory is clean in exactly
the way a scan of good content is clean, and the command prints no term for the difference. The same
holds for `skills` until batch 10 lands. So this gate is not evidence until the catalog is complete,
and reading a green run of it mid-catalogue as a fact about the catalogue is the same error as
reading `evals.uncovered-scenarios` as a fact about the skill a checkpoint exercises. **Run a
population count beside any scan whose subject is still being created.** A gate over a directory
tree is an assertion about the tree's contents and quietly becomes an assertion about nothing.

**In the corrupted-reading class, the dangerous member is the one that stays well-formed.** From
`provmap`, who reproduced `authoring`'s `echo "$f"` corruption exactly — all four locators, 1079
lines against 1338 — and then hit a *second* zsh artifact inside the command verifying the first:
`"$R:tests/..."` read `:t` as a history modifier and produced `8ea...ests/provenance.test.ts`, which
git refused. Two shell artifacts, one command apart. **One failed loudly and one produced a file
that parsed, read as TypeScript, and had citable line numbers.** Only the first is self-reporting.
The second is worse precisely because everything downstream of it works: a corrupted reading that
still parses yields quotations, line numbers and diffs, all of them false and none of them
malformed. This is what rules out care as the guard — care is exactly what both lanes had, and it
caught the loud one. The guard is a second reading by a different route, which is the third of the
three guards and the reason it is worth its cost.

**A check whose subject is absent and a check whose authority is absent are different events, and
`ak validate` prints one word for both.** From `sweep-reviewer`, found by attacking the
mandated-rows gate's authority rather than its subject. `.donors` absent is a check that looked and
found nothing: its subject is gone, empty is the correct answer, and `validate-figure.sh` documents
it as a legitimate skip. A reworded `**Mandatory, verbatim in every role body:**` anchor is
different in kind — the subject is entirely present, 29 bodies sit there uncompared, and the check
was *given* nothing to compare them against. Measured: gutted row with the anchor intact exits 1 and
blocks; gutted row with the anchor reworded exits 0 with `1 check skipped`. **The tree is strictly
worse and the exit code is strictly better.** The distinction is already in the contract for
returns — `ba02021` put it there this morning — and the validator does not yet observe it for its
own checks. The generalising fix is a term in the summary line for which kind of skip occurred; the
narrow one is making this check block. Note what makes it sting: the check enforcing *a required
lane that is unavailable blocks approval* reports itself unavailable and does not block. It is the
one rule it does not apply to itself.

**A contract's claim that a rule is enforced is not checked by asking whether the rule exists.**
From `batch4-writer`, who found that §11's first half tells a writer the ten required `SKILL.md`
headings, their order, insertions between them and the anti-rationalization table are "Decided by
the commands above. Read these when one of them reports, not before" -- and that nothing in `src/`
performs any of the four for a skill. `bodies.ts:1135` seats `["protocols", "roles"]`;
`SKILL_SECTIONS` occurs zero times in the tree. The comment on `checkSections`'s own
`noInsertions` parameter calls the law "§3's insertion law, which §12.1 inherits for protocols and
§12.2 does not impose on roles": the kind that inherits it is seated, the kind that declines it is
seated, and the kind it was written for is not.

The part worth carrying is the gate I nearly routed. §11's first half names 14 rule ids. I
extracted all 14 and checked them against every id emitted anywhere in `src/`. **All 14 are
emitted, including the four that are the defect** -- they are emitted for protocols and for roles.
§11 is "Before handing a skill back", so every claim in it is a claim about a skill body, and an
existence check reads green on exactly the bullets that are false. The working gate is coverage,
not existence: one minimal mutated body per claimed id, asserting *that id appears* rather than
that the run fails. Two properties belong in the rule rather than in whoever implements it -- a
case violating two rules proves neither, because either id satisfies the assertion; and a mutated
body in a corpus this size will fail for some reason, so watching the exit code is an instrument
returning the same answer under both hypotheses.

Population, measured because the defect invites the opposite assumption: all five authored bodies
-- `doc-review`, `super-align`, `super-bound`, `super-scout`, `wayfind` -- carry all ten headings,
at `##`, in order, as an exact prefix, no duplicates, seven-row table under `## Hard gates`. The
corpus is clean, and it is clean because five writers hand-verified instead of trusting the report
§11 promised. **A gap that has not yet produced a defect has not been shown to be harmless; it has
been shown to be outrun by care.**

**Read whether a section already rules on a question before routing a ruling about it.** I sent
`authoring` a ruling that §10 guards only deletion-outruns-gate, that the reverse direction is
worse, and that it is invisible per-lane. The first clause is true. The second is backwards, and
this contract already says so in its own words: *a section understating its enforcement makes a
reader redo work the gate already did; a section overstating it makes a reader skip work nothing
does*, and the second does not surface, because reliance on an over-strong claim fails silently --
the gate still passes, so nothing reports and the writer who trusted the word is never
contradicted. A stale disclosure outliving its gate is the understating direction: the lesser one,
and self-correcting the first time a writer watches the gate fire. §10's existing retirement rule
guards the worse direction and needs no companion.

What produced the error is the third guard, in the one place it is easiest to skip: the reading
passed through my own summary of my own earlier conclusion rather than through §10. A second
reading by a different route is cheapest and least likely to be taken when the first reading was
your own. The real gap this misrouting was pointing at is in §11 rather than §10 -- §10's
disclosures are negative claims and its retirement rule reaches them; §11's first half is a list of
*positive* enforcement claims maintained by hand, separately from the enforcement, and nothing
reaches it. It is a structural generator of the direction the doctrine says to assume is
under-found, and it has now generated one.

**A name is not a reading, and the grader that settles a case is rarely the first one.** My own
correction at `57f4280` claimed scenario 18 read green on the wrong loop: that
`doc-review/third-round-does-not-run` caps *review rounds*, that scenario 18 is the third *fix
cycle*, and that it therefore belongs to `super-build`/`super-verify`. All three clauses were
wrong. `two-fix-cycles-then-stop` carries `scenario: 18` and rules *at most two fix-and-verify
cycles after the first pass*; its `binds.skills` are `super-review`, `ultraqa`, `autopilot` and
`babysit-pr`, and batch 4's dossier independently rules that scenario 18 is the pass-2 cap rather
than the per-ticket implementer loop. The case supplies a prompt in which two rounds have already
happened, and its **second** grader says *the cap is two fix rounds and no configuration buys a
third*.

What I read was the directory name and the first grader's *"No third review round is run"*. Both
say **round**; the ruling says **cycle**; the second grader says **fix rounds**. The whole error
fits between the first grader and the second. Two carried lessons meet here and neither caught it:
a report names a line and the defect is rarely one line wide -- this time there was no defect at
all -- and a test for an ordering has to supply input in which the ordering can arise, which is the
property that made the case correct and which I did not check for before calling it wrong.

The residual claim, after re-reading, is real but narrower and differently shaped: the ruling does
not bind `doc-review`, and the checkpoint slice runs `super-review`, so the corpus is covered by a
case hanging off a skill the ruling has nothing to do with. The global `Set<number>` is satisfied
and the slice is not. **A wrong diagnosis of a real gap is more expensive than no diagnosis**,
because it sends the next writer to repair something correct: the brief had told batch 5 to take
the answer rather than the task.

Rows 1, 3 and 20 were re-read by the same route and hold, and row 20 came back stronger than it was
filed -- all five of its cases are knowledgebase or tracker writes read back before writing, while
the gate is a commit or PR action. That is a different side-effect class, not merely a different
skill, and the difference matters: a knowledgebase record can be read back, a pushed PR cannot, and
the checkpoint's `super-ship` step is dry-run, so the fixture has to prove nothing was pushed
without ever pushing.

**`git add <path> && git commit` is not scoped to that path, and this tree has four lanes staging
into it.** I committed `AGENTS.md` at `021bc47` and took twenty files of another lane's in-flight
checkpoint fixture with it, because `git commit` with no pathspec commits the whole index and
`schemas` had staged work in the shared tree. The snapshot that went in was incoherent -- two
runnable check files renamed, neither the materializer that restores them nor the harness that
reads them included -- and since `bun test` collects `*.test.ts` anywhere in the tree, including
under `tests/fixtures/`, it put 6 failures and 1 unhandled error into a suite that was otherwise
green. `schemas` found it and landed the rest of the change at `f23b81d`. **Use the pathspec form
-- `git commit <path> -F -` -- which commits the named paths from the working tree and leaves every
other staged entry staged.** `git status --short` before committing shows the index; reading it is
the guard, and truncating it is the trap already recorded above.

The reason it is worth a paragraph rather than a note: nothing in the repo could have caught it. The
commit was green at the moment I made it, the files I did not intend to ship were another lane's
correct work-in-progress, and the damage was a *fixture* breaking the suite that collects it --
which is a failure mode with no owner, because the lane that wrote the fixture had not finished it
and the lane that shipped it had not read it.

**The verification convention manufactured a false red, and the gate it fired on is the one that
had already been deferred for reading red.** `mktemp -d` on macOS returns a path under
`/var/folders`, and `/var` is a symlink to `/private/var`, so the extract has two names.
`tests/typecheck.test.ts` asks `tsc --listFiles` which files it checked and keeps the ones prefixed
by the repo root; `tsc` prints the resolved name, the prefix never matches, the checked set reads
empty, and the population assertion reports every file in `src/` and `tests/` as untypechecked.
Measured on one revision: **916 pass 0 fail extracted under `/Users`, 1 fail extracted under
`/var`.** I was one step from reporting HEAD red.

This is the day's pattern inverted and worth holding beside it. Every other instance has been an
instrument returning the same answer under both hypotheses -- a false green, silent, found only by
mutation. This one is loud, and its danger is different in kind: the test's own header records that
this gate was deferred once because `tsc` was red over an in-flight file and *a gate that starts red
is a gate people learn to skip*. A convention that makes it red for every lane but its author would
have taught the whole team to skip it, and the skipping would have looked like judgement rather than
a bug. **A false red does not corrupt a reading; it corrupts the reader's disposition toward the
instrument**, which outlasts the revision that caused it. Fixed at `e0d7ce4` in
`research/probes/validate-figure.sh`, which is the copy lanes take, rather than in each copy.

**`git ls-files` reads the index, so a count taken with it is a count of no revision at all.** This
is the third distinct shape of provenance failure found today and the only one a revision label
cannot repair. `sweep-reviewer` re-enumerated the eval corpus and got 42 cases and 11 scenarios
against a tree that held 33 and 8, because nine `super-build` cases were staged and uncommitted;
they caught it themselves. The three shapes, theirs:

| shape | what fixes it |
|---|---|
| a count goes stale | attach a revision |
| provenance attached to the wrong measurement | attach it to the act it covers |
| a count of the index reported as a count of the tree | **nothing a label can do** |

`sweep-reviewer`'s general form is better than the table and belongs first: **the error is temporal
and every provenance instrument in this repo is spatial.** `validate-figure.sh` pins a revision, a
`git archive` extract pins a tree, `ls-tree` pins a snapshot -- all three answer *which tree*, and
all three presuppose the measurement was of a tree. A count of the index is of no tree, so it passes
through each instrument intact and comes out labelled.

`provmap` went to reproduce the divergence and **could not**, because `ff82f1a` had committed the
staged cases two commits earlier: 33 at `0f59f5c`, 33 at `021bc47`, 42 at `f23b81d`. The retracted
figures became the true ones, and the retraction went stale in the same motion. `provmap` first
called that self-correcting; `sweep-reviewer` corrected them and the correction is the durable part.
**The index is not a wrong number, it is a preview of the tree** -- it survives every plausibility
check, it matches what a colleague is about to commit, and on the branch where that lane commits it
becomes true. Had the lane amended, split or abandoned, it would have stayed false permanently with
**no correction event at all**, because nothing here ever compares a quoted figure against a tree.
Both branches are indistinguishable at measurement time and only one ever emits a signal, so the
method is unaudited either way. It was caught on the lucky branch, which is the branch where
catching it is hardest to motivate.

The remedy, and the guard is narrower than the one we nearly wrote down: **anything quoted comes
from `git ls-tree -r <rev>`; if `ls-files` is used anyway it owes a `git diff --cached`, and if
bytes are also read off disk it owes a `git diff --name-only` for those paths.** The second clause
is `sweep-reviewer`'s and it closes a hole in the first: their actual method was a hybrid, names
from the index via `ls-files` and bytes from the working tree via `grep`, and `diff --cached` is
silent on an unstaged edit. **The guard's scope has to match the measurement's scope** -- guard the
index if names came from it, guard the working tree for those paths if bytes came off disk.
`sweep-reviewer` proposed `git status --porcelain` and `provmap` tested it across four states
rather than reasoning about it -- the divergence is index-versus-HEAD, so `diff --cached`
corresponds to it exactly while `status --porcelain` also fires on unstaged edits and untracked
files. Measured in this repo just now: `ls-tree` 42, `ls-files` 42, **`diff --cached` 0,
`status --porcelain` 38.** The proposed guard would have fired thirty-eight times with the defect
absent, and with four lanes writing here it is never empty. That is §10's own *an unperformable gate
gets turned off*, arriving as a property of a guard before it was written.

One line of `sweep-reviewer`'s covers all four of today's shapes including the two shell artifacts
below, and should lead any future version of this page: **provenance attaches to an act, not to a
paragraph.** `7b20b26` headed a paragraph and described one act inside it; *verified rather than
inferred* covered two adjacent acts and was true of one; the index count carried a revision label
describing a different act than the one performed.

**Any measurement that can return zero owes a positive control proving the instrument had a
subject.** Two clean zeroes today, in different registers, neither of which errored. `sweep-reviewer`
supported *nothing executes a case* with `grep -rn "graders|expected_outcome|max_turns|prompt|execution" src/`
-- BRE, so the pipes are literal and it searched for one long literal string that cannot occur. It
exited 1 by construction, under the sentence *"Verified rather than inferred."* `provmap` reran it
with `-E`, got nine matches, and confirmed the conclusion by a different route: `caseDoc["tags"]` at
`src/validation/evals.ts:84` is the only key access on a parsed case. The conclusion was right and
its evidence never supported it. Then `sweep-reviewer`, auditing themselves against `git show`, wrote
`A=$(git show $R:AUTHORING.md)`; zsh parsed `$R:A` as its absolute-path modifier, git errored, `$A`
came out empty, and the three greps that followed returned `0`, `0`, `0` -- the exact shape of their
own findings being falsified, indistinguishable from a true negative. They caught it only because
they already expected a different answer, which is not a method.

The register is what makes this worth its own rule rather than a note under the shell traps. A
malformed *command* errors and the error is loud. A malformed *pattern* exits cleanly, because *no
lines matched* is the honest answer to the question actually asked -- just not the question intended.
Nothing distinguishes *searched and absent* from *searched for the wrong thing*, and absence is
what these searches are usually run to establish. One `wc -l` on the extract before grepping it, or
one pattern known to match, kills both of today's artifacts at the point of measurement rather than
at the point where someone happens to know the answer. It is the same move as `diff --cached` above,
applied to a failure that is not spatial at all.

**Correction to the sentence above, landed the same hour and falsified by measurement.** I wrote
that a `wc -l` on the extract kills both artifacts. It does not, and `provmap` built the case that
shows why. Every mangled path today exited 128 *because the mangled name happened not to exist*. In
a throwaway repo with both `evals/x/case.yaml` and `vals/x/case.yaml` present, `git show
$R:evals/x/case.yaml` degrades to `git show vals/x/case.yaml` -- **exit 0**, a commit header and a
diff for a different file, 273 bytes captured. The byte-count control *passes*. The grep for the
wrong file's content returns 1 and the grep for what you wanted returns 0, which reads as a clean
true negative.

So: **a positive control proves the instrument had a subject; it cannot prove it had the right
one.** What survives is the *discriminating* control -- a sentinel expected in the intended file and
absent from the plausible wrong ones. `provmap`'s working version was `scannedFiles 0 /
CONTRACT-DEFECTS 4 / schema_version 2`: it worked because the second and third are specific to
`AUTHORING.md`, so a wrong subject drives them to zero alongside the finding and the undiscriminating
`0 0 0` becomes a discriminating `0 4 2`. `sanity: 145223 bytes` would have passed on the wrong file.
**A count proves something was read; only a sentinel proves the right thing was read.**

Two mechanical notes that cost more than they look. **Quoting does not help and braces do.**
`$R:AUTHORING.md` and `"$R:AUTHORING.md"` expand identically under zsh's `:A` absolute-path
modifier -- both to `…/0c785b8UTHORING.md` -- while `"${R}:AUTHORING.md"` is correct. So a reviewer
who spots the shell risk and adds quotes has changed nothing and now believes it is handled. And
capturing stderr does not rescue it either: with `2>&1` the variable holds git's fatal message and
the following greps still return clean zeros, because the error text does not contain the patterns.
`provmap` censused all 27 top-level tracked paths against `$R:<path>`: **14 corrupt, 13 safe**, with
every directory a lane works in -- `src`, `skills`, `schemas`, `tests`, `roles`, `evals`,
`adapters`, `catalog.yaml`, `AUTHORING.md`, `AGENTS.md` -- in the corrupt column, and the safe set
an accident of which letters happen to be zsh modifiers rather than anything anyone chose.

`sweep-reviewer`'s unification is the shortest true statement of both halves of this page, and it is
why each of them was blind to the other's error: **a control must have the same extension as the
hypothesis it guards.** There are exactly two ways to miss. `git status --porcelain` fires on states
that are not the defect -- too wide in the firing direction, a false alarm, and a guard that fires
every day is stepped over. `sanity: N bytes` passes on subjects that are not the right one -- too
wide in the passing direction, false assurance, and nobody looks again. The third live instance
today was neither shell nor prose but committed test code: `tests/typecheck.test.ts`'s population
check reported all 78 owned files as untypechecked whenever the suite was reached through a symlink,
because `spawnSync`'s `cwd` does not rewrite `PWD` and `tsc` builds `--listFiles` from `PWD`. Green
where the repository lives, red in every `mktemp -d` extract -- which is how every lane here
verifies anything. Its author had guarded the vacuous-pass direction with
`expect(owned.length).toBeGreaterThan(30)` and left the false-alarm direction open. **I made that
worse before I made it better:** at `e0d7ce4` I fixed the *convention*, making `validate-figure.sh`
extract under a resolved path, which routes around the trap for callers who copy that script and
leaves it armed for everyone else. The comparison itself is canonicalised at `09860e4`, with a
symlink regression control that is the only test in the file to fail when the canonicalisation is
removed.

**`git push origin HEAD:main` is a moving ref too, and I published another lane's commit ninety
minutes after being handed the report that names the defect.** `authoring` found it first: they ran
`git push origin main`, which publishes whatever the branch points at when it runs rather than the
commit they measured, and it carried an unrelated lane's `021bc47` along with their own. Their
stated remedy was *push the commit I measured by explicit refspec -- `git push origin <sha>:main` --
which fails rather than silently widening.* I accepted it, and then used `git push origin HEAD:main`
on my next two commits. The second one reported `3772d63..5d656af` where I had just committed
`8fa20df`: `authoring` had committed `5d656af` in the window between my `git commit` and my
`git push`, and I published it unreviewed and unasked. Additive, measured green afterwards, nothing
red went out -- and none of that was true because of anything I did.

The lesson is not about git. **A remedy stated as a syntax gets copied as a syntax.** The property
that makes the fix work is *the left-hand side names a commit that cannot move between measuring
and publishing*. `HEAD:main` is an explicit refspec, satisfies every word of the remedy as written,
and violates the property -- because `HEAD` is a name that moves for exactly the same reason `main`
does, in exactly the window the remedy exists to close. The form I copied was the visible half of a
fix whose working half was never in the syntax at all.

Two shapes follow, and the second is why this is on the standing page rather than in a commit
message. A remedy should be written so that its property is checkable on the copy: *the left-hand
side of the refspec is a literal 40-hex sha you pasted from the commit you measured* is longer than
`<sha>:main` and cannot be satisfied by `HEAD`. And the failure is silent in the family way -- the
push succeeds, the range line `A..B` is the only signal, and reading it requires already knowing
which commit you made. It is the positive-control rule above wearing different clothes: the
instrument reported truthfully and the reader had no subject to compare it against.

## A repair that needs history rewritten has a deadline, and on a shared branch it is always past

`97bd59b` is missing the `Co-Authored-By:` trailer `AGENTS.md` requires. `provmap` caught it
immediately and went to `git commit --amend`; another lane had committed `09860e4` on top in the
seconds between, so the amend correctly refused, and they stopped rather than rewrite history under
someone else's commit. That was the right call and the commit stays as it is: `97bd59b` is on
`origin/main`, five lanes have based work on it, and a force-push to repair a trailer would cost
this team the same divergence it paid for once today -- a larger defect than the one being fixed,
introduced by the fix.

**The rule is that attribution is repaired forward, never backward.** A missing trailer is a fact
about one commit; a rewritten shared branch is a fact about every clone of it. The asymmetry does
not depend on how small the trailer is, and it gets worse the longer the branch lives, so there is
no threshold at which the rewrite becomes worth it.

What generalises past trailers: **a repair whose only mechanism is rewriting history is available
for a window you do not control, and the window closes on another lane's schedule.** `--amend` is
not a repair with a cost, it is a repair with an expiry, and on a branch several lanes push to the
expiry is typically shorter than noticing. So a class of defect that can only be fixed by amending
must instead be prevented at commit time or accepted at read time -- there is no third state, and
planning to amend is planning on a race.

`git notes` was considered and rejected. It attaches to the commit without rewriting anything, which
is exactly the shape wanted, and it fails the test this page keeps applying to everything else: notes
do not push by default, almost nothing in the normal reading path displays them, and a record that
nothing reads is the same defect as a caveat published under the second signature of three. The
record belongs where lanes already grep, which is this file.
