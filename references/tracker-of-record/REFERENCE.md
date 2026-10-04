# Tracker of record

What an agent needs, inside an installed plugin, to decide which ticket system a project uses and to
reach it without leaking or borrowing a credential. The contract this condenses is
`adapters/tracker/CONTRACT.md`, which does not ship with the plugin; the rules below are that
contract's §2 and §5, the `linear-linearis` binding's setup and invocation, and the
`linear-composio-connector` binding's setup, mapping and trust ceiling, restated so the plugin
carries them (ruling `tracker-of-record-falls-back-to-kb`). `wayfind` loads it before its first
ticket operation.

## Which system is the record

Configuration decides, never reachability. Two inputs: the project record's
`tracker_policy.system_of_record.system` says *which* system; the project folder's
`ak.tracker.yaml` says *how this checkout reaches it*. The binding's backend states the system it
reaches (`linear-linearis` reaches `linear`), and that id is compared with the record's **exactly**
— no case folding, no aliases. `knowledgebase` is reserved for the knowledgebase's own `ticket`
records.

1. **The folder binds a backend** and the record names the system it reaches, or there is no
   record: that backend is the system of record. A record naming any other system, the
   knowledgebase included, refuses every operation.
2. **No binding**, and the record names `knowledgebase` or there is no record: the knowledgebase's
   `ticket` records, through its adapter.
3. **Otherwise every operation refuses** with `needs-input`: no binding while the record names an
   external system, or no binding and no knowledgebase.

It never ends in a scratch file, a `tickets/` directory or any other record in the working
repository. A bound backend that is unreachable is `failed`; one that rejects the credential is
`needs-input`. Neither drops to step 2.

**The project folder** is the nearest directory at or above the working directory holding
`ak.tracker.yaml`, searching no higher than `git rev-parse --show-toplevel`. None there: unbound.

## Rules every binding obeys

1. **The tool is project-local**: a pinned dependency of the project, invoked from its own
   dependency tree. Never a global install, never a same-named tool on `PATH`.
2. **The credential is project-local**: read from `token_file` for each call and passed as a prefix
   assignment in the call's environment. Never on a command line, `env`'s included.
3. **No fallback to a global credential.** `token_file` absent or blank refuses before the tool
   runs. Where the tool reads a global store under the home directory, the call points `HOME`
   (and `XDG_CONFIG_HOME`) at an empty directory.
4. **A rejected credential is `needs-input`**, never retried and never a fall to the knowledgebase.
5. **Scope flags create and list, never update.** Creating and listing pass the binding's
   `defaults`; an operation on an existing ticket never does, because a scope on an update moves
   the ticket. A status `statuses` does not map is refused, not guessed.
6. **Nothing token-bearing is committed, printed or echoed.** `ak.tracker.yaml` is committed and
   holds no secret; `token_file` is gitignored by a `.gitignore` in the project.

## Setting up `linear-linearis`, when a human asks

Setup is an operator task, not a skill. Stop at the first step that fails.

1. Detect the package manager from the root lockfile; no `package.json`, or two lockfiles, stops
   and asks the human.
2. Install `linearis@2026.8.0` as an exact dev dependency (`npm install --save-dev --save-exact`,
   `pnpm add --save-dev --save-exact`, `yarn add --dev --exact`, `bun add --dev --exact`).
3. Check `node --version` is `v22` or later.
4. The human writes the token into the token file themselves and says when. Never ask for it in
   the conversation, never print the file, never run `linearis auth login`.
5. Write `ak.tracker.yaml`: `backend: linear-linearis`, `token_file`, `defaults.team` (required),
   `defaults.project` (optional), `statuses` in the team's own names.
6. Gitignore the token file in the project's `.gitignore` and commit that rule, then run the check
   below: an uncommitted rule protects only this checkout. A token file
   that is tracked or in history stops setup: tell the human to rotate the token.
7. Verify with `teams read <team>` through the guarded call. Exit `42` goes back to step 4.

## The guarded call

`$token_file` is the binding's `token_file`; replace `<command>` with the linearis command.

