#!/usr/bin/env python3
"""AUTHORING.md's formatting battery: line width, backtick parity, blank runs, the §3.1 freeze.

Every check names the population it owns and reports a figure, never a bare pass. A check
that cannot say how many things it looked at cannot tell a clean file from a check that
examined nothing, and three of the four checks here would report identically against an
empty string.

WHAT A CLEAN RUN IS EVIDENCE OF
-------------------------------
Formatting, and only formatting. Nothing here reads a claim, resolves a citation, or knows
whether a sentence is true. A run is evidence that no line got longer than the file's own
floor, that no inline-code span was left open, that no paragraph boundary doubled, and that
§3.1's bytes are the ones pinned. It is evidence of nothing else, and in particular a clean
run says nothing about the four checks `ak validate` performs on this file.

WHAT IT DOES NOT PIN
--------------------
The 100-column target is a convention. No gate in `src/` enforces it, this script is the
only thing that measures it, and a file that fails here still validates and still builds.
The §3.1 check is a hash of one section against one revision: it catches an edit to those
bytes and says nothing about any other section. The population is every line outside a
fenced block that is not indented four spaces and does not begin a table row -- so code
blocks, indented examples and tables are excluded by construction and can be any width.

THE BASELINE IS A FLOOR SOMEONE WALKED THE FILE DOWN TO, NOT AN INHERITANCE
--------------------------------------------------------------------------
The over-width baseline is derived at runtime from `BASELINE_PIN`, never carried as a
constant, because a threshold quoted without its derivation is a figure without a revision
and this script exists to enforce the opposite. Measured across every revision that touched
this file: the count climbed 10 -> 21 -> 30 -> 45 as the contract was written, peaked at 59
at `b1d4160`, and was walked back down over eight commits to 45 at `7f159d8`, where it has
held. So 45 is not a set of untouchable inherited lines. It is the level the file was last
worked down to, and the check gates on *no higher than* for that reason: the file has
already demonstrated it can climb, and every climb so far was invisible to the edit that
caused it and to the reader of the rendered prose.

When a run reports fewer than the baseline, the pin is stale rather than the file wrong.
Move `BASELINE_PIN` to the commit that lowered it, in the commit immediately after. Not in the
lowering commit itself: it would have to contain its own sha, and a self-naming pin has no
fixpoint. This instruction said "in that commit" until `36f0697` made it necessary to follow,
which is when it turned out to be unfollowable -- a remedy stated in a form nobody can execute,
written by someone who never had to run it. Two adjacent commits is the executable form, and the
floor is only ever read from the earlier one.

IT HAS NO TEMP ROOT, AND THAT IS LOAD-BEARING
---------------------------------------------
Every reading here comes from `git show` or from the file in place, so this script never holds a
directory under an unresolved name. That matters because the trap that made a sibling suite green
where the repository lives and red in every extract needs two terms together: a temp root held
under its unresolved name, and an external process reporting paths back resolved. In-process
Python never sees `/private/var`, so the mismatch cannot arise -- but it arrives the moment an
extract does. Measured: `tempfile.mkdtemp()` returns `/var/folders/...`, whose realpath is
`/private/var/folders/...`, and `TemporaryDirectory().name` carries the same unresolved form. If
an extract is ever added here, take the root as `os.path.realpath(tempfile.mkdtemp())`.

HOW TO RE-DERIVE
----------------
    ./research/probes/authoring-format.py            # the working tree
    ./research/probes/authoring-format.py <revision> # any revision, re-derivable

A figure taken without a revision argument is a measurement of the working tree, which is a
timestamp and not a revision: several lanes write to this tree, and the number is stale
before it is read. The output says which it measured. Quote the second form.

REFLOWING AFTER AN EDIT
-----------------------
Editing a paragraph leaves it ragged, and rewrapping it is where this file gets damaged rather
than measured. Two failure modes, both met in practice on 2026-09-21:

  - A wrap that breaks inside a backtick span splits a code span in half and shows up here as
    an odd-backtick count, which is the loud case.
  - A wrap built by splitting into tokens and rejoining with spaces detaches punctuation that
    followed a span: `donor_sources[]`, or  ->  `donor_sources[]` , or. Nothing in this probe
    catches that. Backticks stay balanced, the line stays under width, and the damage is two
    characters wide in a file of 160,000.

`safe_wrap` below is the reflow that cannot do either. It breaks only at spaces outside a
backtick span, and it asserts that its output differs from its input in whitespace alone --
the positive control on the wrapper itself, which is what turns the second failure from
silent into an exception. Reflow with it, or by hand; not with textwrap, which knows nothing
about spans.

A third mode, met the same day and not caught by that assertion: whitespace alone is exactly
what a paragraph break is made of. Handed two paragraphs, `safe_wrap` flattened the blank line
between them and welded them into one, and the assertion passed, because it compares
non-whitespace characters and a lost blank line is invisible to it. The probe passed too --
`double blank lines` counts breaks that appear, never one that vanishes. So it raises on a
blank line in its input now, and the caller wraps paragraph by paragraph. The general shape is
the one this file keeps meeting: a control that compares the thing it was built to protect is
silent about the dimension it normalises away first.
"""
import hashlib
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILE = "AUTHORING.md"

