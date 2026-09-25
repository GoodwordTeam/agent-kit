#!/usr/bin/env python3
"""Portable installer for the review-learn / skill-index / dreamd stack.

  doctor                      check prerequisites and print the resolved environment
  bundle [--out FILE]         write a self-contained zip (skills + claude-mem mode + this installer)
  apply --from ZIP|DIR        unpack the skills to ~/.claude/skills and mirror them for Codex
  wire [--no-mem]             add the hook entries, claude-mem settings + mode, and the scheduler unit
  schedule [--load]           (re)write the scheduler unit; --load registers it with launchd/systemd/cron
  seed --repo PATH [--since D]  first review-learn pipeline + first dreamd tick for one repo
  verify [--phase wire|seed|all] [--repo PATH]
  uninstall [--keep-ledgers]  remove hooks, unit, and (optionally) the skills; never deletes ledgers

Stdlib only, Python 3.9+. Every action prints what it changed and is safe to re-run.
"""
import argparse
import json
import os
import platform
import shutil
import string
import subprocess
import sys
import time
import zipfile
from pathlib import Path

HOME = Path.home()
SKILLS_ROOT = HOME / ".claude" / "skills"  # fixed: the skills import each other through this exact path
SKILLS = ("review-learn", "skill-index", "dreamd")
CODEX_SKILLS = HOME / ".codex" / "skills"
MEM_DIR = Path(os.environ.get("CLAUDE_MEM_DATA_DIR", HOME / ".claude-mem"))
MEM_MODE = "code--review-learning"
CONTEXT_OBSERVATIONS = "25"
TICK_INTERVAL_S = 900
HERE = Path(__file__).resolve().parent
EXCLUDE = ("__pycache__", ".pyc", ".lock", ".DS_Store", "/.omc/", "/.git/", "/.context/", ".bak-")  # runtime state, experiments, apply backups


def config_dir():
    return Path(os.environ.get("CLAUDE_CONFIG_DIR") or HOME / ".claude")


def say(msg):
    print(msg, flush=True)


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


# --- hook entries -------------------------------------------------------------

def hook_commands():
    s = SKILLS_ROOT
    return {
        "session_start": [f"python3 {s}/review-learn/scripts/session_context.py",
                          f"python3 {s}/skill-index/scripts/skill_index.py roster",
                          f"python3 {s}/dreamd/scripts/session_context.py"],
        "claude_stop": f"python3 {s}/review-learn/scripts/stop_hook.py",
        "codex_stop": f"python3 {s}/review-learn/scripts/stop_hook.py --source codex",
        "codex_prompt": f"python3 {s}/review-learn/scripts/codex_prompt_hook.py",
    }


def owned_commands():
    c = hook_commands()
    return set(c["session_start"]) | {c["claude_stop"], c["codex_stop"], c["codex_prompt"]}


def has_command(entries, command):
    return any(command == h.get("command") for e in entries for h in e.get("hooks", []))


def add_hook(doc, event, command, matcher=None, timeout=10):
    """Append one hook entry unless an identical command is already registered. Returns True when it changed."""
    entries = doc.setdefault("hooks", {}).setdefault(event, [])
    if has_command(entries, command):
        return False
    entry = {"hooks": [{"type": "command", "command": command, "timeout": timeout}]}
    if matcher:
        entry["matcher"] = matcher
    entries.append(entry)
    return True


def drop_hooks(doc, commands):
    """Remove every entry whose hooks are all ours. Returns the number removed."""
    removed = 0
    for event, entries in list(doc.get("hooks", {}).items()):
        keep = []
        for e in entries:
            hooks = [h for h in e.get("hooks", []) if h.get("command") not in commands]
            if not hooks:
                removed += 1
                continue
            if len(hooks) != len(e.get("hooks", [])):
                removed += 1
            e["hooks"] = hooks
            keep.append(e)
        doc["hooks"][event] = keep
    return removed


def read_json(path, default):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError):
        return default


def write_json(path, doc):
    path = Path(path)
    if path.exists():
        shutil.copy2(path, path.with_suffix(path.suffix + ".bak"))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, indent=2) + "\n")


# --- doctor -------------------------------------------------------------------

def which(name):
    return shutil.which(name)


