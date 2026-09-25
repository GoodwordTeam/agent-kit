#!/usr/bin/env python3
"""Shared helpers for review-learn: ledger paths, jsonl append+dedupe, git, claude -p."""
import fcntl
import hashlib
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

CONFIG_DIR = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude")
SKILL_DIR = Path(__file__).resolve().parent.parent
MODEL = os.environ.get("REVIEW_LEARN_MODEL", "sonnet")  # evals/maintainer_eval.py: haiku merged two classes (precision 0.67), sonnet 1.00
PROMOTE_AT = int(os.environ.get("REVIEW_LEARN_PROMOTE_AT", "3"))
ACTIVE_AT = 2  # events needed, from >=2 distinct sources or PRs, before a pattern is active


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def run(cmd, cwd=None, check=False, input_text=None, timeout=120):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=check,
                          input=input_text, timeout=timeout)


def main_repo_root(cwd=None):
    """Main worktree root (worktrees share one ledger). None outside git."""
    r = run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd=cwd)
    if r.returncode != 0:
        return None
    common = Path(r.stdout.strip())
    return common.parent if common.name == ".git" else common


def project_folder_name(path):
    """Claude Code convention: /Users/bob/my_app -> -Users-bob-my-app (non-alphanumerics become '-')."""
    return re.sub(r"[^A-Za-z0-9-]", "-", str(Path(path).resolve()))


def reflect_folder_name(path):
    """claude-reflect's own convention keeps underscores: /Users/bob/my_app -> -Users-bob-my_app."""
    return "-" + str(Path(path).resolve()).replace("/", "-").replace("\\", "-").lstrip("-")


def project_name(cwd=None):
    root = main_repo_root(cwd)
    return root.name if root else None


def ledger_dir(cwd=None):
    if os.environ.get("REVIEW_LEARN_LEDGER"):  # tests and replays point at a scratch ledger
        return Path(os.environ["REVIEW_LEARN_LEDGER"])
    root = main_repo_root(cwd)
    if root is None:
        return None
    return CONFIG_DIR / "projects" / project_folder_name(root) / "review-patterns"


def ensure_ledger(ledger):
    (ledger / "raw").mkdir(parents=True, exist_ok=True)
    (ledger / "patterns").mkdir(exist_ok=True)
    if not (ledger / ".git").exists():
        run(["git", "init", "-q"], cwd=ledger)
        run(["git", "config", "user.email", "review-learn@local"], cwd=ledger)
        run(["git", "config", "user.name", "review-learn"], cwd=ledger)
        for name, text in {
            "index.md": "# Review patterns\n\n## Runs\n\n| date | prs | findings | repeats | new | repeat rate |\n|---|---|---|---|---|---|\n\n## Patterns\n\n| id | count | last seen | status | problem → fix |\n|---|---|---|---|---|\n",
            "guardrails.md": "",
            "pending-team-promotions.md": "# Pending team promotions\n\nProposals for tracked repo files. Apply by hand, then mark `applied:` with the commit.\n",
            "skill-impact.md": "# Skill impact\n\n| date | action | pattern | repeat rate before | note |\n|---|---|---|---|---|\n",
            "log.md": "# Maintainer log\n",
        }.items():
            p = ledger / name
            if not p.exists():
                p.write_text(text)
        (ledger / "raw" / "review-events.jsonl").touch()
        (ledger / ".gitignore").write_text("raw/.last_run\nraw/.pipeline.log\nraw/.lock\n")
        git_commit(ledger, "init ledger")
    return ledger


def git_commit(ledger, msg):
    run(["git", "add", "-A"], cwd=ledger)
    r = run(["git", "commit", "-qm", msg], cwd=ledger)
    return r.returncode == 0


def event_hash(source, key):
    return hashlib.sha1(f"{source}\x00{key}".encode()).hexdigest()[:16]


def load_events(ledger):
    p = ledger / "raw" / "review-events.jsonl"
    if not p.exists():
        return []
    out = []
    for line in p.read_text().splitlines():
        line = line.strip()
        if line:
            out.append(json.loads(line))
    return out


def append_events(ledger, events):
    """Append events whose hash is unseen. Returns list actually appended."""
    seen = {e["hash"] for e in load_events(ledger)}
    fresh = []
    with (ledger / "raw" / "review-events.jsonl").open("a") as f:
        for e in events:
            if e["hash"] in seen:
                continue
            seen.add(e["hash"])
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
            fresh.append(e)
    return fresh


def read_json(path, default):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError):
        return default


def write_json(path, data):
    Path(path).write_text(json.dumps(data, indent=1, ensure_ascii=False))


# --- pattern pages -----------------------------------------------------------

FM_RE = re.compile(r"\A---\n(.*?)\n---\n(.*)\Z", re.S)


def parse_page(text):
    m = FM_RE.match(text)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        v = v.strip()
        if v.startswith("[") and v.endswith("]"):
            v = [x.strip() for x in v[1:-1].split(",") if x.strip()]
        elif v.isdigit():
            v = int(v)
        meta[k.strip()] = v
    return meta, m.group(2)


def render_page(meta, body):
    lines = []
    for k, v in meta.items():
        if isinstance(v, list):
            v = "[" + ", ".join(str(x) for x in v) + "]"
        lines.append(f"{k}: {'' if v is None else v}")
    return "---\n" + "\n".join(lines) + "\n---\n" + body


def load_patterns(ledger):
    out = {}
    for p in sorted((ledger / "patterns").glob("rp-*.md")):
        meta, body = parse_page(p.read_text())
        out[meta.get("id", p.stem)] = (meta, body, p)
    return out


def patch_body(body, op, target, text):
    """Exact-string patch. append ignores target; replace/insert_after need target present."""
    if op == "append":
        return body.rstrip("\n") + "\n" + text.rstrip("\n") + "\n"
    if target not in body:
        raise ValueError(f"target not found for {op}: {target[:60]!r}")
    if op == "replace":
        return body.replace(target, text, 1)
    if op == "insert_after":
        return body.replace(target, target + "\n" + text, 1)
    raise ValueError(f"unknown op {op}")


# --- claude -p ---------------------------------------------------------------

def claude_json(prompt, model=None, timeout=300):
    """Run `claude -p --output-format json`; return parsed JSON object from the result or None."""
    env = {k: v for k, v in os.environ.items() if k not in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT")}
    # disableAllHooks keeps these calls out of claude-mem and other observers; verified to cut system-prompt cache from ~24K to ~9.5K tokens.
    cmd = ["claude", "-p", "--settings", '{"disableAllHooks":true}', "--output-format", "json", "--model", model or MODEL]
    try:
        r = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=timeout, env=env)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None
    if r.returncode != 0 or not r.stdout.strip():
        return None
    try:
        wrapper = json.loads(r.stdout)
    except json.JSONDecodeError:
        return None
    content = wrapper.get("result", wrapper) if isinstance(wrapper, dict) else wrapper
    if isinstance(content, dict):
        return content
    if not isinstance(content, str):
        return None
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", content, re.S) or re.search(r"(\{.*\})", content, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def try_lock(ledger):
    """Exclusive non-blocking lock on the ledger; returns the open handle (keep it alive) or None if another run holds it."""
    fh = open(ledger / "raw" / ".lock", "w")
    try:
        fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        fh.close()
        return None
    return fh
