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

**Test figures are kept apart.**
- Root reported 205 targeted tests passing for the implementation run. That is a historical figure
  as reported; its receipt is outside this repository. No full-suite pass is claimed here.
- A later, separate root run at `f23b00a` passed 24 tests (`tests/catalog-progress.test.ts`,
  `tests/version-gate.test.ts`). It ran in an isolated environment, after the required historical
  objects were fetched. It is an environment regression check of the baseline, not a test of this
  binding.
- Neither run, nor any test count, qualifies the binding. Qualification is the live write rows below.

## Live read-only cases (Q-L1, Q-L2, Q-L9)

| ID | Case | Expected | Result |
|---|---|---|---|
| Q-L1 | `organization`, `viewer` and one known issue under the selected account | The pinned organization; the issue readable | **Observed as a raw read, 2026-10-04 around 03:05Z**, and the organization again at 03:37:39Z (connector log `log_Y1MRCc62zrlF`): organization `b9e20950-eb5e-499b-a192-516407241f09`. Not run through this binding |
| Q-L2 | The same issue under a different connected account | Not found | **Observed as a raw read, around 03:05Z**: `Entity not found: Issue`. One read; it shows that account cannot see that issue, not a general isolation proof |
| Q-L9 | `readTickets` with the exact team, project and `labels.some` filter | The project's labelled issues; `hasNextPage` false | **Observed as a raw read, 2026-10-04 03:40:11Z** (connector log `log_EBbEiJKX_OFg`): three issues, all in project `63131224-a0e7-47e3-b6e3-5c5101110196`, `hasNextPage` false, organization `b9e20950-…`. A scope read, not a `readTickets` through this binding |

## Observed before this binding

| Case | Result |
|---|---|
| `issueCreate` with a client-supplied `id` | **Observed once, outside this binding**, 2026-10-04T03:04:09Z: root created the first project's preparation issue with client id `0b7681c4-b4e5-4c47-af33-a0aed5906266`, and the returned id matched (connector logs `log_aVaLAslxwk58` for the create, `log_iKVjbDc6FHWH` for the read-back). The receipt is kept with the run's evidence outside this repository. It shows acceptance of a client id on `issueCreate` once. It does not show what a second create with the same id does (Q-L3), and it is not qualification |

## Live write cases (Q-L3..Q-L8, Q-L10..Q-L17)

Run only by the writer the run's coordinator designated, recorded with the run id. They run on one
sandbox child issue, after a bundle built from this fork is in use and the project's binding names
this backend. **None has run.** Each row records, when it runs: the time, the run id and writer seat,
the `account` argument, the GraphQL sent, the connector log id, the pre-read, the read-back and the session audit of every call in the execution logs of the selected account and of every other
connected Linear account, with the touched issues read by id. If the session audit is UNAVAILABLE,
because any of those logs cannot be read for the window or the selected account's log lacks a log
id the writer recorded, the row does not pass.

| ID | Case | Expected | Result |
|---|---|---|---|
| Q-L3 | `createTicket` twice with the same key | One issue; the second records success with no create | Not run |
| Q-L4 | `linkRecord` twice; `addBlockingEdge` twice | One attachment, whose read-back `metadata` holds `akIntent`, `akKey` and `akInputHash` equal to the values sent; one edge | Not run |
| Q-L5 | `createTicket` retried under the same run, operation and target (same intent) with an edited input, so the operation key and client id change | The intent lookup finds the first issue by its `ak-intent` footer, with a different `ak-input-hash`. Stopped and escalated; no second issue. Repeated after fixture F-1 below, it is still found | Not run |
| Q-L6 | A second seat asks to claim the claimed sandbox issue | Refused naming the holder; no new claim record; assignee unchanged | Not run |
| Q-L7 | `updateStatus` to `in-progress` | State changes; team, project, labels and parent unchanged on read-back | Not run |
| Q-L8 | `updateStatus(blocked)` | Refused before any call | Not run |
| Q-L10 | Resolution comment twice with the same key | One comment with the client id, or the document's fallback applied and re-tested | Not run |
| Q-L11 | Release, then claim by a new seat | Release record g1; claim record g2 for the new seat | Not run |
| Q-L12 | Handoff from seat A to seat B | Release g(n) `handoff-to-<B>`, then claim g(n+1) for B; both read back | Not run |
| Q-L13 | The same task re-dispatched claims again | Success with no write | Not run |
| Q-L14 | Stale release after the holding task settled | Release with reason `stale`, orchestrator evidence recorded; a new claim then succeeds | Not run |
| Q-L15 | Any write in Q-L3, Q-L4 or Q-L10 whose read-back id differs from the client id sent | The operation is `failed`; the stored id is reported and escalated; the record is not deleted; no further write of that kind until the fallback replay case matches. If every returned id matches, the row records that the refusal path was not exercised, and that path stays UNQUALIFIED; an unexercised refusal is not a pass | Not run |
| Q-L17 | A write (`claimTicket`, `updateStatus` or `linkRecord`) asked for on an existing issue outside `defaults.project`, or without `defaults.label`, named in this record before the row runs | Refused before any call by the existing-issue scope pre-read; scope violation reported; the execution logs show no write to that issue | Not run |
| Q-L16 | A resolution comment, then a `linkRecord` attachment, each retried with the same intent and an edited input | The intent search over the issue's comments, then its attachments, finds the first record with a different `ak-input-hash`; stopped and escalated; no second comment or attachment | Not run |

**Fixture F-1 (for Q-L5), a separately recorded out-of-procedure test step.** The binding forbids an
update that carries labels, so the binding never performs this; root does, explicitly, as a test step
recorded here before it runs:
- **Actor and issue.** Root, as the designated writer, on the disposable sandbox issue Q-L5 created.
- **Exact calls.** `issueUpdate(id: <that issue>, input: {removedLabelIds: ["<defaults.label>"]})`,
  then, after the repeated lookup, the cleanup
  `issueUpdate(id: <that issue>, input: {addedLabelIds: ["<defaults.label>"]})`. Each is read back.
- **Cleanup check.** After cleanup, the issue's labels, team, project and parent equal the read taken
  before F-1.
- **Expected audit exception.** The session audit treats exactly these two calls, and the label
  removal and re-add in the issue's history, as explained. Any other call or change in the session is
  still a violation.
- **Status.** Not run.

Until every row above has run and matched, the document's "Unconfirmed behaviors" stand. These are
assumptions:
- client-id acceptance on attachments, relations and comments, and what a duplicate id does;
- whether the intent lookup finds a footer;
- whether attachment `metadata` is stored;
- whether the execution logs of the selected account and every other connected Linear account cover the session window.

Until Q-L4 and Q-L10 match, a write of those kinds whose outcome is unknown is not replayed.

Every live row also records the writer's designation receipt (run id, writer task id, time), every
log id the writer recorded at a write, and the audit's comparison of those ids with the listed log.