def mem_worker_script():
    """Newest claude-mem worker-service.cjs under a plugin cache. The marketplace copy does not run."""
    cands = sorted(config_dir().glob("plugins/cache/*/claude-mem/*/scripts/worker-service.cjs")) + \
        sorted((HOME / ".claude").glob("plugins/cache/*/claude-mem/*/scripts/worker-service.cjs"))
    return cands[-1] if cands else None


def doctor():
    cfg = config_dir()
    rows, hard_missing = [], []
    checks = [
        ("claude CLI", bool(which("claude")), True, "every model call runs through `claude -p`"),
        ("git", bool(which("git")), True, "ledgers are git repos"),
        (f"python {sys.version_info.major}.{sys.version_info.minor} >= 3.9", sys.version_info >= (3, 9), True, "syntax floor of the skills"),
        ("claude-mem db", (MEM_DIR / "claude-mem.db").exists(), True, "the only source of observations"),
        ("claude-mem worker script", mem_worker_script() is not None, False, "needed to restart after a settings change"),
        ("gh authenticated", bool(which("gh")) and run(["gh", "auth", "status"]).returncode == 0, False, "PR review threads"),
        ("claude-reflect plugin", bool(list(cfg.glob("plugins/cache/*/claude-reflect/*"))), False, "user-correction events"),
        ("node or bun", bool(which("node") or which("bun")), False, "worker restart"),
    ]
    for name, ok, hard, why in checks:
        rows.append((name, "OK" if ok else ("MISSING" if hard else "absent"), "hard" if hard else "soft", why))
        if hard and not ok:
            hard_missing.append(name)
    width = max(len(r[0]) for r in rows)
    say("")
    for name, state, kind, why in rows:
        say(f"  {name.ljust(width)}  {state:<8} {kind:<5} {why}")
    say("")
    say("Resolved environment")
    say(f"  CLAUDE_CONFIG_DIR   {cfg}" + ("" if os.environ.get("CLAUDE_CONFIG_DIR") else "   (default, not exported)"))
    say(f"  skills root         {SKILLS_ROOT}   (fixed: the skills import each other through this path)")
    say(f"  python for the unit {sys.executable}")
    say(f"  claude-mem dir      {MEM_DIR}")
    say(f"  scheduler           {scheduler_kind()}")
    say(f"  installed skills    {', '.join(s for s in SKILLS if (SKILLS_ROOT / s / 'SKILL.md').exists()) or 'none'}")
    if hard_missing:
        say(f"\nBLOCKED: {', '.join(hard_missing)}")
        return 1
    say("\nAll hard requirements present.")
    return 0


# --- bundle / apply -----------------------------------------------------------

def skip(path):
    return any(x in str(path) for x in EXCLUDE)


def bundle(out):
    out = Path(out).expanduser()
    missing = [s for s in SKILLS if not (SKILLS_ROOT / s / "SKILL.md").exists()]
    if missing:
        say(f"cannot bundle, not installed here: {', '.join(missing)}")
        return 1
    n = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for s in SKILLS:
            for p in sorted((SKILLS_ROOT / s).rglob("*")):
                if p.is_file() and not skip(p):
                    z.write(p, f"skills/{p.relative_to(SKILLS_ROOT)}")
                    n += 1
        for p in sorted((HERE.parent).rglob("*")):  # ship this installer too, so the zip is self-contained
            if p.is_file() and not skip(p):
                z.write(p, f"skills/stack-setup/{p.relative_to(HERE.parent)}")
                n += 1
        mode = MEM_DIR / "modes" / f"{MEM_MODE}.json"
        if mode.exists():
            z.write(mode, f"claude-mem/modes/{MEM_MODE}.json")
            n += 1
        z.writestr("INSTALL.txt", INSTALL_TXT)
    say(f"wrote {out} ({n} files, {out.stat().st_size // 1024} KB)")
    say(f"on the target machine:  unzip {out.name} -d stack && python3 stack/skills/stack-setup/scripts/install.py apply --from stack")
    return 0


