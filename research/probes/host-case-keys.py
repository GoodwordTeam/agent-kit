#!/usr/bin/env python3
#
# Reconcile schemas/case.schema.json against the host's own definition of the
# case object, read out of the host binary.
#
#   ./research/probes/host-case-keys.py
#
# WHY THIS RUNS IN THE DIRECTION IT DOES
#
# schemas/case.schema.json annotates keys with the host version they were
# confirmed against. That is schema-driven: it starts from a key this package
# declares and asks who owns it. It cannot reach a key the schema omits, because
# an omitted key has no row to annotate and no empty cell to notice.
# `scaffold_script` was refused from 7db25a7 until it was declared, and the
# visible result was a corpus in which no case ever declared a fixture -- which
# reads as nothing anyone wanted. Annotation finds keys we define wrongly; only
# reconciliation finds keys we exclude silently. Both are needed.
#
# WHICH SOURCE, AND WHY IT IS THE THIRD ONE TRIED
#
# The source decides what the arm can reach, and two weaker ones were used first:
#
#   `claude plugin eval --help`   what a help text happens to mention, so a key's
#                                 absence from it is not evidence.
#   `claude plugin eval init`     the authoring spec, which states its own
#                                 completeness and is a static template. Better,
#                                 and still wrong: its grader table lists five
#                                 types where the loader has six, so reconciling
#                                 against it reported no divergence while
#                                 case.schema.json was refusing `baseline`. Its
#                                 `focus` values omit `mock_calls`.
#   the loader definition         what this probe reads. It is the object the
#                                 runner actually parses, it carries the defaults
#                                 as well as the shapes, and it subsumes both.
#
# A key has a name and an address. Reading a key list without its addresses is
# what put `scaffold_script` at the case root at 9b12366, where the host does not
# read it and where -- the host's root object not being strict -- it would have
# validated, shipped and been silently ignored. So this probe reports addresses:
# root, `context`, `execution`, and per grader type.
#
# THE ANCHORS ARE THE WHOLE RISK
#
# This parses minified JavaScript, where identifiers are one or two letters and
# are reused across chunks. Anchoring on `gs=new Set([...])` alone matched a
# DIFFERENT `gs` in this same binary and returned eight plausible strings -- the
# same count as the real list. Every anchor below is therefore pinned to
# neighbouring text that is unique to the case loader, and every parse is checked
# against content this repository independently knows. A miss exits non-zero and
# says so. It never reports "no divergence", because a probe that cannot find its
# subject and a probe that finds nothing wrong must not look alike.

import json
import os
import re
import shutil
import subprocess
import sys

PINNED_HOST = "2.1.278"


def die(msg):
    print(f"host-case-keys: {msg} Not a clean run.", file=sys.stderr)
    sys.exit(1)


def binary_text():
    exe = shutil.which("claude")
    if exe is None:
        die("no 'claude' on PATH; this probe needs the host binary.")
    exe = os.path.realpath(exe)
    version = subprocess.run(["claude", "--version"], capture_output=True, text=True).stdout.strip()
    if PINNED_HOST not in version:
        print(f"host-case-keys: host is {version}, not the pinned {PINNED_HOST}. The anchors below", file=sys.stderr)
        print("  were written against the pinned build and may match something else entirely.", file=sys.stderr)
    out = subprocess.run(["strings", "-a", exe], capture_output=True, text=True)
    if out.returncode != 0 or len(out.stdout) < 10_000:
        die(f"could not read strings out of {exe}.")
    return version, out.stdout


def balanced(s, open_at):
    depth = 0
    for i in range(open_at, len(s)):
        if s[i] in "([{":
            depth += 1
        elif s[i] in ")]}":
            depth -= 1
            if depth == 0:
                return s[open_at + 1:i]
    die("unbalanced brackets while reading the loader definition.")


def keys(body):
    """Keys at bracket depth 0. Values nest, so a flat regex would pick up the
    inner keys of `tt({source:...,path:...})` as if they were siblings."""
    out, depth, i = [], 0, 0
    while i < len(body):
        c = body[i]
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif depth == 0:
            m = re.match(r"(\w+)\s*:", body[i:])
            if m:
                out.append(m.group(1))
                i += m.end()
                continue
        i += 1
    return out


