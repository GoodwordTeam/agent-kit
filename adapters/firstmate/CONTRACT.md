# adapters/firstmate — supervisor contract

Firstmate supervises. agent-kit judges, inside the worker. no-mistakes delivers, as super-ship's
transport. This file says who owns what when the three run together, what Firstmate must be patched
to allow, and what a worker in delivery mode `agent-kit` may write back (ruling
`firstmate-outer-loop-agent-kit-inner`).

Firstmate is the only outer supervisor. Nothing here makes agent-kit a second one: it adds no
dispatcher, no watcher and no merge path, and it never writes Firstmate's state files. The runtime
pieces agent-kit would need in order to supervise — a runner, a knowledgebase client, a run ledger,
autopilot — are not built, and this adapter is written so that it does not need them to be.

The files beside this one:

| File | For whom | What it is |
|---|---|---|
| `SUPERVISOR.md` | Firstmate | A compact index of what agent-kit offers a supervisor, loaded on demand |
| `WORKER.md` | The worker | The brief section `ak firstmate bind` renders into a Firstmate brief |
| `CHILD-ROLES.md` | The worker's children | The envelope a task-local child runs inside |
| `hooks/child-guard.sh` | The Claude Code host | The PreToolUse hook that enforces part of that envelope |
| `upstream/a5d78f8/0001-agent-kit-mode.patch` | A Firstmate maintainer | The opt-in delivery mode this adapter depends on |

---

## 1. Capabilities and side effects

This adapter supplies `firstmate-supervision` (`common#/$defs/capability`): a supervisor outside
the worker that dispatched the task, holds its steering inbox, watches its PR and owns merge.
Neither coding-agent host provides it.

### Capabilities this adapter supplies

| Capability | Unconfigured | What the refusal is |
|---|---|---|
| `firstmate-supervision` | `fails-closed` | `ak firstmate preflight` and `ak firstmate bind` refuse, and a Firstmate patched with 0001 refuses to scaffold or launch an `agent-kit` task. Never a worker that runs the lifecycle with no supervisor behind it |

This adapter does **not** supply `kb-write`, and nothing about running under Firstmate lifts a
skill that requires it. Evidence that must reach the knowledgebase fails closed until a knowledgebase
exists (`adapters/knowledgebase/CONTRACT.md` §1). The one exception is a binding whose evidence store
is a labeled `mock`, which the binding schema forces to `dry-run` so it can never back a publish
(`schemas/firstmate-binding.schema.json`).

Side effects this adapter adds: none. super-ship's `remote-push` and `pr-open` go through no-mistakes
but stay super-ship's effects, keyed per `adapters/runner-contract/CONTRACT.md` §5.

---

## 2. Ownership

One owner per concern. Where two parties could act, the one named here acts and the other does not.

| Concern | Owner |
|---|---|
| Intake, dispatch, worktree, steering, recovery, PR watch, merge (yolo only), teardown | Firstmate, unchanged |
| Scout, build, verify, specialist review, fixes, delta review, the fix-cycle cap, the ship decision | agent-kit, inside the worker |
| Deterministic re-check of the shipped head (test, lint), push, PR, CI | no-mistakes, started by super-ship as its transport |
| Review judgment | agent-kit only |

no-mistakes runs with `--skip review,document,rebase` on every push, so there is no second review
pipeline and no commit the lifecycle did not review. The mechanics are in
`skills/super-ship/references/transport-no-mistakes.md` (ruling `no-mistakes-as-ship-transport`).

### Fleet agent and task-local child

These are different things, and confusing them is what the worker-role patch exists to prevent
(ruling `task-local-child-not-fleet-task`).

| | Fleet agent | Task-local child |
|---|---|---|
| Started by | Firstmate | The worker, inside its own task |
| Owns | A task | Nothing; the worker keeps ownership |
| Visible to Firstmate | Yes: a status file, an inbox, a worktree | No |
| Depth | Any Firstmate allows | 1 (`common#/$defs/child`) |
| Scope | Its brief | A subset of the worker's bound scope |
| May push, merge, open a PR, dispatch, contact a human | Per its brief | Never |
| Budget | Its own | Charged to the parent's persistent budget |

When autopilot needs two independent supervisor judgments, Firstmate arranges them as separately
dispatched agents. A worker's own children are never those judges: a judgment made by a helper the
worker started is not independent of the worker (ruling `missing-supervisor-never-implementer`).

---

## 3. Compatibility