INSTALL_TXT = """This zip installs the review-learn / skill-index / dreamd stack.

  unzip <this file> -d stack
  python3 stack/skills/stack-setup/scripts/install.py doctor
  python3 stack/skills/stack-setup/scripts/install.py apply --from stack
  python3 ~/.claude/skills/stack-setup/scripts/install.py wire
  python3 ~/.claude/skills/stack-setup/scripts/install.py schedule --load
  python3 ~/.claude/skills/stack-setup/scripts/install.py seed --repo /path/to/repo
  python3 ~/.claude/skills/stack-setup/scripts/install.py verify

The skills must live at ~/.claude/skills/<name>; they import each other through that path.
Full guide for a fresh machine, a shared skills repo, and the quirks: skills/stack-setup/references/INTEGRATION-GUIDE.md
Ledgers are written under $CLAUDE_CONFIG_DIR/projects/<repo-folder>/ and never inside a repo.
"""


def apply(src):
    src = Path(src).expanduser()
    staged = src
    if src.is_file():
        staged = src.parent / (src.stem + "-unpacked")
        with zipfile.ZipFile(src) as z:
            z.extractall(staged)
    root = staged / "skills" if (staged / "skills").is_dir() else staged
    SKILLS_ROOT.mkdir(parents=True, exist_ok=True)
    for s in list(SKILLS) + ["stack-setup"]:
        srcdir = root / s
        if not (srcdir / "SKILL.md").exists():
            if s != "stack-setup":
                say(f"missing in bundle: {s}")
                return 1
            continue
        dest = SKILLS_ROOT / s
        if dest.exists() and dest.resolve() == srcdir.resolve():
            say(f"{s}: already in place")
        else:
            if dest.exists():  # never destroy an existing install without a copy of it
                backup = dest.with_name(f"{s}.bak-{int(time.time())}")
                shutil.move(str(dest), str(backup))
                say(f"{s}: previous install moved to {backup}")
            shutil.copytree(srcdir, dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".lock"))
            say(f"{s}: installed to {dest}")
        link = CODEX_SKILLS / s
        if CODEX_SKILLS.is_dir() and not link.exists():
            link.symlink_to(dest)
            say(f"{s}: mirrored for Codex at {link}")
    mode_src = staged / "claude-mem" / "modes" / f"{MEM_MODE}.json"
    if mode_src.exists():
        (MEM_DIR / "modes").mkdir(parents=True, exist_ok=True)
        dest = MEM_DIR / "modes" / f"{MEM_MODE}.json"
        if not dest.exists():
            shutil.copy2(mode_src, dest)
            say(f"claude-mem mode installed: {dest}")
    return 0


# --- wire ---------------------------------------------------------------------

def wire(skip_mem=False):
    c = hook_commands()
    cfg = config_dir()
    settings = cfg / "settings.json"
    doc = read_json(settings, {})
    changed = 0
    for cmd in c["session_start"]:
        changed += add_hook(doc, "SessionStart", cmd, matcher="startup|resume|clear|compact")
    changed += add_hook(doc, "Stop", c["claude_stop"], timeout=120)
    if changed:
        write_json(settings, doc)
    say(f"{settings}: {changed} hook entries added" if changed else f"{settings}: already wired")

    codex = HOME / ".codex" / "hooks.json"
    if codex.parent.is_dir():
        doc = read_json(codex, {})
        ch = 0
        for cmd in c["session_start"]:
            ch += add_hook(doc, "SessionStart", cmd)
        ch += add_hook(doc, "UserPromptSubmit", c["codex_prompt"])
        ch += add_hook(doc, "Stop", c["codex_stop"], timeout=30)
        if ch:
            write_json(codex, doc)
        say(f"{codex}: {ch} hook entries added" if ch else f"{codex}: already wired")
    else:
        say("~/.codex not present, skipping Codex hooks")

    if not skip_mem:
        mem_settings = MEM_DIR / "settings.json"
        doc = read_json(mem_settings, {})
        before = dict(doc)
        doc["CLAUDE_MEM_CONTEXT_OBSERVATIONS"] = CONTEXT_OBSERVATIONS
        doc.setdefault("CLAUDE_MEM_MODE", MEM_MODE)
        if doc != before:
            write_json(mem_settings, doc)
            say(f"{mem_settings}: CLAUDE_MEM_CONTEXT_OBSERVATIONS={CONTEXT_OBSERVATIONS}, mode={doc['CLAUDE_MEM_MODE']}")
            restart_worker()
        else:
            say(f"{mem_settings}: already set")
    return write_unit()


