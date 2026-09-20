# Contract defects

Where a writer reports that following `AUTHORING.md` produced a wrong result.

**`AUTHORING.md` §10 governs this file** — what counts as a defect, the three things an entry
records, and the rule that an open entry blocks its batch commit until the contract owner rules.
Read it there. It is deliberately not restated here: a restatement that drops a clause reads as
complete, and this file is the one place a writer arrives already believing they know the rule.

The file lives at the repository root for one reason. An entry appears in the diff of the very
commit that would otherwise bury it, so readership does not depend on anyone remembering a path.
A contract defect filed inside a commissioned artifact is the failure mode §10 names, and batch 1
produced a worked example of it: a correct diagnosis about §5's `target:`/`path:` key was filed in
a provenance fragment header, §5 was fixed at `abeb94e`, and nothing was obliged to read the report
so nothing retired it. It sat there asserting something untrue about the contract until a reviewer
found it.

An entry is retired by deleting it in the commit that resolves it, with the ruling in the commit
message. Entries are not marked resolved and left in place — a resolved entry that stays is the
same artifact as a stale one. There is no resolved section here, for that reason.

Deleting an entry does not lose it. `git log -- CONTRACT-DEFECTS.md` is the index of every defect
this contract has ever had, and each resolving commit carries the entry it retired along with the
ruling. Read it there before concluding from an empty list that nothing has been found.

---

## Open
### §11 lists four skill-body rules as decided by the commands; nothing performs them

**The instruction followed.** §11 splits its checklist in two and tells a writer not to
hand-verify the first half:

> **Decided by the commands above.** Read these when one of them reports, not before.

Two of the bullets in that half are:

> The ten required sections are present, in order, spelled exactly — `body.missing-section`,
> `body.sections-out-of-order`, `body.section-inserted`.

> `## Hard gates` carries an anti-rationalization table — `body.missing-anti-rationalization-table`.

**What following it produced.** No rule in the tree emits any of those four ids for a skill body.
`checkBodyShapes` (`src/validation/bodies.ts`) ends in a loop over `["protocols", "roles"]`, and
`checkSections` and `hasAntiRationalizationTable` are reached from nowhere else. The only section
lists in that file are `PROTOCOL_SECTIONS` and `ROLE_SECTIONS`; the ten headings a `SKILL.md`
carries appear in no list the validator reads.

Measured on `skills/super-scout/SKILL.md` at `566a40f`, by removing the thing under test and
watching the assertion fail. Renaming `## Hard gates` to `## Gates that are hard` and renaming
`## Stop conditions` to a second `## Limits` leaves a body with eight of the ten required headings,
one heading the contract does not have, one required heading duplicated, and the
anti-rationalization table sitting under a heading no contract names. `bun run src/cli.ts validate`
reported 0 errors, 9 warnings and 44 notes on that body — the same counts as the unmutated body,
with no `body.*` rule named anywhere in the run. The headings were restored before anything was
committed, and the probe reproduces on any skill body.

The cost is the instruction rather than the gap. A writer who reads §11 as written stops checking
the ten headings and the table by hand, on the stated ground that a command already decided them.
A body missing a required section therefore ships, and it ships from the writers following the
contract most carefully.

**What the correct behavior appears to be.** One of two, and neither is the writer's to choose:
either `checkBodyShapes` seats `skills` against the ten headings and the table the way it seats
protocols and roles, or those two bullets move into §11's second half, "Not checked by anything",
carrying the sentence every entry there carries about what the nearest instrument does instead.

Filed by the batch-4 writer. The four bodies of this batch were hand-verified against the required
section list and the table rule rather than relying on the report §11 promises.
