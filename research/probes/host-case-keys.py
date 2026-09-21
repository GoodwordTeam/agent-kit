#!/usr/bin/env python3
#
# Reconcile schemas/case.schema.json against the host's own enumeration of the
# keys it reads.
#
#   ./research/probes/host-case-keys.py
#
# WHY THIS RUNS IN THE DIRECTION IT DOES
#
# schemas/case.schema.json annotates three keys with the host version they were
# confirmed against. That annotation is schema-driven: it starts from a key this
# package already declares and asks who owns it. It cannot reach a key the
# schema omits, because an omitted key has no row to annotate and no empty cell
# to notice. `scaffold_script` was refused by this schema from 7db25a7 until it
# was declared, and the visible result was a corpus in which no case ever
# declared a fixture -- which reads as nothing anyone wanted, not as a defect.
#
# This probe runs the other way. It takes the host's key list from the host and
# asks which of those keys the schema names. Annotation finds keys we define
# wrongly; only reconciliation finds keys we exclude silently. Both are needed
# and neither substitutes for the other.
#
# WHY `claude plugin eval init` AND NOT `--help`
#
# `--help` is a weak enumeration: it is whatever the help text happens to
# mention, so a key's absence from it is not evidence. `claude plugin eval init`
# prints the host's eval-authoring spec, which states its own completeness
# ("Output format (complete -- do NOT look this up)" and "Do NOT look up the
# format in source. The complete spec is in this prompt."). It is a static
# template: two runs from the same directory at 2.1.278 were byte-identical, so
# it costs no inference, makes no network call, and is diffable across host
# versions.
#
# It is still not a complete enumeration of the host's case surface, and this
# probe says so rather than implying otherwise. Three sources are in play and
# each is incomplete in the others' directions:
#
#   `--help`                  names `scaffold_script`, which the authoring spec
#                             does not, because the spec documents `prompt.md`
#                             frontmatter and `scaffold_script` is a flag's subject.
#   the authoring spec        the only source for the DEFAULTS (`target`/`focus`
#                             = `last_message`, `weight` = 1, `match` = contains,
#                             `tool_used.min` = 1). Its grader table lists five
#                             types.
#   the loader definition     readable in the binary; read at 4756a2e, which is
#   in the binary             how AUTHORING.md §9 came to specify `file_exists`,
#                             `tool_order` and `baseline`, and to record that
#                             EVERY type takes an optional `arm`. It has six
#                             types. It carries signatures, not defaults.
#
# So this probe has a known blind spot and prints it rather than leaving a
# reader to infer completeness from a five-row table: `baseline` is a real
# grader type that its source does not mention, and `case.schema.json` refused
# it until 4756a2e was read. This probe did not catch that -- the reconciling
# direction is necessary and still not sufficient, and which source you
# reconcile against decides what it can reach. What the probe reports is a
# floor on divergence, never a proof of agreement.
#
# WHY THE FORMS DIFFER
#
# The host's canonical case is `prompt.md` (flat frontmatter) plus `graders/*.md`
# (one file per grader, body carries the rubric or pattern). This package's
# case.yaml nests the same keys under `execution` and carries grader bodies as
# named keys. That rearrangement is this package's and is not a divergence; the
# BODY_KEYS table below names each body-to-key correspondence explicitly so it
# is visible rather than silently reconciled away.

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

PINNED_HOST = "2.1.278"

# Host grader body -> the case.yaml key this package carries it in. Measured
# against the loader, not inferred: the host reports `graders.N.criteria:
# Required` for an `llm` grader without one.
BODY_KEYS = {"llm": "criteria", "regex": "pattern"}


def die(msg):
    print(f"host-case-keys: {msg}", file=sys.stderr)
    sys.exit(1)


def host_spec():
    if shutil.which("claude") is None:
        die("no 'claude' on PATH; this probe needs the host CLI. Not a clean run.")
    version = subprocess.run(
        ["claude", "--version"], capture_output=True, text=True
    ).stdout.strip()
    work = os.path.realpath(tempfile.mkdtemp())
    try:
        os.makedirs(os.path.join(work, ".claude-plugin"))
        with open(os.path.join(work, ".claude-plugin", "plugin.json"), "w") as f:
            json.dump(
                {
                    "name": "host-case-keys-probe",
                    "version": "0.0.0",
                    "description": "throwaway manifest; `eval init` refuses a non-plugin directory",
                },
                f,
            )
        run = subprocess.run(
            ["claude", "plugin", "eval", "init"],
            cwd=work,
            capture_output=True,
            text=True,
        )
        if run.returncode != 0:
            die(f"`claude plugin eval init` exited {run.returncode}: {run.stderr.strip()[:300]}")
        return version, run.stdout
    finally:
        shutil.rmtree(work, ignore_errors=True)


def spans(cell):
    """Keys named in a backticked list. `target: a|{source: file, path}` is one
    span and yields one key, which is why this splits on backticks and not on
    commas."""
    out = []
    for s in re.findall(r"`([^`]+)`", cell):
        out.append(s.split(":", 1)[0].strip())
    return out


