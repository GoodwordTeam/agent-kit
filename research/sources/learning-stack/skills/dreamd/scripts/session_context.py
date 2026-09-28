#!/usr/bin/env python3
"""SessionStart hook (Claude + Codex): print dream/memory.md + confirmed lessons within DREAMD_MEMORY_TOKENS, then one status line."""
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import dcommon as D  # noqa: E402
from dcommon import C  # noqa: E402
import consolidate as K  # noqa: E402

MAX_LESSONS = 8
TRIM_ORDER = ["## Completed ✅ (last 7 days)", "## Lessons", "## Current state", "## Decisions", "## Unresolved",
              "## Environment gotchas", "## Preferences & corrections"]


def sections(text):
    """[(header or None, [lines])] preserving order."""
    out, cur = [], (None, [])
    for ln in text.splitlines():
        if ln.startswith("## "):
            out.append(cur)
            cur = (ln, [])
        else:
            cur[1].append(ln)
    out.append(cur)
    return out


def trim(text, cap):
    """Drop bullets from the bottom of the least valuable section first until the block fits `cap` tokens.
    A section with no bullets left cannot shrink further, so the result is hard-cut at the cap as a floor."""
    secs = sections(text)
    while D.tokens(render(secs)) > cap:
        for h in TRIM_ORDER:
            sec = next((s for s in secs if s[0] == h), None)
            idx = max((i for i, ln in enumerate(sec[1]) if ln.startswith("- ")), default=None) if sec else None
            if idx is not None:
                del sec[1][idx]
                break
        else:
            break
    out = render(secs)
    if D.tokens(out) > cap:  # prose-only content the bullet pass cannot shrink
        note = "\n(truncated at the dreamd token cap)\n"
        out = out[:max(0, cap * 4 - len(note))].rsplit("\n", 1)[0] + note
    return out


def render(secs):
    parts = []
    for h, lines in secs:
        block = ("\n".join(([h] if h else []) + lines)).strip("\n")
        if block:
            parts.append(block)
    return "\n\n".join(parts) + "\n"


def lessons_block(dream):
    rows = [m for m, _, _ in K.load_lessons(dream).values() if m.get("status") == "confirmed"]
    rows.sort(key=lambda m: (float(m.get("confidence") or 0), str(m.get("last_seen") or "")), reverse=True)
    if not rows:
        return "", 0
    return "## Lessons\n" + "\n".join(f"- {m['statement']} [{m['id']}]" for m in rows[:MAX_LESSONS]) + "\n", len(rows)


def status_line(dream, st, n_lessons, n_confirmed):
    last_n = str(st.get("last_nightly") or "")
    today = D.today()
    nxt = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d") if last_n >= today else today
    return f"dreamd: reflected {D.age_words(st.get('last_reflect'))} ago · {n_lessons} lessons ({n_confirmed} confirmed) · next nightly {nxt} · /dreamd report"


def main():
    root = C.main_repo_root(os.getcwd())
    if root is None:
        return
    D.register_root(root)  # the launchd tick cannot resolve roots itself (TCC); sessions register their repo here
    dream = D.dream_dir(root)
    if not (dream / "memory.md").exists():
        return
    st = D.state(dream)
    if st.get("muted"):
        return
    memory = (dream / "memory.md").read_text().strip()
    lessons, n_conf = lessons_block(dream)
    n_lessons = len(K.load_lessons(dream))
    block = trim((memory + "\n\n" + lessons).strip() + "\n", D.MEMORY_TOKENS) if (memory or lessons) else ""
    if block.strip():
        print("dreamd working memory for this repo (derived from past sessions; every bullet cites its evidence ids):")
        print(block.rstrip())
    print(status_line(dream, st, n_lessons, n_conf))


if __name__ == "__main__":
    try:
        main()
    except Exception as ex:  # never block a session start
        print(f"dreamd: context unavailable ({ex})", file=sys.stderr)
