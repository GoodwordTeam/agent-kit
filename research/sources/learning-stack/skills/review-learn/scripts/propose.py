#!/usr/bin/env python3
"""Skill Proposer: active patterns with count >= PROMOTE_AT -> guardrails.md (deployed);
patterns with a team_target -> pending-team-promotions.md (proposed, never applied).
Also: retire <id>, rollback, promote (print pending)."""
import argparse
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import common as C  # noqa: E402
from maintain import rebuild_index, section  # noqa: E402


def last_rate(ledger):
    rows = [ln for ln in (ledger / "index.md").read_text().splitlines() if ln.startswith("| 20")]
    return rows[-1].split("|")[-2].strip() if rows else "n/a"


def bullet(pid, meta, body):
    fix = section(body, "Fix").split("\n")[0].strip() or meta.get("title", "")
    return f"- [{pid}] {fix}"


def propose(cwd, threshold=None):
    ledger = C.ledger_dir(cwd)
    if ledger is None or not (ledger / "index.md").exists():
        return "no ledger"
    threshold = threshold or C.PROMOTE_AT
    lock = C.try_lock(ledger)
    if lock is None:
        return "another run holds the ledger lock"
    patterns = C.load_patterns(ledger)
    guard = (ledger / "guardrails.md").read_text()
    pending = (ledger / "pending-team-promotions.md").read_text()
    rate = last_rate(ledger)
    promoted, proposed = [], []
    for pid, (meta, body, path) in patterns.items():
        if meta.get("status") != "active" or int(meta.get("count") or 0) < threshold or meta.get("promoted_to"):
            continue
        guard = guard.rstrip("\n") + ("\n" if guard.strip() else "") + bullet(pid, meta, body) + "\n"
        meta["promoted_to"] = "guardrails"
        meta["promoted_count"] = int(meta.get("count") or 0)
        promoted.append(pid)
        (ledger / "skill-impact.md").open("a").write(f"| {C.today()} | promote | {pid} | {rate} | {meta.get('title', '')} |\n")
        if meta.get("team_target") and f"## {pid}" not in pending:
            pending += (f"\n## {pid} → `{meta['team_target']}`\n\ncount: {meta.get('count')} · prs: {', '.join(meta.get('prs') or [])}\n\n"
                        f"Proposed line:\n\n{bullet(pid, meta, body)}\n\nWhy: {section(body, 'Problem').split(chr(10))[0]}\n\napplied: \n")
            proposed.append(pid)
        path.write_text(C.render_page(meta, body))
    skilled = emit_skill_candidates(ledger, patterns)
    if not promoted and not skilled:
        if C.run(["git", "status", "--porcelain"], cwd=ledger).stdout.strip():
            C.git_commit(ledger, "propose: bookkeeping (promoted_count baseline)")
        return "nothing to promote"
    (ledger / "guardrails.md").write_text(guard)
    (ledger / "pending-team-promotions.md").write_text(pending)
    rebuild_index(ledger, patterns)
    C.git_commit(ledger, f"propose: guardrails +{','.join(promoted)}" + (f"; team proposals {','.join(proposed)}" if proposed else "") + (f"; skill candidates {','.join(skilled)}" if skilled else ""))
    return f"promoted {','.join(promoted)} to guardrails" + (f"; team proposals {','.join(proposed)}" if proposed else "") + (f"; skill candidates {','.join(skilled)}" if skilled else "")


def skill_candidates_dir(ledger):
    """<repo>/.claude/skills-index/candidates for the repo this ledger belongs to, or None."""
    sys.path.insert(0, str(Path.home() / ".claude/skills/skill-index/scripts"))
    try:
        import skill_index  # type: ignore
    except ImportError:
        return None
    root = skill_index.project_root(str(C.main_repo_root(os.getcwd()) or "."))
    return (root / ".claude" / "skills-index" / "candidates") if root else None


