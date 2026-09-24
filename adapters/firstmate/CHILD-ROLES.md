# adapters/firstmate — task-local child roles

A task-local child is a helper the worker starts inside its own Firstmate task. It is not a fleet
agent: Firstmate never sees it, it owns nothing, and the worker keeps the task (ruling
`task-local-child-not-fleet-task`, CONTRACT.md §2).

This file adds no role. Each child runs an existing role unchanged and inside the envelope below. What
the role judges, what it must be given and what it returns are in the role's own file.

| Child role | Role file | What the worker uses it for |
|---|---|---|
| `implementer` | `roles/implementer/ROLE.md` | One approved ticket, built exactly as written |
| `reviewer-spec` | `roles/reviewer-spec/ROLE.md` | Whether the result matches what was asked |
| `reviewer-standards` | `roles/reviewer-standards/ROLE.md` | Whether the result meets the project's declared standards |
| `code-review/<seat>` | `roles/code-review/<seat>/ROLE.md` | One seat of the `super-review` panel, selected by declared risk |

The `supervisor` role is never a child. A judgment made by a helper the worker started is not
independent of the worker, so when autopilot needs the two supervisor judgments, Firstmate dispatches
them as separate agents (ruling `missing-supervisor-never-implementer`).

## The envelope

Every child carries a `common#/$defs/child` record, which the worker writes before starting it:

| Field | Rule |
|---|---|
| `parent_run_id` | The worker's run, from the binding |
| `role` | One of the rows above, and listed in the binding's `child_budget.roles` |
| `scope` | A subset of the worker's bound scope, as globs. Never wider |
| `permissions` | Only what the role needs: `workspace-write` for an implementer, `artifact-write` for a reviewer seat |
| `artifact_destination` | The one place the child writes its result. A reviewer seat's raw output is preserved there before synthesis reads it |
| `budget` | Charged to the parent run. A child has no budget of its own |
| `depth` | 1. A child never starts a child |

The binding's `child_budget` caps how many children the task may start in total and at once. A child
that would exceed it is not started.

## What a child never does

- Push, merge, open a pull request, or run no-mistakes.
- Run Firstmate (`fm-*`), write a status line, or touch another task's files.
- Start an agent: `Task`, `Agent`, `claude`, `codex`.
- Contact a person. A question goes back to the worker as the child's result.
- Write outside its destination. On Claude Code the guard allows the worktree, the evidence store and
  scratch space, and the worker checks the destination itself.

On Claude Code, `hooks/child-guard.sh` enforces the first four and the coarse form of the last
(CONTRACT.md §5). On any other harness these are rules in the brief and nothing more; the adapter says
so rather than implying enforcement it does not have.

## Ownership of a child's outcome

The worker records every child it started and the state each one ended in. A child whose outcome the
worker cannot state — it did not return, returned something unreadable, or was lost with a relaunch —
keeps the task open: the worker reports `blocked` and does not report `done` (CONTRACT.md §4).
