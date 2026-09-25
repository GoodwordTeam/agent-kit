---
name: stack-setup
description: Install, verify, bundle or remove the self-improving stack (review-learn pattern ledger + skill-index roster + dreamd scheduled memory) on any machine, for any repo, on macOS or Linux. Use for "set up the learning stack", "install dreamd on this machine", "package the stack", "portable zip of my skills", "onboard a new repo to review-learn", "uninstall the stack", "why is the SessionStart block empty".
---

# stack-setup

Three skills work as one system and none of them is useful alone:

| Skill | What it does | Fires from |
|---|---|---|
| `review-learn` | PR review threads, claude-mem observations and user corrections → per-repo pattern ledger → guardrails injected at SessionStart | Stop hook, debounced 10 min |
| `skill-index` | the skill roster injected at SessionStart, plus skill-learn candidates discovered from repeating workflows | Stop hook (after review-learn) |
| `dreamd` | episodes → a rewritten `memory.md`, nightly typed lessons, weekly pruning, all injected within a 2.5k-token cap | its own 15-minute scheduler |

Everything derived lives under `$CLAUDE_CONFIG_DIR/projects/<repo-folder>/`, git-versioned and private. Nothing is ever written inside a repo.

One command does each step. `S=~/.claude/skills/stack-setup/scripts/install.py`.
For the full runbook — what each file does, every failure mode, day-two operation — read `references/SETUP.md`.
For a fresh machine, a shared skills repo, and the quirks that cost days, read `references/INTEGRATION-GUIDE.md`.

| Step | Command |
|---|---|
| check the machine | `python3 $S doctor` |
| package for another machine | `python3 $S bundle --out ~/claude-learning-stack.zip` |
| install from that zip | `unzip <zip> -d stack && python3 stack/skills/stack-setup/scripts/install.py apply --from stack` |
| wire hooks, claude-mem, scheduler | `python3 $S wire` |
| register the scheduler | `python3 $S schedule --load` |
| seed one repo | `python3 $S seed --repo /path/to/repo [--since 2026-06-01] [--pr 1874 --pr 1882]` |
| check everything | `python3 $S verify [--phase wire\|seed\|tests] [--repo /path/to/repo]` |
| remove it | `python3 $S uninstall [--remove-skills]` |

Every command prints what it changed and is safe to re-run. `wire` backs up each file it edits to `<name>.bak` and adds nothing that is already present. `apply` moves an existing install aside rather than deleting it.

## Phase 1 — prerequisites

`doctor` exits non-zero if a hard requirement is missing.

| Requirement | Hard | Why |
|---|---|---|
| `claude` CLI on PATH | yes | every model call is `claude -p --settings '{"disableAllHooks":true}'` |
| `git` | yes | the ledgers are git repos |
| python ≥ 3.9 | yes | the syntax floor of the skills; the installer uses the same interpreter for the scheduler unit |
| claude-mem database | yes | the only source of observations, sessions and tool use |
| claude-mem worker script | no | needed to apply a settings change without a manual restart |
| `gh` authenticated | no | PR review threads; review-learn still works from claude-mem alone |
| claude-reflect plugin | no | user-correction events, the largest term in dreamd's priority score |
| `node` or `bun` | no | runs the worker restart |

It also prints the resolved `CLAUDE_CONFIG_DIR`, the interpreter it will bake into the scheduler unit, and which scheduler it found.

**The skills root is not configurable.** They must sit at `~/.claude/skills/<name>`, because they import each other through that exact path (`dcommon.py`, `skill_learn.py`, `propose.py`, `stop_hook.py`). `CLAUDE_CONFIG_DIR` may be anywhere; only the skills location is fixed.

## Phase 2 — install and wire

`bundle` writes one zip holding the three skills, this installer, and the claude-mem mode file `code--review-learning.json`, which defines the `review-finding` and `review-resolution` observation types that review-learn keys on. Caches, `.pyc` and lock files are excluded. `apply` unpacks it to the skills root and symlinks each skill into `~/.codex/skills` so Codex sessions see the same thing.

`wire` touches exactly four places:

