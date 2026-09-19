# Review protocol

One pass, then a receipt. This body exists so the packaged copy of
`references/guide/REFERENCE.md` has a real directory to link at; it carries the
full §12.1 shape so the only error this fixture raises is the broken bundle link.

## When to use

Invoked by `alpha` at its review phase, once a receipt exists.

## Not for

Not for the author's own self-check mid-build.

## Invoked by

`alpha`, through its `review` phase operation. No human trigger of its own.

## Inputs

A verification receipt bound to the reviewed head. No receipt: stop.

## Workflow

1. Freeze the snapshot.
2. Run the lanes against the snapshot.
3. Return the findings.

## Hard gates

Gate: a required lane that did not run is `unavailable` and blocks approval.

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| "The other lanes agreed, the missing one would not have changed it." | An unavailable required lane is not a passing lane (ruling `required-lane-failure-is-unavailable`). | Mark the lane unavailable, block approval, name it. |

## Outputs

One finding ledger, returned to the invoking skill.

## Side effects

`artifact-write`. No `workspace-write`: this protocol never edits.

## Stop conditions

`complete` when every lane returned; `blocked` when a required lane is unavailable.

## Limits

Lanes: as seated by the caller (gate). Fix cycles: owned by the caller.