```sh
(
  for var in $(env | sed -n 's/^\(GIT_[A-Za-z0-9_]*\)=.*/\1/p'); do unset "$var"; done
  top="$(git rev-parse --show-toplevel)" && top="$(cd "$top" && pwd -P)" || exit 1
  root="$(pwd -P)"
  case "$root/" in "$top"/*) ;; *) echo "refused: $root is not inside $top" >&2; exit 1 ;; esac
  until [ -f "$root/ak.tracker.yaml" ]; do
    if [ "$root" = "$top" ] || [ "$root" = / ]; then
      echo "refused: no ak.tracker.yaml at or above $(pwd -P) inside $top" >&2; exit 1
    fi
    root="$(dirname "$root")"
  done
  cd "$root" || exit 1
  [ -f "$token_file" ] || { echo "refused: $token_file is absent" >&2; exit 1; }
  token="$(tr -d '\r' < "$token_file")"
  token="${token#"${token%%[![:space:]]*}"}"
  token="${token%"${token##*[![:space:]]}"}"
  [ -n "$token" ] || { echo "refused: $token_file is blank" >&2; exit 1; }
  case "$token" in *[[:space:]]*) echo "refused: $token_file holds more than one line or word" >&2; exit 1 ;; esac
  binary="$root/node_modules/.bin/linearis"
  [ -x "$binary" ] || binary="$top/node_modules/.bin/linearis"
  [ -x "$binary" ] || { echo "refused: linearis is not installed in this project" >&2; exit 1; }
  resolved="$(realpath "$binary")" || exit 1
  case "$resolved" in
    "$root/node_modules/"*|"$top/node_modules/"*) ;;
    *) echo "refused: linearis resolves outside this project's dependencies" >&2; exit 1 ;;
  esac
  version="$(NO_UPDATE_NOTIFIER=1 "$binary" --version)" || exit 1
  [ "$version" = "2026.8.0" ] || { echo "refused: linearis $version installed, 2026.8.0 required" >&2; exit 1; }
  home="$(mktemp -d)" || exit 1
  trap 'rm -rf "$home"' EXIT
  trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM
  linearis_rc=0
  output="$(LINEAR_API_TOKEN="$token" HOME="$home" XDG_CONFIG_HOME="$home" NO_UPDATE_NOTIFIER=1 "$binary" <command> 2>"$home/stderr")" || linearis_rc=$?
  errors="$(cat "$home/stderr")"
  [ -z "$errors" ] || printf '%s\n' "$errors" >&2
  if [ "$linearis_rc" -eq 0 ]; then printf '%s\n' "$output"; exit 0; fi
  printf '%s\n' "$output" >&2
  case "$output$errors" in
    *AUTHENTICATION_REQUIRED*|*'Authentication required, not authenticated'*|*'No API token found'*) exit 42 ;;
  esac
  exit "$linearis_rc"
)
```

The `realpath` check refuses a global command on `PATH` and symlinks that escape the project's
dependency tree. The guard keeps stderr warnings out of successful result JSON, and `linearis_rc`
works in zsh, whose `status` parameter is read-only. Exit `0` is the result JSON. The guard maps linearis's authentication rejection, including its
observed exit-`1` message, to `42`: `needs-input`. Exit `2` is a wrong invocation, `failed` and
not retried with guessed flags. Other exit-`1` application errors are `failed`.

| Operation | linearis command |
|---|---|
| create | `issues create <title> --team <team> [--project <project>] [--description <text>] [--status <status>]` |
| link a record | `attachments create <issue> --url <url> --title <title>` |
| blocking edge | `issues relations add <blocker> --blocks <blocked>` |
| claim | `issues read <issue>`, then `issues update <issue> --assignee me` if unassigned |
| update status | `issues update <issue> --status <mapped status>`; resolution via `issues discuss <issue> --body <text>` |
| read | `issues list --team <team> [--project <project>] …`; `issues relations list <issue>` |

`issues update` never carries `--team` or `--project`. A create whose outcome is unknown is not
replayed: linearis offers no idempotency key. Live round-trips against Linear are unverified at
`2026.8.0`.

## Checking the secret with plain git

Where `ak tracker check` is not on hand, from the project folder, with `$f` the token file:

```sh
printf './%s\0' "$f" | git check-ignore -q -z --stdin --no-index     # exit 0: ignored
printf './%s\0' "$f" | git check-ignore -v -z --stdin --no-index | tr '\0' '\n'
#   source, line, pattern, path: the source must be a .gitignore in the repository, and a
#   pattern starting with ! un-ignores the file, so it does not count. The ./ prefix matters:
#   stdin paths are still pathspecs, and ':(top)x' would otherwise be checked as 'x'.
tmp=$(mktemp -d) && git clone -q --template= . "$tmp" && git -C "$tmp" -c core.excludesFile=/dev/null check-ignore -q --no-index "./$f"
#   exit 0: the committed rules ignore it. A clone checks out the committed branch head, so a
#   rule that is only in the working tree or only staged does not count. Run from the repository
#   top, or prefix $f with the project folder's path from it; then rm -rf "$tmp".
git --literal-pathspecs ls-files --error-unmatch -- "$f"            # exit 0: tracked, refuse
git --literal-pathspecs log --all --full-history --format=%h -1 -- "$f"   # any output: in history, rotate
```

