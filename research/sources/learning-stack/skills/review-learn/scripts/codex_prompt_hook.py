#!/usr/bin/env python3
"""Codex UserPromptSubmit: run claude-reflect's detect_patterns on the prompt; corrections -> ledger raw."""
import glob
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import common as C  # noqa: E402


def load_detect():
    for base in (C.CONFIG_DIR, Path.home() / ".claude"):
        hits = sorted(glob.glob(str(base / "plugins/cache/claude-reflect-marketplace/claude-reflect/*/scripts/lib")))
        if hits:
            sys.path.insert(0, hits[-1])
            from reflect_utils import detect_patterns  # type: ignore
            return detect_patterns
    return None


def main():
    detect = load_detect()
    if detect is None:
        return
    payload = json.load(sys.stdin)
    prompt = (payload.get("prompt") or payload.get("user_prompt") or "").strip()
    cwd = payload.get("cwd") or os.getcwd()
    if not prompt or len(prompt) > 2000 or prompt.startswith("<"):
        return
    item_type, patterns, confidence, sentiment, _ = detect(prompt)
    if not item_type or sentiment != "correction":
        return
    ledger = C.ledger_dir(cwd)
    if ledger is None:
        return
    C.ensure_ledger(ledger)
    ts = C.now_iso()
    C.append_events(ledger, [{
        "source": "user-correction", "kind": "correction", "project": C.project_name(cwd), "pr": None, "sha": None,
        "author": "user", "severity": None, "path": None, "line": None, "text": prompt, "url": None, "ts": ts,
        "platform": "codex", "patterns": patterns, "confidence": confidence,
        "hash": C.event_hash("user-correction", f"{ts}|{prompt[:200]}"),
    }])
    print(f"review-learn: correction captured ({confidence:.0%})")


if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        print(f"review-learn codex hook: {ex}", file=sys.stderr)