1. `$CLAUDE_CONFIG_DIR/settings.json` — three SessionStart entries with matcher `startup|resume|clear|compact`, plus the review-learn Stop hook.
2. `~/.codex/hooks.json` — the same three SessionStart commands, plus the Codex prompt hook and Stop hook. Skipped when `~/.codex` is absent.
3. `~/.claude-mem/settings.json` — `CLAUDE_MEM_CONTEXT_OBSERVATIONS=25` and `CLAUDE_MEM_MODE=code--review-learning`, then a worker restart. The 50→25 cut is the budget trade that pays for dreamd's injected block, so resident context stays flat.
4. The scheduler unit: a launchd plist on macOS, a systemd user service and timer on Linux, or a printed crontab line.

Two host facts that cost a day to learn, so do not undo them:

- **A scheduler must not open a file inside a repo.** On macOS, opening a path under `~/Documents` from a launchd job blocks uninterruptibly on the Files-and-Folders prompt, and `subprocess` timeouts do not fire. dreamd resolves repo roots with stat only and never spawns git. The systemd template deliberately omits `ProtectHome` and sandboxing for the same reason.
- **`CLAUDE_CONFIG_DIR` must reach the scheduler**, not just your shell. It is written into the unit's environment. A value exported in a shell profile alone will not be visible to the job, and the ledgers will silently land in `~/.claude` instead.

Verify: `python3 $S verify --phase wire` asserts each entry appears exactly once, the mode file exists, the observation budget reads 25, and the job is loaded.

## Phase 3 — seed a repo

`seed` runs, from inside the repo: review-learn `ingest → maintain → propose`, then one forced dreamd tick that builds episodes, writes the first memory, runs one nightly and one weekly. Budget a few minutes and roughly four model calls. Pass `--pr` a few times on the first run so the first patterns rest on real review threads rather than observations alone.

No per-repo registration step exists or is needed: the SessionStart hook registers the repo on every session, and the tick also discovers repos from claude-mem tool use. A linked git worktree registers from its own sessions.

Read `memory.md` and `lessons.md` by hand before trusting the injection. A repo with little claude-mem history produces a thin memory and few lessons; that is correct, not broken. dreamd's first reflect starts from the newest observations that fit its input cap and never replays older history into memory.

Verify: `python3 $S verify --phase seed --repo <path>` checks both ledgers exist with commits, the run ledger has an episodes row and a reflect row, the watermark is set, and the block a session will receive is within the token cap.

## Phase 4 — end to end

`python3 $S verify` runs the wire checks, all three test suites, and the seed checks when `--repo` is given. Then confirm by hand, because no script can:

1. Start a real session in the repo. The dreamd block, the review-learn guardrails and the skill roster should all appear, and the claude-mem timeline should show 25 entries rather than 50.
2. Mute and unmute dreamd, confirming the block disappears and returns.
3. Wait one scheduler interval and check `$CLAUDE_CONFIG_DIR/dreamd/tick.log` gained a line. On macOS: `launchctl print gui/$(id -u)/com.<user>.dreamd | grep -E 'state|last exit'`. On Linux: `systemctl --user list-timers dreamd-tick.timer`.

## What to watch

- `dropped_by_provenance` per reflect in `dream/runs.jsonl` should stay near zero. A rise means the prompt is inventing evidence ids.
- The repeat-rate column in `review-patterns/index.md` is the point of the whole exercise: it should fall over months.
- A nightly that reports `10/24 episodes` is normal. Only what fits the prompt is consolidated; the rest stay pending for the next run.

## Known ceilings

- The evidence gate checks that a cited id exists, not that it supports the sentence. It catches invented ids, not misattributed ones.
- Contrastive failure pairing needs file lists, and claude-mem populates them on a small fraction of observations, so that mechanic is mostly inert today. dreamd supplements from tool use where it can.
- A lesson's `last_seen` is set at creation and refreshed only by a merge, so the 90-day decay means 90 days since creation.
- The first reflect on a cold ledger skips history older than its input cap, permanently.

## Uninstall

`uninstall` removes the hook entries it owns and leaves foreign entries in the same file alone, unloads and deletes the scheduler unit, and restores the claude-mem observation budget. Ledgers under `$CLAUDE_CONFIG_DIR/projects/` are never deleted; they are your data. Add `--remove-skills` to drop the three skill directories too.

## Testing

```
python3 -m unittest discover ~/.claude/skills/stack-setup/tests   # hook merge, unit rendering, path derivation, bundle filters
python3 ~/.claude/skills/stack-setup/scripts/install.py verify    # the live machine, including the three skills' own suites
```