def restart_worker():
    script = mem_worker_script()
    runner = which("bun") or which("node")
    if not script or not runner:
        say("restart the claude-mem worker by hand so the new settings take effect")
        return
    r = run([runner, str(script), "restart"])
    say("claude-mem worker: " + (r.stdout.strip().splitlines()[-1] if r.returncode == 0 and r.stdout.strip()
                                 else f"restart failed, do it by hand: {runner} {script} restart"))


# --- scheduler ----------------------------------------------------------------

def scheduler_kind():
    if platform.system() == "Darwin":
        return "launchd"
    if which("systemctl"):
        return "systemd"
    return "cron" if which("crontab") else "none"


def unit_paths():
    user = os.environ.get("USER") or HOME.name
    if scheduler_kind() == "launchd":
        label = f"com.{user}.dreamd"
        return label, HOME / "Library" / "LaunchAgents" / f"{label}.plist"
    return "dreamd-tick", HOME / ".config" / "systemd" / "user" / "dreamd-tick.service"


def render(name, **kw):
    return string.Template((HERE / "templates" / name).read_text()).substitute(**kw)


def unit_text():
    label, _ = unit_paths()
    log = config_dir() / "dreamd" / "tick.log"
    tick = SKILLS_ROOT / "dreamd" / "scripts" / "tick.py"
    path = os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin")
    common = dict(python=sys.executable, tick=str(tick), config_dir=str(config_dir()), log=str(log), path=path)
    if scheduler_kind() == "launchd":
        return render("launchd.plist.tmpl", label=label, interval=TICK_INTERVAL_S, **common)
    return render("systemd.service.tmpl", **common)


