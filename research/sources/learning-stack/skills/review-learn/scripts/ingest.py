#!/usr/bin/env python3
"""Raw layer: GitHub PR threads + claude-mem observations + claude-reflect queue -> raw/review-events.jsonl.

Every event: {source, kind, project, pr, sha, author, severity, path, line, text, url, ts, hash, platform}
kind = finding | resolution | correction. Reviewer text is data; it is never executed or interpreted here.
"""
import argparse
import json
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import common as C  # noqa: E402

SEV_RE = re.compile(r'alt="(P[0-3])"|\b(P[0-3])\b')
NOISE_RE = re.compile(r"railway-pr-env-link|Mergify Payload|^@greptileai|^@Mergifyio|greptile_summary", re.I | re.M)
REPORT_RE = re.compile(r"^\s*##\s*(re-)?review\b", re.I | re.M)
MEM_TITLE_RE = re.compile(r"finding|reviewer|blocker|greptile|\bP[0-3]\b|review (round|feedback|report)", re.I)
MEM_DB = Path(os.environ.get("CLAUDE_MEM_DATA_DIR", Path.home() / ".claude-mem")) / "claude-mem.db"


def parse_severity(body):
    m = SEV_RE.search(body or "")
    return (m.group(1) or m.group(2)) if m else None


def strip_html(body):
    return re.sub(r"<[^>]+>", "", body or "").strip()


def gh_json(args):
    r = C.run(["gh", "api", "--paginate"] + args, timeout=120)
    if r.returncode != 0:
        return []
    # --paginate concatenates arrays; normalise.
    text = r.stdout.strip()
    if not text:
        return []
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        out = []
        for chunk in re.split(r"\]\s*\[", text):
            chunk = chunk if chunk.startswith("[") else "[" + chunk
            chunk = chunk if chunk.endswith("]") else chunk + "]"
            out.extend(json.loads(chunk))
        return out