# The revision whose over-width count is this check's floor. See the docstring: this is the
# commit that last lowered the count, not the commit that introduced the rule.
BASELINE_PIN = "36f0697"

# §3.1's anti-rationalization table is frozen: it is the one section every skill body copies
# verbatim, so an edit here silently invalidates every copy. The pin is the revision its
# current bytes were agreed at.
SEC31_PIN = "170fab6"


def safe_wrap(text: str, width: int = 100) -> str:
    """Reflow prose without altering a character. See the docstring's reflow section.

    Breaks only at spaces outside backtick spans, so a code span is never split and
    punctuation following one is never detached. The assertion is the control: it fails
    loudly on the exact defect the probe itself cannot see.

    Takes one paragraph. A blank line is whitespace, so flattening one is a change the
    assertion below cannot see and the probe does not count; it is refused here instead.
    """
    if "\n\n" in text.strip():
        raise ValueError(
            "safe_wrap takes one paragraph: a blank line would be flattened, and neither "
            "the assertion below nor the probe's blank-line count would report it. "
            "Split on blank lines, wrap each, and rejoin with '\\n\\n'."
        )
    flat = " ".join(text.split())
    inside = False
    breaks = set()
    for i, ch in enumerate(flat):
        if ch == "`":
            inside = not inside
        elif ch == " " and not inside:
            breaks.add(i)
    lines, start = [], 0
    while len(flat) - start > width:
        brk = max((i for i in breaks if start < i <= start + width), default=None)
        if brk is None:
            # An atomic span longer than the remaining width: overflow rather than split it.
            brk = min((i for i in breaks if i > start + width), default=None)
            if brk is None:
                break
        lines.append(flat[start:brk])
        start = brk + 1
    lines.append(flat[start:])
    out = "\n".join(lines)
    assert "".join(out.split()) == "".join(text.split()), "safe_wrap altered characters"
    return out


def show(rev: str) -> str:
    """`<rev>:AUTHORING.md`, read through git rather than the filesystem.

    Written `f"{rev}:{FILE}"` and never interpolated into a shell string. In zsh
    `$R:evals/x` expands to `vals/x` -- `:e` is a modifier taking the extension of `$R` --
    so a revision-qualified path built in a shell can degrade into a plain path that also
    resolves, exits 0, and yields a faithful measurement of the wrong file. `subprocess`
    with a list argv has no shell to do that.

    The family is wider than `:e`, and its members do not fail alike. Measured here with
    `R=33e59fe`: `$R:AUTHORING.md` expands to `<repo>/33e59feUTHORING.md`, because `:A` takes
    the absolute path of `$R` and the rest of the word is appended. That one is loud -- no such
    file exists and git refuses. `:e` is the quiet one, because the name it produces can exist.
    A third member breaks that pairing. `$R:src/denylist.ts` hits `:s`, the substitution modifier,
    and zsh aborts the word with `bad substitution` -- loud, but only on stderr, while the pipeline
    it sat in kept running, so `git show ... | grep -c plans` counted an empty stream and printed
    `0`. Measured in a four-revision loop, it rendered as a clean column of zeros: the answer a
    working command would have given, in the channel a reader quotes from. So loud and quiet are
    not properties of the trap. They are properties of where the failure lands relative to where
    the figure is read, and this member is loud where nobody looks and quiet where it counts.
    So a shell form that worked once is not evidence about the next path written the same way:
    whether the trap is caught depends on whether the mangled name happens to resolve, or on
    whether the complaint reaches the stream being read -- properties of the run rather than of
    the code. `${R}:...` survives all of them.
    """
    out = subprocess.run(["git", "-C", str(ROOT), "show", f"{rev}:{FILE}"],
                         capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"authoring-format: cannot read {FILE} at {rev}: {out.stderr.strip()}")
    return out.stdout


