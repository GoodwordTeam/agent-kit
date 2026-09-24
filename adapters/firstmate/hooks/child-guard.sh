#!/usr/bin/env bash
# child-guard.sh --binding <path>
#
# The Claude Code PreToolUse hook that enforces part of the task-local child
# envelope (adapters/firstmate/CHILD-ROLES.md, CONTRACT.md §5).
#
# Two rules hold for the whole worker session, main thread and subagents alike
# (ADR-0004): no `ak firstmate bind`, `install` or `remove`, which are
# supervisor-side, and no write into agent-kit's binding ledger
# (~/.agent-kit/firstmate/), whether by Write/Edit/NotebookEdit or by a Bash
# command naming that path.
#
# Every other rule judges only calls made inside a subagent. Claude Code puts
# `agent_id` and `agent_type` on the hook input for those and on no main-thread
# call (observed on 2.1.281). A child may not:
#   - start an agent (Task, Agent) or run `claude` or `codex`: depth is 1;
#   - run Firstmate (`fm-*`) or no-mistakes;
#   - `git push`, or `gh pr create` / `gh pr merge` (also through gh-axi), or
#     `gh api` against a pulls endpoint with a mutating method or a merge path,
#     or a `gh api graphql` call naming a pull-request mutation;
#   - write outside the worktree, the binding's evidence store or $TMPDIR.
#
# The command check is by token and deliberately coarse: a command that names
# one of those tools anywhere is denied, including inside a quoted string. A
# false denial costs the child a retry; a false pass costs an unreviewed push.
# Known limit: a git alias defined inline (`git -c alias.p=push p`) is not
# resolved, so the guard is one part of the envelope and not all of it.
#
# A child call it cannot judge -- no jq, input that is not JSON, a binding that
# is missing, unreadable or still the unsubstituted token -- is denied. A
# main-thread call it cannot judge passes, so a broken guard cannot stop the
# worker; a main-thread call that does not mention `firstmate` is not parsed.
#
# Output: a PreToolUse deny decision on stdout, exit 0. Silence means allow.

set -u

BINDING=""
while [ $# -gt 0 ]; do
  case "$1" in
    --binding) BINDING=${2-}; shift 2 || shift ;;
    *) shift ;;
  esac
done

IFS= read -r -d '' INPUT || true  # builtin: no subshell, no cat fork

deny() {
  local reason="agent-kit child guard: $1"
  if command -v jq >/dev/null 2>&1; then
    jq -cn --arg r "$reason" \
      '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
  else
    reason=$(printf '%s' "$reason" | tr -d '"\\')
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$reason"
  fi
  exit 0
}

# Cheap exit for the main thread before anything that could fail.
SUBAGENT=0
case "$INPUT" in
  *'"agent_id"'*) SUBAGENT=1 ;;
  *firstmate*) ;;
  *) exit 0 ;;
esac

if ! command -v jq >/dev/null 2>&1; then
  [ "$SUBAGENT" = 1 ] || exit 0
  deny "jq is unavailable, so this subagent call cannot be judged"
fi

