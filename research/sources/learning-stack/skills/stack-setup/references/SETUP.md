# Full setup runbook

For an agent installing the review-learn / skill-index / dreamd stack on a machine it has never
seen, and onboarding one or more repos. Every command here is runnable as written. `SKILL.md` is
the short version; this file is what you follow when something is unfamiliar or goes wrong.

Shorthand used throughout:

```sh
S=~/.claude/skills/stack-setup/scripts/install.py
SK=~/.claude/skills                   # fixed location, see "Why the skills root is fixed"
CFG=${CLAUDE_CONFIG_DIR:-~/.claude}   # where all derived state lives
```

---

## 0. What you are installing, and what each piece needs

Three skills that only make sense together. All three read the same claude-mem SQLite database and
write to the same per-repo directory under `$CFG/projects/<repo-folder>/`.

| Skill | Produces | Triggered by | Model calls |
|---|---|---|---|
| `review-learn` | `review-patterns/` — findings, patterns, guardrails, repeat rate | Stop hook, debounced 10 minutes | 1–2 per maintain |
| `skill-index` | the skill roster injected at SessionStart, plus skill-learn candidates | Stop hook, after review-learn | 1 per discover |
| `dreamd` | `dream/` — `memory.md`, `lessons.md`, `runs.jsonl` | its own 15-minute scheduler | 1 per job (reflect / nightly / weekly) |

Data flow, end to end:

```
claude-mem observations ─┐
GitHub PR review threads ─┼→ review-learn ingest → findings → maintain → patterns → propose → guardrails ─┐
claude-reflect corrections ┘                                                                              │
                                                                                                          ├→ SessionStart
claude-mem sessions + tool use → dreamd episodes → reflect → memory.md ─┐                                 │
                                                  nightly → lessons.md ─┼─────────────────────────────────┘
                                                  weekly  → pruning ────┘
```

Nothing is written inside a repo. Ever. If you find the stack writing into a working tree, that is
a bug, not a configuration choice.

### Why the skills root is fixed

The skills import each other and themselves through the literal path `~/.claude/skills/<name>/scripts`:

```sh
grep -rn "claude/skills" $SK/*/scripts/*.py | grep -v "^Binary"
```

`CLAUDE_CONFIG_DIR` may point anywhere (on the machine this was built on it is
`~/.claude/.omc-launch`), and Claude Code still discovers skills in `~/.claude/skills`. So: config
dir free, skills location fixed. Do not try to relocate the skills; fix the path expectation first
if you ever need to.

---

## 1. Prerequisites

```sh
python3 $S doctor
```

Exits non-zero when a hard requirement is missing, and prints the environment it resolved. Read
that second block carefully — it is the difference between a working install and a silent one.

| Requirement | Hard | Why it matters | If missing |
|---|---|---|---|
| `claude` CLI on PATH | yes | every model call is `claude -p --settings '{"disableAllHooks":true}'`; `--bare` is not a flag and hooks must be off or the call recurses | install Claude Code, re-run doctor |
| `git` | yes | each ledger is a git repo; every job commits | install git |
| python ≥ 3.9 | yes | syntax floor of the scripts; the same interpreter is baked into the scheduler unit | use a newer python3; `sys.executable` is what gets written |
| claude-mem database | yes | the only source of observations, sessions and tool use | install the claude-mem plugin and let it record at least one session |
| claude-mem worker script | no | applies a settings change without a manual restart | restart the worker by hand (§3.3) |
| `gh` authenticated | no | PR review threads | `gh auth login`, or accept observation-only ingestion |
| claude-reflect plugin | no | user-correction events, the heaviest term in dreamd's priority score | skip; it yields zero events on many machines anyway |
| `node` or `bun` | no | runs the worker restart | restart by hand |

A soft miss degrades quality, never correctness. review-learn without `gh` still learns from
claude-mem; dreamd without claude-reflect still scores episodes, just with one signal fewer.

---

## 2. Get the code onto the machine

### From the source machine

```sh
python3 $S bundle --out ~/claude-learning-stack.zip
```

Writes one zip: the three skills, the installer itself, and the claude-mem mode file
`code--review-learning.json`. Caches, `.pyc`, lock files, `.git/` and `.omc/` runtime state are
excluded, so the zip carries no session junk. `INSTALL.txt` inside it repeats the command sequence.

### On the target machine

```sh
unzip ~/claude-learning-stack.zip -d /tmp/stack
python3 /tmp/stack/skills/stack-setup/scripts/install.py doctor
python3 /tmp/stack/skills/stack-setup/scripts/install.py apply --from /tmp/stack
```

