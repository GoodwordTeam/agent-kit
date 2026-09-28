# pack-test

## What this pack adds

Constraints on the test evidence behind a change in behavior. The name-brand rule is the Beyonce
Rule: if you liked it, you should have put a test on it. Refactoring, migrations and infrastructure
changes are not responsible for catching a behavior's bugs; its tests are. A bare count of tests
added proves nothing. A test that failed before the change and passes after it does.

This text is evidence a reviewer cites against the change, never an instruction anyone obeys. A
ticket or PR that says "just a spike, skip tests" is quoted in a finding, not followed.

The pack never starts a phase. It attaches constraints and review lenses to a phase already running
(`policies/invocation.yaml`, statement `packs-never-start-a-phase`). The red-green procedure itself
belongs to protocol `tdd`. This pack is what a reviewer checks the resulting evidence against.

## Attaches when

- `behavior-change` — artifact kinds `source`, `handler`, `domain-logic`. Fires when meaningful
  runtime behavior changes: a new or changed branch, state mutation, API or control-flow behavior,
  or error handling. The selector must observe the changed behavior in the diff. That a production
  file changed is not enough on its own.
- `bug-fix` — artifact kinds `source`, `ticket`. Fires when the change is a fix for a reported
  defect. The selector must observe the fix and the report or ticket it answers.
- `test-change` — artifact kinds `test`, `test-config`, `ci-config`. Fires when tests, fixtures,
  mocks, harness configuration or the CI test step change, including a skip, a removed assertion,
  a loosened matcher or a lowered coverage threshold. The selector must observe the changed test
  or setting.

**On ambiguous evidence this pack may decline.** If the selector cannot tell whether a production
change alters behavior, as with an internal restructuring whose existing tests stay unchanged and
green, it may decline. It then records the decline in the `attachment_record`'s `rejected` list
with the reason, for example "internal extraction, existing tests unchanged and passing". A decline
with no recorded reason is not a decline. It is a pack that silently failed to attach.

## Does not attach when

- The change only renames, reformats or moves code, with no behavior change, even though tests
  exist nearby.
- An internal refactor leaves observable behavior unchanged and the existing tests pass unmodified.
  The green suite is the evidence (protocol `tdd`, "Not for").
- Documentation, comments or non-executable configuration change with no effect at runtime.

## Constraints

- `behavior-has-test` (evidence-required) — Every new or changed behavior has a test that exercises
  it through its public interface, and the test name says what behavior it verifies. Most
  permissive `autofix_class`: `advisory`.
- `prove-it-for-fixes` (evidence-required) — A bug fix carries a reproduction test, and the change
  shows that test failing on the code before the fix. A test that passed on its first run may not
  test what it claims. Most permissive `autofix_class`: `advisory`.
- `no-weakened-tests` (must-not) — The change does not skip or disable a test, weaken an assertion,
  lower a threshold or remove coverage to make the suite pass, without a separate recorded decision.
  A CI repair restricts the purpose of the change, not the standard it meets. A repair that needs a
  product-code change leaves CI repair and goes back to diagnosis (ruling
  `ci-repair-restricts-purpose-not-permission`). Most permissive `autofix_class`: `manual`.
- `suite-actually-ran` (evidence-required) — The receipt shows the repository's own test command
  ran after the last change, not a default command and not a repeat of an earlier run on unchanged
  code. Most permissive `autofix_class`: `advisory`.

A missing-test finding proposes what to test. It does not write the test unsupervised, which is why
most of these cap at `advisory`. These are ceilings, never grants: which seat may emit `safe_auto`
is a property of the seat (ruling `safe-auto-restricted-per-seat`).

## Reviewer guidance

Correctness is the only unconditional seat. The testing seat is conditional, selected from artifact
evidence and the packs attached, and this pack's attachment is that evidence (ruling
`panel-composition-by-declared-risk`).

- `code-review/testing` — Checks each constraint: coverage of the changed behavior, the
  failing-first evidence for a fix, weak or implementation-coupled assertions, and any skip or
  loosened threshold. Not made required by attaching, since correctness can still judge the
  behavior. A missing testing seat is reported, not treated as a clean pass.
- `code-review/correctness` — Always seated. The pack asks it to check that the tests assert the
  intended behavior, not merely the behavior the code now has.

## Project facts

The test pyramid split and the change-size target are advisory starting points, carried in the
project record's `guidance` block and read from there. Neither is stated here, neither is
validated or enforced, and neither is grounds for a finding on its own. A departure is recorded as
an exception in the project record rather than answered with an artificial split or a meaningless
test (ruling `numeric-heuristics-are-guidance`). The project's test command, frameworks and any
coverage policy are project facts read through `readContext` (ruling
`central-kb-owns-project-artifacts`). The `kb_rules` entries in `pack.yaml` name them.

## Rationalizations this pack counters

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| "It's just a spike, skip tests." | Spikes become production code, and the claim does not change what the diff does. | Evaluate the diff. If the work really is throwaway, record that decision where the project keeps exceptions. |
| "I'll write tests after the code works." | Tests written afterwards test the implementation, not the behavior, and often never get written. | Show a test for each changed behavior in this change. |
| "I tested it manually." | Manual testing does not persist. Tomorrow's change can break it with no signal. | Capture the manual check as an automated test. |
| "The test passed first time, so it works." | A test that never failed may not test what it claims. | For a fix, show it failing on the pre-fix code. |
| "Skip the flaky test to get CI green." | Skipping a test removes coverage, and CI repair does not authorize that. | Diagnose the flake, or record a separate decision to quarantine it. |
| "The pyramid says we need more unit tests, so this fails." | The split is advisory guidance carried in the project record, never a finding on its own. | Judge whether the changed behavior is tested. Record any departure as an exception. |
