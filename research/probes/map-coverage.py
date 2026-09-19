#!/usr/bin/env python3
"""Which parts of the governing design no conversation-map row points at.

Run from the repo root. Reports every numbered section of the plan that no row in
`provenance/conversation-map.yaml` claims, and fails on any `plan §N` or `arch §N`
locator that names a section the plan does not have.

WHAT THIS IS NOT
----------------
This is not a capability census and cannot become one. `ak validate` already proves
each row is well-formed and that each locator resolves; what nobody can prove is
that no capability in the sources is *missing* from the map, because nothing
enumerates capabilities. A capability is a unit of intent, and intent is not
lexically marked -- one section can carry three of them, and one sentence can carry
one. The six rows added on 2026-09-19 are the worked example: the quote-the-line
gate split into two rows because its schema half and its policy half land in
different destinations, and no instrument reading plan prose would have known to
split it.

So this measures the one thing that *is* enumerable: territory in the source that
no row has claimed. An unclaimed section is a place a gap could be hiding. A
claimed section is not evidence of anything, because one row claims a whole
section however many capabilities are in it. The false negative is the dominant
error and it is structural, not a tuning problem. Read a clean run as evidence
about this probe, not about the map.

WHY THE PLAN AND NOT THE TRANSCRIPT
-----------------------------------
Both design sources were measured. The plan works because a numbered heading is an
author's own claim that the text beneath it is one unit, so the enumeration is a
closed set someone already drew: 37 sections, of which 11 are unclaimed, totalling
255 lines -- a list you read in two minutes.

The transcript does not work and the numbers say why. 846 of its 2265 lines are
cited (37%). Of the 1419 that are not, 424 are scraped page chrome before the
conversation starts, 575 are blank, and 210 carry a denylisted model-routing term,
which the package excludes on purpose and records in twelve `excluded` rows. The
451 substantive lines left over arrive in 335 separate runs, the longest of them
nine lines. A line-range union over a conversation shatters; there is no unit in it
for a coverage metric to be about. Reporting it would be reporting noise, so this
probe does not.

BACKTEST
--------
Run against the map as it stood at 53857cf^ -- before batch 2's writer found, by
reading, that the suppression catalogs, the quote-the-line gate and the no-menus
rule had no row -- this reports 15 unclaimed sections including §5.5, §6.1 and
§6.5. Those are exactly the three the six new rows cite. The probe would have named
the region of the gap before anyone read for it, which is the reason it exists.
It did not name the capabilities, and could not have; that part stays human.
"""

import io
import re
import sys

import yaml

PLAN = "research/sources/engineering-skills-repo-plan.md"
MAP = "provenance/conversation-map.yaml"

# `## 6.3 Delta closure`, `### §7.5 CI repair ...`. AGENTS.md cites this same file
# as `arch §N` and the map's header calls it `plan §N`; both spellings reach it, so
# both are read here rather than picking a winner the validator does not pick.
HEADING = re.compile(r"^#{2,6}\s+(?:§\s*)?(\d+(?:\.\d+)*)[.\s)]+(.*)$")
REFERENCE = re.compile(r"^\s*(?:plan|arch)\s+§(\d+(?:\.\d+)*)")


def sections(path):
    """(id, title, first line, last line) for every numbered heading, in file order."""
    lines = io.open(path, encoding="utf8").read().split("\n")
    found = [(m.group(1), m.group(2).strip(), i) for i, l in enumerate(lines, 1) if (m := HEADING.match(l))]
    out = []
    for n, (sec, title, start) in enumerate(found):
        end = found[n + 1][2] - 1 if n + 1 < len(found) else len(lines)
        out.append((sec, title, start, end))
    return out


def cited(path):
    """Every section id named by a row's locator. `acceptance_test` prose is not a locator."""
    rows = yaml.safe_load(io.open(path, encoding="utf8").read())["capabilities"]
    out = set()
    for row in rows:
        for part in str(row.get("locator", "")).split(";"):
            if m := REFERENCE.match(part):
                out.add(m.group(1))
    return out


def claims(refs, sec):
    """A row citing §6.1 claims §6, because a subsection is part of its parent."""
    return any(ref == sec or ref.startswith(sec + ".") for ref in refs)


def main():
    plan = sections(PLAN)
    refs = cited(MAP)
    known = {sec for sec, _, _, _ in plan}

    dangling = sorted(refs - known)
    for ref in dangling:
        print(f"DANGLING  plan §{ref} is cited by a row and is not a section of {PLAN}")

    unclaimed = [(sec, title, start, end) for sec, title, start, end in plan if not claims(refs, sec)]
    print(f"{'section':10s} {'lines':>13s}  title")
    for sec, title, start, end in unclaimed:
        print(f"§{sec:9s} {f'L{start}-{end}':>13s}  {title}")

    span = sum(end - start + 1 for _, _, start, end in unclaimed)
    print()
    print(f"{len(plan)} numbered sections, {len(plan) - len(unclaimed)} claimed by some row, {len(unclaimed)} unclaimed ({span} lines).")
    print("Unclaimed is a place to look, not a defect: a section can be structure rather than capability.")
    print("Claimed is not coverage: one row claims a section however many capabilities are inside it.")
    return 1 if dangling else 0


if __name__ == "__main__":
    sys.exit(main())
