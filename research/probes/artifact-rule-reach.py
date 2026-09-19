#!/usr/bin/env python3
"""How much of the validator is gated behind an artifact set that is empty.

Run from the repo root. Reports every validation rule that can only fire while
iterating a document loaded by `loadArtifacts`, and every schema that has no
document anywhere in the CLI path. Exits non-zero when a schema carrying a
runtime document shape has no document for its validator to meet.

WHAT A CLEAN RUN IS EVIDENCE OF
-------------------------------
That each schema carrying a runtime document shape is exercised against at
least one real document when `ak validate` runs, so the artifact-gated rule
surface executes against something rather than standing down.

WHAT A CLEAN RUN IS NOT EVIDENCE OF
-----------------------------------
That those documents are *good*, or that they reach the interesting branches.
A conforming example satisfies the conditionals it enters and never enters the
rest; it proves the validator ran, not that it would object. The conditional
census below is reported for that reason and is deliberately not an exit
condition -- a template contorted to enter every branch would be a worse
artifact than an honest one, and AUTHORING.md forbids editing a document until
a check goes green. Read an entered-branch count as a description of the
examples, never as a coverage target to raise.

It is also not evidence about the rules themselves. A rule iterating zero
artifacts and a rule iterating fifty clean ones both emit nothing, and
`ak validate` exits 0 under both. That indistinguishability is the defect this
probe exists to make visible, which is why the census prints even when it
passes.

WHY THE GATING IS ATTRIBUTED THIS WAY
-------------------------------------
Rule ids are held in `RULE_*` constants as often as they are written inline and
the emitting call is often split across lines, so a literal scan finds neither
reliably. This resolves `const RULE_X = "..."` bindings, then walks the call
graph from the entry points in `CHECKS` (`src/validation/run.ts`) to find which
functions sit downstream of a `loadArtifacts` call. In `checkPackManifests` the
call sits mid-function, so only call sites textually after it count as gated;
elsewhere the call is the first statement and the whole function is downstream.

The extraction self-checks against classifications that must hold for any
correct reading of these files and fails loudly rather than reporting a number
it cannot stand behind. If the validator is restructured so a self-check trips,
the probe is telling you it no longer understands the code -- fix the walk, do
not delete the assertion.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path.cwd()
VALIDATION = ROOT / "src" / "validation"
MODULES = ["artifacts.ts", "configrules.ts", "docrules.ts"]
def issue_constructors() -> dict[str, int]:
    """Every `types.ts` export whose first parameter is the rule id, to the
    argument index that holds it, plus docrules' local `fail` wrapper.

    Derived rather than listed because the set has already drifted once: an
    earlier revision of this probe looked for `warn`, which does not exist --
    the constructor is `warning` -- and silently lost every rule emitted
    through it.
    """
    text = (VALIDATION / "types.ts").read_text(encoding="utf-8")
    found = {m.group(1): 0 for m in re.finditer(r"^export function ([A-Za-z0-9_]+)\(rule: string", text, re.M)}
    if "error" not in found:
        raise SystemExit("SELF-CHECK FAILED: types.ts exports no issue constructor taking a rule id first")
    found["fail"] = 1  # docrules: fail(rc, rule, message)
    return found


EMITTERS = issue_constructors()

RULE_ID = re.compile(r"^[a-z][a-z0-9]*\.[a-z0-9]+(-[a-z0-9]+)*$")
CONST_BINDING = re.compile(r"\bconst\s+(RULE[A-Za-z0-9_]*)\s*=\s*\"([^\"]+)\"")
FUNC_DECL = re.compile(r"^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(", re.M)

# `common` defines shared $defs and validates no document; `catalog`, `skill`
# and `pack` are configuration with real files of their own, found by
# documentTargets rather than under templates/.
NO_RUNTIME_DOCUMENT = {"common"}
CONFIG_SCHEMAS = {"catalog", "skill", "pack"}


def function_spans(text: str) -> dict[str, tuple[int, int]]:
    """Each top-level function name to its [start, end) character span."""
    out: dict[str, tuple[int, int]] = {}
    for m in FUNC_DECL.finditer(text):
        i = text.find("{", m.end() - 1)
        if i < 0:
            continue
        depth, j = 0, i
        while j < len(text):
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        out[m.group(1)] = (m.start(), j + 1)
    return out


def nth_arg(text: str, open_paren: int, n: int) -> str | None:
    """The n-th (0-based) argument token of the call whose '(' is at open_paren."""
    depth, j, start, seen = 0, open_paren, open_paren + 1, 0
    while j < len(text):
        c = text[j]
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
            if depth == 0:
                break
        elif c == "," and depth == 1:
            if seen == n:
                break
            seen += 1
            start = j + 1
        j += 1
    if seen != n:
        return None
    arg = text[start:j].strip()
    if arg.startswith('"'):
        return arg[1:].split('"')[0]
    return arg if re.fullmatch(r"[A-Za-z0-9_]+", arg) else None


def dispatch_tables(text: str, fns: dict[str, tuple[int, int]]) -> dict[str, set[str]]:
    """Module-level `const NAME = { key: someFunction, ... }` tables.

    `docrules.ts` dispatches its per-schema rules through one of these, so the
    edge from checkDocument to charterRules carries no parentheses and a
    call-shaped scan misses every rule in the file.
    """
    out: dict[str, set[str]] = {}
    # The annotation may itself contain '=' (a `(rc) => void` member type), so
    # this anchors on a module-level const whose line ends at an opening brace.
    for m in re.finditer(r"^const\s+([A-Za-z0-9_]+)\b[^\n]*=\s*\{[ \t]*$", text, re.M):
        if any(lo <= m.start() < hi for lo, hi in fns.values()):
            continue
        depth, j = 0, text.index("{", m.end() - 1)
        while j < len(text):
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        named = {i for i in re.findall(r"[A-Za-z0-9_]+", text[m.end():j]) if i in fns}
        if named:
            out[m.group(1)] = named
    return out


def analyse(name: str) -> dict:
    text = (VALIDATION / name).read_text(encoding="utf-8")
    fns = function_spans(text)
    tables = dispatch_tables(text, fns)

    # `RULE_*` bindings are function-scoped and the names are reused: docrules
    # binds RULE_SEATS, RULE_AUTH and RULE_SEC twice each, in different rules.
    # A file-global map silently attributes the first function's failures to
    # the second's rule id, so each function resolves its own bindings first.
    module_consts = {
        m.group(1): m.group(2)
        for m in CONST_BINDING.finditer(text)
        if not any(lo <= m.start() < hi for lo, hi in fns.values())
    }
    local_consts = {
        fn: {m.group(1): m.group(2) for m in CONST_BINDING.finditer(text[lo:hi])} for fn, (lo, hi) in fns.items()
    }

    # The gate is looked for inside the body only: a declaration line reading
    # `function loadArtifacts(` is not a call to it.
    gate_at: dict[str, int] = {}
    for fn, (lo, hi) in fns.items():
        body = text[text.index("{", lo):hi]
        if "loadArtifacts(" in body:
            gate_at[fn] = text.index("{", lo) + body.index("loadArtifacts(")

    calls = {fn: set() for fn in fns}
    emits_gated = {fn: set() for fn in fns}
    emits_plain = {fn: set() for fn in fns}

    for fn, (lo, hi) in fns.items():
        for m in re.finditer(r"\b([A-Za-z0-9_]+)\s*\(", text[lo:hi]):
            callee, at = m.group(1), lo + m.start()
            after_gate = fn in gate_at and at > gate_at[fn]
            if callee in EMITTERS:
                raw = nth_arg(text, lo + m.end() - 1, EMITTERS[callee])
                scope = {**module_consts, **local_consts[fn]}
                rule = scope.get(raw, raw) if raw else None
                if rule and RULE_ID.match(rule):
                    (emits_gated if after_gate or fn not in gate_at else emits_plain)[fn].add(rule)
            elif callee in fns and callee != fn and (after_gate or fn not in gate_at):
                calls[fn].add(callee)
        # Dispatch-table references are call edges to every function in the table.
        for ident in set(re.findall(r"[A-Za-z0-9_]+", text[lo:hi])):
            if ident in tables:
                calls[fn] |= tables[ident] - {fn}
    return {"fns": fns, "gate_at": gate_at, "calls": calls, "gated": emits_gated, "plain": emits_plain, "tables": tables}


def downstream(mod: dict, roots: set[str]) -> set[str]:
    seen, stack = set(), list(roots)
    while stack:
        fn = stack.pop()
        if fn in seen or fn not in mod["fns"]:
            continue
        seen.add(fn)
        stack.extend(mod["calls"].get(fn, ()))
    return seen


def main() -> int:
    mods = {name: analyse(name) for name in MODULES}

    # Self-checks: classifications that must hold for any correct reading.
    checks = [
        ("artifacts.ts", "checkArtifacts", True),
        ("docrules.ts", "checkDocumentRules", True),
        ("configrules.ts", "checkPackManifests", True),
        ("configrules.ts", "checkCatalogRules", False),
        ("configrules.ts", "checkSkillManifests", False),
    ]
    for module, fn, expected in checks:
        if (fn in mods[module]["gate_at"]) != expected:
            print(f"SELF-CHECK FAILED: {module}:{fn} gated={fn in mods[module]['gate_at']}, expected {expected}", file=sys.stderr)
            print("The walk no longer understands these modules. Fix it rather than the assertion.", file=sys.stderr)
            return 2

    # Cross-check the walk against a plain literal scan. This caught the walk
    # attributing six of docrules' rules to the wrong id, because RULE_SEATS,
    # RULE_AUTH and RULE_SEC are each bound twice in different functions. A
    # walk that invents an id no literal contains is wrong in a way the
    # reported count would hide.
    unattributed: dict[str, set[str]] = {}
    for name in MODULES:
        text = (VALIDATION / name).read_text(encoding="utf-8")
        literals = set(re.findall(r"\"([a-z][a-z0-9]*\.[a-z0-9]+(?:-[a-z0-9]+)*)\"", text))
        walked = set().union(*(mods[name]["gated"].values()), *(mods[name]["plain"].values()))
        invented = walked - literals
        if invented:
            print(f"SELF-CHECK FAILED: {name} attributes ids that appear in no literal: {sorted(invented)}", file=sys.stderr)
            return 2
        unattributed[name] = literals - walked

    gated_rules: dict[str, set[str]] = {}
    ungated: set[str] = set()
    for name, mod in mods.items():
        roots = set(mod["gate_at"])
        reach = downstream(mod, roots)
        gated_rules[name] = set().union(*(mod["gated"][fn] for fn in reach)) if reach else set()
        for fn in mod["fns"]:
            ungated |= mod["plain"][fn]
            if fn not in reach:
                ungated |= mod["gated"][fn]
    all_gated = set().union(*gated_rules.values()) if gated_rules else set()
    all_gated -= ungated  # a rule reachable by an ungated path is not gated

    # Artifact census.
    artifact_dirs = re.findall(r"ARTIFACT_DIRS\s*=\s*\[([^\]]*)\]", (VALIDATION / "artifacts.ts").read_text(encoding="utf-8"))
    dirs = [d.strip().strip('"') for d in artifact_dirs[0].split(",") if d.strip()] if artifact_dirs else []
    documents: dict[str, list[str]] = {}
    for d in dirs:
        for path in sorted((ROOT / d).rglob("*")):
            if not path.is_file() or path.suffix not in {".json", ".yaml", ".yml"}:
                continue
            try:
                doc = json.loads(path.read_text(encoding="utf-8")) if path.suffix == ".json" else None
            except json.JSONDecodeError:
                doc = None
            declared = doc.get("schema") if isinstance(doc, dict) else None
            documents.setdefault(declared or "(undeclared)", []).append(str(path.relative_to(ROOT)))

    schemas = sorted(p.name[: -len(".schema.json")] for p in (ROOT / "schemas").glob("*.schema.json"))
    owed = [s for s in schemas if s not in NO_RUNTIME_DOCUMENT and s not in CONFIG_SCHEMAS]
    missing = [s for s in owed if s not in documents]

    # Conditional census: which branches a shipped example actually enters.
    entered: dict[str, tuple[int, int]] = {}
    for s in schemas:
        schema = json.loads((ROOT / "schemas" / f"{s}.schema.json").read_text(encoding="utf-8"))
        branches = [b for b in schema.get("allOf", []) if "if" in b]
        if not branches:
            continue
        hits = 0
        for branch in branches:
            guard = branch["if"]
            for file in documents.get(s, []):
                doc = json.loads((ROOT / file).read_text(encoding="utf-8"))
                req = guard.get("required", [])
                props = guard.get("properties", {})
                if all(k in doc for k in req) and all(
                    ("const" in c and doc.get(k) == c["const"]) or ("enum" in c and doc.get(k) in c["enum"]) or (k in doc and "const" not in c and "enum" not in c)
                    for k, c in props.items()
                ):
                    hits += 1
                    break
        entered[s] = (hits, len(branches))

    print(f"artifact directories: {dirs or '(none declared)'}")
    print(f"documents found: {sum(len(v) for v in documents.values())}")
    for declared, files in sorted(documents.items()):
        print(f"  {declared}: {len(files)}")
    print()
    print(f"rules reachable only through loadArtifacts: {len(all_gated)}")
    for name in MODULES:
        only = sorted(gated_rules[name] - ungated)
        print(f"  {name}: {len(only)}")
    print()
    print("schemas with a runtime document shape and no document in the CLI path:")
    print(f"  {len(missing)} of {len(owed)}" + (f" -- {', '.join(missing)}" if missing else ""))
    print()
    print("rule-id-shaped literals not attributed to any emitting call:")
    for name in MODULES:
        rest = sorted(unattributed[name])
        print(f"  {name}: {len(rest)}" + (f" -- {', '.join(rest)}" if rest else ""))
    print("  (field paths such as charter.hash share the rule-id shape; a rule that")
    print("   appears here and is not a field path is declared and never emitted)")
    print()
    print("root-level conditional branches entered by a shipped example (descriptive, not a target):")
    for s, (hit, total) in sorted(entered.items()):
        print(f"  {s}: {hit}/{total}")

    if missing:
        print()
        print(f"FAIL: {len(missing)} schema(s) have no document for their validator to meet.", file=sys.stderr)
        print(f"{len(all_gated)} rule(s) stand down with them, and ak validate exits 0 regardless.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
