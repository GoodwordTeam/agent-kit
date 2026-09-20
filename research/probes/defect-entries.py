#!/usr/bin/env python3
"""Check that every open CONTRACT-DEFECTS.md entry's quotation still resolves.

AUTHORING.md §10 states the rule this performs:

    An open entry's quoted instruction must still resolve in the section it cites

...compared with whitespace collapsed, scoped to the cited section rather than to
the file, failing closed when the citation cannot be resolved, and resolving on the
section number so that a descriptive gloss cannot manufacture the unresolvable case.

The gate landed at `d87f9e9`. `src/validation/defects.ts` performs this rule and
`ak validate` seats it, so this file is no longer the only enforcement either rule
has -- and it is not redundant and not the gate's source. It is a second,
independently written implementation, kept for the one thing the gate cannot do:
the differential backtest below runs over git history, and a check inside
`ak validate` only ever sees the tree it is run in.

Agreement recorded at `d87f9e9`. Over an extract of `f04a4d0` carrying HEAD's
`src/`, `ak validate` raises `defects.entry-quotation-dangling` twice, naming the
same entry and the same two quotations this probe names, and raises neither at
`f04a4d0~1`. Two implementations, one real historical regression, same answer in
both directions. That is the whole reason to keep two.

An earlier version of this header said the gate landing would make this probe
redundant. It was written before the gate existed and it was wrong about why this
file is worth keeping.

Usage:
    python3 research/probes/defect-entries.py            # check the working tree
    python3 research/probes/defect-entries.py --self-test # prove the probe discriminates
"""
import os
import re
import subprocess
import sys
from pathlib import Path

# parents[2] from research/probes/. AGENT_KIT_ROOT overrides it, so the probe can
# run against a tree extracted with `git archive` rather than only against a checkout.
ROOT = Path(os.environ.get("AGENT_KIT_ROOT") or Path(__file__).resolve().parents[2])
DEFECTS = ROOT / "CONTRACT-DEFECTS.md"
CONTRACT = ROOT / "AUTHORING.md"

SECTION_HEADING = re.compile(r"^(#{2,3})\s+(\d+(?:\.\d+)?)[.\s]")
# Resolve on the number and ignore any gloss: `§5 (Provenance law)` -> "5".
SECTION_REF = re.compile(r"§(\d+(?:\.\d+)?)")

collapse = lambda s: re.sub(r"\s+", " ", s).strip()


def sections(contract: str) -> dict:
    """Map '5' / '12.2' to that section's own text."""
    lines = contract.split("\n")
    marks = [
        (i, len(m.group(1)), m.group(2))
        for i, l in enumerate(lines)
        if (m := SECTION_HEADING.match(l))
    ]
    out = {}
    for idx, (i, lvl, num) in enumerate(marks):
        nxt = len(lines)
        for j, l2, _ in marks[idx + 1:]:
            if l2 <= lvl:
                nxt = j
                break
        # A subsection ends at the next heading of any level.
        if lvl == 3 and idx + 1 < len(marks):
            nxt = min(nxt, marks[idx + 1][0])
        out[num] = "\n".join(lines[i:nxt])
    return out


def entries(defects: str) -> list:
    """Every `### ` entry under the Open section, as (title, body)."""
    out, title, buf = [], None, []
    for ln in defects.split("\n"):
        if ln.startswith("### "):
            if title:
                out.append((title, "\n".join(buf)))
            title, buf = ln[4:].strip(), []
            continue
        if title is not None:
            buf.append(ln)
    if title:
        out.append((title, "\n".join(buf)))
    return out


def quotes_with_section(body: str) -> list:
    """Each blockquote paired with the most recent section cited before it."""
    pairs, cur, sec = [], [], None
    for ln in body.split("\n"):
        if ln.startswith(">"):
            cur.append(ln.lstrip("> ").rstrip())
            continue
        # Flush first: a section named on the line AFTER a blockquote is not that
        # quotation's section, and updating `sec` before flushing would make it one.
        if cur:
            pairs.append((sec, " ".join(cur)))
            cur = []
        for m in SECTION_REF.finditer(ln):
            sec = m.group(1)
    if cur:
        pairs.append((sec, " ".join(cur)))
    return pairs


