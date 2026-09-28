# Independent judging

Loaded by `bakeoff` at Workflow step 6. The body carries the rule: a completed bake-off has an
independent judgment, and without one the result is `incomplete`. This file carries how that
judgment is set up, what the judge applies, and what it returns.

The judge is internal to `bakeoff`. It is not `pov` and does not start `pov`: both are
user-invoked, and a bake-off a human started is not a delegated controller holding a grant, so no
path from one to the other is lawful (ruling `entrypoint-phase-operation-split`). The judge borrows
the same grade vocabulary and evidence floors so its verdicts read like any other point of view in
this catalog, and it produces no `pov` artifact. Its output belongs to the evaluation.

## Contents

- Setting up the judge
- What the judge applies
- What the judge returns
- Reconciling with the coordinator

## Setting up the judge

- **Freeze first.** Dispatch only after every counted candidate has returned. A candidate's
  artifact does not change after the judge has seen it. A change made later, including synthesis,
  is covered by the counterexample check in the body, not by this judgment.
- **Fresh context.** The judge runs in an independent reviewer context that authored no candidate
  and shares no reasoning state with the coordinator. Who fills that seat is the runner's decision.
  No independent context is available: the result is `incomplete`. Same-context self-review is
  never a substitute and never reported as one.
- **What it receives.** The contract (the brief and the criteria exactly as fixed) and the
  candidate artifacts under their neutral labels, with source pointers inside the permitted read
  scope.
- **What it never receives.** The author's claim about its own candidate, any builder's reasoning
  or notes, the coordinator's ranking, and any other judge's conclusion. The judge reads what was
  built, not what the builder says about it.
- **Read-only.** The judge changes nothing, starts nothing downstream and offers no follow-up menu.

## What the judge applies

**Skeptic stance.** Seek disconfirming evidence in every candidate. Name the real alternatives,
including keeping the incumbent and doing nothing. Rejecting every candidate is a legitimate
result, not a failure to finish.

**The project floor.** A position rests on a concrete, verified project fact relevant to the
choice: a named incumbent with at least one touchpoint (a `file:line`, a dependency, an issue, a
decision record), the verified absence of one plus a concrete integration point, or a prior
decision on the question. Fail: **Blocked — insufficient project grounding**, with a numbered list
of exactly what to inspect to make the floor passable.

**The external floor.** Where the position depends on an external claim, at least one verified
external source supports that claim. Fail: **Blocked — external evidence unavailable**, with a
numbered list of the evidence that would make the floor passable. A position that depends on no
external claim needs no external source.

The two floors are independent. Strong external evidence never compensates for thin project
evidence, and the reverse. Neither is a comparison of how much evidence each side has; each is
pass or fail.

Floors apply to premises the candidates share as well as to each candidate's own claims. Several
candidates agreeing on a premise does not corroborate it. Name every dependency whose failure would
change feasibility, a required guarantee or the ranking, and keep source-backed conclusions
separate from assumptions.

A call to a function shows that the call happens, not how that function behaves. A guarantee is
verified against the implementation or the tests that establish it, or it stays unknown.

## What the judge returns

- **Per candidate, exactly one grade.** **Adopt**: proven fit, use it. **Trial**: promising, use on
  a low-risk slice first. **Hold**: a complete decision to wait. **Reject**: not worth it here. A
  hard-constraint violation is **Reject** whatever the candidate's other strengths.
- **A position across the set**: the candidate it would take and why, with the material trade-offs
  and the conditions that would change it. Where the evidence gives no real basis to choose, it
  says **Either is viable** and explains the trade-offs. It never manufactures certainty with a
  scorecard or a count of advantages.
- **Or a named Blocked result** where a floor failed, in place of a position.
- **Always**: verified evidence kept distinct from assumptions, and an independence attestation of
  `true`, `false` or `unverified` about its context. Only `true` is a completed independent
  judgment; `false` or `unverified` leaves the outcome `incomplete`.

In the evaluation record (`schemas/evaluation.schema.json`) the grades are written lowercase
(`adopt`, `trial`, `hold`, `reject`), **Either is viable** is `either_viable`, and a Blocked result
names its floor as `insufficient-project-grounding` or `external-evidence-unavailable` with the
numbered list as `needed`. A `selected` outcome needs a position, never a Blocked return.

## Reconciling with the coordinator

The coordinator compares the judge's return with its own reading, including the evidence behind
the judge's decisive claims. A consequential disagreement is resolved by checking sources, never by
counting agreement, and the reason for the decision is recorded in the evaluation.

A **Blocked** return is an open evidence need, not an endorsement, and leaves the outcome
`unresolved` until the evidence is in. An affirmative return does not waive the counterexample
check. The coordinator keeps selection and synthesis. The judge's position is a recommendation,
and a recommendation is not authorization.