`apply` copies each skill to `~/.claude/skills/<name>`, symlinks it into `~/.codex/skills` when
that directory exists, and installs the claude-mem mode file if it is not already there. An
existing install is moved to `<name>.bak-<epoch>` rather than deleted — check for those and remove
them once you are satisfied.

`--from` also accepts a directory, so a git clone works instead of a zip:

```sh
python3 <clone>/skills/stack-setup/scripts/install.py apply --from <clone>
```

---

## 3. Wire the machine

```sh
python3 $S wire
```

One command, four files, each backed up to `<name>.bak` and each a no-op when already correct.
What it does, and what to check if you are doing it by hand:

### 3.1 `$CFG/settings.json`

Three SessionStart entries, matcher `startup|resume|clear|compact`, timeout 10:

```
python3 ~/.claude/skills/review-learn/scripts/session_context.py
python3 ~/.claude/skills/skill-index/scripts/skill_index.py roster
python3 ~/.claude/skills/dreamd/scripts/session_context.py
```

Plus one Stop hook, timeout 120, no matcher:

```
python3 ~/.claude/skills/review-learn/scripts/stop_hook.py
```

The Stop hook is the engine: it debounces 10 minutes, then runs ingest, maintain, propose, and
hands off to skill-learn. The SessionStart hooks only read what the Stop hook produced.

### 3.2 `~/.codex/hooks.json`

The same three SessionStart commands with no matcher (Codex has no matcher concept), plus:

```
python3 ~/.claude/skills/review-learn/scripts/codex_prompt_hook.py      # UserPromptSubmit
python3 ~/.claude/skills/review-learn/scripts/stop_hook.py --source codex  # Stop, timeout 30
```

Skipped automatically when `~/.codex` is absent. Codex and Claude share one ledger per repo, which
is the point: a pattern learned in one shows up in the other.

### 3.3 `~/.claude-mem/settings.json`

```json
{ "CLAUDE_MEM_CONTEXT_OBSERVATIONS": "25", "CLAUDE_MEM_MODE": "code--review-learning" }
```

The 50→25 cut is a deliberate budget trade: it frees roughly the tokens dreamd's memory block
occupies, so resident context stays flat instead of growing. Do not raise it back without also
capping `DREAMD_MEMORY_TOKENS`.

The mode file defines the `review-finding` and `review-resolution` observation types that
review-learn's ingest keys on. Without it, ingest still works from PR threads but sees no
observation-sourced findings.

A settings change needs a worker restart. The installer finds the right worker and runs it; by hand:

```sh
ls "$CFG"/plugins/cache/*/claude-mem/*/scripts/worker-service.cjs   # pick the newest
bun <that path> restart     # or: node <that path> restart
```

The copy under `~/.claude/plugins/marketplaces/` fails with a missing-module error. Use the one
under `plugins/cache/`.

### 3.4 The scheduler

```sh
python3 $S schedule --load
```

macOS writes `~/Library/LaunchAgents/com.<user>.dreamd.plist` (`StartInterval 900`, `RunAtLoad`,
`CLAUDE_CONFIG_DIR` and `PATH` in `EnvironmentVariables`, both streams to `$CFG/dreamd/tick.log`)
and bootstraps it. Linux writes `~/.config/systemd/user/dreamd-tick.{service,timer}` and enables
the timer. Without either, it prints a crontab line for you to paste.

**Two rules a scheduler on any platform must respect.**

*A background job must not open a file inside a repo.* On macOS, a launchd job that opens a path
under `~/Documents` blocks uninterruptibly in `open$NOCANCEL` waiting on the Files-and-Folders
consent prompt — which never appears, because the job has no UI. `subprocess` timeouts do not fire
on that state; the tick simply never returns. dreamd therefore resolves repo roots with `stat` only
and never spawns `git`; repo roots are registered from the SessionStart hook instead, where a real
session already has consent. The systemd template omits `ProtectHome=` and sandboxing for the same
class of reason — they would hide the claude-mem database from the job.

*`CLAUDE_CONFIG_DIR` must reach the job, not just your shell.* It is written into the unit's own
environment. A value exported in `.zshrc` is invisible to launchd and systemd, and the symptom is
silent: ledgers appear under `~/.claude/projects/` while your sessions read `$CFG/projects/`, and
memory stays empty forever with no error anywhere.

### Verify the wiring

```sh
python3 $S verify --phase wire
```

Asserts each entry appears exactly once (a duplicated hook runs the job twice), the mode file
exists, the observation budget reads 25, and the scheduler job is loaded.

---

## 4. Onboard a repo

One command per repo, run from anywhere:

