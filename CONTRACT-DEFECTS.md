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

### §12 enumerates three further body shapes; the package has four

**The instruction followed.** §12's preamble:

> §1–§11 are written for skills. Three further body shapes exist in this package, and two of them
> are batch 1's entire output.

and the sentence that scopes the inherited law:

> What all three share: none is human-invocable [...] §1's size rule and progressive disclosure,
> §5's provenance law, §6's ruling citations, §7's prohibitions and §8's writing standard all apply
> unchanged.

**What following it produced.** `catalog.yaml` declares a `references` section with four entries —
`codebase-design`, `domain-modeling`, `engineering-principles`, `prose-quality`. §12.1 covers
protocols, §12.2 roles, §12.3 loose doctrine files. A reference pack is none of the three, so it has
no governing subsection, and the scoping sentence above reaches "all three" and therefore does not
reach it: by the section's own words, §1, §5, §6, §7 and §8 do not bind a reference pack.

Every `references/` occurrence in `AUTHORING.md` — lines 28, 37, 43, 56, 69, 74, 78, 846 — is the
*skill's own* `references/` subdirectory under §1's progressive disclosure, not this catalog section.
All eight were checked individually; the count is not the evidence.

The rules that do exist for reference packs live only in `src/validation/completeness.ts`. Probed
against a clean extract of `1e32a9a`:

| Tree | Result |
|---|---|
| `references/codebase-design/ANYTHING.md` | `WARNING catalog.unexpected-body-name`, naming `REFERENCE.md` as canonical |
| empty `references/codebase-design/` | `ERROR catalog.entry-missing-body`, exit 1 |
| empty, `status: authored` | adds `ERROR provenance.missing-adaptation` |

So the body filename is mandatory and provenance law does apply, and a writer can learn either fact
only by tripping the validator. Unanswerable from any file: what sections a `REFERENCE.md` requires
or whether it has a required list; whether it carries frontmatter (§12's preamble denies frontmatter
to protocols and roles, and that sentence does not reach references); whether a `.yaml` sidecar
exists; which handback applies, given that §11 defers to §12 for non-skills and §12.4 is titled "a
protocol or a role".

**What the correct behavior appears to be.** A §12.5, rather than folding references into §12.3.
§12.3's argument that a loose doctrine file is safely invisible to `catalog.directory-without-entry`
turns on its having no catalog entry; a reference pack has one. That difference is load-bearing in
the other direction too — a reference pack can be named in a ruling's `binds` block, so §6's citation
rule is mechanically checkable for it exactly where §12.3 states it is not checkable for a doctrine
file. §12's preamble also needs "three" to become four, and the inheritance sentence needs to reach
the fourth shape explicitly.

**How this was found, stated because it changes what the entry is evidence of.** Not by a writer
following the instruction and producing a wrong artifact. Found by probing before batch 3 was
dispatched, batch 3 being the first batch to author anything outside §12.1 and §12.2. Nothing could
have surfaced this earlier: batches 1 and 2 produced protocols and roles, the two shapes §12 covers
well. Filed here rather than left in an inbox because §10's blocking clause is the mechanism that
makes a ruling happen, and a message is not one.

Blocks: batch 3's `references/codebase-design` and `references/domain-modeling`. Batch 3's four
skills are unaffected.
