#!/usr/bin/env python3
"""Judgement eval (1 model call): Reflector over the last N real observations of the cwd repo into a scratch ledger.
Asserts: output <= cap, every bullet passes the provenance gate before the gate runs, every fixed section present. Prints the memory."""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import dcommon as D  # noqa: E402
from dcommon import C  # noqa: E402
import reflect as R  # noqa: E402

N = int(sys.argv[1]) if len(sys.argv) > 1 else 40


def main():
    root = C.main_repo_root(os.getcwd())
    if root is None:
        sys.exit("run from inside a git repo")
    con = D.mem()
    mem_project = root.name
    rows = con.execute(f"select id from observations where {D.project_where()} order by id desc limit ?", (*D.project_args(mem_project), N)).fetchall()
    wm = min(r["id"] for r in rows) - 1
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["DREAMD_LEDGER"] = tmp
        dream = D.ensure_dream(Path(tmp))
        D.save_state(dream, {"last_obs_id_reflected": wm})
        obs_rows = R.fetch_new(con, mem_project, wm)
        sids = sorted({r["memory_session_id"] for r in obs_rows})
        prompt = R.build_prompt("", obs_rows, R.fetch_summaries(con, mem_project, sids))
        print(f"input: {len(obs_rows)} observations, {len(sids)} sessions, {D.tokens(prompt)} prompt tokens; model {D.MODEL}")
        resp = C.claude_json(prompt, model=D.MODEL, timeout=600)
        text = resp.get("memory") if isinstance(resp, dict) else None
        if not text:
            sys.exit("FAIL: no model output")
        valid = {f"obs:{r['id']}" for r in obs_rows} | {D.sid8(s) for s in sids}
        bullets = [ln for ln in text.splitlines() if ln.lstrip().startswith("- ")]
        _, dropped = D.provenance_gate(text.splitlines(), valid)
        missing = [s for s in D.SECTIONS if s not in text]
        checks = {"tokens <= cap": D.tokens(text) <= D.MEMORY_TOKENS, "all sections present": not missing,
                  "no bullet fails provenance": dropped == 0, "degenerate guard passes": R.degenerate(text, "", D.tokens(prompt)) is None}
        print(f"tokens {D.tokens(text)}/{D.MEMORY_TOKENS} · bullets {len(bullets)} · dropped by provenance {dropped} · missing {missing}")
        print("\n" + text + "\n")
        for k, v in checks.items():
            print(("PASS " if v else "FAIL ") + k)
        sys.exit(0 if all(checks.values()) else 1)


if __name__ == "__main__":
    main()