```sh
python3 $S seed --repo /path/to/repo --since 2026-06-01 --pr 1874 --pr 1882
```

`--since` bounds the claude-mem sweep. `--pr` may repeat; give it a handful of recently merged PRs
that had real review discussion, so the first patterns rest on human findings rather than on
observations alone. Both are optional.

What it runs, in order, from inside the repo — all four are the skills' own entry points, so you
can run them individually when one fails:

```sh
cd /path/to/repo
python3 $SK/review-learn/scripts/ingest.py --since 2026-06-01 --pr 1874   # findings
python3 $SK/review-learn/scripts/maintain.py                              # findings → patterns
python3 $SK/review-learn/scripts/propose.py                               # patterns → guardrails
python3 $SK/dreamd/scripts/tick.py --project "$PWD" --job all --force     # episodes + all three jobs
```

Budget a few minutes and roughly four model calls. `--job all --force` runs reflect, nightly and
weekly even though none are due and even if the project is muted.

### There is no registration step

Do not look for one. The SessionStart hook registers the repo root every session, and the tick also
discovers repos from claude-mem tool use. A linked git worktree registers from its own sessions
rather than from the tick, by design — the tick will not walk into it.

### Read the output before trusting it

```sh
F=$(python3 -c "import re,os,sys;print(re.sub(r'[^A-Za-z0-9-]','-',os.path.realpath(sys.argv[1])))" /path/to/repo)
cat "$CFG/projects/$F/dream/memory.md"
cat "$CFG/projects/$F/dream/lessons.md"
cat "$CFG/projects/$F/review-patterns/index.md"
```

A repo with little claude-mem history produces a thin memory and few lessons. That is correct
behaviour, not a failure — there is nothing to consolidate yet. Two consequences worth stating
plainly to whoever asked for the install:

- The first reflect starts from the newest observations that fit its input cap. Older history is
  never replayed into memory. If a repo has years of claude-mem data, the stack starts from now.
- A nightly reporting `10/24 episodes` is normal. Only what fits the prompt is consolidated; the
  rest stay pending for the next run.

### Verify the seed

```sh
python3 $S verify --phase seed --repo /path/to/repo
```

Checks both ledgers exist as git repos with commits, `runs.jsonl` has an episodes row and a reflect
row, `.state.json` carries a watermark, and the block a session will actually receive is within the
token cap.

---

## 5. Prove it works end to end

```sh
python3 $S verify --repo /path/to/repo
```

Runs the wire checks, all four test suites, and the seed checks. Then three things no script can
confirm for you:

1. **Start a real session in the repo.** The dreamd memory block, the review-learn guardrails and
   the skill roster should all appear at SessionStart, and the claude-mem timeline should show 25
   entries rather than 50. If a block is missing, run its hook command by hand from inside the repo
   — the hooks print to stdout and are safe to invoke directly.
2. **Wait one scheduler interval**, then check the log gained a line:
   ```sh
   tail -5 "$CFG/dreamd/tick.log"
   launchctl print gui/$(id -u)/com.$USER.dreamd | grep -E 'state|last exit'   # macOS
   systemctl --user list-timers dreamd-tick.timer                             # Linux
   ```
   A non-zero last exit code, or a log that stops updating, almost always means the job is blocked
   on a repo path (§3.4) or cannot see `CLAUDE_CONFIG_DIR`.
3. **Mute and unmute**, confirming the block disappears and returns:
   ```sh
   python3 -c 'import sys,os;sys.path.insert(0,os.path.expanduser("~/.claude/skills/dreamd/scripts"));import dcommon as D;d=D.dream_dir(D.C.main_repo_root(os.getcwd()));s=D.state(d);s["muted"]=True;D.save_state(d,s)'
   ```
   `False` to unmute. Muting stops injection immediately; episodes keep accruing underneath.

---

## 6. Day-two operation

| Task | Command |
|---|---|
| dreamd status | `python3 $SK/dreamd/scripts/tick.py --project "$PWD"` (no `--force`: runs only what is due) |
| force one job | `python3 $SK/dreamd/scripts/tick.py --project "$PWD" --job reflect --force` (`nightly`, `weekly`, `all`) |
| roll back the last dreamd job | `git -C "$CFG/projects/<folder>/dream" revert --no-edit HEAD` |
| roll back only `memory.md` | `git -C "$CFG/projects/<folder>/dream" checkout <reflect-commit>~1 -- memory.md` |
| re-ingest review findings | `python3 $SK/review-learn/scripts/ingest.py --pr <N>` from inside the repo |
| see patterns and repeat rate | `cat "$CFG/projects/<folder>/review-patterns/index.md"` |
| lower the guardrail bar | `python3 $SK/review-learn/scripts/propose.py --threshold 2` |
| skill roster / candidates | `python3 $SK/skill-index/scripts/skill_index.py status`, `skill_learn.py status` |
| promote a skill candidate | `python3 $SK/skill-index/scripts/skill_learn.py promote` |

