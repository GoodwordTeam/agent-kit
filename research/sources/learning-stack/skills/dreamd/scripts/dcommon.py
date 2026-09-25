#!/usr/bin/env python3
"""dreamd shared helpers: dream ledger paths, project registry, token estimate, provenance gate, claude-mem queries.

Downstream consumer of review-learn (common.py) and claude-mem; never writes tracked repo files.
"""
import fcntl
import json
import math
import os
import re
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.append(str(Path.home() / ".claude/skills/review-learn/scripts"))  # append: review-learn also has a session_context.py
import common as C  # noqa: E402

CONFIG_DIR = C.CONFIG_DIR
SKILL_DIR = Path(__file__).resolve().parent.parent
DREAMD_DIR = CONFIG_DIR / "dreamd"
MEM_DB = Path(os.environ.get("CLAUDE_MEM_DATA_DIR", Path.home() / ".claude-mem")) / "claude-mem.db"

MODEL = os.environ.get("DREAMD_MODEL", "sonnet")
IDLE_S = int(os.environ.get("DREAMD_IDLE_S", "300"))
REFLECT_TOKENS = int(os.environ.get("DREAMD_REFLECT_TOKENS", "25000"))
MEMORY_TOKENS = int(os.environ.get("DREAMD_MEMORY_TOKENS", "2500"))
NIGHTLY_HOUR = int(os.environ.get("DREAMD_NIGHTLY_HOUR", "2"))
BATCH = int(os.environ.get("DREAMD_BATCH", "24"))
DRY_RUN = os.environ.get("DREAMD_DRY_RUN") == "1"

FAILURE_TYPES = {"review-finding", "test-failure", "error", "security_alert", "critical-issue", "blocker"}
SECTIONS = ["## Current state", "## Decisions", "## Unresolved", "## Preferences & corrections",
            "## Environment gotchas", "## Completed ✅ (last 7 days)"]
ID_RE = re.compile(r"\b(obs:\d+|S[0-9a-f][0-9a-f-]{5,})\b")
LESSONS_INDEX_HEAD = "# Lessons\n\n| id | status | scope | confidence | last seen | statement |\n|---|---|---|---|---|---|\n"


def now_ms():
    return int(time.time() * 1000)


def today():
    return datetime.now().strftime("%Y-%m-%d")


def tokens(text):
    return len(text) // 4


def sid8(sid):
    """Session id as cited in memory: S + first 8 chars (models truncate full UUIDs anyway)."""
    return f"S{str(sid)[:8]}"


# --- dream ledger ------------------------------------------------------------

def dream_dir(root):
    if os.environ.get("DREAMD_LEDGER"):  # tests and evals point at a scratch ledger
        return Path(os.environ["DREAMD_LEDGER"])
    return CONFIG_DIR / "projects" / C.project_folder_name(root) / "dream"


def ensure_dream(d):
    (d / "lessons").mkdir(parents=True, exist_ok=True)
    if not (d / ".git").exists():
        C.run(["git", "init", "-q"], cwd=d)
        C.run(["git", "config", "user.email", "dreamd@local"], cwd=d)
        C.run(["git", "config", "user.name", "dreamd"], cwd=d)
        for name, text in {"memory.md": "", "episodes.jsonl": "", "runs.jsonl": "", "log.md": "# dreamd log\n",
                           "lessons.md": LESSONS_INDEX_HEAD, ".state.json": "{}", ".gitignore": ".lock\n"}.items():
            if not (d / name).exists():
                (d / name).write_text(text)
        C.git_commit(d, "init dream ledger")
    return d


def rp_ledger(root):
    """review-learn ledger for a main repo root, computed without spawning git (launchd processes hang on the TCC prompt for ~/Documents)."""
    if os.environ.get("REVIEW_LEARN_LEDGER"):
        return Path(os.environ["REVIEW_LEARN_LEDGER"])
    return CONFIG_DIR / "projects" / C.project_folder_name(root) / "review-patterns"


def state(d):
    return C.read_json(d / ".state.json", {})


def save_state(d, st):
    C.write_json(d / ".state.json", st)


def read_jsonl(path):
    p = Path(path)
    if not p.exists():
        return []
    return [json.loads(ln) for ln in p.read_text().splitlines() if ln.strip()]


def write_jsonl(path, rows):
    Path(path).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))


def append_run(d, run):
    run = {"ts": C.now_iso(), **run}
    with (d / "runs.jsonl").open("a") as f:
        f.write(json.dumps(run, ensure_ascii=False) + "\n")
    return run