def parse_host(blob):
    # `ps` and `gs` are the prompt.md frontmatter routing tables: a key in `ps`
    # lands at the case root, a key in `gs` lands in `execution`, anything else
    # is refused. Anchored as the adjacent PAIR, because each name alone collides.
    m = re.search(r'ps=new Set\(\[(.*?)\]\),gs=new Set\(\[(.*?)\]\)', blob)
    if m is None:
        die("the frontmatter routing tables (`ps`/`gs`) did not match; this probe's anchors are stale.")
    root = re.findall(r'"(\w+)"', m.group(1))
    execution = re.findall(r'"(\w+)"', m.group(2))
    if "schema_version" not in root or "max_turns" not in execution:
        die(f"the routing tables matched the wrong pair: root={root}, execution={execution}.")

    m = re.search(r"context:tt\(\{", blob)
    if m is None:
        die("the `context` object did not match; this probe's anchors are stale.")
    context = keys(balanced(blob, m.end() - 1))

    m = re.search(r'var Fc=f\(\(\)=>HXt\("type",\[', blob)
    if m is None:
        die("the grader union did not match; this probe's anchors are stale.")
    graders = {}
    for chunk in blob[m.end():].split("tt({")[1:]:
        cut = chunk.find("}).strict()")
        if cut < 0:
            continue
        body = chunk[:cut]
        t = re.search(r'type:Od\("(\w+)"\)', body)
        if t:
            graders[t.group(1)] = [k for k in keys(body) if k != "type"]
    if "llm" not in graders:
        die(f"the grader union parsed without an `llm` type: {sorted(graders)}.")

    # `focus`/`target` accept these, and the default is what makes the 41
    # filesystem claims in this tree score against the transcript.
    m = re.search(r'function cs\(\)\{return DP\(\[cl\(\[(.*?)\]\)', blob)
    focus = re.findall(r'"(\w+)"', m.group(1)) if m else []
    return root, execution, context, graders, focus


def parse_schema(root_dir):
    with open(os.path.join(root_dir, "schemas", "case.schema.json")) as f:
        s = json.load(f)
    p = s["properties"]
    grader = p["graders"]["items"]
    return {
        "root": set(p),
        "execution": set(p["execution"]["properties"]),
        "context": set(p.get("context", {}).get("properties", {})),
        "grader_props": set(grader["properties"]),
        "grader_types": set(grader["properties"]["type"]["enum"]),
        "root_closed": s.get("additionalProperties") is False,
        "exec_closed": p["execution"].get("additionalProperties") is False,
        "grader_closed": grader.get("additionalProperties") is False,
    }


def main():
    root_dir = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True
    ).stdout.strip()
    version, blob = binary_text()
    hroot, hexec, hcontext, hgraders, hfocus = parse_host(blob)
    s = parse_schema(root_dir)

    print(f"host case object  (claude: {version})")
    print("  source: the loader definition in the host binary -- the object the runner parses.")
    print()

    missing = []

    def section(label, host_keys, mine, closed, structural=()):
        print(f"{label}  ({'closed' if closed else 'open'} here)")
        for k in host_keys:
            ok = k in mine or k in structural
            print(f"    {k:<22} {'' if ok else '<- NOT NAMED HERE'}")
            if not ok:
                missing.append(f"{label.split()[0].lower()}.{k}")
        extra = sorted(mine - set(host_keys) - set(structural))
        if extra:
            print(f"    named here, not in the loader: {', '.join(extra)}")
        print()

    # `execution`, `context` and `graders` are objects the loader declares
    # structurally rather than routing frontmatter into, so they are not in `ps`.
    section("ROOT", hroot, s["root"], s["root_closed"], ("execution", "context", "graders"))
    section("CONTEXT", hcontext, s["context"], True)
    section("EXECUTION", hexec, s["execution"], s["exec_closed"], ("prompt",))

    print(f"GRADER TYPES  ({'closed' if s['grader_closed'] else 'open'} here; the host's are strict)")
    for t in sorted(hgraders):
        mark = "" if t in s["grader_types"] else "  <- NOT IN THIS SCHEMA'S ENUM"
        absent = [k for k in hgraders[t] if k not in s["grader_props"]]
        print(f"    {t:<13}{mark}")
        print(f"      loader     {', '.join(hgraders[t])}")
        print(f"      unnamed    {', '.join(absent) or '(none)'}")
        if t not in s["grader_types"]:
            missing.append(f"grader type {t}")
        missing += [f"{t}.{k}" for k in absent]
    print()

    print(f"`focus`/`target` accept {', '.join(hfocus) or '(unparsed)'}, or {{source: file, path}},")
    print("  and default to last_message. See CONTRACT-DEFECTS.md.")
    print()

    print("RECONCILIATION")
    print(f"  the loader names and this schema does not: {', '.join(missing) or 'none'}")
    print()
    print("  Unnamed grader keys are admitted, because that object is open here -- but")
    print("  the host's grader objects are strict, so openness buys nothing against the")
    print("  runner. It admits exactly the surplus the runner will reject.")
    print()
    print("  CONTROL: every anchor is pinned to neighbouring text unique to the case")
    print("  loader and checked against content this repository knows independently. A")
    print("  missed anchor exits non-zero. A clean 'none' above means the anchors held")
    print("  and the keys matched, never that the probe could not find its subject.")


if __name__ == "__main__":
    main()
