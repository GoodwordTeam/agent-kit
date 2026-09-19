# Batch 2 brief — review personas

Twenty-two role bodies: the fifteen `code-review/` seats and the seven `doc-review/` seats.

## What governs this batch

`AUTHORING.md` governs. §12.2 governs role bodies; §10 governs the process you are working
under; §11 and §12.4 govern the handback. This brief does not reproduce any of it, and where
this brief and `AUTHORING.md` appear to disagree, `AUTHORING.md` wins and the disagreement is a
defect in this brief — report it rather than reconciling it yourself.

That rule is not decorative. Batch 1's brief restated a heading name that the contract had
moved, and the writer, correctly following the more specific instruction, carried the wrong
heading into seven files. The writer was not at fault. Briefs restate nothing for that reason.

## Your inputs

| | |
|---|---|
| Dossier | `research/dossiers/review-personas.md` |
| Catalog | the twenty-two `roles:` entries with `batch: 2` |
| Contract | `AUTHORING.md` |
| Schemas | `schemas/` |
| Rulings | `policies/resolved-conflicts.yaml` |

Nothing else. Not the donor tree beyond the pinned files the dossier cites, not batch 1's
drafts, not this session's discussion.

## Facts about this batch you cannot get from those files

**§12.2 changed after the dossier was written.** Its mandated prohibition rows were split
following a strain report from batch 1's writer. Read the section as it stands; do not pattern
match against batch 1's committed role bodies, which predate the split and are being revised.
The dossier is unaffected — it cites the contract by name rather than restating it.

**Provenance notation is being corrected in the dossier, not by you.** Its citations used donor
aliases and abbreviated commits that do not resolve against `provenance/upstream.lock.yaml`.
`personas` is fixing the notation; the underlying donor paths were spot-checked at the pin and
are correct. Work from the corrected dossier. If you find a source string that does not resolve,
that is a dossier defect — report it, and do not repair it by guessing the expansion.

**Twelve Pocock citations have no resolved category yet.** They point at
`research/sources/pocock-code-review-two-axis.SKILL.md`, a recovered in-repo copy that differs
from the pinned upstream file in 58 of its ~88 lines. It is a different artifact, so the pin is
not its source even though a plausible-looking path exists there. `provmap` is ruling on how a
vendored in-repo source is recorded. Where the dossier flags one of these, leave the provenance
slot empty and list it in your handback. Do not invent a spelling, and do not cite the pin.

**One writer authors all twenty-two.** That is deliberate: the seats' boundaries against each
other are the hard part of this batch, and they cannot be drawn consistently by writers who
cannot see each other's files.

## The two failure modes I expect, named so you can report them rather than absorb them

**Boundary restatement across a large panel.** Fifteen seats that must each distinguish
themselves from their neighbours will tend either to enumerate each other or to go vague.
§12.2's rule for this was written before any panel larger than three seats existed, so it is
preventive rather than proven. §10 records the escalation: if the seats end up restating each
other's boundaries, the panel needs one central boundary table the roles reference, and that is
a decision to escalate rather than to absorb. Escalate early. A batch of twenty-two is expensive
to redo.

**Uniformity that is almost right.** Several of these seats resemble each other closely enough
that a correct-looking body can be produced without deciding what the seat actually judges.
Batch 1's writer flagged this as the sharper risk for this panel: nothing stops an author who is
writing plausible prose. Where you cannot state a seat's question in one sentence without
reaching for a neighbour's, that is a finding about the seat, and it goes in the handback.

## Review

An independent reviewer follows, reading the produced files, the dossier and `AUTHORING.md` —
never your narrative. At most two fix cycles; anything open after the second is reported with its
evidence. `ak validate` gates the commit, and an open item in your report is a normal outcome.
A stub written to make the report look clean is not.
