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

**§12.2's mandated prohibition rows are now four, not two.** Two are mandatory in every role;
two are conditional on a closed list. Read the section as it stands. Batch 1's seven role bodies
have been revised to match and are a usable worked example of the current shape — they are
committed at `9a63e19` and `6c3c60c` but not yet through review, so treat them as an illustration
of form, never as authority for content. §12.2 is the authority.

**The dossier's provenance notation is corrected and committed.** Every citation now uses the
`donor@fullsha:path` form the validator parses; 119 occurrences across 35 distinct source strings,
none unresolved. Work from it as it stands. If you still find a source string that does not
resolve, that is a dossier defect — report it and do not repair it by guessing the expansion.

**The twelve Pocock citations resolve at the pin. Cite them as they stand.** An earlier version
of this brief told you to leave those provenance slots empty and not cite the pin, on the grounds
that the recovered in-repo copy differs from the pinned upstream file in 58 of ~88 lines. That
figure counted punctuation and reflow. Normalized, the two artifacts differ substantively in three
places, none of which any of the twelve citations depends on; two line ranges carried the recovered
file's numbering and have been re-pointed. `provmap` and `personas` established this independently
of each other. Following the earlier instruction would have stripped twelve valid provenance rows,
which is why it is corrected here rather than left for you to discover.

**No open provenance category blocks this batch.** The question of how a vendored in-repo source is
recorded is decided-but-unimplemented, and it has no users: the one row that would have needed it
resolved without it. If you reach a citation that needs a category that does not exist, you will
get a loud `provenance.malformed-source` failure rather than silent acceptance — stop and report it.

**One writer authors all twenty-two.** That is deliberate: the seats' boundaries against each other
are the hard part of this batch, and they cannot be drawn consistently by writers who cannot see
each other's files.

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

§10 governs the review — who the reviewer is, what it is given, what it must record, and what
happens when the cycle limit is reached. Read it there. This brief states none of it, and the
reason is worth your attention rather than your trust.

The previous version of this section summarised §10 in four lines and narrowed it three times.
It listed three reviewer inputs where §10 lists four, dropping the prior findings that §10 calls
*"not optional and not the writer's to withhold"*. It reduced the cycle limit to "report what is
open", dropping the explicit blocked-or-replan decision and the route that makes a twice-failing
batch a defect in **this brief** rather than a verdict on your work. And it omitted the rule that
a reviewer records the revision it read.

Each clause that survived was the one a reader would have supplied unprompted. Each clause that
vanished was the one the rule exists to pin down. The first would have re-imposed on your reviewer
exactly the amnesia that cost batch 1 a cycle, in a brief written after that cycle was paid for.

That is what a four-line summary of a governing section costs, and it is why the rule at the top of
this brief — that it restates nothing — is load-bearing rather than stylistic. Apply the same
suspicion to your own bodies: §12.2 will tempt you to paraphrase a neighbouring seat's boundary
instead of citing it, and the paraphrase will read as complete.
