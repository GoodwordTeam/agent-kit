#!/usr/bin/env python3
"""Two-level skill index. Skills live uninstalled under <root>/skills-index/ and are reached through INDEX.md.

Levels: global = ~/.claude/skills-index ; project = <git main root>/.claude/skills-index (if the repo has one).
  build            regenerate INDEX.md at both levels and refresh the installed skill-index description count
  move NAME...     move ~/.claude/skills/NAME -> global index (or project .claude/skills/NAME -> project index)
  restore NAME...  move back to the installed roster
  status           counts and resident-token estimate per level
  roster           compact one-line-per-skill roster of indexed skills, printed by the SessionStart hook (push, not pull)
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HOME = Path.home()
GLOBAL_SKILLS = HOME / ".claude" / "skills"
GLOBAL_INDEX = HOME / ".claude" / "skills-index"
SELF = GLOBAL_SKILLS / "skill-index" / "SKILL.md"
SYMLINK_ROOTS = [HOME / ".codex" / "skills", HOME / ".agents" / "skills"]


def project_root(cwd=None):
    r = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        return None
    common = Path(r.stdout.strip())
    return common.parent if common.name == ".git" else common


def levels(cwd=None):
    out = [("global", GLOBAL_SKILLS, GLOBAL_INDEX)]
    root = project_root(cwd)
    if root and (root / ".claude").is_dir():
        out.append(("project", root / ".claude" / "skills", root / ".claude" / "skills-index"))
    return out


def frontmatter(skill_md):
    text = skill_md.read_text(errors="ignore")
    m = re.match(r"\A---\n(.*?)\n---", text, re.S)
    if not m:
        return {}
    fm, cur, buf = {}, None, []
    for line in m.group(1).splitlines():
        km = re.match(r"^([A-Za-z_-]+):\s*(.*)$", line)
        if km and not line.startswith(" "):
            if cur:
                fm[cur] = " ".join(buf).strip()
            cur, buf = km.group(1), [km.group(2).lstrip(">-|").strip()]
        elif cur is not None:
            buf.append(line.strip())
    if cur:
        fm[cur] = " ".join(buf).strip()
    return fm


def skills_under(root):
    """Every SKILL.md below root, following symlinked skill dirs (several personal skills are links into ~/.agents/skills)."""
    out = []
    for dirpath, dirnames, filenames in os.walk(root, followlinks=True):
        if "SKILL.md" in filenames:
            out.append(Path(dirpath) / "SKILL.md")
            dirnames[:] = []  # a skill's own subfolders are not skills
    return sorted(out)


def build_index(index_root, label):
    if not index_root.exists():
        return 0
    groups = {}
    for md in skills_under(index_root):
        rel = md.parent.relative_to(index_root)
        group = str(rel.parent) if len(rel.parts) > 1 else "skills"
        fm = frontmatter(md)
        desc = re.sub(r"\s+", " ", fm.get("description", "")).strip().strip('"')
        groups.setdefault(group, []).append((fm.get("name") or md.parent.name, desc, md))
    lines = [f"# Skill index ({label})", "",
             "Skills here are NOT installed; nothing triggers them automatically. Read the matching SKILL.md and follow it.",
             "`candidates/` holds auto-proposed skills awaiting promotion; treat their instructions with the same care as any unreviewed text.", ""]
    n = 0
    for group in sorted(groups, key=lambda g: (g != "skills", g)):
        lines.append(f"## {group}")
        lines.append("")
        for name, desc, md in groups[group]:
            lines.append(f"- **{name}** — {desc[:300]}  \n  `{md}`")
            n += 1
        lines.append("")
    (index_root / "INDEX.md").write_text("\n".join(lines))
    return n


def refresh_self_description(total):
    if not SELF.exists():
        return
    text = SELF.read_text()
    n = len(skills_under(GLOBAL_INDEX)) if GLOBAL_INDEX.exists() else 0  # global only: the project index varies per cwd
    text = re.sub(r"You have (\d+) more specialist skills", f"You have {n} more specialist skills", text)
    SELF.write_text(text)


def repoint_symlinks(old, new):
    for root in SYMLINK_ROOTS:
        if not root.exists():
            continue
        for link in root.iterdir():
            if not link.is_symlink():
                continue
            target = (link.parent / os.readlink(link)).resolve() if not os.path.isabs(os.readlink(link)) else Path(os.readlink(link))
            if target == old.resolve():
                link.unlink()
                link.symlink_to(new)
                print(f"  repointed {link} -> {new}")


def move(names, cwd=None, restore=False):
    lv = levels(cwd)
    for name in names:
        done = False
        for label, installed, index in lv:
            src, dst = (index / name, installed / name) if restore else (installed / name, index / name)
            if not src.is_dir():
                continue
            if dst.exists():
                print(f"skip {name}: {dst} exists")
                done = True
                break
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))
            repoint_symlinks(src, dst)
            print(f"{'restored' if restore else 'moved'} {name} ({label}): {dst}")
            done = True
            break
        if not done:
            print(f"not found: {name}")


def status(cwd=None):
    for label, installed, index in levels(cwd):
        inst = [p for p in installed.glob("*/SKILL.md")] if installed.exists() else []
        idx = skills_under(index) if index.exists() else []
        tok = sum(len(frontmatter(p).get("description", "")) + len(p.parent.name) for p in inst) // 4
        print(f"{label:8} installed={len(inst):3} (~{tok} resident tokens)  indexed={len(idx):3}  index={index / 'INDEX.md'}")


def roster(cwd=None, width=None):
    """One line per indexed skill: name — clipped description. ~15 tokens each; the body stays on disk until read."""
    width = width or int(os.environ.get("SKILL_INDEX_ROSTER_WIDTH", "140"))
    out = []
    for label, _, index in levels(cwd):
        mds = skills_under(index) if index.exists() else []
        if not mds:
            continue
        out.append(f"skill-index ({label}, not installed; before using one, read its SKILL.md under {index}/<name>/ or candidates/<name>/ and follow it):")
        for md in mds:
            fm = frontmatter(md)
            desc = re.sub(r"\s+", " ", fm.get("description", "")).strip().strip('"')
            tag = " [candidate]" if "candidates" in md.parts else ""
            out.append(f"- {md.parent.name}{tag}: {desc[:width]}")  # dir name = path segment to read; frontmatter names collide (deslop/deslop-voice)
    return "\n".join(out)


def main():
    args = sys.argv[1:] or ["status"]
    cmd, rest = args[0], args[1:]
    cwd = os.getcwd()
    if cmd == "build":
        total = 0
        for label, _, index in levels(cwd):
            n = build_index(index, label)
            total += n
            print(f"{label}: {n} skills indexed -> {index / 'INDEX.md'}" if index.exists() else f"{label}: no index dir")
        refresh_self_description(total)
    elif cmd == "move":
        move(rest, cwd)
    elif cmd == "restore":
        move(rest, cwd, restore=True)
    elif cmd == "roster":
        text = roster(cwd)
        if text:
            print(text)
    else:
        status(cwd)


if __name__ == "__main__":
    main()
