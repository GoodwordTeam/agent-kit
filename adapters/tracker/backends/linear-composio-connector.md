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
- **The session audit read.** A **session** runs from the writer's preflight 3 to its audit read,
  under one account, one writer and one run. After each session of writes, the writer lists
  **every call** in the connector's execution log for the selected account over the session window,
  whatever its tool slug. The operator's notes are not the source of that list.
  - **Every connected Linear account.** For the same window, the writer also lists the execution log
    of every other Linear account that preflight 3's `list` returned, connected or not active. A call
    made without `account` lands in the connector's default account. A call made under another alias
    lands in that alias's log. Neither appears in the selected account's log.
  - **Calls in another account's log.** Any call there that this session made is a violation. So is
    any call in the window that no seat or person has attributed, in writing, to a source outside
    this session.
  - **Any unreadable log.** If any of those logs, the selected account's included, cannot be read for
    the window, the audit is **UNAVAILABLE**.

  Then:
  - **Out-of-procedure calls are violations.** Any call whose slug is not
    `LINEAR_RUN_QUERY_OR_MUTATION` or the preflight's `COMPOSIO_MANAGE_CONNECTIONS` `list` is a
    violation. So is any GraphQL document holding a mutation other than `issueCreate`,
    `attachmentCreate`, `issueRelationCreate`, `commentCreate`, or `issueUpdate` whose input has only
    `stateId` or `assigneeId`.
  - **Touched ids.** Every issue id in any mutation's input or result is collected, whatever the
    mutation. That includes both `issueId` and `relatedIssueId` of a relation.
  - **Read by id.** Each touched issue is read by id, whatever its current team, project or labels,
    together with its history entries. A change to team, project, parent or labels that no
    `createTicket` explains is a violation. An id that cannot be read by id (deleted, trashed or not
    found) is a violation, never skipped.
  - **Out-of-scope issues.** A touched issue that this session did not create is a violation when any
    of these holds:
    - its `team.id` differs from `defaults.team`;
    - `defaults.project` is set and its `project.id` differs;
    - `defaults.label` is set and that label is not among its labels.

    The one exception is the recorded fixture window below.
  - **Coverage.** At each write the writer records the call's connector log id. Every recorded log id
    must appear in the listed log. If one is missing, or the log for that account and window cannot
    be read, the audit is **UNAVAILABLE**.
  - **Recorded fixture exception.** The audit treats exactly one kind of thing as explained without
    a `createTicket`: a qualification fixture the probe record names in advance. The record names
    the fixture's disposable issue, its exact calls and change, and its cleanup. Those calls and that
    change, and nothing else, are explained. Any other call or change stays a violation. This
    exception grants no write permission: the fixture is a separately recorded test step outside
    this procedure, never an operation of the binding.

  A violation is reported and escalated, never repaired silently. An UNAVAILABLE audit is never read
  as clean: the session's result is not complete, and the writer escalates it to the coordinator. A
  live qualification row whose session audit is UNAVAILABLE does not pass: it fails closed.