def check(defects: str, contract: str, label: str, force_section=None) -> tuple:
    """Return (failures, quotations_examined, entries_examined). Report all three:
    zero failures is not a pass when nothing was examined, and an entry that
    carries no quotation contributes no quotation to count."""
    secs = sections(contract)
    bad = seen = ents = 0
    for title, body in entries(defects):
        ents += 1
        quotes = quotes_with_section(body)
        # §10: "Every entry quotes the instruction it is filed against." An entry
        # carrying no quotation is that violation, and counting only quotations
        # would let it contribute nothing and vanish behind the entries that do.
        if not quotes:
            bad += 1
            print(f"  UNQUOTED      {title!r}: quotes nothing, so there is nothing to resolve")
            continue
        for sec, quote in quotes:
            seen += 1
            sec = force_section or sec
            # Fail closed: an unresolvable citation is the failure, never a reason
            # to widen the search to the whole file.
            if not sec:
                bad += 1
                print(f"  UNRESOLVABLE  {title!r}: names no section: {collapse(quote)[:60]!r}")
                continue
            if sec not in secs:
                bad += 1
                print(f"  UNRESOLVABLE  {title!r}: cites §{sec}, which does not exist")
                continue
            hay, pos = collapse(secs[sec]), 0
            for frag in (f for f in quote.split("[...]") if collapse(f)):
                f = collapse(frag)
                i = hay.find(f, pos)
                if i < 0:
                    bad += 1
                    print(f"  DANGLING      {title!r} in §{sec}: {f[:70]!r}")
                    break
                pos = i + len(f)
    if ents == 0:
        print(f"  [{label}] VACUOUS: no open entries -- 0 failures means nothing")
    else:
        print(f"  [{label}] {bad} failure(s) over {seen} quotation(s) in {ents} entry(ies)")
    return bad, seen, ents


def at(rev: str, path: str) -> str:
    r = subprocess.run(["git", "-C", str(ROOT), "show", f"{rev}:{path}"],
                       capture_output=True, text=True)
    return r.stdout


def self_test() -> int:
    """Prove the probe discriminates. Without this, a silent run is ambiguous
    between 'nothing is wrong' and 'nothing is being checked'."""
    contract = CONTRACT.read_text()
    secs = sections(contract)
    # Quote a real sentence out of §5 so the positive cases are genuinely resolvable.
    quotable = next(l.strip() for l in secs["5"].split("\n")
                    if l.strip() and not l.startswith("#") and len(l.strip()) > 40)

    def entry(title, lead, quote):
        return f"### {title}\n\n{lead}\n\n> {quote}\n\nTrailing prose.\n"

    cases = [
        # title                      lead                            quote                fails quotes
        ("cites the section",        "§5 requires:",                 quotable,            0, 1),
        ("gloss on the citation",    "§5 (Provenance law) requires:", quotable,           0, 1),
        ("names no section",         "The provenance section requires:", quotable,          1, 1),
        ("cites a missing section",  "§99 requires:",                quotable,            1, 1),
        ("quotation never resolved", "§5 requires:",                 "a purple elephant", 1, 1),
        ("quotes nothing at all",    "Filed against §5.",            None,                1, 0),
    ]
    failed = 0
    print("=== discrimination: six entries, four of which must fail ===")
    for title, lead, quote, want, want_q in cases:
        body = (f"### {title}\n\n{lead}\n\nNo blockquote here.\n" if quote is None
                else entry(title, lead, quote))
        got, seen, ents = check(body, contract, title)
        if got != want or seen != want_q or ents != 1:
            print(f"  !! expected {want} failure(s) over {want_q} quotation(s) in 1 entry,"
                  f" got {got} over {seen} in {ents}")
            failed += 1

    # A section named after a blockquote is not that quotation's section. This was a
    # real defect in this probe: `sec` was updated from the closing line before the
    # quotation was flushed, so a trailing mention silently re-scoped the match.
    print("=== scoping: a trailing mention must not re-scope the quotation ===")
    trailing = (f"### trailing mention\n\n\u00a75 requires:\n\n> {quotable}\n\n"
                "Unrelated, and it mentions \u00a712.\n")
    pairs = quotes_with_section(trailing.split("\n\n", 1)[1])
    if [sec for sec, _ in pairs] != ["5"]:
        print(f"  !! expected the quotation scoped to \u00a75, got {[s for s, _ in pairs]}")
        failed += 1
    else:
        print("  quotation stayed scoped to \u00a75 despite a trailing \u00a712")

    print("=== differential backtest: f04a4d0 against its parent ===")
    # f04a4d0 is the §12.5 reference-packs ruling. It contains no test; what is
    # differential is the revision pair -- two entries existed at f04a4d0 whose
    # quotations that commit had just invalidated, and did not exist before it.
    after, _, _ = check(at("f04a4d0", "CONTRACT-DEFECTS.md"), at("f04a4d0", "AUTHORING.md"), "f04a4d0")
    before, _, _ = check(at("f04a4d0~1", "CONTRACT-DEFECTS.md"), at("f04a4d0~1", "AUTHORING.md"), "f04a4d0~1")
    if not (after > 0 and before == 0):
        print(f"  !! expected failures at f04a4d0 and none at its parent; got {after} and {before}")
        failed += 1

    print("PASS: the probe discriminates" if not failed else f"FAIL: {failed} case(s)")
    return failed


def main() -> int:
    if "--self-test" in sys.argv:
        return 1 if self_test() else 0
    if not DEFECTS.exists():
        print("CONTRACT-DEFECTS.md not found")
        return 1
    print(f"=== {DEFECTS.name} at the working tree ===")
    bad, seen, ents = check(DEFECTS.read_text(), CONTRACT.read_text(), "working tree")
    if ents == 0:
        print("Run --self-test: a vacuous run is not evidence the rule holds.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