`--all` covers every commit reachable from a ref, not unreachable objects. The token file must be
readable by its owner only (no group or other bits; `chmod 600` sets that), as checked by both
`ak tracker check` and `ak doctor`.

## Setting up `linear-composio-connector`

This binding reaches `linear` through the host's Composio connector and an account the operator has
already connected. Its document is `adapters/tracker/backends/linear-composio-connector.md`, which
exists only in a fork of this package; a project reaches it through a bundle built from that fork,
used by explicit path, and `ak update` would replace that bundle with one that lacks it.

**This section is a summary.** Before any write, the writer reads the full binding document from the
fork's source checkout at its pinned revision. A built bundle, the fork's included, carries no
`adapters/` directory, so the bundle path cannot supply it. The binding document defines
the claim and release record formats, the footer, the intent lookup, the state lookup, the error
mapping, the client-id fallback and discovering the tool's argument schema at call time. **No write
is made from this section alone.** Without the full binding document at hand, no write is made at
all.

**Trust ceiling, first.** No code in this package makes, gates or inspects a connector call, and the
one backend tool, `LINEAR_RUN_QUERY_OR_MUTATION`, runs any GraphQL it is sent under the named
account. Every "refuse" below is an instruction to the operator, and nothing stops an operator that
ignores it. What checks the rules is `ak tracker check` and `ak doctor` (binding shape and account
file hygiene, when run), a read-back after every write that selects `organization { id }`, team,
project, parent, labels and state. After each session, an audit read lists every call in the
connector's execution log for the selected account. A call through any other slug, or a mutation
outside the binding's five, is a violation. Every issue id in any mutation, both ids of a relation
included, is read by id whatever its current team or labels, and an id that cannot be read is a
violation. If the log cannot be read, or lacks a log id the writer recorded at a write, the audit is
UNAVAILABLE: the session is not complete, it is escalated, and a live qualification row fails
closed. Writes stay **guided**. The run's coordinator designates one writer seat in a run receipt
every seat can read, and that writer makes every write, one at a time, and reads each back. A new
writer is designated only after the orchestrator shows the previous one settled, failed or
cancelled; two live writers are never designated. The serial guarantee covers one run with one designated writer
only. Concurrent runs, any other writer, or edits made in Linear reopen the claim race. The full binding document also extends the audit to every other connected Linear account's log, and refuses any write on an existing issue outside the `defaults` team, project and label; those rules live there and are not restated here.

**Departures from the rules above.** Rule 1: the tool is the host's connector, not a project
dependency; the operator uses one tool through one route. Rule 2: `token_file` holds the
connected-account alias, which grants nothing on its own; the OAuth credential stays in the
connector, and the alias is passed as `account` on every call. Rule 3 holds in adapted form: an
absent or blank account file refuses, and no call relies on the connector's default account. The
`HOME` isolation clause has nothing to apply to, because no local tool runs. Rules 4 to 6 hold as
written.

**The binding.** `backend: linear-composio-connector`, `token_file: .linear-connected-account`,
`defaults` with `account_kind: composio-connected-account`, `organization` and `team` (required) and
optional `team_key`, `project`, `label` and `parent`, every scope value a lowercase UUID, and
`statuses` mapping at least `draft`, `in-progress`, `done` and `cancelled`. Leave `blocked` unmapped
for a team with no blocked state: `updateStatus(blocked)` is then refused before any call.

**Setup, when a human asks.** Stop at the first step that fails.

1. The human connects the account in the connector and names its alias. Never create, rename or
   remove a connection.
2. The human writes the alias, as the file's only word, into `.linear-connected-account` at the
   project root and runs `chmod 600` on it. During setup or a rebind the human asked for, the
   project root is the folder the human names to bind, at or below the git top level.
3. Discover with read-only queries under the account, then write `ak.tracker.yaml` once and
   complete, binding only values a discovery read returned and the human confirmed (organization,
   team, optional scope), with `statuses` in the team's names. Never write a partial binding. On a
   rebind, the existing `ak.tracker.yaml` stays unchanged until the complete replacement is ready,
   then is replaced in one step; the old token file is not read, moved, rewritten or removed.
4. Gitignore the account file in the project's `.gitignore` and commit that rule. Steps 3 and 4
   write local files only; no Linear mutation is made before step 5 passes.
5. Run `ak tracker check` from the fork checkout, or the fork bundle's `ak doctor`, then the
   preflight below.
