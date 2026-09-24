#!/usr/bin/env bash
# child-guard.sh --binding <path>
#
# The Claude Code PreToolUse hook that enforces part of the task-local child
# envelope (adapters/firstmate/CHILD-ROLES.md, CONTRACT.md §5).
#
# It judges only calls made inside a subagent. Claude Code puts `agent_id` and
# `agent_type` on the hook input for those and on no main-thread call (observed
# on 2.1.281); a call without `agent_id` is the worker's own and passes
# untouched. A child may not:
#   - start an agent (Task, Agent) or run `claude` or `codex`: depth is 1;
#   - run Firstmate (`fm-*`) or no-mistakes;
#   - `git push`, or `gh pr create` / `gh pr merge` (also through gh-axi), or
#     `gh api` against a pulls endpoint with a mutating method or a merge path;
#   - write outside the worktree, the binding's evidence store or $TMPDIR.
#
# The command check is by token and deliberately coarse: a command that names
# one of those tools anywhere is denied, including inside a quoted string. A
# false denial costs the child a retry; a false pass costs an unreviewed push.
# Known limit: a git alias defined inline (`git -c alias.p=push p`) is not
# resolved, so the guard is one part of the envelope and not all of it.
#
# A child call it cannot judge -- no jq, input that is not JSON, a binding that
# is missing, unreadable or still the unsubstituted token -- is denied. The
# main thread is never judged, so a broken guard cannot stop the worker.
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

INPUT=$(cat)

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
case "$INPUT" in
  *'"agent_id"'*) ;;
  *) exit 0 ;;
esac

command -v jq >/dev/null 2>&1 || deny "jq is unavailable, so this subagent call cannot be judged"
AGENT_ID=$(printf '%s' "$INPUT" | jq -r '.agent_id // empty' 2>/dev/null) || deny "the hook input is not JSON"
[ -n "$AGENT_ID" ] || exit 0

case "$BINDING" in
  ""|__AK_FIRSTMATE_BINDING__) deny "no task binding was substituted into the worker settings" ;;
esac
[ -f "$BINDING" ] && [ -r "$BINDING" ] || deny "the task binding $BINDING is unreadable"
jq -e '.schema == "firstmate-binding"' "$BINDING" >/dev/null 2>&1 || deny "the task binding $BINDING is not a firstmate-binding"

EVIDENCE=$(jq -r '.evidence.location // empty' "$BINDING")
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty')
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')
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
  local cmd=$1
  # Separators and quotes become spaces, so every word is a token.
  local flat
  flat=$(printf '%s' "$cmd" | tr ';&|()`"'"'"'\n\t' '          ')
  local noglob=0
  case $- in *f*) noglob=1 ;; esac
  set -f
  # shellcheck disable=SC2206
  local -a tok=($flat)
  [ "$noglob" = 1 ] || set +f
  local n=${#tok[@]} i j word base sub method pulls merge body
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
          method="" pulls=0 merge=0 body=0
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
          done
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
    check_command "$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')" ;;
  Write|Edit|MultiEdit)
    check_write "$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')" ;;
  NotebookEdit)
    check_write "$(printf '%s' "$INPUT" | jq -r '.tool_input.notebook_path // empty')" ;;
esac
exit 0
