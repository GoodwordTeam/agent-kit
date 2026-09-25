#!/usr/bin/env python3
"""Skill-routing eval: does a fresh session load the right skill for a task?

Two arms, same prompts file: `installed` (skill is in the native Skill list) and `indexed` (skill lives in a
skills-index, reachable only via the roster/INDEX.md). Prompts live in evals/prompts/{dev,holdout}.json.
Scored from the transcript's tool calls, never the reply text:
  hit        = Skill tool called with an expected name, or a read of <expected>/SKILL.md
  index_read = any read of an INDEX.md

  python3 trigger_eval.py [--set dev|holdout] [--roster] [--model sonnet] [--jobs 6] [--arm indexed|installed]
                          [--json OUT] [--quiet]
Prints a JSON object on the last line (measurement-harness contract): hit_rate, per-arm rates, counts.
"""
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
SUFFIX = (" Do not carry out the task yet. First identify and read the skill instructions you would follow for it "
          "(installed or otherwise), then reply with ONLY the skill name you loaded, or 'none'.")


def run_one(case, model, roster):
    cmd = ["claude", "-p", "--settings", '{"disableAllHooks":true}', "--output-format", "stream-json", "--verbose",
           "--max-turns", "6", "--model", model, "--dangerously-skip-permissions"]
    if roster:  # stands in for the SessionStart roster hook (hooks are off here so eval runs stay out of claude-mem)
        cmd += ["--append-system-prompt", roster]
    cmd.append(case["prompt"] + SUFFIX)
    env = {k: v for k, v in os.environ.items() if k not in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT")}
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300, env=env)
    except subprocess.TimeoutExpired:
        return {**case, "hit": False, "index_read": False, "skills": [], "reads": [], "reply": "TIMEOUT"}
    skills, reads, reply = [], [], ""
    for line in r.stdout.splitlines():
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        if d.get("type") == "assistant":
            for c in (d.get("message") or {}).get("content") or []:
                if c.get("type") != "tool_use":
                    continue
                inp = c.get("input") or {}
                if c.get("name") == "Skill":
                    skills.append(inp.get("skill", ""))
                reads += re.findall(r"([\w./~-]*(?:skills(?:-index)?)/[\w./-]*(?:SKILL|INDEX)\.md)", json.dumps(inp))
        elif d.get("type") == "result":
            reply = (d.get("result") or "").strip()
    expected = set(case["expected"])
    loaded = any(s.split(":")[-1] in expected for s in skills) or any(f"/{e}/SKILL.md" in p for p in reads for e in expected)
    # A reply that names the right skill without reading it still routed correctly (e.g. CLAUDE.md names the
    # skill outright). Counted as a hit; `loaded` stays separate so "named it" is never mistaken for "read it".
    named = any(re.fullmatch(rf"[\w:-]*{re.escape(e)}\b.*", reply.strip().strip("`*.")) for e in expected) and len(reply) < 80
    return {**case, "hit": loaded or named, "loaded": loaded, "named_only": named and not loaded,
            "index_read": any(p.endswith("INDEX.md") for p in reads),
            "skills": skills, "reads": sorted(set(reads)), "reply": reply[:140]}


def main():
    a = sys.argv[1:]
    def opt(flag, default=None):
        return a[a.index(flag) + 1] if flag in a else default
    model, jobs = opt("--model", "sonnet"), int(opt("--jobs", "6"))
    which, arm, quiet = opt("--set", "dev"), opt("--arm"), "--quiet" in a
    cases = json.loads((HERE / "prompts" / f"{which}.json").read_text())
    if arm:
        cases = [c for c in cases if c["arm"] == arm]
    roster = ""
    if "--roster" in a:
        roster = subprocess.run([sys.executable, str(SCRIPTS / "skill_index.py"), "roster"], capture_output=True, text=True).stdout
    with ThreadPoolExecutor(jobs) as ex:
        results = list(ex.map(lambda c: run_one(c, model, roster), cases))
    out = {"set": which, "model": model, "roster_tokens": len(roster) // 4, "n": len(results),
           "hits": sum(r["hit"] for r in results), "index_reads": sum(r["index_read"] for r in results),
           "loaded": sum(r["loaded"] for r in results), "named_only": sum(r["named_only"] for r in results)}
    out["hit_rate"] = round(out["hits"] / out["n"], 4) if out["n"] else 0.0
    for name in ("installed", "indexed"):
        sub = [r for r in results if r["arm"] == name]
        out[f"{name}_n"] = len(sub)
        out[f"{name}_hits"] = sum(r["hit"] for r in sub)
        out[f"{name}_rate"] = round(sum(r["hit"] for r in sub) / len(sub), 4) if sub else 0.0
    out["worst_arm_rate"] = min(out["installed_rate"], out["indexed_rate"])
    out["misses"] = [r["prompt"][:60] for r in results if not r["hit"]]
    if not quiet:
        for r in results:
            if r["hit"]:
                continue
            print(f"[MISS {r['arm'][:5]}] {r['prompt'][:72]}")
            print(f"    expected={r['expected']} skills={r['skills']} reads={[Path(p).parent.name + '/' + Path(p).name for p in r['reads']]}")
            print(f"    reply={r['reply']!r}")
    if opt("--json"):
        Path(opt("--json")).write_text(json.dumps({"summary": out, "results": results}, indent=1))
    print(json.dumps(out))


if __name__ == "__main__":
    main()