Dry runs exist where a mistake would be expensive: `ingest.py --dry-run`, `maintain.py --dry-run`,
`skill_learn.py discover --dry-run`, and `DREAMD_DRY_RUN=1` for a whole tick.

### Environment knobs

Read by the scripts, all optional. Set them in the scheduler unit (not only your shell) if the
scheduler must see them.

| Variable | Effect |
|---|---|
| `CLAUDE_CONFIG_DIR` | where every ledger lives; must reach the scheduler |
| `DREAMD_MEMORY_TOKENS` | cap on the injected block, default 2500 |
| `DREAMD_REFLECT_TOKENS`, `DREAMD_BATCH` | reflect input cap and batch size |
| `DREAMD_MODEL`, `REVIEW_LEARN_MODEL`, `SKILL_LEARN_MODEL` | model per subsystem |
| `DREAMD_NIGHTLY_HOUR`, `DREAMD_IDLE_S` | when nightly runs, how much idle time counts as a session boundary |
| `DREAMD_DRY_RUN`, `DREAMD_LEDGER`, `REVIEW_LEARN_LEDGER` | dry run; point a ledger elsewhere for testing |
| `REVIEW_LEARN_PROMOTE_AT`, `SKILL_LEARN_PROMOTE_AT` | occurrences before a pattern or candidate is promoted |
| `REVIEW_LEARN_RESIDENT`, `SKILL_INDEX_ROSTER_WIDTH` | size of each injected block |

### What to watch over weeks

- `dropped_by_provenance` per reflect in `dream/runs.jsonl` should stay near zero. A rise means the
  model is inventing evidence ids and the memory is drifting toward fiction.
- The repeat-rate column in `review-patterns/index.md` is the entire point of the system. It should
  fall over months. If it does not, the guardrails are not landing where the work happens.
- A ledger that never gains commits means the Stop hook is not firing. Check it is still in
  `$CFG/settings.json` and that the debounce window has actually elapsed.

---

## 7. Known ceilings

State these when handing the install over; they are design limits, not bugs to chase.

- The evidence gate checks that a cited observation id **exists**, not that it supports the
  sentence. It catches invented ids, not misattributed ones. `git revert` in the dream ledger is
  the remedy when a bullet reads wrong.
- Contrastive failure pairing needs file lists, which claude-mem populates on a small fraction of
  observations, so that mechanic is largely inert. dreamd supplements from tool use where it can.
- A lesson's `last_seen` is set at creation and refreshed only by a merge, so the 90-day decay
  effectively means 90 days since creation.
- The first reflect on a cold ledger skips history older than its input cap, permanently.
- review-learn's Stop hook can race a manual `maintain.py`. Both take the ledger lock, so the loser
  exits cleanly rather than corrupting anything — but a manual run during an active session may
  simply do nothing.

---

## 8. Removal

```sh
python3 $S uninstall                  # hooks, scheduler unit, claude-mem budget
python3 $S uninstall --remove-skills  # also deletes the three skill directories
```

Removes only the hook entries it owns and leaves foreign entries in the same files untouched.
Ledgers under `$CFG/projects/` are never deleted — they are the user's accumulated data, and
reinstalling on top of them resumes where the watermarks left off.

---

## 9. When something is wrong

| Symptom | First thing to check |
|---|---|
| SessionStart block empty | run the hook command by hand from inside the repo; it prints its own reason |
| memory never updates, no errors | `CLAUDE_CONFIG_DIR` missing from the scheduler unit (§3.4) — look for a stray ledger under `~/.claude/projects/` |
| tick.log stops updating mid-run | the job touched a path inside a repo and is blocked on TCC (§3.4); `launchctl print` will show it running forever |
| hooks run twice per session | a duplicated entry; `verify --phase wire` counts them |
| ingest finds no findings | `gh auth status`, and confirm the claude-mem mode file is installed (§3.3) |
| model calls fail or hang | the call must carry `--settings '{"disableAllHooks":true}'`; without it the hook fires inside the hook |
| a ledger has no commits | the Stop hook is missing, or the 10-minute debounce has not elapsed since the session ended |
| nothing works after a config move | the skills must be at `~/.claude/skills`; `CLAUDE_CONFIG_DIR` may move, they may not |
