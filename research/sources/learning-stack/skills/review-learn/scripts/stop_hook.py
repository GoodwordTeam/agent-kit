#!/usr/bin/env python3
"""Stop hook (Claude + Codex): gate, then detach ingest -> maintain -> propose. Debounced 10 min per project."""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import common as C  # noqa: E402

DEBOUNCE = 600


def main():
    if "--sync" in sys.argv:
        run_pipeline(sys.argv[sys.argv.index("--cwd") + 1], sys.argv[sys.argv.index("--source") + 1])
        return
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        payload = {}
    cwd = payload.get("cwd") or os.getcwd()
    if "/plugins/cache/" in cwd or payload.get("stop_hook_active"):
        return
    ledger = C.ledger_dir(cwd)
    if ledger is None:
        return
    mark = ledger / "raw" / ".last_run"
    if mark.exists() and time.time() - mark.stat().st_mtime < DEBOUNCE:
        return
    C.ensure_ledger(ledger)
    mark.touch()
    source = "codex" if "--source" in sys.argv and "codex" in sys.argv else "claude"
    detach([sys.executable, __file__, "--sync", "--source", source, "--cwd", cwd], ledger / "raw" / ".pipeline.log")


def detach(cmd, logfile):
    log = open(logfile, "a")
    subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)


def run_pipeline(cwd, source):
    from ingest import ingest
    from maintain import maintain
    from propose import propose
    print(f"\n== {C.now_iso()} {source} {cwd}", flush=True)
    fresh, _ = ingest(cwd, source=source)
    print(f"ingest +{len(fresh)}", flush=True)
    if fresh:
        print("maintain:", maintain(cwd))
        print("propose:", propose(cwd))
    sys.path.insert(0, str(Path.home() / ".claude/skills/skill-index/scripts"))
    try:
        import skill_index, skill_learn
        os.chdir(cwd)
        for label, _, index in skill_index.levels(cwd):
            if index.exists():
                skill_index.build_index(index, label)
        skill_index.refresh_self_description(sum(len(skill_index.skills_under(i)) for _, _, i in skill_index.levels(cwd) if i.exists()))
        print("skill-learn:", skill_learn.run(cwd), flush=True)
    except Exception as ex:  # the review pipeline must not fail because the skill index does
        print(f"skill-index/skill-learn skipped: {ex}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        print(f"review-learn stop hook: {ex}", file=sys.stderr)