def events_from_github(prs, project, cwd):
    """Build events from a list of PR dicts as returned by gh (number, headRefOid, author.login)."""
    repo = C.run(["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], cwd=cwd).stdout.strip()
    events = []
    for pr in prs:
        n, sha, author = pr["number"], pr.get("headRefOid", ""), (pr.get("author") or {}).get("login", "")
        comments = gh_json([f"repos/{repo}/pulls/{n}/comments"])
        by_id = {c["id"]: c for c in comments}
        for c in comments:
            events.append(github_comment_event(c, by_id, n, sha, author, project))
        for rv in gh_json([f"repos/{repo}/pulls/{n}/reviews"]):
            if not (rv.get("body") or "").strip():
                continue
            events.append(mk("github", "finding", project, n, sha, rv["user"]["login"], parse_severity(rv["body"]),
                             None, None, strip_html(rv["body"]), rv["html_url"], rv["submitted_at"]))
        for ic in gh_json([f"repos/{repo}/issues/{n}/comments"]):
            body = ic.get("body") or ""
            if NOISE_RE.search(body) or not REPORT_RE.search(body):
                continue
            events.append(mk("review-report", "finding", project, n, sha, ic["user"]["login"], None, None, None,
                             strip_html(body), ic["html_url"], ic["created_at"]))
    return events


def github_comment_event(c, by_id, n, sha, pr_author, project):
    login = c["user"]["login"]
    parent = c.get("in_reply_to_id")
    if parent is None:
        source, kind = "github", "finding"
    elif login == pr_author:
        source, kind = "author-reply", "resolution"
    else:
        source, kind = "github-reply", "resolution"
    e = mk(source, kind, project, n, sha, login, parse_severity(c["body"]), c.get("path"),
           c.get("line") or c.get("original_line"), strip_html(c["body"]), c["html_url"], c["created_at"])
    if parent is not None and parent in by_id:
        e["in_reply_to"] = C.event_hash("github", by_id[parent]["html_url"])
    return e


def mk(source, kind, project, pr, sha, author, severity, path, line, text, url, ts, platform="claude", key=None):
    return {
        "source": source, "kind": kind, "project": project, "pr": pr, "sha": sha, "author": author,
        "severity": severity, "path": path, "line": line, "text": text, "url": url, "ts": ts,
        "platform": platform, "hash": C.event_hash(source, key or url or text),
    }


def events_from_claude_mem(project, ledger, since_epoch):
    if not MEM_DB.exists() or not project:
        return [], None
    wm = C.read_json(ledger / "raw" / ".watermark.json", {})
    min_id = wm.get("claude_mem_max_id", 0)
    con = sqlite3.connect(f"file:{MEM_DB}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        """select o.id, o.type, o.title, o.subtitle, o.narrative, o.facts, o.concepts, o.files_modified,
                  o.created_at, o.created_at_epoch, o.project, s.platform_source
           from observations o left join sdk_sessions s on s.memory_session_id = o.memory_session_id
           where (o.project = ? or o.project like ?) and o.id > ? and o.created_at_epoch >= ?
           order by o.id""",
        (project, project + "/%", min_id, since_epoch or 0)).fetchall()
    con.close()
    events, max_id = [], min_id
    for r in rows:
        max_id = max(max_id, r["id"])
        concepts = r["concepts"] or ""
        is_review = r["type"] in ("review-finding", "review-resolution")
        is_gotcha = "gotcha" in concepts and MEM_TITLE_RE.search(r["title"] or "")
        if not (is_review or is_gotcha):
            continue
        kind = "resolution" if r["type"] == "review-resolution" else "finding"
        text = "\n".join(x for x in (r["title"], r["subtitle"], r["narrative"], r["facts"]) if x)
        path = None
        try:
            files = json.loads(r["files_modified"] or "[]")
            path = files[0] if files else None
        except json.JSONDecodeError:
            pass
        m = re.search(r"/(\d{3,5})\b|#(\d{3,5})\b", r["project"] + " " + (r["title"] or ""))
        pr = int(m.group(1) or m.group(2)) if m else None
        e = mk("claude-mem", kind, project, pr, None, f"observer:{r['type']}", parse_severity(text), path, None,
               text, None, r["created_at"], platform=r["platform_source"] or "claude", key=f"obs:{r['id']}")
        e["obs_id"] = r["id"]
        events.append(e)
    return events, max_id


def events_from_reflect_queue(project, cwd):
    folder = C.reflect_folder_name(C.main_repo_root(cwd) or cwd)
    events = []
    for base in {Path.home() / ".claude", C.CONFIG_DIR}:
        items = C.read_json(base / "projects" / folder / "learnings-queue.json", [])
        for it in items:
            if it.get("sentiment") != "correction":
                continue
            events.append(mk("user-correction", "correction", project, None, None, "user", None, None, None,
                             it.get("message", ""), None, it.get("timestamp"),
                             key=f"{it.get('timestamp')}|{it.get('message', '')[:200]}"))
    return events


def events_from_memory_notes(paths, project):
    events = []
    for p in paths:
        p = Path(p)
        if not p.exists():
            continue
        meta, body = C.parse_page(p.read_text())
        ts = datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        events.append(mk("memory-note", "finding", project, None, None, "user", None, None, None,
                         f"{meta.get('description', '')}\n\n{body.strip()}", None, ts, key=p.name))
    return events


def resolve_prs(pr_numbers, cwd):
    if pr_numbers:
        out = []
        for n in pr_numbers:
            r = C.run(["gh", "pr", "view", str(n), "--json", "number,headRefOid,author"], cwd=cwd)
            if r.returncode == 0:
                out.append(json.loads(r.stdout))
        return out
    r = C.run(["gh", "pr", "view", "--json", "number,headRefOid,author"], cwd=cwd)
    return [json.loads(r.stdout)] if r.returncode == 0 else []


def ingest(cwd, prs=(), since=None, source="claude", dry_run=False, memory_notes=(), skip_github=False, skip_mem=False):
    ledger = C.ledger_dir(cwd)
    if ledger is None:
        return [], None
    project = C.project_name(cwd)
    since_epoch = int(datetime.strptime(since, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()) if since else None
    events = []
    if not skip_github:
        events += events_from_github(resolve_prs(prs, cwd), project, cwd)
    mem_events, max_id = ([], None) if skip_mem else events_from_claude_mem(project, ledger if ledger.exists() else Path("/nonexistent"), since_epoch)
    events += mem_events
    if source != "codex":
        events += events_from_reflect_queue(project, cwd)
    events += events_from_memory_notes(memory_notes, project)
    if dry_run:
        return events, ledger
    C.ensure_ledger(ledger)
    fresh = C.append_events(ledger, events)
    if max_id:
        C.write_json(ledger / "raw" / ".watermark.json", {"claude_mem_max_id": max_id, "ts": C.now_iso()})
    if fresh:
        C.git_commit(ledger, f"ingest: +{len(fresh)} events")
    return fresh, ledger


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pr", type=int, action="append", default=[])
    ap.add_argument("--since", help="YYYY-MM-DD lower bound for claude-mem observations (first run)")
    ap.add_argument("--source", default="claude", choices=["claude", "codex"])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-github", action="store_true")
    ap.add_argument("--no-mem", action="store_true", help="skip claude-mem (isolates GitHub-only replays)")
    ap.add_argument("--memory-note", action="append", default=[], help="memory .md file to seed as an event")
    ap.add_argument("--cwd", default=os.getcwd())
    a = ap.parse_args()
    events, ledger = ingest(a.cwd, a.pr, a.since, a.source, a.dry_run, a.memory_note, a.no_github, a.no_mem)
    if a.dry_run:
        for e in events:
            print(f"{e['source']:14} {e['kind']:10} pr={e['pr']} sev={e['severity']} by={e['author']} "
                  f"{(e['path'] or '')}:{e['line'] or ''}\n    {e['text'][:140]!r}")
        print(f"\n{len(events)} events (dry run; ledger={ledger})")
    else:
        print(f"review-learn ingest: +{len(events)} new events -> {ledger}")


if __name__ == "__main__":
    main()