6. Verify with one `readTickets` read under the account. An empty result is a fact.

**Preflight, before any connector call.** The only carve-out is setup step 3's read-only discovery
reads, which run until this binding's `ak.tracker.yaml` is written and need steps 2, 3 and 5, not
steps 1 and 4. On a rebind they read no existing binding or token file. No Linear mutation is made
until all five hold against the written binding.

1. `ak.tracker.yaml` is at or above the working directory, no higher than the git top level.
2. The account file exists, holds exactly one word (`wc -w` prints `1`) and is exactly mode `600`
   (`stat -f %Lp` or `stat -c %a` prints `600`). `ak tracker check` does not check those two: a
   two-word or mode-`400` file passes it. It checks non-blank, owner-only, inside the folder,
   ignored by a committed rule, untracked and absent from history. A history scan that does not
   finish is unavailable evidence, not a clean history. Outside a git repository the check only
   warns and skips the ignore, tracked and history checks.
3. Once per session: `COMPOSIO_MANAGE_CONNECTIONS`, action `list`, toolkit `linear`, shows the alias
   `ACTIVE`. Otherwise `needs-input`.
4. Once per session: `query { organization { id } }` under the account returns exactly
   `defaults.organization`. Otherwise no write in the session.
5. Every `COMPOSIO_MULTI_EXECUTE_TOOL` call's tool entry carries `tool_slug`
   `LINEAR_RUN_QUERY_OR_MUTATION` and `account` set to the alias from the file. Without `account`
   the connector uses its default account.

No other Linear tool slug is used; `LINEAR_UPDATE_ISSUE` in particular replaces all labels and moves
issues between teams and projects.

| Operation | Write (GraphQL) | Must read back |
|---|---|---|
| create | intent lookup, then pre-read `issue(id)`, then `issueCreate` with client `id`, `teamId`, draft `stateId`, and `projectId`, `parentId`, `labelIds: [label]` only when `defaults` sets them; no assignee | id, identifier, url, team, the scope `defaults` set, footer, organization |
| link a record | `attachmentCreate` with client `id` and `metadata` carrying `akIntent`, `akKey` and `akInputHash` | the attachment by id and url, with all three metadata values |
| blocking edge | `issueRelationCreate` with client `id`, `type: blocks`; both issues in the organization | one `blocks` edge |
| claim | writer only, serialized: claim-record attachment, then `issueUpdate` `assigneeId` if unassigned | the current claim record names this seat |
| update status | `issueUpdate` `stateId` only; resolution by `commentCreate` with client `id` | mapped state; team, project, labels, parent unchanged; one comment |
| read | `issues` filtered by team id, plus project id and `labels.some` label id only when `defaults` sets them, paged | read-only; revision is the greatest `updatedAt` |

Updates never pass `teamId`, `projectId`, `labelIds` or `parentId`. Every paged connection is read to
the end through `pageInfo`. A page error fails the whole read, a failed pre-read refuses its write,
and a partial read is never used or given a revision.

- **Idempotency.**
  - The client id is the first 16 bytes of the runner contract's input-dependent operation key,
    shaped as a version-4 UUID. Its pre-read detects only a same-input replay.
  - A separate, input-independent intent, `sha256(run_id · operation_id · target_identity)`, is
    written as an `ak-intent` footer. Before each create, the writer searches for it across the
    organization, whatever the team.
  - Same intent with the same input hash: success with no second effect. Same intent with a
    different hash, or found more than once: stop, escalate, no write. A lookup that cannot run
    refuses the create.
  - A retry under another run is not detected.
  - When the intent lookup finds nothing but `issue(id)` finds the issue: success with no write. The
    lookup's miss is a detection defect, and creates are refused until Q-L5 is re-run.
  - A returned id that differs from the client id sent is `failed`. The writer reports the stored
    id, deletes nothing, and makes no further write of that kind until its fallback is re-tested.
    Relations keep the existing-edge pre-read; they have no free text for a fallback.
- **State lookup.** A mapped status resolves only when exactly one state of `defaults.team`, read by
  team id, has a name that matches byte for byte. Anything else is `needs-input`. An issue whose
  team is not `defaults.team` is refused as a scope violation.
- **Claims.** Claims are generation-numbered claim and release attachments that are never deleted.
  Another seat's claim is refused, naming the holder. A stale claim is released only on evidence
  that the holding task ended.
- **No replay until proven.** Whether Linear accepts client ids on attachments, relations and
  comments is not yet verified. Until Q-L4 and Q-L10 pass, a write of those kinds whose outcome is
  unknown is not replayed.
