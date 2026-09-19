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
closed set someone already drew: 37 sections, and the unclaimed remainder is a list
you read in two minutes. The count is deliberately not written here -- it moves every
time a row lands, and a figure in this docstring would go stale silently while looking
authoritative. Run the probe; it prints the number it just measured.

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

THE SECOND INDEX, AND WHY IT ONLY ANNOTATES
-------------------------------------------
`policies/resolved-conflicts.yaml` is a second index over the same territory: each
ruling's `source.plan` names the sections it settles. Seven of the sections no map
row claims are cited by a ruling, so a reader sent to them blind re-derives
decisions already made. They are marked `see` for that reason.

They are marked, not moved. Filing them under a separate heading was built first
and reverted, because the backtest refused it: at 53857cf^ the demotion pulled §5.5
and §6.1 out of the primary list, and those are two of the three sections where a
writer afterwards found real capability gaps by reading. Both already had rulings
against them. So a ruling citing a section is evidence that one question inside it
was answered and is evidence of nothing at all about the rest -- treating it as
coverage would have pointed this probe away from the gaps it exists to find.

That is the load-bearing limit of the marker: it says what to read first. It never
says what to skip.
"""

import io
import re
import sys

import yaml

PLAN = "research/sources/engineering-skills-repo-plan.md"
MAP = "provenance/conversation-map.yaml"
RULINGS = "policies/resolved-conflicts.yaml"

# `## 6.3 Delta closure`, `### §7.5 CI repair ...`. AGENTS.md cites this same file
# as `arch §N` and the map's header calls it `plan §N`; both spellings reach it, so
# both are read here rather than picking a winner the validator does not pick.
HEADING = re.compile(r"^#{2,6}\s+(?:§\s*)?(\d+(?:\.\d+)*)[.\s)]+(.*)$")
REFERENCE = re.compile(r"^\s*(?:plan|arch)\s+§(\d+(?:\.\d+)*)")
# A ruling's `source.plan` is a bare list -- `"§7.1, §11"` -- with no `plan` prefix,
# because the field name already says which document. Different shape, same job.
RULING_REFERENCE = re.compile(r"§\s*(\d+(?:\.\d+)*)")


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


def resolved(path):
    """Every plan section named by a ruling's `source.plan`.

    A second index over the same territory. A ruling is a resolution rather than a
    capability, so it does not belong in the map and its sections are not merged
    into the map's count -- but a section a ruling settles has been dealt with, and
    reporting it as unexamined sends a reader to re-derive a decision already made.
    """
    doc = yaml.safe_load(io.open(path, encoding="utf8").read())
    out = set()
    for group in doc.values():
        if not isinstance(group, list):
            continue
        for ruling in group:
            if not isinstance(ruling, dict):
                continue
            source = ruling.get("source")
            if isinstance(source, dict):
                out.update(RULING_REFERENCE.findall(str(source.get("plan", ""))))
    return out


def claims(refs, sec):
    """A row citing §6.1 claims §6, because a subsection is part of its parent."""
    return any(ref == sec or ref.startswith(sec + ".") for ref in refs)


def main():
    plan = sections(PLAN)
    refs = cited(MAP)
    rules = resolved(RULINGS)
    known = {sec for sec, _, _, _ in plan}

    dangling = sorted(refs - known)
    for ref in dangling:
        print(f"DANGLING  plan §{ref} is cited by a row and is not a section of {PLAN}")

    unclaimed = [(sec, title, start, end) for sec, title, start, end in plan if not claims(refs, sec)]
    # Annotated, not demoted, and the backtest is why. Filing ruling-touched sections
    # under a second heading was tried first and reverted: at 53857cf^ it moved §5.5
    # and §6.1 out of the primary list, and those are two of the three sections where
    # a writer later found real capability gaps by reading. A ruling citing a section
    # settles one question inside it and says nothing about the rest, so demoting on
    # that signal would have pointed the reader away from the gaps this probe exists
    # to find. The marker earns its place by naming what to read first; it must not
    # decide what to skip.
    print(f"{'section':10s} {'lines':>13s}  {'ruling':>7s}  title")
    for sec, title, start, end in unclaimed:
        mark = "see" if claims(rules, sec) else ""
        print(f"§{sec:9s} {f'L{start}-{end}':>13s}  {mark:>7s}  {title}")

    touched = sum(1 for sec, _, _, _ in unclaimed if claims(rules, sec))
    span = sum(end - start + 1 for _, _, start, end in unclaimed)
    print()
    print(f"{len(plan)} numbered sections, {len(plan) - len(unclaimed)} claimed by a map row, "
          f"{len(unclaimed)} unclaimed ({span} lines), of which {touched} are cited by a ruling.")
    print(f"'see' means a ruling in {RULINGS} cites that section: read it first, because part of")
    print("the section is already settled. It is not a reason to skip the section -- a ruling")
    print("resolves one question inside it and is silent about every other.")
    print("Unclaimed is a place to look, not a defect: a section can be structure rather than capability.")
    print("Claimed is not coverage: one row claims a section however many capabilities are inside it.")
    return 1 if dangling else 0


if __name__ == "__main__":
    sys.exit(main())
