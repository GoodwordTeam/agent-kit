# Binding `linear-composio-connector` — Linear through a connected account

A backend binding under `adapters/tracker/CONTRACT.md` §5. Everything generic — the chain, the six
operations, the rules every binding obeys — is the contract's; this document states only how this one
binding meets it, and where it cannot, what replaces the rule (ruling
`tracker-of-record-falls-back-to-kb`).

**Reaches system:** `linear`. A project record whose `tracker_policy.system_of_record.system` is
anything else refuses every operation through this binding (CONTRACT §2 step 1).

**Transport:** the coding-agent host's Composio connector, through an account the operator has
already connected to one Linear organization. The connector holds the OAuth credential; no token
reaches the project.

---

## 1. The binding

### The trust ceiling

Read this before anything else in this document. **No code in this package makes, gates or inspects
a connector call.** The package supplies no credential and runs no backend (CONTRACT §5). The calls
are made by the operator agent through the host's tools, and the backend tool this binding uses,
`LINEAR_RUN_QUERY_OR_MUTATION`, executes whatever GraphQL it is sent under the named account. Naming
one tool therefore constrains nothing mechanically. Every "refuse" and "never" below means: this
document instructs the operator not to make the call, and the operator does not make it. Nothing
stops an operator that ignores this document.

Three things hold the rules instead, and each has a stated reach:

