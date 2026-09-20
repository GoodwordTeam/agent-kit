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

### §7 names the wrong symbol for whether a tree is denylist-scanned, and `evals/` falls in the gap

**The instruction followed.** §7:

> `ak validate` fails on a hit anywhere outside the exempt prefixes, which are
> `DENYLIST_EXEMPT_PREFIXES` (`src/validation/content.ts`). The invariant that decides that list:
> nothing packaged into `dist/` is ever exempt, and an exemption exists only where the material's
> job is to quote what the denylist excludes — pinned sources, dossiers recording a donor's
> routing, and the tests that prove the scanner fires. Read the symbol rather than this sentence
> for whether a given tree is scanned.

**What following it produced.** The batch-3 brief required that the model-routing denylist not hit
anything the batch wrote, and §9 requires every skill author to create `evals/<skill-id>/<case-id>/`
with a `case.yaml` whose `execution.prompt` is free prose. Following §7's last sentence, I read
`DENYLIST_EXEMPT_PREFIXES` to decide whether that tree is scanned. It is
`["provenance/", "research/", "tests/", SCANNER_DEFINITION_FILE]`; `evals/` is not among them, so
by the quoted sentence a hit there fails `ak validate`. It does not. The symbol that decides
whether a tree is scanned is `SCAN_DIRS` in the same file, an allow-list of thirteen directories
that §7 never names, and `evals` is absent from it. `collect()` is called with `SCAN_DIRS` and
`isExempt()` only subtracts from what `collect()` already gathered, so a tree in neither list is
never offered to the scanner at all.

`research/probes/denylist-reach.ts` is the executable half, per this section's rule that a gap a
check can express is a probe rather than prose. It writes a term's own `probe` string into a copy of
the tree at three paths and runs the full validation: `docs/` is reported, `research/` is silent
because it is exempt, `evals/` is silent because nothing decided anything about it. It exits 1 while
that holds, 0 once a term under `evals/` is reported, and 1 without judging the tree if either
control disagrees with the scanner's own configuration. I scanned this batch's 44 files with
`matchTerms` by hand, because `ak validate` could not reach 27 of them.

**What the correct behavior appears to be.** I cannot tell which of the two is wrong, and §10 says
that is not mine to decide. Either §7's sentence is describing an allow-list as a deny-list and
should name `SCAN_DIRS` as the symbol to read — in which case `evals/` is deliberately out of
scope and §9 owes a writer that fact, since §9 commissions the tree — or `evals` belongs in
`SCAN_DIRS` and the omission is the defect. The two differ in what a writer is then obliged to do,
which is why I am not choosing.

§7's own invariant reads on the second side of that, and I set out to check it: §9 and
`adapters/claude-code/CONTRACT.md` both say the built bundle declares the eval directory as
`experimental.evals`, so if those cases reach `dist/` then "nothing packaged into `dist/` is ever
exempt" is not satisfied by a tree that is never scanned. It does not reach it. With four skills at
`status: authored` and a bundle built from them, `dist/` contains no path matching `eval` for either
host, and `src/packaging/` contains no occurrence of the string at all: the key the adapter contract
specifies is not emitted and the tree it names is not copied. So the `dist/` invariant does not
decide this entry either way, and the argument that leaned on it is withdrawn. That the manifest is
missing a key its own host contract declares is a separate matter, and it is the packaging lane's,
not this entry's.

Filed by the batch-3 writer, 2026-09-19, against `AUTHORING.md` at `26a1e90`; §7's quoted text is
unchanged at `6600cd0`, which `research/probes/defect-entries.py` re-checks on every run.