So tracker writes through this binding stay **guided**. **The writer** is the one seat the run's
coordinator designates. The coordinator records the designation in a run receipt: the run id, the
writer seat's task id and the time it was made. Every seat can read that receipt before it asks for
a write. A seat that cannot read a designation naming itself makes no write. **Re-designation.** The
coordinator designates a new writer only after the orchestrator shows the previous writer task
settled, failed or cancelled. It records that evidence in the new designation's receipt. Two live
writers in one run are never designated. The writer makes every write, one at a time, and
reads each one back. Other seats read, and ask the writer for writes (§5, "Claims"). The serial
guarantee holds only **within one run with its one designated writer**. It says nothing about two
runs writing concurrently, a second writer, or a person editing in Linear. Any of those reopens the
claim race in CONTRACT §6. Detection is after the fact and limited to what the read-backs and the
audit read can see. No wrapper or proxy around the host's tool calls exists, and none is implied by
this document.

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
`teamId` and `projectId` move the issue. No operation in this binding adds a label. If one ever must,
`addedLabelIds` on `issueUpdate` is the only allowed field, and only after a reviewed change to this
document; until then the session audit reports it as a violation.

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
steps 3 and 4 are checked once per session, before the first call. The one carve-out is setup (§4
step 3). Before `defaults.organization` exists, read-only discovery reads may run once steps 1, 2, 3
and 5 hold. No write is made until all five hold.

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
is read as unavailable evidence, never as proof that the file was never committed. In a folder that
is not inside a git repository, the check only warns (`tracker.not-a-git-repository`). It then skips
the ignore, tracked and history checks, so it is not evidence for any of them.

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
| `createTicket` | The intent lookup, then `issue(id: <client id>)` (see "Idempotency") | `issueCreate(input: {id, title, description, teamId, stateId: <draft>})`, adding `projectId`, `parentId` and `labelIds: [label]` only when `defaults` sets them. No `assigneeId`: a new issue is unassigned until `claimTicket` | — | `id`, `identifier`, `url`, `team.id`, the `project.id`, `parent.id` and label set that `defaults` set, the footer in `description`, `organization.id` |
| `linkRecord` | The scope pre-read ("Existing-issue scope"), then `issue { attachments { nodes { id url metadata } pageInfo { hasNextPage endCursor } } }` | `attachmentCreate(input: {id, issueId, url, title, metadata: {akIntent, akKey, akInputHash}})` | `teamId`, `projectId`, `labelIds`, `parentId` | An attachment with that `id` and `url`, and `metadata` holding all three of `akIntent`, `akKey` and `akInputHash` with the values sent; `organization.id`. Missing or different metadata is a refusal, as for a returned id (see "Idempotency") |
| `addBlockingEdge` | The scope pre-read on **both** the blocker and the blocked issue, then `issue { relations { nodes { type relatedIssue { id } } pageInfo { hasNextPage endCursor } } }` on the blocker | `issueRelationCreate(input: {id, issueId: <blocker>, relatedIssueId: <blocked>, type: blocks})` | `teamId`, `projectId`, `labelIds`, `parentId` | One `blocks` edge. Both issues are in `defaults.organization` and in the scope `defaults` sets |
| `claimTicket` | The scope pre-read, then `issue { assignee { id } attachments { nodes { id url title } pageInfo { hasNextPage endCursor } } updatedAt }` | The writer only, serialized (see "Claims"): `attachmentCreate` for the claim record, then `issueUpdate(id, input: {assigneeId})` only if unassigned | `teamId`, `projectId`, `labelIds`, `parentId` | The current claim record names this seat; `organization.id` |
| `updateStatus` | The scope pre-read, then `issue { state { id } parent { id } comments { nodes { id body } pageInfo { hasNextPage endCursor } } }` | `issueUpdate(id, input: {stateId})`, plus `commentCreate(input: {id, issueId, body})` for the resolution, with the footer as the body's last lines | `teamId`, `projectId`, `labelIds`, `parentId` | `state.id` is the mapped state. Team, project, labels and parent equal the pre-read. The comment with that `id` exists once |
| `readTickets` | — | `issues(filter: {team: {id: {eq: team}}, project: {id: {eq: project}}, labels: {some: {id: {eq: label}}}}, first, after) { pageInfo { hasNextPage endCursor } }`, with the `project` and `labels` clauses only when `defaults` sets them, paged to the end ("Paged reads") | — | Read-only. Returns ref, state, assignee, current claim record, relations and `updatedAt`. The revision is the greatest `updatedAt` over the complete read; a partial read yields no revision. An empty result is a fact |

**Paged reads.** Every connection read in this document selects `pageInfo { hasNextPage endCursor }`
and follows `endCursor` until `hasNextPage` is false. That covers:
- `issues`;
- an issue's `comments`, `attachments`, `relations` and `labels`;
- a team's `states`.

It applies in every pre-read, scope read, state lookup, intent search, claim read and audit read. A page that
errors fails the whole read: `readTickets` is `failed`, and a failed pre-read refuses the write it
guards. A partial result is never used, and no revision is computed from one.

**Existing-issue scope.** Every write on an existing issue is preceded by a scope pre-read of that
issue under the same account:

`issue(id) { team { id } project { id } labels { nodes { id } pageInfo { hasNextPage endCursor } } }`,
with labels paged to the end.

