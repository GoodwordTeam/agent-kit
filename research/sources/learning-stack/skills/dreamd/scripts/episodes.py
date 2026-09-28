#!/usr/bin/env python3
"""Episode memory: completed claude-mem sessions -> dream/episodes.jsonl (deterministic) with a priority score.
Episodes are only ever appended here; consolidation later rewrites the file in place to stamp `consolidated_run`.

priority = 0.30*C + 0.20*F + 0.15*R + 0.10*T + 0.10*N + 0.15*A
  C corrections (cap 3) · F failure signals (cap 5) · R review events (cap 5) · T tokens / max tokens in window
  N share of files_modified never seen in earlier episodes · A exp(-age_days/14). K (conflict) waits for lessons.
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import dcommon as D  # noqa: E402

STALE_ACTIVE_MS = 6 * 3600 * 1000


def iso_to_ms(ts):
    try:
        return int(datetime.strptime(ts[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc).timestamp() * 1000)
    except (TypeError, ValueError):
        return None


def fetch_sessions(con, mem_project, since_ms, now_ms):
    return con.execute(
        f"""select id, memory_session_id, platform_source, started_at_epoch, completed_at_epoch
            from sdk_sessions where {D.project_where()} and memory_session_id is not null and started_at_epoch >= ?
              and (completed_at_epoch is not null or started_at_epoch < ?) order by started_at_epoch""",
        (*D.project_args(mem_project), since_ms, now_ms - STALE_ACTIVE_MS)).fetchall()


def edited_files(con, sid):
    """File paths this session actually wrote, from tool use. Covers sessions whose observations carry no file list."""
    out = set()
    for (inp,) in con.execute(
            "select tool_input from tool_uses where memory_session_id = ? and tool_name in ('Edit','Write','NotebookEdit')", (sid,)):
        try:
            path = json.loads(inp or "{}").get("file_path")
        except (json.JSONDecodeError, AttributeError):
            continue
        if path:
            out.add(path)
    return out


def raw_episode(con, s, ledger_events):
    obs = con.execute("select id, type, discovery_tokens, files_modified, created_at_epoch from observations where memory_session_id = ?",
                      (s["memory_session_id"],)).fetchall()
    if not obs:
        return None
    files = set()
    for o in obs:
        try:
            files |= set(json.loads(o["files_modified"] or "[]"))
        except (json.JSONDecodeError, TypeError):
            pass
    files |= edited_files(con, s["memory_session_id"])  # claude-mem fills observations.files_modified on ~4% of rows
    ended = s["completed_at_epoch"] or max(o["created_at_epoch"] for o in obs)
    summ = con.execute("select request, completed from session_summaries where memory_session_id = ? order by id desc limit 1",
                       (s["memory_session_id"],)).fetchone()
    prompts = con.execute("select count(*) from user_prompts where session_db_id = ?", (s["id"],)).fetchone()[0]
    obs_ids = {o["id"] for o in obs}
    corrections = sum(1 for e in ledger_events if e.get("source") == "user-correction"
                      and (iso_to_ms(e.get("ts")) or -1) >= s["started_at_epoch"] and (iso_to_ms(e.get("ts")) or -1) <= ended)
    review_events = sum(1 for e in ledger_events if e.get("obs_id") in obs_ids and e.get("source") != "dreamd")  # never count our own output
    return {
        "sid": s["memory_session_id"], "platform": s["platform_source"], "started": s["started_at_epoch"], "ended": ended,
        "prompts": prompts, "obs": len(obs), "tokens": sum(o["discovery_tokens"] or 0 for o in obs),
        "files_modified": sorted(files), "request": (summ["request"] if summ else None),
        "completed": bool(summ and (summ["completed"] or "").strip()),
        "failure_signals": sum(1 for o in obs if o["type"] in D.FAILURE_TYPES),
        "corrections": corrections, "review_events": review_events,
    }


WINDOW_MS = 30 * 86400 * 1000


def score(new, existing, now_ms):
    """Fill `priority` in place. T is relative to the max tokens in the 30-day window; N against files of earlier episodes."""
    in_window = [e for e in existing if now_ms - e["ended"] <= WINDOW_MS] + new
    max_tokens = max([e["tokens"] for e in in_window] or [1]) or 1
    seen = set()
    for e in existing:
        seen |= set(e["files_modified"])
    for e in sorted(new, key=lambda x: x["started"]):
        files = e["files_modified"]
        novel = sum(1 for f in files if f not in seen)
        n = novel / len(files) if files else 0.0
        seen |= set(files)
        age_days = max(0.0, (now_ms - e["ended"]) / 86400000)
        e["priority"] = round(
            0.30 * min(e["corrections"], 3) / 3 + 0.20 * min(e["failure_signals"], 5) / 5 + 0.15 * min(e["review_events"], 5) / 5
            + 0.10 * e["tokens"] / max_tokens + 0.10 * n + 0.15 * D.decay(age_days), 4)
    return new


def build(con, dream, mem_project, ledger_events, now_ms=None, days=30):
    now_ms = now_ms or D.now_ms()
    existing = D.read_jsonl(dream / "episodes.jsonl")
    known = {e["sid"] for e in existing}
    new = []
    for s in fetch_sessions(con, mem_project, now_ms - days * 86400 * 1000, now_ms):
        if s["memory_session_id"] in known:
            continue
        ep = raw_episode(con, s, ledger_events)
        if ep:
            new.append(ep)
    score(new, existing, now_ms)
    if new and not D.DRY_RUN:
        with (dream / "episodes.jsonl").open("a") as f:
            for e in sorted(new, key=lambda x: x["started"]):
                f.write(json.dumps(e, ensure_ascii=False) + "\n")
    return new