- **The mechanical check** is `ak tracker check` (and `ak doctor`'s tracker rows). It validates the
  binding against the generic schema and against
  `schemas/tracker-backends/linear-composio-connector.schema.json`, and it checks the account file's
  hygiene with `checkTrackerSecret` (`src/tracker/binding.ts`). It runs when someone runs it, not on
  every call, and it does not check the account file's word count or its exact mode (§3).
- **Read-back detection.** Every write is followed by a read under the same account that selects
  `organization { id }` and the issue's team, project, parent, labels and state. A mismatch with
  `defaults` or with the pre-read stops the session, and the operation is `failed`.
- **The session audit read.** After each session of writes, the writer reads every issue under
  `defaults.team` carrying `defaults.label` that was updated in the session window, with its history
  entries. A change to team, project, parent or labels that no `createTicket` explains is a
  violation: reported and escalated, never repaired silently.

So tracker writes through this binding stay **guided**. One seat per run is **the writer**: it makes
every write, one at a time, and reads each one back. Other seats read, and ask the writer for writes
(§5, "Claims"). Detection is after the fact and limited to what the read-backs and the audit read can
see. No wrapper or proxy around the host's tool calls exists, and none is implied by this document.

### The binding file

```yaml
# ak.tracker.yaml, at the project root, committed; holds no secret
backend: linear-composio-connector
token_file: .linear-connected-account   # gitignored, chmod 600; holds the connected-account alias (§3)
defaults:
  account_kind: composio-connected-account
  organization: <organization uuid>     # required; the account-scope guard (§3, preflight 4)
  team: <team uuid>                     # required
  team_key: <team key>                  # optional; for reading identifiers, never sent
  project: <project uuid>               # optional
  label: <label uuid>                   # optional
  parent: <parent issue uuid>           # optional
statuses:                               # the team's own workflow state names
  draft: Backlog
  approved: Todo
  in-progress: In Progress
  done: Done
  cancelled: Canceled
```

`schemas/tracker-backends/linear-composio-connector.schema.json` applies after the generic
`schemas/tracker-binding.schema.json`. It requires `defaults.account_kind`, `defaults.organization`
and `defaults.team`, refuses any other key under `defaults`, requires every scope value to be a
lowercase UUID, and requires `statuses` to map at least `draft`, `in-progress`, `done` and
`cancelled`. Scope is by UUID rather than by name so that no call resolves a name against whatever
the account sees first.

A status the binding leaves unmapped is refused by `updateStatus` before any call (CONTRACT §5 rule
5). Leave `blocked` unmapped for a team with no blocked state; do not map it to a state that means
something else.

### Where this binding departs from CONTRACT §5

A connected-account transport cannot meet rules 1 and 2 as written, and the package finds a backend
only inside its own tree. Each departure has a replacement, followed by the operator:

| # | Rule as written | Replacement |
|---|---|---|
| E1 | Rule 1: the tool is a pinned project dependency, invoked by its path | The tool is the host's connector, not a package. The operator calls one backend tool through one route (§2), and names the account on every call (§3) |
| E2 | Rule 2: the credential is read from `token_file` and passed in the call's environment | `token_file` names the per-operator account file. It holds the connected-account alias, which is selection metadata and grants nothing on its own; the OAuth credential never leaves the connector. The operator reads the alias before every call and passes it as `account`. `checkTrackerSecret` applies to the file unchanged |
| E3 | A backend with no document under the package's `adapters/tracker/backends/` is refused | This document is that document, added to a fork of this package. A project reaches it only through a bundle built from that fork, used by explicit path (§2) |

Rules 3 to 6 are kept. **3:** an absent, blank or malformed account file means no call, and no call
relies on the connector's default account. **4:** a rejected or inactive account is `needs-input`,
never retried and never a fall to the knowledgebase. **5:** scope goes on create and list only;
updates never pass team, project, labels or parent; an unmapped status is refused. **6:** nothing
credential-bearing is committed or printed.

The account file is kept private for a reason other than secrecy: each operator binds their own
account deliberately, so nothing committed to the repository can pick an account for them. Preflight
4 (§3) is what guards the account's scope.

---

## 2. Transport

**One backend tool, one route.** Every operation calls `LINEAR_RUN_QUERY_OR_MUTATION`, and only
through the meta tool `COMPOSIO_MULTI_EXECUTE_TOOL`. The only other connector call in this procedure
is `COMPOSIO_MANAGE_CONNECTIONS` with action `list` and toolkit `linear`, read-only, in preflight 3.
Every other route is out of procedure: any other Linear tool slug, any other `COMPOSIO_MANAGE_CONNECTIONS`
action (`add`, `rename`, `remove` change connections), a direct Linear API call, a Linear token, the
`linearis` CLI, or a second connector.

`LINEAR_UPDATE_ISSUE` in particular is never used: its `labelIds` replaces every label, and its
`teamId` and `projectId` move the issue. Where a label must be added, `addedLabelIds` on `issueUpdate`
is the only allowed field.

Running every write through one GraphQL tool is what lets each write carry a client-supplied `id`
and request its read-back fields in the same call (§5).

**Nothing is installed into the project.** There is no tool version to pin. If the connector renames
or removes the tool, the call returns an error and the operation is `failed`; this document is then
changed by a reviewed pull request, never worked around with another slug. Preflight 3 checks that
the account is active, not that the tool exists.

**Where the package comes from.** E3 means the project uses a bundle built from the fork that carries
this document, by explicit path to that bundle's `bin/ak`. `ak update` refreshes from the upstream
marketplace and replaces the fork bundle with one that has no such backend; it is not run while this
binding is selected.

---

## 3. Account and invocation

**The project root** is the nearest directory at or above the working directory holding
`ak.tracker.yaml`, searching no higher than `git rev-parse --show-toplevel` — the same search
`findProjectRoot` performs for `ak tracker check`. With none up to the top level, the folder is
unbound (CONTRACT §2).

**The account file** is `token_file`, inside the project root. It holds exactly one word, the alias
of the operator's connected Linear account, and nothing else. It is mode `600`, ignored by a rule in
a committed `.gitignore`, and never tracked. The operator writes it once, deliberately; the alias is
read from the file for every call, never from the conversation or from memory.

### Preflight

The operator makes no connector call unless all five hold. Steps 1, 2 and 5 hold for every call;
steps 3 and 4 are checked once per session, before the first call.

1. `ak.tracker.yaml` is found at or above the working directory, no higher than the top level.
2. The account file exists, is non-blank, holds a single word, and is exactly mode `600`. The
   operator confirms the last two by inspection: `wc -w < .linear-connected-account` prints `1`, and
   `stat -f %Lp .linear-connected-account` (BSD) or `stat -c %a .linear-connected-account` (GNU)
   prints `600`.
3. `COMPOSIO_MANAGE_CONNECTIONS`, action `list`, toolkit `linear`, shows that alias as `ACTIVE`. An
   alias that is absent or not active is `needs-input`: the operator reconnects the account
   themselves. The agent does not run `add`.
4. `query { organization { id } }`, run under that account, returns exactly `defaults.organization`.
   A different organization ends the session with no write, and is reported.
5. Every `COMPOSIO_MULTI_EXECUTE_TOOL` call names the account on its tool entry: `tool_slug`
   `LINEAR_RUN_QUERY_OR_MUTATION`, `account` set to the alias from the file. A call without `account`
   breaks the procedure, because the connector then uses its default account, which may reach
   another organization.

**What the mechanical check covers, exactly.** At the start of each session the writer also runs
`ak tracker check <project root>` from the fork's source checkout, or the fork bundle's `ak doctor`.
`checkTrackerSecret` confirms that the account file exists, is non-blank, grants no group or other
access, resolves inside the folder, is ignored by a `.gitignore` rule committed at `HEAD`, is
untracked and is absent from every commit reachable from a ref. It does **not** count words and does
**not** require mode `600` exactly: a two-word file or a mode-`400` file passes it. Those two
conditions are the operator's, in step 2. A history scan that does not finish is a warning, and it
is read as unavailable evidence, never as proof that the file was never committed.

**Errors.** A tool result that reports an authentication or connection failure for the account is
`needs-input` naming the operator's fix: reconnect the account, or correct the alias in the file. It
is not retried and never falls to the knowledgebase. A GraphQL error is `failed` with its message. A
result the operator cannot read back is `failed`, never complete.

---

## 4. Setup, when a human asks for it

Setup is not a skill (CONTRACT §5). When a human asks to bind a project to Linear through a connected
account, the agent performs these steps in order and stops at the first that fails.

1. **The human connects the account** in the connector, outside this procedure, and tells the agent
   its alias. The agent does not create, rename or remove connections.
2. **The human writes the account file**, `.linear-connected-account` at the project root, holding
   the alias as its only word, then runs `chmod 600` on it.
3. **Write the binding**, `ak.tracker.yaml`, with the organization, team and the optional scope
   UUIDs the human names, and `statuses` in the team's own state names. Once preflight 3 passes, the
   agent may read candidate UUIDs with read-only queries under that account, each call naming the
   account; the organization id returned is the value for `defaults.organization` only after the
   human confirms it is the intended organization. No write is made before step 5 passes.
4. **Gitignore the account file** in the project's `.gitignore` and commit that rule; an uncommitted
   rule protects only this checkout. Keep any older token file ignored as well, so a stray credential
   can never be committed.
5. **Run `ak tracker check`** from the fork checkout, or the fork bundle's `ak doctor`, and the
   preflight in §3. Every check passes, or setup stops with the failing check named.
6. **Verify with one read-only call**: `readTickets` with the exact `defaults` filter (§5). An empty
   result is a fact, not a failure.

---

## 5. Operation mapping

Every operation below is one `LINEAR_RUN_QUERY_OR_MUTATION` call per GraphQL document, made after the
preflight. Scope from `defaults` is passed to `createTicket` and `readTickets` only. An operation on
an existing issue never passes `teamId`, `projectId`, `labelIds` or `parentId` (CONTRACT §5 rule 5).

| Operation | Pre-read | Write | Never passes | Read-back that must match |
|---|---|---|---|---|
| `createTicket` | `issue(id: <client id>)` | `issueCreate(input: {id, title, description, teamId, projectId, parentId, labelIds: [label], stateId: <draft>})`. No `assigneeId`: a new issue is unassigned until `claimTicket` | — | `id`, `identifier`, `url`, `team.id`, `project.id`, `parent.id`, the label set, the key footer in `description`, `organization.id` |
| `linkRecord` | `issue { attachments { nodes { id url } } }` | `attachmentCreate(input: {id, issueId, url, title})` | `teamId`, `projectId`, `labelIds`, `parentId` | An attachment with that `id` and `url`; `organization.id` |
| `addBlockingEdge` | `issue { relations { nodes { type relatedIssue { id } } } }` on the blocker | `issueRelationCreate(input: {id, issueId: <blocker>, relatedIssueId: <blocked>, type: blocks})` | `teamId`, `projectId`, `labelIds`, `parentId` | One `blocks` edge. Both issues are in `defaults.organization`; a blocker in another organization is not linked |
| `claimTicket` | `issue { assignee { id } attachments { nodes { id url title } } updatedAt }` | The writer only, serialized (see "Claims"): `attachmentCreate` for the claim record, then `issueUpdate(id, input: {assigneeId})` only if unassigned | `teamId`, `projectId`, `labelIds`, `parentId` | The current claim record names this seat; `organization.id` |
| `updateStatus` | `issue { state { id } team { id } project { id } parent { id } labels { nodes { id } } }` | `issueUpdate(id, input: {stateId})`, plus `commentCreate(input: {id, issueId, body})` for the resolution | `teamId`, `projectId`, `labelIds`, `parentId` | `state.id` is the mapped state. Team, project, labels and parent equal the pre-read. The comment with that `id` exists once |
| `readTickets` | — | `issues(filter: {team: {id: {eq: team}}, project: {id: {eq: project}}, labels: {some: {id: {eq: label}}}}, first, after)`, with the `project` and `labels` clauses only when `defaults` sets them | — | Read-only. Returns ref, state, assignee, current claim record, relations and `updatedAt`. The revision is the greatest `updatedAt` read. An empty result is a fact |

The state id for a mapped status is read from the team's workflow states by name, under the same
account, once per session.

### Idempotency and read-back

The key is the runner contract's (`adapters/runner-contract/CONTRACT.md` §5):
`sha256(run_id · operation_id · target_identity · input_artifact_hash)`. `target_identity` is the
Linear issue id, or `team:<team uuid>` for a create. No timestamp, random value or attempt counter
goes in.

- **Client id.** The first 16 bytes of the key, with the UUID version nibble set to `4` and the
  variant bits set to `10`, so every replay sends the same id. Each write above carries it as `id`.
- **Key footer.** A create also writes `ak-key: <key>` and `ak-input-hash: sha256:<hash>` as the
  last lines of `description`, so the stored input hash can be compared on replay.
- **Replay.** The pre-read finds the client id. Same input hash: record success with no second
  effect. Different input hash: stop and escalate, and write nothing.
- **Read-back.** Every write is followed by a read under the same account, including
  `organization { id }`. A write whose read-back cannot be performed is `failed`.

**Fallback if Linear refuses a client id** on an attachment, a relation or a comment: the key moves to
an `ak-key: <key>` line in that record's body or title, the pre-read searches for it, and the
replay cases for that record are run again before this binding is used for it. Until they are, a
write of that kind whose outcome is unknown is not replayed.

### Claims

Every seat writes through one Linear user, so assignment cannot tell seats apart, and Linear offers
no compare-and-swap on attachments. Claims therefore do not race:

- **Who writes claims.** The writer only, one claim operation at a time across the run. A seat asks
  the writer for a claim; it never writes a claim record itself. Two claims for the same issue cannot
  interleave because there is one serialized writer. The contract's known claim race (CONTRACT §6)
  stays open for any writer outside this procedure.
- **Seat identity** is the seat's task id from the orchestrator that runs it, not a dispatch or
  session id. A restart or re-dispatch of the same task is the same seat.
- **Claim record.** An attachment with id `uuid(sha256("claim" · issue id · generation))`, shaped as
  for client ids, title `ak-claim g<generation>`, URL `<issue url>#ak-claim/<generation>/<task id>`.
  Generations start at 1.
- **Release record.** An attachment with id `uuid(sha256("release" · issue id · generation))`, title
  `ak-release g<generation>`, URL `<issue url>#ak-release/<generation>/<reason>`. Records are never
  deleted.
- **Current holder.** The highest-generation claim record with no release record of the same
  generation.
- **Claim.** No current holder: write claim generation n+1 (n is the highest generation seen, 0 if
  none) for the seat, assign the issue if it is unassigned, then read back.
- **Re-claim by the same seat** succeeds with no write.
- **Claim by another seat** is refused, naming the holder's task id. The writer does not reassign.
- **Handoff.** Release generation n with reason `handoff-to-<task id>`, then claim generation n+1 for
  the new seat, in that order, each read back.
- **Stale claim.** There is no timeout. The writer releases with reason `stale` only after the
  orchestrator shows the holding task settled, failed or cancelled, and records that evidence.
- **Closing.** `updateStatus` to `done` or `cancelled` ends claims; the writer writes a final release
  so the record is explicit.

### Refusals before any call

- Any preflight step fails.
- `updateStatus` with a status `statuses` does not map.
- Any write on an existing issue that would carry `teamId`, `projectId`, `labelIds` or `parentId`.
- `addBlockingEdge` or `linkRecord` naming an issue outside `defaults.organization`.
- A replay whose stored input hash differs from the current one.
- A claim for a seat while another seat holds the issue.

### Unconfirmed behaviors

None of these is relied on by a rule above; each is settled by a live case in
`research/probes/linear-composio-connector.md` before the binding is called qualified.

- Whether Linear accepts a client-supplied `id` on `attachmentCreate`, `issueRelationCreate` and
  `commentCreate`, as it does on `issueCreate`, and what a second write with the same id does:
  rejects, or overwrites. The input types carry an `id` field; acceptance is untested.
- The argument field names `LINEAR_RUN_QUERY_OR_MUTATION` takes for the GraphQL document and its
  variables. They are read from the tool's own input schema at the time of the call, not assumed
  here.
- Whether an unmapped transition that Linear's workflow refuses comes back as a GraphQL error or as
  an unchanged state.

### Verified results

What has been executed, and what has not. A connector call that succeeds is not qualification of
this binding: the binding is qualified only when every row below has run through it and matched.

| Case | Status |
|---|---|
| Offline: binding valid, account file absent, blank, mode 644, tracked; invalid `defaults`; unmapped `blocked` passes the schema; the package without this document refuses the backend | Committed as tests in `tests/tracker-binding.test.ts`, run through `ak tracker check` as a child process |
| Organization read under the selected account; another connected account cannot read an issue in the organization | Observed read-only before this binding existed; one read each, not an isolation proof |
| `readTickets` exact filter | Observed once read-only as a raw query before this binding existed; not yet run through the binding |
| Create, link, edge and comment replay; changed-input refusal; other-seat claim refusal; update preserves scope; unmapped status refusal; release, handoff, re-claim and stale release | Not run |

The probe record carries each row's evidence, time and account, and it is where a live result is
recorded when it runs.