That covers `linkRecord`, `addBlockingEdge` (on both the blocker and the blocked issue),
`claimTicket` (its claim and release attachments and its `assigneeId` update) and `updateStatus` (its
`stateId` update and its resolution comment). The write is refused before any call, as a scope
violation that the session audit also reports, unless all three hold:
- `team.id` equals `defaults.team`;
- `project.id` equals `defaults.project`, when `defaults` sets `project`;
- `defaults.label` is among the issue's labels, when `defaults` sets `label`.

The recorded fixture's two calls are outside this procedure and are not writes of this binding.

**State lookup.** Once per session, under the same account, the writer runs
`query { team(id: "<defaults.team>") { states { nodes { id name } pageInfo { hasNextPage endCursor } } } }`,
paged to the end. A mapped status
resolves to its state id only when exactly one state's `name` equals the mapped name byte for byte:
no case folding, no trimming, and no state from another team. Zero or several matches refuse the
operation with `needs-input`, naming the status and the names read. A state id from this lookup is
sent only for an issue that passes the existing-issue scope pre-read. An issue outside that scope is
refused before any write and reported as a scope violation.

### Idempotency and read-back

Two identities, kept apart:

- **Operation key** (the runner contract's, `adapters/runner-contract/CONTRACT.md` §5):
  `sha256(run_id · operation_id · target_identity · input_artifact_hash)`. It depends on the input.
- **Intent** (this binding's): `sha256(run_id · operation_id · target_identity)`. It does not
  depend on the input, so a retry of the same operation with an edited input keeps the same intent.

`target_identity` is the Linear issue id, or `team:<team uuid>` for a create. No timestamp, random
value or attempt counter goes into either.

- **Client id.** The first 16 bytes of the operation key, with the UUID version nibble set to `4` and
  the variant bits set to `10`, so a replay with the same input sends the same id.
  - `createTicket`, `linkRecord`, `addBlockingEdge` and the resolution `commentCreate` carry it as
    `id`.
  - `issueUpdate` addresses an existing issue and carries no client id.
  - Claim and release attachments carry their own derived ids ("Claims").
- **Footer.** The intent, the operation key and the input hash are written into the record:
  - In a create's `description`, and in a resolution comment's `body`, as the last three lines:
    `ak-intent: <intent>`, `ak-key: <key>` and `ak-input-hash: sha256:<hash>`.
  - On a `linkRecord` attachment, as `metadata`.
- **The client-id pre-read detects only a same-input replay.** A changed input gives a new operation
  key, so it also gives a new client id, and `issue(id: <client id>)` then finds nothing. That
  lookup can never detect a changed input, and nothing in this document relies on it to.
- **Intent lookup, before a create.** The writer first runs
  `issues(filter: {description: {contains: "ak-intent: <intent>"}}, includeArchived: true)
  { nodes { id identifier description team { id } } pageInfo { hasNextPage endCursor } }`, paged to
  the end, with no team, project or label clause, so that a moved issue is still found. It reads each
  match's `ak-input-hash` from `description`. Then:
  - **None found:** run `issue(id: <client id>)`. If that also finds nothing, create.
  - **None found, but `issue(id: <client id>)` finds the issue:** a same-input replay. Record success
    with no write. The intent lookup missed an existing footer, which is a detection defect. The
    writer reports it, and refuses every further create through this binding until Q-L5 is re-run
    and matches.
  - **One found, with the same `ak-input-hash`:** record success with no second effect.
  - **One found, with a different `ak-input-hash`:** a changed input. Stop, escalate and write
    nothing.
  - **More than one found:** a violation. Stop, escalate and write nothing.
  - **The lookup errors or cannot run:** refuse the create. It is fail-closed, never "assume none".
- **Comments and attachments.** Before a resolution comment or a `linkRecord` attachment, the
  issue's comments or attachments are read and searched for the same intent, with the same outcomes.
- **Relations.** A relation's input is its two issues, which are its target, so the pre-read for an
  existing `blocks` edge between them is its intent check.
- **Scope of the intent.** The intent carries `run_id`. A retry under a different run has a different
  intent and is not detected. That limit is stated here, not worked around.
- **Read-back.** Every write is followed by a read under the same account, including
  `organization { id }`. A write whose read-back cannot be performed is `failed`.
- **A returned id that differs from the client id sent is a refusal.** The record already exists in
  Linear, so:
  - The operation is `failed`. The writer reports the id Linear actually stored and escalates.
  - The record is not deleted.
  - Nothing is retried. No further write of that record kind is made until the fallback below has
    been applied and its replay case re-run and matched.

**No replay until proven.** Until Q-L4 (attachments and relations) and Q-L10 (comments) have run and
matched in the probe record, a write of those kinds whose outcome is unknown is not replayed. The
writer reads the record back and escalates instead. This hold is unconditional; it does not wait for
Linear to refuse anything.

**Fallback if Linear refuses or replaces a client id** on an attachment or a comment:
- The intent and the key move to `ak-intent: <intent>` and `ak-key: <key>` lines in that comment's
  body, or in that attachment's title or metadata. The pre-read searches for them.
- The replay cases for that record are run again before this binding is used for it.
- A relation has no free-text field to carry them. Relations keep the existing-edge pre-read as their
  idempotency check, under the fallback as before it.

### Claims

Every seat writes through one Linear user, so assignment cannot tell seats apart, and Linear offers
no compare-and-swap on attachments. Within one run, claims are serialized through the designated
writer instead:

- **Who writes claims.** The coordinator-designated writer only (§1), one claim operation at a time
  across the run. A seat asks the writer for a claim; it never writes a claim record itself.
  - Within one run with one designated writer, two claims for the same issue cannot interleave.
  - This guarantee does not cover concurrent runs on the same project, any second writer, or edits
    made directly in Linear. Each of those reopens the contract's claim race (CONTRACT §6).
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

### Refusals before any write

Each refusal is decided before any write, from preflight and pre-reads only.

- Any preflight step fails.
- `updateStatus` with a status `statuses` does not map, or whose state lookup does not find exactly
  one state.
- Any write on an existing issue (`linkRecord`, `addBlockingEdge` on either issue, `claimTicket`,
  `updateStatus`) whose scope pre-read shows a team other than `defaults.team`, a project other than
  `defaults.project` when set, or no `defaults.label` among its labels when set: a scope violation,
  also reported by the session audit.
- Any write on an existing issue that would carry `teamId`, `projectId`, `labelIds` or `parentId`.
- `addBlockingEdge` naming an issue outside `defaults.organization`.
- `linkRecord` on an issue outside `defaults.organization`. Its URL is a link, not an issue.
- An intent lookup that finds the same intent with a different input hash, finds the same intent
  more than once, or cannot run.
- Any create while an intent-lookup detection defect stands, until Q-L5 is re-run and matches.
- Any write whose guarding pre-read failed on any page.
- A write of a record kind whose returned id once differed, until its fallback replay case matches.
- A claim for a seat while another seat holds the issue.
- A write from a seat that is not the designated writer for this run.

### Unconfirmed behaviors

Several rules above depend on these. Until each is settled by its live case in
`research/probes/linear-composio-connector.md`, the rules that depend on it run under the
"No replay until proven" hold, and the binding is not qualified.

- Whether Linear accepts a client-supplied `id` on `attachmentCreate`, `issueRelationCreate` and
  `commentCreate`, as it does on `issueCreate`. The `issueCreate` acceptance was observed once,
  outside this binding (probe record, "Observed before this binding"). What a second write with the same id does: rejects,
  overwrites, or stores its own id instead. The input types carry an `id` field; acceptance is
  untested (Q-L4, Q-L10).
- Whether the `description.contains` filter, run through `LINEAR_RUN_QUERY_OR_MUTATION`, finds an
  `ak-intent` footer on an issue created moments earlier, including a moved or archived one (Q-L5).
- Whether `attachmentCreate` stores and returns `metadata` (Q-L4).
- Whether the connector's execution log for the selected account, and for every other connected
  Linear account, lists every call made in the window, with its input and result (each live row's
  session audit). An unreadable log makes the audit UNAVAILABLE.
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
| Create, link, edge and comment replay; attachment metadata read-back; returned-id refusal; intent-lookup changed-input refusal for creates, comments and attachments, including the recorded moved-issue fixture; other-seat claim refusal; update preserves scope; existing-issue scope refusal; unmapped status refusal; release, handoff, re-claim and stale release; the session audit of every call from the execution logs of every connected Linear account | Not run |

The probe record carries each row's evidence, time and account, and it is where a live result is
recorded when it runs.