# One jq call pulls every field the guard could need out of the hook input.
# Each field is NUL-terminated so arbitrary bytes (newlines, quotes) survive
# intact, and a `read` that hits EOF before finding its NUL (malformed JSON,
# or a jq runtime error on an unexpectedly-shaped tool_input) fails -- which
# is how a bad parse is detected without a second call. The `?` on each nested
# access keeps one oddly-shaped field (e.g. a non-object tool_input) from
# aborting the whole read, matching the old per-field jq calls' isolation.
AGENT_ID="" CWD="" TOOL="" CMD="" FILE_PATH="" NOTEBOOK_PATH=""
{
  IFS= read -r -d '' AGENT_ID &&
  IFS= read -r -d '' CWD &&
  IFS= read -r -d '' TOOL &&
  IFS= read -r -d '' CMD &&
  IFS= read -r -d '' FILE_PATH &&
  IFS= read -r -d '' NOTEBOOK_PATH
} < <(printf '%s' "$INPUT" | jq -j '
    (.agent_id? // ""), "\u0000",
    (.cwd? // ""), "\u0000",
    (.tool_name? // ""), "\u0000",
    (.tool_input.command? // ""), "\u0000",
    (.tool_input.file_path? // ""), "\u0000",
    (.tool_input.notebook_path? // ""), "\u0000"
  ' 2>/dev/null) || { [ "$SUBAGENT" = 1 ] || exit 0; deny "the hook input is not JSON"; }

TOK=()
tokenize() {
  # Separators and quotes become spaces, so every word is a token.
  local flat noglob=0
  flat=$(printf '%s' "$1" | tr ';&|()`"'"'"'\n\t<>' '            ')
  case $- in *f*) noglob=1 ;; esac
  set -f
  # shellcheck disable=SC2206
  TOK=($flat)
  [ "$noglob" = 1 ] || set +f
}

in_ledger() {
  case "$1" in */.agent-kit/firstmate|*/.agent-kit/firstmate/*|.agent-kit/firstmate|.agent-kit/firstmate/*) return 0 ;; esac
  return 1
}

check_session_command() {
  local n=${#TOK[@]} i word
  for ((i = 0; i < n; i++)); do
    word=${TOK[$i]}
    in_ledger "$word" && deny "the worker session may not name agent-kit's binding ledger in a command ($word)"
    case "$word" in
      firstmate|*/firstmate/cli.ts)
        case "${TOK[$((i + 1))]-}" in
          bind|install|remove) deny "the worker session may not run ak firstmate ${TOK[$((i + 1))]}; binding is supervisor-side" ;;
        esac
        ;;
    esac
  done
}

check_session_write() {
  local path=$1
  case "$path" in /*) ;; *) path="$CWD/$path" ;; esac
  in_ledger "$path" && deny "the worker session may not write agent-kit's binding ledger ($1)"
  return 0
}

case "$TOOL" in
  Bash)
    tokenize "$CMD"
    check_session_command ;;
  Write|Edit|MultiEdit)
    check_session_write "$FILE_PATH" ;;
  NotebookEdit)
    check_session_write "$NOTEBOOK_PATH" ;;
esac

[ -n "$AGENT_ID" ] || exit 0

case "$BINDING" in
  ""|__AK_FIRSTMATE_BINDING__) deny "no task binding was substituted into the worker settings" ;;
esac
[ -f "$BINDING" ] && [ -r "$BINDING" ] || deny "the task binding $BINDING is unreadable"

# One jq call on the binding file returns whether the schema matches and the
# evidence location together.
SCHEMA_OK="" EVIDENCE=""
{
  IFS= read -r -d '' SCHEMA_OK &&
  IFS= read -r -d '' EVIDENCE
} < <(jq -j '
    (if .schema == "firstmate-binding" then "1" else "0" end), "\u0000",
    (.evidence.location? // ""), "\u0000"
  ' "$BINDING" 2>/dev/null) || deny "the task binding $BINDING is not a firstmate-binding"
[ "$SCHEMA_OK" = "1" ] || deny "the task binding $BINDING is not a firstmate-binding"

[ -n "$CWD" ] || deny "the hook input names no working directory"

strip_slash() { local p=$1; while [ "${#p}" -gt 1 ] && [ "${p%/}" != "$p" ]; do p=${p%/}; done; printf '%s' "$p"; }

under() {
  local path=$1 root
  root=$(strip_slash "$2")
  [ -n "$root" ] || return 1
  [ "$path" = "$root" ] && return 0
  case "$path" in "$root"/*) return 0 ;; esac
  return 1
}

check_write() {
  local path=$1
  [ -n "$path" ] || deny "a write with no target path"
  case "$path" in /*) ;; *) path="$CWD/$path" ;; esac
  case "/$path/" in *"/../"*) deny "a write path that climbs with '..' ($1)" ;; esac
  under "$path" "$CWD" && return 0
  [ -n "$EVIDENCE" ] && under "$path" "$EVIDENCE" && return 0
  [ -n "${TMPDIR:-}" ] && under "$path" "$TMPDIR" && return 0
  deny "a task-local child writes only inside the worktree, the evidence store or its scratch directory, not $path"
}

check_command() {
  local -a tok=("${TOK[@]}")
  local n=${#tok[@]} i j word base sub method pulls merge body graphql prmut
  for ((i = 0; i < n; i++)); do
    word=${tok[$i]}
    base=${word##*/}
    case "$base" in
      fm-*) deny "a task-local child may not run Firstmate ($word)" ;;
      no-mistakes) deny "a task-local child may not run no-mistakes" ;;
      claude|codex) deny "a task-local child has depth 1 and may not start an agent ($word)" ;;
      git)
        j=$((i + 1))
        while [ "$j" -lt "$n" ]; do
          case "${tok[$j]}" in
            -C|-c|--git-dir|--work-tree|--namespace) j=$((j + 2)) ;;
            -*) j=$((j + 1)) ;;
            *) break ;;
          esac
        done
        sub=${tok[$j]-}
        [ "$sub" = push ] && deny "a task-local child may not push"
        ;;
      gh|gh-axi)
        if [ "${tok[$((i + 1))]-}" = pr ]; then
          case "${tok[$((i + 2))]-}" in
            create|merge) deny "a task-local child may not ${tok[$((i + 2))]} a pull request" ;;
          esac
        elif [ "${tok[$((i + 1))]-}" = api ]; then
          method="" pulls=0 merge=0 body=0 graphql=0 prmut=0
          for ((j = i + 2; j < n; j++)); do
            case "${tok[$j]}" in
              -X|--method) method=${tok[$((j + 1))]-} ;;
              -X*) method=${tok[$j]#-X} ;;
              --method=*) method=${tok[$j]#--method=} ;;
              -f|-F|--field|--raw-field|--input|-f*|-F*|--field=*|--raw-field=*|--input=*) body=1 ;;
            esac
            case "${tok[$j]}" in
              */pulls|*/pulls/*|pulls|pulls/*) pulls=1 ;;
            esac
            case "${tok[$j]}" in */pulls/*/merge) merge=1 ;; esac
            case "${tok[$j]}" in graphql) graphql=1 ;; esac
            case "${tok[$j]}" in
              *createPullRequest*|*mergePullRequest*|*enablePullRequestAutoMerge*|*updatePullRequestBranch*) prmut=1 ;;
            esac
          done
          if [ "$graphql" = 1 ] && [ "$prmut" = 1 ]; then deny "a task-local child may not change a pull request through gh api graphql"; fi
          [ -z "$method" ] && [ "$body" = 1 ] && method=POST
          method=$(printf '%s' "$method" | tr '[:lower:]' '[:upper:]')
          if [ "$merge" = 1 ]; then deny "a task-local child may not merge a pull request"; fi
          if [ "$pulls" = 1 ]; then
            case "$method" in
              POST|PUT|PATCH) deny "a task-local child may not change a pull request through gh api" ;;
            esac
          fi
        fi
        ;;
    esac
  done
}

case "$TOOL" in
  Task|Agent)
    deny "a task-local child has depth 1 and may not start an agent" ;;
  Bash)
    check_command ;;
  Write|Edit|MultiEdit)
    check_write "$FILE_PATH" ;;
  NotebookEdit)
    check_write "$NOTEBOOK_PATH" ;;
esac
exit 0
