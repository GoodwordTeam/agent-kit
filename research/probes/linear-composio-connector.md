# `linear-composio-connector` qualification record

The qualification record for `adapters/tracker/backends/linear-composio-connector.md`, as
`linear-linearis.md` §3 records its probe. **Status: not qualified.** The offline cases are committed
tests; the live read-only cases ran only as raw connector reads made before this binding existed;
no live write case has run. A connector call that succeeds is not qualification of this binding: a
row below counts only when it ran through the binding's procedure and its read-back matched.

Organization, team, project, label and parent ids below are those of the first project to bind this
backend. The account alias is selection metadata, not a credential. Personal names and email
addresses returned by the connector are omitted.

## Offline cases (Q-O)

Each case runs the source checkout's `bun run src/cli.ts tracker check <fixture>` as a child process,
in `tests/tracker-binding.test.ts`, describe block `linear-composio-connector offline matrix`.

| ID | Case | Expected |
|---|---|---|
| Q-O1 | Valid binding, account file present and mode 600, ignore rule committed | exit 0 |
| Q-O2 | Account file absent | exit 1, `tracker.secret-absent` |
| Q-O3 | Account file blank | exit 1, `tracker.secret-empty` |
| Q-O4 | Account file mode 644 | exit 1, `tracker.secret-mode` |
| Q-O5 | Account file tracked | exit 1, `tracker.secret-tracked` |
| Q-O6 | `organization` not a UUID; `team` missing; `statuses` missing | exit 1, `tracker.binding-invalid` |
| Q-O7 | `statuses` without `blocked` | exit 0; the refusal of `blocked` is the document's (§5), checked by inspection |
| Q-O8 | The package without this backend's document (negative control) | exit 1, `tracker.backend-unknown` |

The same block also checks that an unlisted `defaults` key or another `account_kind` is
`tracker.binding-invalid`, that a two-word or mode-`400` account file passes `tracker check` (the
word count and exact mode are the operator's preflight, not the check's), and that `ak doctor`'s
embedded validators (`parseBinding`, `checkToken` in `src/maintenance/cli.ts`) report the binding
and its account file PASS.

**Failing first.** Before the backend document, schema and validator entry existed, every case in
that block failed against the tree at base `e60eef17b669fd06fc5ac38466e3c9d2014d17d7` with only the
new tests added: the fixtures' backend was unknown, so the secret and schema cases reported
`tracker.backend-unknown` instead of their own rule. That run is a working-tree measurement; its
receipt is kept with the run's evidence outside this repository. The green run is the committed
tests at the commit that adds this record, and its figure is quoted only with that revision.

## Live read-only cases (Q-L1, Q-L2, Q-L9)

| ID | Case | Expected | Result |
|---|---|---|---|
| Q-L1 | `organization`, `viewer` and one known issue under the selected account | The pinned organization; the issue readable | **Observed as a raw read, 2026-10-04 around 03:05Z**, and the organization again at 03:37:39Z (connector log `log_Y1MRCc62zrlF`): organization `b9e20950-eb5e-499b-a192-516407241f09`. Not run through this binding |
| Q-L2 | The same issue under a different connected account | Not found | **Observed as a raw read, around 03:05Z**: `Entity not found: Issue`. One read; it shows that account cannot see that issue, not a general isolation proof |
| Q-L9 | `readTickets` with the exact team, project and `labels.some` filter | The project's labelled issues; `hasNextPage` false | **Observed as a raw read, 2026-10-04 03:40:11Z** (connector log `log_EBbEiJKX_OFg`): three issues, all in project `63131224-a0e7-47e3-b6e3-5c5101110196`, `hasNextPage` false, organization `b9e20950-…`. A scope read, not a `readTickets` through this binding |

## Live write cases (Q-L3..Q-L8, Q-L10..Q-L14)

Run by the run's writer only, on one sandbox child issue, after a bundle built from this fork is in
use and the project's binding names this backend. **None has run.** Each row records, when it runs:
the time, the `account` argument, the GraphQL sent, the connector log id, the pre-read, the
read-back and the session audit read.

| ID | Case | Expected | Result |
|---|---|---|---|
| Q-L3 | `createTicket` twice with the same key | One issue; the second records success with no create | Not run |
| Q-L4 | `linkRecord` twice; `addBlockingEdge` twice | One attachment; one edge | Not run |
| Q-L5 | `createTicket` with a reused key and a changed input | Stopped and escalated; no write | Not run |
| Q-L6 | A second seat asks to claim the claimed sandbox issue | Refused naming the holder; no new claim record; assignee unchanged | Not run |
| Q-L7 | `updateStatus` to `in-progress` | State changes; team, project, labels and parent unchanged on read-back | Not run |
| Q-L8 | `updateStatus(blocked)` | Refused before any call | Not run |
| Q-L10 | Resolution comment twice with the same key | One comment with the client id, or the document's fallback applied and re-tested | Not run |
| Q-L11 | Release, then claim by a new seat | Release record g1; claim record g2 for the new seat | Not run |
| Q-L12 | Handoff from seat A to seat B | Release g(n) `handoff-to-<B>`, then claim g(n+1) for B; both read back | Not run |
| Q-L13 | The same task re-dispatched claims again | Success with no write | Not run |
| Q-L14 | Stale release after the holding task settled | Release with reason `stale`, orchestrator evidence recorded; a new claim then succeeds | Not run |

Until every row above has run and matched, the document's "Unconfirmed behaviors" stand: client-id
acceptance on attachments, relations and comments, and what a duplicate id does, are assumptions.