def write_unit():
    kind = scheduler_kind()
    if kind == "none":
        say("no supported scheduler (launchd, systemd, cron); run tick.py from your own scheduler")
        return 0
    label, path = unit_paths()
    (config_dir() / "dreamd").mkdir(parents=True, exist_ok=True)
    if kind == "cron":
        say(f"add this crontab line:  */15 * * * * CLAUDE_CONFIG_DIR={config_dir()} {sys.executable} "
            f"{SKILLS_ROOT}/dreamd/scripts/tick.py >> {config_dir()}/dreamd/tick.log 2>&1")
        return 0
    text = unit_text()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text() == text:
        say(f"{path}: unchanged")
    else:
        path.write_text(text)
        say(f"{path}: written")
    if kind == "systemd":
        timer = path.with_suffix(".timer")
        ttext = render("systemd.timer.tmpl", minutes=TICK_INTERVAL_S // 60, unit=path.name)
        if not (timer.exists() and timer.read_text() == ttext):
            timer.write_text(ttext)
            say(f"{timer}: written")
    return 0


def schedule(load=False):
    rc = write_unit()
    if not load or rc:
        return rc
    kind = scheduler_kind()
    label, path = unit_paths()
    if kind == "launchd":
        uid = os.getuid()
        run(["launchctl", "bootout", f"gui/{uid}/{label}"])
        r = run(["launchctl", "bootstrap", f"gui/{uid}", str(path)])
        say(f"launchd: {'loaded' if r.returncode == 0 else 'bootstrap failed: ' + r.stderr.strip()}")
        say(f"status:  launchctl print gui/{uid}/{label} | grep -E 'state|last exit'")
    elif kind == "systemd":
        run(["systemctl", "--user", "daemon-reload"])
        r = run(["systemctl", "--user", "enable", "--now", path.with_suffix(".timer").name])
        say(f"systemd: {'timer enabled' if r.returncode == 0 else 'enable failed: ' + r.stderr.strip()}")
        say(f"status:  systemctl --user list-timers {path.with_suffix('.timer').name}")
    return 0


# --- seed ---------------------------------------------------------------------

def seed(repo, since=None, prs=()):
    repo = str(Path(repo).expanduser().resolve())
    py = sys.executable
    steps = [[py, f"{SKILLS_ROOT}/review-learn/scripts/ingest.py"] + (["--since", since] if since else [])
             + [a for pr in prs for a in ("--pr", str(pr))],
             [py, f"{SKILLS_ROOT}/review-learn/scripts/maintain.py"],
             [py, f"{SKILLS_ROOT}/review-learn/scripts/propose.py"],
             [py, f"{SKILLS_ROOT}/dreamd/scripts/tick.py", "--project", repo, "--job", "all", "--force"]]
    for cmd in steps:
        say(f"\n$ {' '.join(Path(c).name if c.endswith('.py') else c for c in cmd)}")
        r = run(cmd, cwd=repo, timeout=1800)
        out = (r.stdout or "").strip().splitlines()
        for line in out[-8:]:
            say("  " + line)
        if r.returncode != 0:
            say(f"  FAILED rc={r.returncode} {(r.stderr or '').strip()[:400]}")
            return 1
    say("\nread the memory before trusting it:")
    say(f"  cat {dream_dir(repo)}/memory.md {dream_dir(repo)}/lessons.md")
    return 0


def ledger_folder(repo):
    import re
    return re.sub(r"[^A-Za-z0-9-]", "-", str(Path(repo).resolve()))


def dream_dir(repo):
    return config_dir() / "projects" / ledger_folder(repo) / "dream"


def rp_dir(repo):
    return config_dir() / "projects" / ledger_folder(repo) / "review-patterns"


# --- verify -------------------------------------------------------------------

def check(label, ok, detail=""):
    say(f"  {'PASS' if ok else 'FAIL'}  {label}" + (f"  {detail}" if detail else ""))
    return bool(ok)


def verify_wire():
    say("\nPhase: wire")
    c = hook_commands()
    ok = True
    doc = read_json(config_dir() / "settings.json", {})
    entries = doc.get("hooks", {}).get("SessionStart", [])
    for cmd in c["session_start"]:
        n = sum(1 for e in entries for h in e.get("hooks", []) if h.get("command") == cmd)
        ok &= check(f"claude SessionStart {Path(cmd.split()[1]).parent.parent.name}", n == 1, f"{n} entries")
    n = sum(1 for e in doc.get("hooks", {}).get("Stop", []) for h in e.get("hooks", []) if h.get("command") == c["claude_stop"])
    ok &= check("claude Stop review-learn", n == 1, f"{n} entries")
    if (HOME / ".codex" / "hooks.json").exists():
        cdoc = read_json(HOME / ".codex" / "hooks.json", {})
        cn = sum(1 for e in cdoc.get("hooks", {}).get("SessionStart", []) for h in e.get("hooks", [])
                 if h.get("command") in set(c["session_start"]))
        ok &= check("codex SessionStart entries", cn == 3, f"{cn}/3")
    mem = read_json(MEM_DIR / "settings.json", {})
    ok &= check("claude-mem observations budget", mem.get("CLAUDE_MEM_CONTEXT_OBSERVATIONS") == CONTEXT_OBSERVATIONS,
                str(mem.get("CLAUDE_MEM_CONTEXT_OBSERVATIONS")))
    ok &= check("claude-mem mode file", (MEM_DIR / "modes" / f"{MEM_MODE}.json").exists())
    kind = scheduler_kind()
    _, path = unit_paths()
    if kind in ("launchd", "systemd"):
        ok &= check(f"{kind} unit written", path.exists(), str(path))
        if kind == "launchd":
            loaded = run(["launchctl", "list"]).stdout
            ok &= check("launchd job loaded", unit_paths()[0] in loaded)
    return ok


def verify_seed(repo):
    say(f"\nPhase: seed ({repo})")
    ok = True
    d, rp = dream_dir(repo), rp_dir(repo)
    ok &= check("review-patterns ledger", (rp / "index.md").exists(), str(rp))
    ok &= check("dream ledger", (d / "memory.md").exists(), str(d))
    if (d / ".git").exists():
        n = run(["git", "-C", str(d), "rev-list", "--count", "HEAD"]).stdout.strip()
        ok &= check("dream ledger has commits", n.isdigit() and int(n) > 0, f"{n} commits")
    runs = [json.loads(l) for l in (d / "runs.jsonl").read_text().splitlines() if l.strip()] if (d / "runs.jsonl").exists() else []
    ok &= check("episodes run recorded", any(r["job"] == "episodes" for r in runs))
    ok &= check("reflect attempted", any(r["job"] == "reflect" for r in runs),
                next((r["status"] for r in runs if r["job"] == "reflect"), "none"))
    state = read_json(d / ".state.json", {})
    ok &= check("watermark set", bool(state.get("last_obs_id_reflected")), str(state.get("last_obs_id_reflected")))
    block = run([sys.executable, f"{SKILLS_ROOT}/dreamd/scripts/session_context.py"], cwd=repo).stdout
    cap = int(os.environ.get("DREAMD_MEMORY_TOKENS", "2500"))
    ok &= check("injected block within cap", len(block) // 4 <= cap + 60, f"{len(block) // 4} tokens, cap {cap}")
    return ok


def verify_tests():
    say("\nPhase: tests")
    ok = True
    for s in SKILLS:
        t = SKILLS_ROOT / s / "tests"
        if not t.is_dir():
            continue
        r = run([sys.executable, "-m", "unittest", "discover", str(t)])
        tail = (r.stderr or "").strip().splitlines()[-1] if r.stderr else ""
        ok &= check(f"{s} tests", r.returncode == 0, tail)
    return ok


def verify(phase="all", repo=None):
    ok = True
    if phase in ("all", "wire"):
        ok &= verify_wire()
    if phase in ("all", "tests"):
        ok &= verify_tests()
    if repo and phase in ("all", "seed"):
        ok &= verify_seed(repo)
    elif phase == "seed":
        say("  --repo is required for the seed phase")
        ok = False
    say("\n" + ("all checks passed" if ok else "FAILURES above"))
    return 0 if ok else 1


# --- uninstall ----------------------------------------------------------------

def uninstall(remove_skills=False):
    cmds = owned_commands()
    for path in (config_dir() / "settings.json", HOME / ".codex" / "hooks.json"):
        if not path.exists():
            continue
        doc = read_json(path, {})
        n = drop_hooks(doc, cmds)
        if n:
            write_json(path, doc)
        say(f"{path}: {n} hook entries removed")
    kind = scheduler_kind()
    label, unit = unit_paths()
    if kind == "launchd" and unit.exists():
        run(["launchctl", "bootout", f"gui/{os.getuid()}/{label}"])
        unit.unlink()
        say(f"{unit}: unloaded and removed")
    elif kind == "systemd" and unit.exists():
        run(["systemctl", "--user", "disable", "--now", unit.with_suffix(".timer").name])
        unit.unlink(missing_ok=True)
        unit.with_suffix(".timer").unlink(missing_ok=True)
        say(f"{unit}: disabled and removed")
    mem_settings = MEM_DIR / "settings.json"
    doc = read_json(mem_settings, None)
    if doc and doc.pop("CLAUDE_MEM_CONTEXT_OBSERVATIONS", None):
        write_json(mem_settings, doc)
        say(f"{mem_settings}: observation budget restored to the claude-mem default")
    if remove_skills:
        for s in SKILLS:
            shutil.rmtree(SKILLS_ROOT / s, ignore_errors=True)
            (CODEX_SKILLS / s).unlink(missing_ok=True)
        say(f"removed skills: {', '.join(SKILLS)}")
    say("ledgers under $CLAUDE_CONFIG_DIR/projects/*/ were left untouched (they are your data)")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog="install.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("doctor")
    b = sub.add_parser("bundle"); b.add_argument("--out", default=str(HOME / "claude-learning-stack.zip"))
    a = sub.add_parser("apply"); a.add_argument("--from", dest="src", required=True)
    w = sub.add_parser("wire"); w.add_argument("--no-mem", action="store_true")
    s = sub.add_parser("schedule"); s.add_argument("--load", action="store_true")
    sd = sub.add_parser("seed"); sd.add_argument("--repo", required=True); sd.add_argument("--since"); sd.add_argument("--pr", type=int, action="append", default=[])
    v = sub.add_parser("verify"); v.add_argument("--phase", default="all", choices=["all", "wire", "seed", "tests"]); v.add_argument("--repo")
    u = sub.add_parser("uninstall"); u.add_argument("--remove-skills", action="store_true")
    args = ap.parse_args(argv)
    if args.cmd == "doctor":
        return doctor()
    if args.cmd == "bundle":
        return bundle(args.out)
    if args.cmd == "apply":
        return apply(args.src)
    if args.cmd == "wire":
        return wire(args.no_mem)
    if args.cmd == "schedule":
        return schedule(args.load)
    if args.cmd == "seed":
        return seed(args.repo, args.since, args.pr)
    if args.cmd == "verify":
        return verify(args.phase, args.repo)
    if args.cmd == "uninstall":
        return uninstall(args.remove_skills)
    return 1


if __name__ == "__main__":
    sys.exit(main())
