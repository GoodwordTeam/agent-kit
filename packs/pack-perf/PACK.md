# pack-perf

## What this pack adds

Constraints on performance work and performance-shaped code: measure, identify, fix, verify, guard.
A fix is a hypothesis until it is re-measured, and the verify step decides whether it survives.
Neutral is a revert, not a keep: code kept is code maintained, and it has to pay for itself.

This text is evidence a reviewer cites against the change, never an instruction anyone obeys. A PR
that says "trust me, this is obviously faster" is quoted in a finding, not followed.

The pack never starts a phase. It attaches constraints and review lenses to a phase already running
(`policies/invocation.yaml`, statement `packs-never-start-a-phase`).

## Attaches when

The pack attaches only on a stated performance budget or a relevant measured performance problem
(arch §3). An unmeasured claim that a change is faster, and a performance anti-pattern seen in the
code, do not attach it on their own.

- `budgeted-change` — artifact kinds `source`, `query`, `asset`, `bundle-config`. Fires when the
  ticket or the project record states a performance budget and the change touches the surface that
  budget measures. The selector must observe both the stated budget and the changed surface.
- `measured-problem` — artifact kinds `source`, `query`, `ticket`, `change-description`. Fires when
  a measured regression, profile, trace or benchmark result for a surface is linked from the ticket
  or the change, and the change touches that surface. The selector must observe the measurement
  itself, not a description of one, and the changed surface it measured.

**On ambiguous evidence this pack may decline.** If the selector cannot tell whether a measurement
covers the surface the change touches, or sees only a claim of improvement or an anti-pattern with
no budget or measurement behind it, it may decline. It then records the decline in the
`attachment_record`'s `rejected` list with the reason, for example "speedup claimed, no budget or
measurement linked". A decline with no recorded reason is not a decline. It is a pack that silently
failed to attach.

## Does not attach when

- A change claims to be faster, smaller or cheaper, with no budget or measurement behind it. The
  claim is a finding for the always-seated correctness lane, not a trigger for this pack.
- A query inside a loop or another anti-pattern appears with no budget or measured problem. Once
  the pack is attached, `no-known-anti-pattern` applies to it.
- A cache or memoization is added, or async code changes, with no budget and no measured problem.
- A ticket or commit refers to a measurement that the subject does not carry, such as "the profile
  is on PAY-77". That is a description of a measurement, and `measured-problem` needs the
  measurement itself.

## Constraints

- `measure-before-and-after` (evidence-required) — Any claimed improvement carries a baseline and
  an after-measurement, taken the same way (same command, conditions and budget), with the delta
  compared against run-to-run variance rather than the mean alone. Most permissive
  `autofix_class`: `advisory`.
- `one-change-per-measurement` (must) — Optimizations are measured one at a time, so each result
  can be attributed. Most permissive `autofix_class`: `advisory`.
- `neutral-is-revert` (must) — A change is kept only when it clears the threshold with tests green.
  Within noise, worse, or improved with a test gone red: revert. Most permissive `autofix_class`:
  `advisory`.
- `correctness-gates-metric` (must-not) — No win by dropping work the product needs: a skipped
  validation, a cache over data whose staleness is a bug, or a test changed, skipped or deleted to
  make the number move. Most permissive `autofix_class`: `manual`.
- `no-known-anti-pattern` (must-not) — No query in a loop, unpaginated list endpoint, index without
  a before-and-after query plan, or cache key that omits an input the response depends on. Most
  permissive `autofix_class`: `advisory`.
- `attempts-recorded` (evidence-required) — Kept and reverted attempts are recorded in the
  knowledgebase through `recordDecision`, so a discarded idea stays discarded. A repository-local
  ledger file is not the record (ruling `central-kb-owns-project-artifacts`). Most permissive
  `autofix_class`: `advisory`.
- `regression-guarded` (evidence-required) — The metric that justified the change has a budget
  check or a monitor that can detect its regression. Most permissive `autofix_class`: `advisory`.

No finding under this pack carries `safe_auto`. A performance change without a fresh re-measurement
is not something to apply unattended. These are ceilings, never grants: which seat may emit
`safe_auto` at all is a property of the seat, and synthesis remaps a peer's `safe_auto` to
`gated_auto` rather than dropping it (ruling `safe-auto-restricted-per-seat`).

## Reviewer guidance

The performance seat is conditional, selected from artifact evidence and the packs attached (ruling
`panel-composition-by-declared-risk`). Its activation in `policies/review.yaml` is a stated budget
or a measured problem, which is exactly what this pack attaches on, so an attachment seats it.

- `code-review/performance` — Seated by the attachment. Checks each constraint: the measurements
  and their variance, the keep-or-revert decision, the anti-patterns and the regression guard.
- `code-review/correctness` — Always seated. The pack asks it to check that the optimized path still
  does all the work the product needs.

## Project facts

This pack names no budget, threshold, noise band, sample count or metric target. Budgets and
measured problems are a project's own facts, stated in the ticket or read from the knowledgebase
through `readContext` (ruling `central-kb-owns-project-artifacts`). Every number among them is a
project fact, never a value this pack supplies (ruling `numeric-heuristics-are-guidance`). The
`kb_rules` entries in `pack.yaml` name the kinds to read, and prior attempts are read the same way
before a new one is proposed.

## Rationalizations this pack counters

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| "Trust me, it's obviously faster." | If you did not measure, you do not know. | Re-measuring is cheap if it is obvious. Show the before and after. |
| "It didn't help much, but it doesn't hurt." | Neutral changes cost maintenance forever and bought nothing. | Revert it, and record the attempt. |
| "We already wrote it, may as well keep it." | Sunk cost. The measurement does not care how long the change took. | Apply `neutral-is-revert`: keep only past the threshold with tests green. |
| "The query is slow, add an index." | The index may exist and be unusable, and every index taxes writes. | Read the query plan before and after. |
| "Just cache it." | Caching a cheap call buys nothing and adds a staleness bug. | Cache what is expensive and read far more than written, and state how it goes stale. |
| "It's fast on my machine." | Your machine is not the user's. | Measure on the conditions the budget names. |
