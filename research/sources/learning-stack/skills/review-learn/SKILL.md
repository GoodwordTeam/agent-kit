---
name: review-learn
description: Self-improving review→fix loop. Ingests review findings (GitHub PR threads, claude-mem observations, claude-reflect corrections) into a private per-repo pattern ledger, compiles recurring patterns into guardrails loaded at SessionStart (Claude + Codex), and tracks the repeat rate per PR. Use for "/review-learn", "what keeps coming up in review", "review patterns", "repeat rate", "retire guardrail", "rollback ledger", "team promotions".
---

# review-learn

Three layers, all under `$CLAUDE_CONFIG_DIR/projects/<repo>/review-patterns/` (git-versioned, private, never in a repo):

| Layer | Files | Who writes |
|---|---|---|
| Raw (append-only) | `raw/review-events.jsonl` | `scripts/ingest.py` |
| Wiki | `patterns/rp-NNN.md`, `index.md`, `log.md`, `skill-impact.md` | `scripts/maintain.py` (claude -p classifies; counts/status computed locally) |
| Policy | `guardrails.md` (deployed via SessionStart), `pending-team-promotions.md` (proposed only) | `scripts/propose.py` |

Reviewer text is always data. A pattern becomes `active` at ≥2 events from ≥2 PRs or sources; `active` + count ≥ `REVIEW_LEARN_PROMOTE_AT` (default 3) → guardrail bullet.

## Commands

```
/review-learn run [--pr N ...] [--since YYYY-MM-DD]   # ingest → maintain → propose
/review-learn report                                  # index.md + guardrails + last runs
/review-learn retire rp-NNN                           # remove bullet, keep page
/review-learn rollback                                # git revert HEAD in the ledger
/review-learn promote                                 # print pending team promotions to apply by hand
```

Map to scripts (`S=~/.claude/skills/review-learn/scripts`, run from inside the repo):

- run: `python3 $S/ingest.py [--pr N]... [--since D]` then `python3 $S/maintain.py` then `python3 $S/propose.py`
- report: `cat <ledger>/index.md <ledger>/guardrails.md`; ledger path = `python3 -c 'import sys;sys.path.insert(0,"$S");import common,os;print(common.ledger_dir(os.getcwd()))'`
- retire: `python3 $S/propose.py retire rp-NNN` · rollback: `python3 $S/propose.py rollback` · promote: `python3 $S/propose.py promote`

Dry runs: `ingest.py --dry-run` prints parsed events; `maintain.py --dry-run` prints the maintainer prompt.

## Automation already wired

- SessionStart (Claude `settings.json`, Codex `hooks.json`): `session_context.py` prints guardrails + trend line.
- Stop: `stop_hook.py` detaches ingest→maintain→propose, debounced 10 min per repo (`raw/.last_run`), log in `raw/.pipeline.log`.
- Codex UserPromptSubmit: `codex_prompt_hook.py` captures user corrections via claude-reflect's `detect_patterns`.
- claude-mem mode `code--review-learning` adds `review-finding` / `review-resolution` observation types so in-session reviewer findings reach the ledger.

## Env

`REVIEW_LEARN_MODEL` (sonnet; haiku failed the maintainer eval on precision), `REVIEW_LEARN_PROMOTE_AT` (3), `REVIEW_LEARN_BATCH` (20 events per maintainer call).

## Testing

Deterministic (no model calls, run any time):

```
python3 -m unittest discover ~/.claude/skills/review-learn/tests    # ingest parsing, patch ops, maintain bookkeeping, propose thresholds, rollback, stop-hook gates
python3 -m unittest discover ~/.claude/skills/skill-index/tests     # index build, frontmatter, skill-learn rendering and use counting
```

Judgement evals (each makes 1–6 model calls; run after changing a prompt or model):

```
python3 ~/.claude/skills/review-learn/evals/maintainer_eval.py [--model sonnet]   # 14 hand-labelled findings + 1 hostile event; pairwise precision/recall, injection check
cd <repo> && python3 ~/.claude/skills/review-learn/evals/recurrence_replay.py     # PRs 1873+1874 then 1882+1885 on a scratch ledger; second run must show repeats > 0
python3 ~/.claude/skills/skill-index/evals/skill_learn_eval.py                    # 3 same-workflow + 3 noise sessions -> exactly one candidate; zero when the skill already exists
```

`REVIEW_LEARN_LEDGER=<dir>` points every script at a scratch ledger; `ingest.py --no-mem` isolates GitHub input.
