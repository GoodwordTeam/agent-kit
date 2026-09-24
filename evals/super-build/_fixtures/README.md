# evals/super-build/_fixtures

Shared fixtures referenced by more than one skill's cases via
`context.scaffold_script`. Nested under `super-build/` rather than directly
under `evals/` because `ak validate` (`evals.unknown-skill-directory` in
`src/validation/evals.ts`) treats every directory directly under `evals/` as
a skill's case directory and errors on one that names no skill in
catalog.yaml; a directory one level deeper, with no `case.yaml` of its own,
is outside that check. Living under `super-build/` is bookkeeping only --
`tiny-config-repo` below is shared with `super-review` exactly as if this
were `evals/_fixtures`.

## tiny-config-repo

A minimal, dependency-free Node project (`parseConfig` in `src/config.js`,
tested with `node --test`, no `npm install` needed) used by the two
`firstmate`-tagged delegation-boundary cases:

- `evals/super-build/task-local-child-does-not-ship`
- `evals/super-review/worker-helper-is-not-an-independent-judge`

Each of those cases has its own `scaffold.sh` that copies this fixture into
the run's throwaway workspace, `git init`s it, commits a baseline (and, for
the review case, a second commit implementing ticket T2 — the diff under
review), checks out a task branch, and writes the Firstmate-like task
context (`.agent-kit/task-context.md`) the cases' prompts refer to. Nothing
here is run directly; it is copied by the case-local scaffold scripts.

**A run of either case needs `--scaffold`.** Without it the case's workspace
is empty — nothing to build, nothing to review — which is exactly the
failure mode recorded in `docs/decisions/0002-firstmate-integration.md`
("The two delegation-boundary evals"): both cases scored identically with
and without the plugin because there was no fixture to act on.

## Note on scope

An eval-runner-clean home for a directory like this one — one `ak validate`
does not have to be tricked past by nesting — is a `src/validation/evals.ts`
change (e.g. skipping a directory under `evals/` that holds no `case.yaml`
anywhere beneath it, or that starts with `_`), which is outside `evals/**`
and therefore outside what authored this fixture.