def parse(spec):
    line = [l for l in spec.splitlines() if l.startswith("**prompt.md**")]
    if not line:
        die("the spec no longer has a `**prompt.md**` frontmatter line; this probe's parse is stale. Not a clean run.")
    frontmatter = spans(line[0])
    if not frontmatter:
        die("parsed zero keys from the `**prompt.md**` line; the spec's shape changed. Not a clean run.")

    graders = {}
    for line in spec.splitlines():
        if not line.startswith("| `"):
            continue
        # Split on unescaped pipes only. The frontmatter cells carry `\|`
        # alternations inside backticks (`match: contains\|not_contains`), and
        # splitting on every pipe silently truncates three of the five rows --
        # which reads as those types taking no frontmatter at all.
        cells = [c.strip() for c in re.split(r"(?<!\\)\|", line)]
        cells = [c for c in cells if c]
        if len(cells) < 2:
            continue
        kind = cells[0].strip("`")
        graders[kind] = (spans(cells[1]), cells[2] if len(cells) > 2 else "")
    if not graders:
        die("parsed zero grader types from the spec's table; its shape changed. Not a clean run.")
    return frontmatter, graders


def schema_keys(root):
    with open(os.path.join(root, "schemas", "case.schema.json")) as f:
        s = json.load(f)
    props = s["properties"]
    case = {k: k for k in props}
    for k in props["execution"]["properties"]:
        case[k] = f"execution.{k}"
    grader = props["graders"]["items"]
    closed = grader.get("additionalProperties") is False
    return case, set(grader["properties"]), closed, set(grader["properties"]["type"]["enum"])


def main():
    root = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True
    ).stdout.strip()
    version, spec = host_spec()
    frontmatter, graders = parse(spec)
    case, gprops, gclosed, genum = schema_keys(root)

    print(f"host case keys  (claude: {version})")
    print("  source: `claude plugin eval init`, the host's own authoring spec, which states")
    print("  its own completeness. Static template: no inference, no network, diffable.")
    if PINNED_HOST not in version:
        print(f"  !! host is not the pinned {PINNED_HOST}. Every row below is against {version};")
        print("     the annotations in case.schema.json are not, and are now unverified.")
    print()

    print("CASE-LEVEL KEYS THE HOST NAMES")
    missing = []
    for k in frontmatter:
        where = case.get(k)
        print(f"  {k:<18} {'schema: ' + where if where else 'NOT IN SCHEMA'}")
        if not where:
            missing.append(k)
    print()

    print("GRADER KEYS THE HOST NAMES, BY TYPE")
    gmissing = []
    for kind, (keys, body) in sorted(graders.items()):
        named = [k for k in keys if k in gprops]
        absent = [k for k in keys if k not in gprops]
        bk = BODY_KEYS.get(kind)
        print(f"  {kind}")
        print(f"    frontmatter   {', '.join(keys) or '(none)'}")
        print(f"    in schema     {', '.join(named) or '(none)'}")
        print(f"    NOT in schema {', '.join(absent) or '(none)'}")
        if bk:
            print(f"    body          {body!r} -> schema `{bk}`" + ("" if bk in gprops else "  MISSING"))
        elif body and body != "(none)":
            print(f"    body          {body!r} -> no declared correspondence")
        gmissing += [(kind, k) for k in absent]
    print()

    print("GRADER TYPES: THIS PROBE'S SOURCE AGAINST THE SCHEMA")
    print(f"    authoring spec lists   {', '.join(sorted(graders))}")
    print(f"    schema enum admits     {', '.join(sorted(genum))}")
    unlisted = sorted(set(genum) - set(graders))
    print(f"    in the enum, not in this probe's source: {', '.join(unlisted) or 'none'}")
    print("    The spec's table is not the host's type list. The loader definition in the")
    print("    binary has six types and AUTHORING.md \u00a79 records them; a type absent from the")
    print("    row above is not evidence it does not exist, which is how `baseline` was")
    print("    refused by this schema while this probe reported no divergence.")
    print()

    print("SCHEMA KEYS THE HOST SPEC DOES NOT NAME")
    hostnames = set(frontmatter) | {k for keys, _ in graders.values() for k in keys}
    for k, where in sorted(case.items()):
        if k not in hostnames and k not in ("execution", "graders"):
            print(f"  {where}")
    print("  (Not defects. This package owns schema_version, name, tags and prompt, and")
    print("   scaffold_script is real but documented in `--help` rather than in this spec.)")
    print()

    print("RECONCILIATION")
    print(f"  case-level keys the host names and the schema omits:  {', '.join(missing) or 'none'}")
    print(f"  grader keys the host names and the schema omits:      {', '.join(f'{t}.{k}' for t, k in gmissing) or 'none'}")
    print(f"  grader object is {'CLOSED' if gclosed else 'open'}: surplus grader keys are "
          f"{'refused here' if gclosed else 'admitted here and refused by the host'}.")
    print()
    print("  CONTROL: this output is a floor, not a proof of agreement. The parse is")
    print("  anchored on two lines of the spec and exits non-zero if either is gone, so a")
    print("  clean 'none' above means the anchors held and the keys matched -- never that")
    print("  the probe found nothing to look at.")


if __name__ == "__main__":
    main()
