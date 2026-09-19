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
same artifact as a stale one.

---

## Open

### §12.2 states that no length check measures role and protocol bodies. One does.

*Filed by the batch-2 writer (twenty-two review-persona role bodies), against `AUTHORING.md` at
`a5f9f2ee3b6f0ec7f77126f3a63d974ed69e4c8a`.*

**1. The instruction followed.** §12.2, under "On length, and it matters because batch 1 built an
exception out of this":

> §1's targets bind protocol and role bodies as contract — §12 says §1 applies unchanged — but
> **nothing measures them**: `checkBudget` iterates the `skills` section alone
> (`src/validation/budget.ts`), so a `PROTOCOL.md` or `ROLE.md` of any length passes silently. Two
> consequences, and the second is the one that bit. A writer does not treat the silence as
> permission. And **a writer does not record an exception to a cap that was never applied to its
> file** — an exception argues with a gate, and there is no gate here, so the record asserts a
> constraint the validator never had and a later reader inherits a justification for a rule that
> was not in force.

**2. What following it produced.** The quoted premise is false at the revision above.
`src/validation/budget.ts` (at `3e29c756261421b14ed95ea3cb3a66722ee4caad`) iterates three sections,
not one:

```ts
const BUDGETED: ReadonlyArray<{ section: DirectorySection; over: string; cap: string }> = [
  { section: "skills",    over: "budget.skill-over-target", cap: "budget.skill-over-cap" },
  { section: "protocols", over: "budget.body-over-target",  cap: "budget.body-over-cap" },
  { section: "roles",     over: "budget.body-over-target",  cap: "budget.body-over-cap" },
];
```

A role or protocol body over 150 lines warns and over 300 fails. This is not latent: `bun run ak
validate` at `568433b295f7db2d14f44248c28babcd31db3e2e` already emits one
`budget.body-over-target` against `protocols/review-delta/PROTOCOL.md` at 151 lines. The two
consequences §12.2 builds on the premise therefore rest on nothing, and the second one now points
the wrong way. §1 gained a paragraph at `a5f9f2e` instructing the opposite: *"The warning asks one
question: is there material in this body that belongs behind a `references/` file? Answer it by
looking, and record the answer where the body's review is recorded."* §12 says §1 applies to role
and protocol bodies unchanged. So a role writer over 150 lines is told by §1 to record the answer
and by §12.2 not to record it, and §12.2's reason for the prohibition — "there is no gate here" —
is the part that is untrue.

This is not a race between two landings. `budget.ts` landed at 2026-09-19 15:41:27;
`AUTHORING.md`'s edits at 15:51:37 and later did not update the passage.

**3. What the correct behavior appears to be.** §12.2's length passage should state that §1's
target and cap are measured against `PROTOCOL.md` and `ROLE.md` by `checkBudget`
(`src/validation/budget.ts`, rules `budget.body-over-target` and `budget.body-over-cap`), and
should defer to §1's new paragraph for what a writer does about a warning, rather than prohibiting
the record. The prohibition §12.2 is actually reaching for — batch 1's defect — survives the
correction intact and should be kept in the form §1 now gives it: a body is never shortened to
clear the number, and a waiver is never manufactured. What must go is the claim that the cap was
never applied to the file, because it is now applied.

**Batch-2 impact, so the ruling can be sized.** No batch-2 body is over 150 lines, so nothing in
the batch depends on the resolution. This entry blocks the batch-2 commit only by §10's rule, not
by any property of the produced files.

## Resolved

None yet.
