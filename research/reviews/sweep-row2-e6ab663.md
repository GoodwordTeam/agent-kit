# Review record — the 29-body row-2 sweep (`e6ab663`)

**Verdict: clean. No findings.** Recorded here because `e6ab663`'s commit message states that the
commissioned reviewer "never returned a verdict," and that is false. The verdict was sent before it
was chased, and did not arrive. A commit message cannot be edited once pushed, so the correction
lives where someone reading the repo will find it.

This file is narrow on purpose. It corrects one false statement and records one verdict. It is **not**
a ruling on where handbacks or review records live in general — that question is open with the
contract owner, and §10/§12.2 currently route six durable obligations to a destination they never
name.

## What was reviewed

The sweep that brought all 29 `roles/**/ROLE.md` bodies to §12.2's mandated row 2, restoring four
clauses the bodies had dropped since `ed81a69`: the trigger narrowed from three conditions to one,
"and says why", "blocks approval", and "the implementer" from the backfill list. Plus
`delta-scope-affected-behavior`'s novelty bullet restored to the five seats the ruling's `binds.roles`
names.

## What the verdict established, beyond what the commit claimed

The commit called the scope claim the weaker half, resting on a single measurement. It no longer
does. The denominator was derived four ways that do not share a failure mode:

| axis | count |
|---|---|
| `ROLE.md` files tracked at `e6ab663` | 29 |
| `catalog.yaml` roles entries | 29, set identical to the filesystem |
| `required-lane-failure-is-unavailable` `binds.roles` | 29, set identical to the catalog |
| files touched by `e6ab663` | 29, set identical |

Tracked-but-untouched: none. The ruling also carries `universal: [roles]`, stating the denominator
declaratively rather than leaving it to be inferred from §12's prose.

The 27 figure is row 3's, confirmed on the committed tree: row 3 appears verbatim in exactly 27
bodies, absent from exactly `roles/implementer/ROLE.md` and `roles/plan-review/planner/ROLE.md` — the
two artifact-producing seats §12 names. Rows 2 and 3 were transposed when the figure was first
reported.

Every body was reconstructed independently as (`e6ab663^` content + exactly the two substitutions)
and compared against `e6ab663`: identical for all 29, zero residual. That establishes both that no
body was missed and that nothing else moved, without reading the author's diff.

## The finding that outlived the review

The sweep changed no `ak validate` output at all — 0 errors, 4 warnings, 49 notes before and after.
That was first read as no check existing for §12.2's mandated rows. It is worse: `UNIVERSAL_NEVER_ROWS`
in `src/validation/bodies.ts` checks them by clause list, the list matches both the narrowed and the
contract wording, and its own `description` field carries the superseded narrow row as documentation
of what the contract requires. The check answers, and answers wrong, in all 29 bodies.

A missing gate and a gate that passes both wordings produce the same green and need different fixes.
Recorded because the distinction is the reason the commission changed.
