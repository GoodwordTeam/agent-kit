# Contract defects

Where a writer reports that following `AUTHORING.md` produced a wrong result.

**`AUTHORING.md` §10 governs this file** — what counts as a defect, the three things an entry
records, and the rule that an open entry blocks its batch commit until the contract owner rules.
Read it there. It is deliberately not restated here: a restatement that drops a clause reads as
complete, and this file is the one place a writer arrives already believing they know the rule.

The file lives at the repository root for one reason. An entry appears in the diff of the very
commit that would otherwise bury it, so readership does not depend on anyone remembering a path.
A contract defect filed inside a commissioned artifact is the failure mode §10 names, and batch 1
produced a worked example of it: a correct diagnosis about §5's `target:`/`path:` key was filed in
a provenance fragment header, §5 was fixed at `abeb94e`, and nothing was obliged to read the report
so nothing retired it. It sat there asserting something untrue about the contract until a reviewer
found it.

An entry is retired by deleting it in the commit that resolves it, with the ruling in the commit
message. Entries are not marked resolved and left in place — a resolved entry that stays is the
same artifact as a stale one. There is no resolved section here, for that reason.

Deleting an entry does not lose it. `git log -- CONTRACT-DEFECTS.md` is the index of every defect
this contract has ever had, and each resolving commit carries the entry it retired along with the
ruling. Read it there before concluding from an empty list that nothing has been found.

---

## Open

### §5's route for a design-originated capability needs a `G:L` locator, and one class of capability has no honest one

*Filed by the batch-2 writer (twenty-two review-persona role bodies), against `AUTHORING.md` at
`a4f2dbf375f21d5472146235ef090be3c890c71b`, on a review finding against the committed batch
(`ae061b2`).*

**1. The instruction followed.** §5, on a donor-origin entry that carries design-originated
substance:

> **A donor-origin entry may still contain design-originated capabilities, and the route for them
> is the same one.** [...] A directory adapted from a donor can therefore carry a capability no
> donor implements, recorded at `destination: <entry dir>` with its `G:L` locator, while the entry
> stays `provenance_origin: donor` and its adapted files keep their rows.

and, two sentences later, the clause that names the escape:

> If a writer cannot find the route for something, that is a contract defect (§10) — never a new
> key parked in a fragment, which records nothing and dangles once merged.

The same section forbids the obvious workaround in the neighbouring column: *"Never fabricate a
source path because a document named a skill."*

**2. What following it produced.** Two capabilities in this batch have no donor source and no
honest `G:L`. They occupy three fragment rows, because the first is recorded on both of the paths
that carry it:

| Capability | Fragment rows |
|---|---|
| The reciprocal boundary between `doc-review/design-lens` and `code-review/frontend-races` | both bodies, one row each |
| The `doc-review/feasibility` / `plan-review/architect` distinction, examined and resolved as not a counterpart family | `roles/doc-review/feasibility/ROLE.md` |

The route §5 gives resolves a locator into `research/sources/grok-transcript.md`. Neither was
designed there. Each is a boundary between two donor files that never reference each other,
and each was drawn while authoring this batch — the donors sit on different panels, and this
package is the first artifact to seat them together. There is no transcript range to point at
because the reasoning postdates the transcript.

So the writer had three options and §5 forbids two of them. Fabricating a `G:L` would be the
locator-column twin of the fabricated source path §5 prohibits. Dropping the substance silently
would lose the only record that these boundaries were decided rather than assumed. I took the
third, which §5 also names and rejects: I parked the rows under
`conversation_origin_fragments:` in `provenance/adaptations.d/review-personas.yaml` with
`locator: null`, and flagged the absence in the fragment header and the handback.

That is the "new key parked in a fragment" clause exactly, and the consequence §5 predicts is
observable. `renderAdaptations` (`src/validation/provenance.ts`) carries `adaptations:` rows alone,
so the key is dropped at merge: `provenance/adaptations.yaml` at `ae061b2` contains no
`conversation_origin_fragments` key, and the three capabilities reach the published record with no
entry of any kind. Nothing fails. `ak validate` reports 0 errors against the fragment, because the
key it would have to check is one nothing reads.

**The pre-existing convention is a real mitigation and does not close the gap.**
`provenance/adaptations.d/protocols.yaml` uses the same key, which is where I took the shape from.
Its rows carry real `G:L` locators into the transcript, and one of them explicitly flags its own
locator as inexact rather than inventing a precise one. Mine carry `null`. That is the difference:
the batch-1 rows are imprecise records of something the transcript contains; mine are records of
something it does not.

**3. What the correct behavior appears to be.** A third provenance origin category, not a third
way to spell a locator. The model has two origins — `donor`, located by `donor@sha:path`, and
`conversation`, located by `G:L` into the transcript — and a capability designed during this
package's authoring is neither. It has a real origin, a real author and a real commit; what it
lacks is a slot. Naming the category is what §5 is missing, and the locator problem dissolves once
it exists, because a capability designed at authoring time is located by the commit that
introduced it.

This is the contract owner's ruling as relayed to me, recorded here so the entry states it rather
than leaving it open: the category must exist, and `locator: null` is not an acceptable resting
state. `provmap` owns `provenance/conversation-map.yaml` and the spelling.

**Batch-2 impact, so the ruling can be sized.** Three rows in one fragment, no bodies affected.
The fragment is left exactly as committed, per the fix-cycle instruction, so the resolution can
rewrite the three rows into whatever shape the category takes rather than merging with a repair
that anticipated it.
