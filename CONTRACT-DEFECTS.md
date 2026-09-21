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

### §4's `packaging.hosts[].mode` is declared by every manifest and read by nothing

**The instruction followed.** §4 assigns the host-mode declaration to the manifest, and still does
at `70d62a7`:

> `packaging.hosts[]` declares, per adapter, the `mode` the skill runs in there (`autonomous` / `guided` / `manual`) and the `unsupported` semantics that host cannot enforce. That is where a skill records the degradation its adapter contract describes — a skill needing a restriction a host lacks lists it in `unsupported` and drops to `guided` or `manual`, rather than claiming a guarantee nothing enforces (`adapters/claude-code/CONTRACT.md` §4).

**What following it produced.** Writing batch 4's `diagnose` manifest, both host blocks declare
`mode: autonomous` with three `unsupported` entries each, and `ak build` emitted
`metadata.ak.mode: manual` into both bundles.

The packager reads a different key. `src/packaging/manifest.ts:52` takes `autonomyModes` from
`autonomy.modes` and `requiresEnforced` from `autonomy.requires_enforced`, and
`src/packaging/plan.ts:268-269` computes the mode from those two alone: `autonomous` when the
first contains `autonomous` and the second leaves nothing unenforceable, `guided` when something
is unenforceable, `manual` otherwise. No manifest can carry an `autonomy` key.
`schemas/skill.schema.json` sets `additionalProperties: false` at the top level and lists no such
property among its 28, so the read returns empty for every skill in the package and the expression
has one reachable branch.

Measured at `70d62a7`: all 13 tracked manifests carry a `packaging.hosts[]` block, and none of
them carries an `autonomy` key, because none can. `autonomous` and `guided` are unreachable, and
with them the `rejected` list and the whole `unsupported`-driven degradation §4 describes. A skill
that declares a guarantee its host cannot enforce and a skill that declares nothing produce the
same bundle. Those 13 manifests carry 26 host blocks between them, declaring `guided` 10 times,
`autonomous` 8 and `manual` 8 — 18 declarations asking for something the packager cannot emit.

The one reachable branch is `manual`, which reads as a safe failure without being one. `manual` is
the falsy arm of the ternary at `src/packaging/plan.ts:269`, reached because `wantsAutonomous` is
always false; nothing selected it. Written the other way round, the same dead read would have
shipped every skill claiming an autonomy nothing checks. A dead branch fails safe or unsafe by
accident, so "it currently fails closed" is a second thing to check here rather than a reassurance
to record beside the defect.

This is the §10 direction: a rule in the contract that specifies a declaration nothing performs.
It is invisible from the writing side, because the manifest validates, the build reports zero
errors and zero warnings, and the declared mode never appears in a diff a writer reads.

**What the correct behavior appears to be.** `src/packaging/manifest.ts` reads
`packaging.hosts[]`, selecting the block whose `adapter` matches the bundle being built, and takes
its `mode` and `unsupported`. The alternative reading is that `autonomy.modes` is the intended
shape and §4 and `schemas/skill.schema.json` both name the wrong field, in which case the schema's
closure is what makes it unwritable and the fix belongs there. This writer reads the first as
correct — §4 and the schema agree with each other and the code disagrees with both — but which
file is amended is not the writer's to decide.

**Correction, from `3b2ed6c`.** This entry said batch 4's four manifests declare `autonomous` on
both adapters and will need no change under the first reading. The second half is wrong. Measured
in that lane: eight manifests were filled in while nothing read them, five declaring `autonomous`
and one `guided` on codex, whose `enforces` list is empty — so connecting the read as written
would ship skills claiming autonomy on a host that enforces nothing, which is worse than the
defect it repairs. `unsupported` is authored as prose and cannot be compared against `enforces` at
all. The declarations accumulated unreviewed for exactly as long as the branch stayed dead,
because the authors filling the field got no feedback, and connecting it makes all of them live at
once. So the repair is two steps — report what the connected read would emit, then emit it — and
this entry retires on the second, not the first.

**Correction, at `70d62a7`: every figure in this entry had gone stale, and one of them never had a
revision to go stale against.** The entry located the computation at `src/packaging/plan.ts:218`
and §4 locates it at `:199`; it is now `:268-269`. The entry said eight manifests had been filled
in; thirteen now carry host blocks. Both are the ordinary decay of a line number quoted from a
tree several lanes write to, and the repair is the one the probes already use: name the revision
beside the figure, as every measurement above now does. §4's other locator,
`src/packaging/manifest.ts:52`, is still correct and is not part of this correction.

The third figure is a different fault and does not have that repair. The entry read the count of
bundles carrying `mode: manual` out of `dist/claude-code/skills/`, and `AGENTS.md` line 113 says
`dist/` is generated by `ak build`, never hand-edited and never committed. A count taken from it
names whoever last ran the packager and when, so it cannot be re-derived from any revision and was
never a fact about the repository. It is the instrument defect `AGENTS.md` describes for `ak build
--check` in a fresh clone: a reading that reports the state of a local build while appearing to
report the state of the commit. The durable form of the claim is the one above — 18 of 26 host
blocks declare a mode the packager cannot emit — which is measurable from the tracked tree at a
named revision.

**§4 now discloses this defect inside itself, which is the arrangement this file exists to
avoid.** A paragraph was added at `AUTHORING.md:242` beginning "Nothing reads that declaration,
and until this paragraph is deleted the sentence above describes a field with no consumer." It is
accurate, and it carries the stale `plan.ts:199` locator noted above. Two records of one defect
now hold two different retirement conditions: this entry retires when the connected read is
emitted, that paragraph retires when someone deletes it. Nothing keeps them in step. The header of
this file names the failure — a contract defect filed inside the artifact it is about is not
obliged to be read, so nothing retires it. Whether that paragraph stays, and whether §4 or the
code is the file amended, is the contract owner's ruling and not this writer's.
