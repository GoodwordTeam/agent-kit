#!/usr/bin/env python3
"""dreamd scheduler. `tick [--project ROOT] [--job reflect|nightly|weekly|all] [--force]`.
Global lock; registers projects from claude-mem; per project runs episodes -> reflect -> nightly -> weekly when due.
Failures are logged, never raised. DREAMD_DRY_RUN=1 prints decisions and prompts and writes nothing.
"""
import sys
import tempfile
import traceback
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import dcommon as D  # noqa: E402
from dcommon import C  # noqa: E402
import episodes as E  # noqa: E402
import reflect as R  # noqa: E402
import consolidate as K  # noqa: E402
import deep as W  # noqa: E402

ACTIVE_DAYS = 7
REFLECT_MAX_GAP_MS = 6 * 3600 * 1000
NIGHTLY_BACKLOG = 25
WEEK_MS = 7 * 86400 * 1000


def decide(st, now, idle_s, new_tokens, new_obs, unconsolidated, force_job=None):
    """Pure: which of reflect/nightly/weekly are due. `now` is a local datetime."""
    if force_job:
        return ["reflect", "nightly", "weekly"] if force_job == "all" else [force_job]
    if st.get("muted"):
        return []
    due = []
    idle = idle_s >= D.IDLE_S
    now_ms = int(now.timestamp() * 1000)
    last_reflect = st.get("last_reflect", 0)
    if (idle and new_tokens >= D.REFLECT_TOKENS) or (new_obs > 0 and now_ms - last_reflect >= REFLECT_MAX_GAP_MS):
        due.append("reflect")
    today = now.strftime("%Y-%m-%d")
    if (now.hour >= D.NIGHTLY_HOUR and str(st.get("last_nightly") or "") < today and unconsolidated >= 1) \
            or (unconsolidated >= NIGHTLY_BACKLOG and idle):
        due.append("nightly")
    if idle and now_ms - st.get("last_weekly", 0) >= WEEK_MS:
        due.append("weekly")
    return due


def run_project(con, root, mem_project, job=None, force=False):
    dream = D.dream_dir(root)
    if D.DRY_RUN and not (dream / ".git").exists():
        dream = D.ensure_dream(Path(tempfile.mkdtemp(prefix="dreamd-dry-")))  # dry run writes nothing under CONFIG_DIR
    else:
        D.ensure_dream(dream)
    ledger = D.rp_ledger(root)
    ledger_events = C.load_events(ledger) if (ledger / "raw").exists() else []
    out = []
    try:
        new_eps = E.build(con, dream, mem_project, ledger_events)
        out.append(f"episodes +{len(new_eps)}")
        if new_eps and not D.DRY_RUN:
            D.append_run(dream, {"job": "episodes", "status": "ok", "new": [e["sid"] for e in new_eps]})
            C.git_commit(dream, f"episodes +{len(new_eps)}")
    except Exception as ex:
        out.append(f"episodes failed: {ex}")
        D.log(dream, f"episodes failed: {ex}")
    st = D.state(dream)
    last_activity = D.last_activity_ms(con, mem_project)
    if not last_activity:
        return out + [f"no claude-mem observations under project '{mem_project}' - check the folder basename matches"]
    idle_s = (D.now_ms() - last_activity) / 1000
    new_tokens, new_obs = D.new_tokens_since(con, mem_project, st.get("last_obs_id_reflected", 0))
    unconsolidated = sum(1 for e in D.read_jsonl(dream / "episodes.jsonl") if not e.get("consolidated_run"))
    due = decide(st, datetime.now(), idle_s, new_tokens, new_obs, unconsolidated, (job or "all") if force else None)
    if job and not force:
        due = [j for j in due if job in ("all", j)]
    out.append(f"idle {int(idle_s)}s new_tokens {new_tokens} new_obs {new_obs} unconsolidated {unconsolidated} due {due or 'none'}")
    runners = {"reflect": lambda: R.reflect(con, dream, mem_project, trigger="force" if force else "tick"),
               "nightly": lambda: K.consolidate(con, dream, mem_project, root, trigger="force" if force else "tick"),
               "weekly": lambda: W.deep(dream, root, trigger="force" if force else "tick")}
    for j in ("reflect", "nightly", "weekly"):
        if j not in due:
            continue
        try:
            out.append(runners[j]())
        except Exception as ex:
            out.append(f"{j} failed: {ex}")
            D.log(dream, f"{j} failed: {ex}\n```\n{traceback.format_exc()[-1500:]}\n```")
    return out


def main(argv):
    args = argv[1:]
    project = args[args.index("--project") + 1] if "--project" in args else None
    job = args[args.index("--job") + 1] if "--job" in args else None
    force = "--force" in args
    lock = D.try_lock(D.DREAMD_DIR / ".lock")
    if lock is None:
        print("tick: another run holds the lock")
        return 0
    con = D.mem()
    if con is None:
        print("tick: claude-mem db not found")
        return 0
    print(f"\n== {C.now_iso()} tick CLAUDE_CONFIG_DIR={D.CONFIG_DIR}" + (" DRY RUN" if D.DRY_RUN else ""), flush=True)
    if project:
        root = C.main_repo_root(project)
        if root is None:
            print(f"tick: {project} is not inside a git repo")
            return 0
        project = str(root)
        D.register_root(root)
    reg = D.discover_projects(con)
    cutoff = D.now_ms() - ACTIVE_DAYS * 86400 * 1000
    for folder, info in reg.items():
        if project and info["root"] != project:
            continue
        if not project and D.last_activity_ms(con, info["mem_project"]) < cutoff:
            continue
        for line in run_project(con, Path(info["root"]), info["mem_project"], job, force):
            print(f"{info['mem_project']}: {line}", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except Exception as ex:
        print(f"tick failed: {ex}\n{traceback.format_exc()}", file=sys.stderr)
        sys.exit(0)
