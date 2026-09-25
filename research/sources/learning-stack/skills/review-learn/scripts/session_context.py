#!/usr/bin/env python3
"""SessionStart hook (Claude + Codex): print deployed guardrails + one trend line as context."""
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import common as C  # noqa: E402


def top_recent(bullets, ledger, cap):
    """Keep the `cap` bullets whose pattern recurred most recently (then most often); order by pattern id."""
    if len(bullets) <= cap:
        return bullets
    rank = {}
    for pid, (meta, _, _) in C.load_patterns(ledger).items():
        rank[pid] = (str(meta.get("last_seen") or ""), int(meta.get("count") or 0))
    def key(b):
        m = re.match(r"- \[(rp-\d+)\]", b)
        return rank.get(m.group(1) if m else "", ("", 0))
    keep = set(sorted(bullets, key=key, reverse=True)[:cap])
    return [b for b in bullets if b in keep]


def main():
    ledger = C.ledger_dir(os.getcwd())
    if ledger is None or not (ledger / "index.md").exists():
        return
    guard = (ledger / "guardrails.md").read_text().strip() if (ledger / "guardrails.md").exists() else ""
    index = (ledger / "index.md").read_text()
    runs = [ln.split("|") for ln in index.splitlines() if ln.startswith("| 20")][-5:]
    rates = [r[-2].strip() for r in runs]
    n_patterns = len(re.findall(r"^\| rp-\d+ \|", index, re.M))
    pending = (ledger / "pending-team-promotions.md").read_text() if (ledger / "pending-team-promotions.md").exists() else ""
    n_pending = len(re.findall(r"^applied: *$", pending, re.M))
    trend = f"{rates[0]}→{rates[-1]}" if len(rates) > 1 else (rates[0] if rates else "n/a")
    if guard:
        bullets = [ln for ln in guard.splitlines() if ln.startswith("- [")]
        cap = int(os.environ.get("REVIEW_LEARN_RESIDENT", "10"))
        shown = top_recent(bullets, ledger, cap)
        print("review-learn guardrails (recurring review findings in this repo — check the diff against these before asking for review):")
        print("\n".join(shown))
        if len(bullets) > len(shown):
            print(f"(+{len(bullets) - len(shown)} more in {ledger / 'guardrails.md'}; full pattern list in {ledger / 'index.md'})")
    print(f"review-learn: {n_patterns} patterns · repeat rate last {len(runs)} runs {trend} · {n_pending} team promotions pending (`/review-learn promote`)")


if __name__ == "__main__":
    try:
        main()
    except Exception as ex:  # never block a session start
        print(f"review-learn: context unavailable ({ex})", file=sys.stderr)