def scan(text: str, report: bool):
    """Returns (prose lines examined, over-width, odd backticks, double blanks)."""
    lines = text.split("\n")
    over = ticks = blanks = prose = 0
    fence = False
    for i, line in enumerate(lines, 1):
        if line.strip().startswith("```"):
            fence = not fence
            continue
        if fence:
            continue
        if line.count("`") % 2:
            ticks += 1
            if report:
                print(f"  ODD BACKTICK  {i}: {line[:70]}")
        if line.startswith("    ") or line.strip().startswith("|"):
            continue
        prose += 1
        if len(line) > 100:
            over += 1
            if report:
                print(f"  OVER {len(line)}  {i}: {line[:60]}")
    for i in range(len(lines) - 1):
        if lines[i] == "" and lines[i + 1] == "":
            blanks += 1
            if report:
                print(f"  DOUBLE BLANK  {i + 1}-{i + 2}")
    return prose, over, ticks, blanks


def sec31(text: str):
    """The §3.1 subsection's bytes, heading included, or None if it cannot be found."""
    m = re.search(r"\n### 3\.1[^\n]*\n(.*?)(?=\n### |\n## )", text, re.S)
    return hashlib.sha256(m.group(0).encode()).hexdigest() if m else None


def main() -> int:
    rev = sys.argv[1] if len(sys.argv) > 1 else None
    if rev:
        text, subject = show(rev), f"revision {rev}"
    else:
        text = (ROOT / FILE).read_text()
        dirty = subprocess.run(["git", "-C", str(ROOT), "status", "--porcelain", "--", FILE],
                               capture_output=True, text=True).stdout.strip()
        subject = "working tree (a timestamp, not a revision" + \
                  (", and dirty against HEAD)" if dirty else ")")

    prose, over, ticks, blanks = scan(text, report=True)
    baseline = scan(show(BASELINE_PIN), report=False)[1]
    frozen = sec31(text) == sec31(show(SEC31_PIN))

    print(f"subject              : {subject}")
    print(f"prose lines examined : {prose}")
    print(f"over-width           : {over} (floor {baseline}, derived at {BASELINE_PIN})")
    print(f"odd backticks        : {ticks}")
    print(f"double blank lines   : {blanks}")
    print(f"3.1 frozen at {SEC31_PIN}  : {frozen}")
    print(f"rederive             : ./research/probes/authoring-format.py {rev or '<revision>'}")

    # Losing the subject is a fact about the instrument, not about the file, so it exits 1
    # whatever the other counts say. Keyed on the text being empty and on §3.1 being
    # unfindable, both of which were checked to fire: `"".split("\n")` is `[""]`, so a
    # population count can never reach zero here and a guard written against it would be
    # dead. `sec31` returning None also has to fail loudly -- compared against a pin that
    # is also None it would report frozen.
    if not text.strip() or sec31(text) is None:
        print("FAIL: this is not AUTHORING.md; the figures above are not evidence of anything.")
        return 1
    # Only when measuring the working tree. Against an older revision a lower count is the
    # history before the floor was raised, and telling a reader to move the pin backwards
    # would ratchet it the wrong way.
    if rev is None and over < baseline:
        print(f"NOTE: {baseline - over} fewer over-width lines than the floor. Move "
              f"BASELINE_PIN to this commit in the NEXT commit, so the floor ratchets. It "
              f"cannot go in this one: a commit cannot contain its own sha.")
    fail = over > baseline or ticks or blanks or not frozen
    print("FAIL" if fail else "PASS")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