def log(d, msg):
    with (d / "log.md").open("a") as f:
        f.write(f"- {C.now_iso()} {msg}\n")


# --- provenance --------------------------------------------------------------

def cited_ids(text):
    return set(ID_RE.findall(text or ""))


def provenance_gate(lines, valid_ids):
    """Keep bullets citing >=1 id in valid_ids; non-bullet lines pass through. Returns (kept_lines, dropped_count)."""
    kept, dropped = [], 0
    for ln in lines:
        if not ln.lstrip().startswith("- "):
            kept.append(ln)
            continue
        if cited_ids(ln) & valid_ids:
            kept.append(ln)
        else:
            dropped += 1
    return kept, dropped


# --- claude-mem --------------------------------------------------------------

def mem():
    if not MEM_DB.exists():
        return None
    con = sqlite3.connect(f"file:{MEM_DB}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    return con


def project_where(col="project"):
    return f"({col} = ? or {col} like ?)"


def project_args(mem_project):
    return (mem_project, mem_project + "/%")


def last_activity_ms(con, mem_project):
    r = con.execute(f"select max(created_at_epoch) from observations where {project_where()}", project_args(mem_project)).fetchone()
    return r[0] or 0


def new_tokens_since(con, mem_project, last_obs_id):
    r = con.execute(f"select coalesce(sum(discovery_tokens),0), count(*) from observations where {project_where()} and id > ?",
                    (*project_args(mem_project), last_obs_id)).fetchone()
    return r[0], r[1]


def registry_path():
    return DREAMD_DIR / "projects.json"


SKIP_CWD = ("/plugins/cache/", "/tmp/", "/private/tmp/")


def root_of(cwd):
    """Main repo root by walking up for a `.git` DIRECTORY, using stat only. Never opens a file and never spawns git,
    so it is safe under launchd (an open() under ~/Documents blocks on the TCC prompt and ignores timeouts).
    A linked worktree (`.git` is a file) returns None; its main root registers from its own sessions."""
    try:
        p = Path(cwd).resolve()
    except OSError:
        return None
    for d in [p, *p.parents]:
        try:
            if (d / ".git").is_dir():
                return d
        except OSError:
            return None
    return None


def discover_projects(con, days=14, registry=None):
    """Auto-register repos from claude-mem tool use: latest cwd per project -> stat-resolved root. Complements the
    SessionStart registration, which also covers linked worktrees."""
    path = registry or registry_path()
    reg = C.read_json(path, {})
    if con is None:
        return reg
    rows = con.execute(
        """select project, cwd, max(created_at_epoch) as last_seen from tool_uses
           where created_at_epoch > ? and cwd is not null and cwd != '' group by project, cwd order by last_seen""",
        (now_ms() - days * 86400 * 1000,)).fetchall()
    found = {}
    for r in rows:
        if any(s in r["cwd"] + "/" for s in SKIP_CWD):
            continue
        root = root_of(r["cwd"])
        if root is None:
            continue
        found[C.project_folder_name(root)] = {"root": str(root), "mem_project": r["project"].split("/")[0],
                                              "last_seen": r["last_seen"]}
    for folder, info in found.items():
        if reg.get(folder, {}).get("last_seen", 0) < info["last_seen"]:
            reg[folder] = info
    if not DRY_RUN and found:
        path.parent.mkdir(parents=True, exist_ok=True)
        C.write_json(path, reg)
    return reg


def register_root(root, registry=None):
    """Record a main repo root -> claude-mem project (folder basename). Called from SessionStart (user context, TCC-approved) and
    tick --project; the launchd tick itself never resolves roots because git blocks uninterruptibly on the ~/Documents TCC prompt."""
    path = registry or registry_path()
    reg = C.read_json(path, {})
    root = Path(root).resolve()
    reg[C.project_folder_name(root)] = {"root": str(root), "mem_project": root.name, "last_seen": now_ms()}
    if not DRY_RUN:
        path.parent.mkdir(parents=True, exist_ok=True)
        C.write_json(path, reg)
    return reg


def try_lock(path):
    """Exclusive non-blocking lock; returns the handle (keep it alive) or None if held elsewhere."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    fh = open(path, "w")
    try:
        fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        fh.close()
        return None
    return fh


def age_words(ms):
    if not ms:
        return "never"
    s = max(0, (now_ms() - ms) // 1000)
    for unit, n in (("d", 86400), ("h", 3600), ("m", 60)):
        if s >= n:
            return f"{s // n}{unit}"
    return f"{s}s"


def decay(age_days, half=14):
    return math.exp(-age_days / half)
