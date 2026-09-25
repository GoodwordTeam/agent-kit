#!/usr/bin/env python3
"""Judgement eval for skill-learn discovery. Two sonnet calls. Run on demand:
    python3 evals/skill_learn_eval.py
Case A: 3 sessions asking for the same workflow in different words + 3 unrelated -> exactly one candidate, scope
project, >=3 evidence quotes. Case B: same sessions, but the WHOLE workflow (retrigger + wait + mark ready) is already an installed skill -> zero."""
import sys
import tempfile
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import skill_learn as SL  # noqa: E402
import skill_index as SI  # noqa: E402

WORKFLOW = [
    ("s1", ["ask greptile to re-review PR 1873, it's stale on an old commit", "poll gh pr checks until the new greptile score lands", "ok 5/5 now, mark ready"]),
    ("s2", ["greptile's review on #1882 is pinned to the previous sha, retrigger it with @greptileai and wait for 5/5", "good, now flip the PR out of draft"]),
    ("s3", ["re-request the greptile review on 1874 at the current head and tell me when its confidence is back to 5", "then run gh pr ready"]),
]
NOISE = [
    ("s4", ["why does the drivers page 404 in the worktree?", "check organizations.clerk_id for the bypass org"]),
    ("s5", ["write an ADR for the appointment writeback lock", "shorter, 20 lines"]),
    ("s6", ["what did we decide about the SMS allowlist last week?"]),
]


def run_case(existing_extra, tmp):
    reg = {"candidates": {}, "rejected": [], "seen_sessions": {}}
    with mock.patch.object(SL, "gather_sessions", lambda cwd, days, reg, force=False: WORKFLOW + NOISE), \
         mock.patch.object(SL, "existing_skills", lambda cwd: "- humanizer: remove AI tells\n" + existing_extra), \
         mock.patch.object(SL, "registry", lambda: reg), mock.patch.object(SL, "save_registry", lambda r: None), \
         mock.patch.object(SI, "GLOBAL_INDEX", Path(tmp) / "g"), mock.patch.object(SI, "project_root", lambda cwd=None: Path(tmp) / "repo"):
        (Path(tmp) / "repo" / ".claude" / "skills-index").mkdir(parents=True, exist_ok=True)
        out = SL.discover(str(Path(tmp) / "repo"))
    return out, reg


def main():
    ok = True
    with tempfile.TemporaryDirectory() as tmp:
        out, reg = run_case("", tmp)
        names = list(reg["candidates"])
        print("A:", out)
        info = reg["candidates"][names[0]] if names else {}
        a_ok = len(names) == 1 and info.get("evidence", 0) >= 3 and "greptile" in names[0]
        if names:
            print(f"   scope={info.get('scope')} evidence={info.get('evidence')} confidence={info.get('confidence')}")
            print((Path(info["path"]).read_text())[:500])
        print("A", "PASS" if a_ok else "FAIL", "(expect exactly one greptile candidate with >=3 evidence; scope may be project or global since the steps are plain gh)")
        ok &= a_ok
    with tempfile.TemporaryDirectory() as tmp:
        out, reg = run_case("- greptile-rereview-and-ready: re-request a stale Greptile review at the current head with @greptileai, poll gh pr checks until the score is back to 5/5, then take the PR out of draft (gh pr ready). Use when greptile is stale or before marking a PR ready.", tmp)
        print("B:", out)
        b_ok = len(reg["candidates"]) == 0
        print("B", "PASS" if b_ok else "FAIL", f"(expect zero; got {list(reg['candidates'])})")
        ok &= b_ok
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