def emit_skill_candidates(ledger, patterns):
    """Guardrail was not enough (>=2 new events since promotion) or the fix is a multi-step procedure -> skill candidate.
    Written uninstalled under the project skills-index; skill-learn promotes it after real use."""
    out_dir = skill_candidates_dir(ledger)
    if out_dir is None:
        return []
    made = []
    for pid, (meta, body, path) in patterns.items():
        if meta.get("status") != "active" or meta.get("promoted_to") != "guardrails" or meta.get("skill_candidate"):
            continue
        if not meta.get("promoted_count"):  # promoted before this field existed: today's count is the baseline
            meta["promoted_count"] = int(meta.get("count") or 0)
            path.write_text(C.render_page(meta, body))
            continue
        fix_lines = [ln for ln in section(body, "Fix").splitlines() if ln.strip()]
        since = int(meta.get("count") or 0) - int(meta.get("promoted_count") or 0)
        if len(fix_lines) < 2 and since < 2:
            continue
        slug = re.sub(r"[^a-z0-9]+", "-", str(meta.get("title", "")).lower()).strip("-")[:40]
        name = f"{pid}-{slug}"
        d = out_dir / name
        d.mkdir(parents=True, exist_ok=True)
        reason = "guardrail bullet did not stop recurrence" if since >= 2 else "fix is a multi-step procedure"
        (d / "SKILL.md").write_text(
            f"---\nname: {name}\ndescription: {meta.get('title')}. Use before writing or reviewing code in this repo where this could apply: {section(body, 'Problem').splitlines()[0][:220]}\n---\n\n"
            f"# {meta.get('title')}\n\nAuto-proposed by review-learn from pattern {pid} ({reason}; {meta.get('count')} events across PRs {', '.join(meta.get('prs') or [])}). Unreviewed.\n\n"
            f"## Problem\n{section(body, 'Problem')}\n\n## Root cause\n{section(body, 'Root cause')}\n\n## Procedure\n{section(body, 'Fix')}\n\n## Evidence\n{section(body, 'Evidence')}\n")
        meta["skill_candidate"] = name
        path.write_text(C.render_page(meta, body))
        (ledger / "skill-impact.md").open("a").write(f"| {C.today()} | skill-candidate | {pid} | {last_rate(ledger)} | {name} ({reason}) |\n")
        made.append(name)
    return made


def retire(cwd, pid):
    ledger = C.ledger_dir(cwd)
    patterns = C.load_patterns(ledger)
    if pid not in patterns:
        return f"unknown pattern {pid}"
    meta, body, path = patterns[pid]
    meta["status"] = "retired"
    meta["promoted_to"] = ""
    path.write_text(C.render_page(meta, body))
    g = ledger / "guardrails.md"
    g.write_text(re.sub(rf"^- \[{re.escape(pid)}\].*\n?", "", g.read_text(), flags=re.M))
    (ledger / "skill-impact.md").open("a").write(f"| {C.today()} | retire | {pid} | {last_rate(ledger)} | bullet removed, page kept |\n")
    rebuild_index(ledger, patterns)
    C.git_commit(ledger, f"retire: {pid}")
    return f"retired {pid}; guardrail bullet removed, pattern page kept"


def rollback(cwd):
    ledger = C.ledger_dir(cwd)
    head = C.run(["git", "log", "-1", "--format=%s"], cwd=ledger).stdout.strip()
    r = C.run(["git", "revert", "--no-edit", "HEAD"], cwd=ledger)
    return f"reverted '{head}'" if r.returncode == 0 else f"revert failed: {r.stderr.strip()}"


def show_pending(cwd):
    ledger = C.ledger_dir(cwd)
    return (ledger / "pending-team-promotions.md").read_text() if ledger else "no ledger"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("action", nargs="?", default="propose", choices=["propose", "retire", "rollback", "promote"])
    ap.add_argument("pattern_id", nargs="?")
    ap.add_argument("--threshold", type=int)
    ap.add_argument("--cwd", default=os.getcwd())
    a = ap.parse_args()
    if a.action == "propose":
        print("review-learn propose:", propose(a.cwd, a.threshold))
    elif a.action == "retire":
        print(retire(a.cwd, a.pattern_id))
    elif a.action == "rollback":
        print(rollback(a.cwd))
    else:
        print(show_pending(a.cwd))
