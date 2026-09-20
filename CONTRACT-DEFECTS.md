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

### §6 names no citation shape for a YAML scalar, and three of the four ways out are things §6 forbids

**The instruction followed.** §6's shape table assigns one shape per location:

> | A YAML file — `skill.yaml`, a policy, a profile | The key `ruling: <bare-id>`, or `rulings: [<id>, <id>]` for several |

and §6 then names the case where that shape is unavailable:

> Otherwise cite at the point of use, and where the point of use is a scalar list item that has no key to carry the citation, converting it to a mapping is a schema question for the file's owner and `ak validate`, never a reason to cite somewhere easier.

**What following it produced.** Writing batch 4's `super-verify` manifest, the fifth
`hard_gates` entry restates `delta-baseline-reset-not-third-loop` and `ak validate` reported
`rulings.uncited-restatement` on it at 0.55. `hard_gates` items are typed
`common.schema.json#/$defs/nonempty_string` by `schemas/skill.schema.json`, so the entry has no
key to carry `ruling:`. The table offers the key shape and nothing else for a YAML file, and the
sentence above closes the three obvious exits: leaving the claim uncited is the defect the scanner
reported, hoisting the key to the parent mapping scopes the ruling over five sibling gates it does
not govern — the widening §6 calls worse than the omission — and rewording the claim under the
threshold is the silencing §6 separately forbids. Following the table literally leaves a writer
with no legal move.

A fourth shape exists and works, and the contract does not mention it: the markdown inline form,
the word `ruling` and the bare id in backticks, written inside the scalar itself.
`policies/invocation.yaml:213` already uses it for exactly this case, a keyless list item, and
`citationScope` in `src/validation/restatement.ts` is written for it — *"§6's inline form is legal
in YAML too, and a scalar that names its ruling in the sentence is attributed by the same rule
markdown uses."* The contract's own instrument and the contract's own policy file both accept a
form the contract's table does not list, which is the surface §6 exists to close rather than open.

One consequence a writer cannot get from the table and needs: in YAML the scanner's scope is the
matched window's own physical lines, not the block. In a wrapped multi-line scalar an inline
citation therefore attributes only the lines it shares a window with, so a citation written in the
bullet's second sentence does not reach a claim made in its first. Placing it took a reproduction
of the scan, not a reading of the contract.

**What the correct behavior appears to be.** Either the table's YAML row names the inline form as
the shape for a scalar with no key to carry one, or the scalar-list-item sentence says so where it
already discusses this case — and whichever is chosen, the scoping rule above belongs beside it,
because a shape that attributes the wrong sentence is not a working shape. The alternative reading
is that the inline form is illegal in a YAML file, in which case `policies/invocation.yaml:213` is
a defect and the scanner accepts something it should not. This writer cannot tell which, and took
the fourth shape at `0945b4c` while reporting it here.

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

This is the §10 direction: a rule in the contract that specifies a declaration nothing performs. It
is invisible from the writing side, because the manifest validates, the build reports zero errors
and zero warnings, and the declared mode never appears in a diff a writer reads.

**What the correct behavior appears to be.** `src/packaging/manifest.ts` reads
`packaging.hosts[]`, selecting the block whose `adapter` matches the bundle being built, and takes
its `mode` and `unsupported`. The alternative reading is that `autonomy.modes` is the intended shape
and §4 and `schemas/skill.schema.json` both name the wrong field, in which case the schema's closure
is what makes it unwritable and the fix belongs there. This writer reads the first as correct —
§4 and the schema agree with each other and the code disagrees with both — but which file is amended
is not the writer's to decide. Batch 4's four manifests declare `autonomous` on both adapters and
will need no change under the first reading.