| Firstmate | What works |
|---|---|
| **Unmodified upstream** (`a5d78f8` or later, no patch) | Nothing in this adapter. The worker role forbids delegation outright and the supervisor rule gives no-mistakes sole ownership of review, so an agent-kit lifecycle inside a Firstmate worker contradicts its own brief. `ak firstmate preflight` reports this and refuses |
| **Upstream `a5d78f8` with patch 0001** | Delivery mode `agent-kit` for Claude Code workers with the child guard enforced; other harnesses with the guard declared but not enforced (§5). Everything in §2 and §4 |
| **Not supported yet** | Evidence published to a knowledgebase (none exists); runner-validated grants (no runner); autopilot (a contract); cross-task child budgets (no run ledger); any Firstmate commit the patch does not apply to cleanly |

The patch is version-bound. It is carried here, under the upstream commit it was made against, and
it is never applied to a live Firstmate home by any `ak` command. `ak firstmate preflight` checks
that the home contains the upstream commit and that the patch is already applied, by a reverse
`git apply --check`; `ak firstmate install` refuses on a home where it is not.

`ak firstmate install` writes into the home's `config/` only: `agent-kit.env`, which holds exactly
the three keys the patch parses (`AK_FIRSTMATE_BIN`, `AK_FIRSTMATE_PATCH`,
`AK_FIRSTMATE_WORKER_SETTINGS`) and which the patch refuses if it holds any other;
`agent-kit/worker-settings.json`, whose hook command carries `'__AK_FIRSTMATE_BINDING__'`, in
single quotes, for the patch to replace with the task's bare binding path; and, when an evidence store is given,
`agent-kit/evidence.env`, which only `ak` reads. It is idempotent and `ak firstmate remove` deletes
exactly those.

---

## 4. Status lines

The worker reports to Firstmate the way every Firstmate worker does: by appending one line to its
status file. agent-kit maps its run outcome onto Firstmate's verbs and writes nothing else. It never
reads or writes `state/`, never edits the brief, and never touches another task's files.

| `run_state` | Status line |
|---|---|
| `complete` (PR open, checks green) | `done [at=<epoch>]: PR <url> checks green evidence=<ref>,<ref>` |
| `complete` in `dry-run` | `done [at=<epoch>]: dry-run ship prepared, nothing published evidence=<ref>` |
| `needs-input` | `needs-decision [at=<epoch>]: <the decision, named>` |
| `cap-reached` | `needs-decision [at=<epoch>] [key=fix-cap-<run>]: fix-cycle cap reached; blocked or replan; open findings=<ids>` |
| `failed` | `failed [at=<epoch>]: <reason>` |
| `cancelled` | `failed [at=<epoch>]: cancelled: <by whom>` |
| any state, with a child whose outcome is unknown | `blocked [at=<epoch>]: child <id> state unknown` |

The last row wins over every other. A worker that cannot say what one of its children did has not
finished, and it keeps ownership of the task rather than reporting `done` and leaving the child's
effects unowned. `ak firstmate status <binding> <outcome>` prints these lines; it writes nothing.

`evidence=` refs are the verification receipts and the review the ship rested on, by artifact id.
With no knowledgebase they point into the labeled mock store, and the line says `dry-run`.

---

## 5. Trust boundary

A declaration is not enforcement (plan §1.2). What each claim in this contract rests on:

| Claim | Enforced by | Where not enforced |
|---|---|---|
| The worker cannot widen its binding | The binding lives in `data/<task-id>/` in the Firstmate home, outside the worktree | A harness running outside Firstmate's worktree isolation |
| The worker runs the pinned bundle | The bundle is content-addressed under `~/.agent-kit/pins/<sha256>/`, and the binding names the hash | Nothing stops a worker reading another copy; the review of its receipts is what catches it |
| A child does not push, merge, open a PR, run `fm-*` or no-mistakes, or write outside its destination | `hooks/child-guard.sh`, on Claude Code | Every other harness: the rule is prose in the brief and nothing more |
| The pipeline creates no unreviewed commit | `--skip review,document,rebase` plus `auto_fix.{test,lint,ci}: 0`, which `ak firstmate preflight` requires | A repository whose trusted config is changed after preflight |
| The ship decision is the lifecycle's | super-ship's preconditions: receipts and a verdict bound to the shipped snapshot | A worker that pushes by hand; Firstmate's done gate then sees a head with no receipts |

The child guard can tell a child from its parent only because the host says so. Claude Code's
PreToolUse input carries `agent_id` and `agent_type` for a call made inside a subagent and omits
both for the main thread; that was observed on Claude Code 2.1.281, and the guard acts on no other
signal. A host version that stops sending those fields turns the guard into a no-op, so
`ak firstmate preflight` names the host version it last verified and the guard's tests pin the
input shape.
