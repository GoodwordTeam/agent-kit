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

**The instruction followed.** §4 assigns the host-mode declaration to the manifest:

> `packaging.hosts[]` declares, per adapter, the `mode` the skill runs in there (`autonomous` / `guided` / `manual`) and the `unsupported` semantics that host cannot enforce. That is where a skill records the degradation its adapter contract describes — a skill needing a restriction a host lacks lists it in `unsupported` and drops to `guided` or `manual`, rather than claiming a guarantee nothing enforces (`adapters/claude-code/CONTRACT.md` §4).

**What following it produced.** Writing batch 4's `diagnose` manifest, both host blocks declare
`mode: autonomous` with three `unsupported` entries each, and `ak build` emitted
`metadata.ak.mode: manual` into both bundles. So does every other skill in the tree: all eight
bodies in `dist/claude-code/skills/` carry `mode: manual`, including the ones whose manifests ask
for `autonomous`.

The packager reads a different key. `src/packaging/manifest.ts` takes `autonomyModes` from
`autonomy.modes` and `requiresEnforced` from `autonomy.requires_enforced`, and
`src/packaging/plan.ts` computes the mode from those two alone: `autonomous` when the first contains
`autonomous` and the second leaves nothing unenforceable, `guided` when something is unenforceable,
`manual` otherwise. No manifest can carry an `autonomy` key: `schemas/skill.schema.json` sets
`additionalProperties: false` and has no such property, so the read returns empty for every skill in
the package and the expression has one reachable branch. `autonomous` and `guided` are unreachable,
and with them the `rejected` list and the whole `unsupported`-driven degradation §4 describes. A
skill that declares a guarantee its host cannot enforce, and a skill that declares nothing, produce
the same bundle.

The one reachable branch is `manual`, which reads as a safe failure without being one. `manual` is
the falsy arm of the ternary at `src/packaging/plan.ts:218`, reached because `wantsAutonomous` is
always false; nothing selected it. Written the other way round, the same dead read would have
shipped every skill claiming an autonomy nothing checks. A dead branch fails safe or unsafe by
accident, so "it currently fails closed" is a second thing to check here rather than a reassurance
to record beside the defect.

This is the §10 direction: a rule in the contract that specifies a declaration nothing performs. It
is invisible from the writing side, because the manifest validates, the build reports zero errors
and zero warnings, and the declared mode never appears in a diff a writer reads.

**What the correct behavior appears to be.** `src/packaging/manifest.ts` reads
`packaging.hosts[]`, selecting the block whose `adapter` matches the bundle being built, and takes
its `mode` and `unsupported`. The alternative reading is that `autonomy.modes` is the intended shape
and §4 and `schemas/skill.schema.json` both name the wrong field, in which case the schema's closure
is what makes it unwritable and the fix belongs there. This writer reads the first as correct —
§4 and the schema agree with each other and the code disagrees with both — but which file is amended
is not the writer's to decide.

**Correction, from `3b2ed6c`.** This entry said batch 4's four manifests declare `autonomous` on
both adapters and will need no change under the first reading. The second half is wrong. Measured
in that lane: eight manifests were filled in while nothing read them, five declaring `autonomous`
and one `guided` on codex, whose `enforces` list is empty — so connecting the read as written would
ship four skills claiming autonomy on a host that enforces nothing, which is worse than the defect
it repairs. `unsupported` is authored as prose and cannot be compared against `enforces` at all.
The declarations accumulated unreviewed for exactly as long as the branch stayed dead, because the
authors filling the field got no feedback, and connecting it makes all of them live at once. So the
repair is two steps — report what the connected read would emit, then emit it — and this entry
retires on the second, not the first.
