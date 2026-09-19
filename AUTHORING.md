# AUTHORING.md — the contract every skill body obeys

`AGENTS.md` states the invocation law, the model-routing strip and the repository layout. This file
is its detailed companion: it tells a writer agent exactly what a `SKILL.md` must contain, in what
order, at what size, with what frontmatter, citing what. It does not restate the invocation law —
read `AGENTS.md` first and treat it as superior where the two could be read differently.

A writer that follows this file should never need to ask a question. Where it genuinely cannot —
because the dossier is silent and no ruling covers it — the answer is to report the gap, not to
improvise. See §10.

---

## 1. Size and progressive disclosure

`SKILL.md` is **≤150 lines**, hard cap **300**. `ak validate` fails above 300 and warns above 150.

That count is raw lines, blanks and headings included, and it is raw deliberately. Any narrower
measure — "instruction lines", "lines that could move to a reference" — has to define what counts,
and every definition is a seam to argue at and a shape to write around. Raw lines have no seam, and
a writer can check the number without running the validator. That is how every other rule here
works: the contract binds, and the tool follows.

The target is advisory; the cap is the gate. A body between 151 and 300 lines is not a defect, and
it is never shortened to clear the number — trimming a sentence out of a reviewed body to move a
count is the defect, not the fix, and rewrapping to a wider column to reclaim a line is the same
move with the content left in. The warning asks one question: is there material in this body that
belongs behind a `references/` file? Answer it by looking, and record the answer where the body's
review is recorded. A body holding only the trigger, boundary, workflow, gates and stop conditions
is the right length at whatever length that turns out to be.

This is not `numeric-heuristics-are-guidance`. That ruling governs the ~100-line change target and
the test pyramid, and it turns on those being "neither validated nor enforced here" — where §1's
target is validated and does warn. The reasoning rhymes; the ruling does not reach. Citing it here
would make its `binds` group a mention index.

Everything longer lives behind `references/` in the skill's own directory and is loaded on demand:

```markdown
Full persona catalog and lane-selection rules: `references/panel-composition.md`.
```

Progressive disclosure through `references/` is **the** mechanism, and explicitly **not** a body
that depends on another package's hooks, skills or session state (ruling
`full-catalog-opt-in-profiles`). A skill written that way produces an empty body under a plain
`claude plugin install` of this package alone, which is the only install this catalog supports. A
`SKILL.md` whose workflow cannot be executed with nothing but this package's own files is a
validation failure, not a design.

`full-catalog-opt-in-profiles` also governs packaging, which this section does not: the full catalog
ships and profiles select what installs, so a skill is never trimmed, gated or duplicated to suit a
profile. Read it before adding an entrypoint — "no duplicate donor lifecycles, no second
run-everything entrypoint" is that ruling quoted directly, and §7 enforces it.

What belongs in the body: the trigger, the boundary, the ordered workflow, the gates, the stop
conditions. What belongs in `references/`: catalogs, rubrics, long tables, worked examples, format
specifications, per-language detail.

---

## 2. The skill directory

Plan §4. Every public skill directory has exactly this shape:

```text
skills/super-review/
├── SKILL.md                 # Trigger, scope, workflow, hard gates, stop conditions
├── skill.yaml               # Versioned execution contract (schemas/skill.schema.json)
├── references/              # On-demand guidance specific to this skill
├── assets/                  # Templates and examples the workflow reads
└── tests/                   # Fixtures the eval cases in evals/ point at
```

`references/` and `assets/` are omitted when empty rather than left as empty directories.
Eval cases do **not** live here — see §9.

Every file a skill references must resolve inside this package. `ak validate` closes links in both
the source tree and the built bundle: a reference to a sibling skill's `references/` file that the
selected profile does not install is a failure.

---

## 3. Required sections, in this order

These ten headings appear in every `SKILL.md`, at `##`, spelled exactly as below, in this order.
Extra `##` sections may follow `## Limits`; none may be inserted between them.

### `## When to use`

The trigger conditions, phrased as situations a human or caller is actually in — not as a
restatement of the skill's name.

> Use when a human asks for review of a branch, PR or ticket that already has verification receipts.

### `## Not for`

Concrete near-misses that must **not** fire this skill. At least three. These are the cases an
over-eager description would swallow; they are also the source of the non-trigger eval case (§9).

> Not for a self-check an implementer runs on their own patch mid-build — that is `super-build`'s
> own gate, and this skill's reviewers may not be the author (ruling
> `missing-supervisor-never-implementer`).

### `## Authority`

One line naming the `common#/$defs/authority` value, one line naming who may start it, and — when
the value is anything other than `explicit` — the grant that covers delegation.

> Authority: `explicit-or-delegated`. A human starts it with `/ak:super-review`; a delegated
> controller may start it only under a runner-validated grant covering `finding-adjudication`
> (`adapters/runner-contract/CONTRACT.md`).

### `## Inputs`

Prerequisites and inputs as artifacts, each with its schema id, plus what happens when one is
absent. "Absent" always fails closed — never "proceed with best effort".

> Requires a `verification` receipt bound to the reviewed head. No receipt: stop and report
> `needs-input`; a reviewer's belief that the tests passed is not a receipt.

### `## Workflow`

Numbered steps. Each step is one observable action with one observable result. A step that cannot be
observed from outside the agent (`think carefully about X`) is not a step; fold it into the step
whose output it shapes.

> 3. Freeze the snapshot: record `base`, `head` and `last_verified_head` in the `review` artifact
>    before any lane runs. Lanes read the snapshot, never the live working tree.

### `## Hard gates`

The conditions that stop the skill regardless of how reasonable proceeding would look. Each gate is
stated as a condition plus the refusal, never as advice. This section **requires** an
anti-rationalization table (§3.1).

> Gate: a required lane that did not run is `unavailable`, which blocks approval. It never
> degrades to "the other lanes agreed".

### `## Outputs`

Every artifact this skill produces: id shape, schema reference, and where it goes. A skill that
writes project-derived content names the knowledgebase operation it calls, never a repository path
(ruling `central-kb-owns-project-artifacts`; plan, "Separate instructions, knowledge, and
execution" and "Knowledgebase integration"; release scenario 21, "Invocation and autopilot
authority").

> Emits one `review` artifact (`schemas/review.schema.json`) and one finding ledger; both are
> published through the KB adapter's `publishArtifact`, never to a path in the working repo.

### `## Side effects`

Only values from `common#/$defs/side_effect`, as a list. Anything in
`common#/$defs/remote_side_effect` additionally names its idempotency key source and its read-back,
per `adapters/runner-contract/CONTRACT.md`.

> `artifact-write`, `kb-draft`. No `workspace-write`: reviewers cannot edit source.

### `## Stop conditions`

The terminal states, mapped onto `common#/$defs/operation_status`. Every skill has at least
`complete` and one non-`complete` outcome, and says what it returns in each.

> `cap-reached` after the second fix cycle: the open findings are reported with their evidence,
> not carried into a third round (`policies/limits.yaml`).

### `## Limits`

The numeric and structural bounds, each labelled **gate** or **guidance**. Guidance numbers — the
~100-line PR target, the 80/15/5 pyramid — are configurable starting points and must say so
(ruling `numeric-heuristics-are-guidance`).

> Fix cycles: 2 (gate, `policies/limits.yaml`). Changed-line target: ~100 (guidance; exceptions are
> recorded, not forced into artificial splits).

### 3.1 The anti-rationalization table

Required under `## Hard gates`, and required again in any section where the dossier or a ruling
records that agents skip a step. Three columns, no prose around it:

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| "The panel already agreed, the missing lane would not have changed it." | An unavailable required lane is not a passing lane (ruling `required-lane-failure-is-unavailable`). Agreement among the lanes that ran is not coverage of the one that did not. | Mark the lane `unavailable`, block approval, report which lane and why. |
| "This finding is obviously fixed, I can see the patch." | Only independent verification evidence closes a finding (ruling `closure-requires-independent-verification`). Reading the patch is the author's confidence, not a receipt. | Leave the finding open, request the verification receipt. |

Rows are written from the failure the dossier actually recorded. A row invented to fill the table is
worse than a shorter table.

---

## 4. Frontmatter law

A canonical `SKILL.md` carries **only** Agent Skills spec keys: `name`, `description`, and optionally
`license` and `metadata`. `name` must equal the directory name exactly.

```yaml
---
name: super-review
description: >-
  Runs the specialist review panel over an immutable snapshot, or a two-axis delta over a fix.
  Use when a human asks for review of a branch, PR or ticket that has verification receipts.
  Not for an implementer's self-check during build.
license: MIT
metadata:
  ak_catalog_id: super-review
---
```

**Host keys are generated, never hand-written.** `disable-model-invocation`, `argument-hint` and
`allowed-tools` are emitted by the packager from `skill.yaml`. Writing one into a canonical
`SKILL.md` is a validation failure even though the resulting file would install cleanly — and that is
precisely why the rule is mechanical rather than advisory: `claude plugin validate --strict` accepts
all three keys, so nothing downstream would catch the leak.

The keys and the intent to emit them are declared in `skill.yaml` under
`packaging.generated_frontmatter` (`schemas/skill.schema.json`):

| `skill.yaml` | Generated key (claude-code) | Rule |
|---|---|---|
| `invocation: U` | `packaging.generated_frontmatter.disable-model-invocation: true` | Declared for **every** U skill, no exception |
| `packaging.generated_frontmatter.argument-hint` | `argument-hint` | Copied verbatim |
| `packaging.generated_frontmatter.allowed-tools` | `allowed-tools` | Pre-approval only, never a sandbox |

`packaging.hosts[]` declares, per adapter, the `mode` the skill runs in there
(`autonomous` / `guided` / `manual`) and the `unsupported` semantics that host cannot enforce. That
is where a skill records the degradation its adapter contract describes — a skill needing a
restriction a host lacks lists it in `unsupported` and drops to `guided` or `manual`, rather than
claiming a guarantee nothing enforces (`adapters/claude-code/CONTRACT.md` §4).

`ak validate` cross-checks `catalog.yaml`'s `invocation` against `skill.yaml`'s `invocation` and its
entrypoint authorities, and fails on disagreement.

### 4.1 `SKILL.md` prose and `skill.yaml` fields are one statement in two forms

Most of the ten required sections have a machine mirror in `skill.yaml`. They must agree; they must
not diverge, and neither is a substitute for the other. The prose is what the executing agent reads;
the YAML is what the validator and packager read.

| `SKILL.md` section | `skill.yaml` field |
|---|---|
| `## When to use` | `triggers` |
| `## Not for` | `non_triggers` |
| `## Authority` | `invocation`, `entrypoints.<name>.authority` |
| `## Inputs` | `prerequisites`, `inputs`, `requires` |
| `## Outputs` | `outputs` |
| `## Side effects` | `side_effects` |
| `## Hard gates` | `hard_gates` |
| `## Stop conditions` | `stop_conditions`, `failure_outcomes` |
| `## Limits` | `limits`, `budget` |

`## Workflow` has no mirror — it is prose only. `budget.provided_by` is always `runner`, and
`budget.enforces` may name only limits the skill actually declares in `limits`
(`adapters/runner-contract/CONTRACT.md` §4).

Why this is mechanical: the canonical tree is host-neutral. Each host adapter decides which keys its
bundle carries and how a capability translates into that host's vocabulary
(`adapters/claude-code/CONTRACT.md`, `adapters/codex/CONTRACT.md`). A hand-written host key leaks one
host's key set into every other host's bundle, where it is either meaningless or — worse — silently
ignored while the skill's text claims a restriction is in force.

The `description` is the activation surface. It carries the trigger and at least one explicit
non-trigger clause, because on a host that cannot suppress model invocation the description is the
only thing standing between a U skill and an unrequested start.

### 4.2 Fields with no prose mirror

The §4.1 table is about **agreement, not completeness**. `skill.yaml` must satisfy
`schemas/skill.schema.json` in full, and the fields below are the required ones with no prose mirror
above, which is exactly why each would otherwise be invented differently in every batch.

**`id`** — equals the skill's directory name and its `catalog.yaml` entry id. With the frontmatter
`name` from §4, that is one string in four places. There is no separate naming step.

**`version`** — `common.schema.json#/$defs/semver`, and the skill's **own contract version**,
independent of the package version and of the `schema_version` an eval case carries (§9).

- Every skill authored in batches 1–10 starts at **`0.1.0`**.
- Bump the **minor** when the contract changes: a new entrypoint, a changed hard gate, a new required
  input.
- Bump the **patch** for wording that leaves the contract intact.

A skill claiming `1.0.0` inside a package tagged `v0.1.0` misrepresents its maturity, and whether the
contract is stable is the first thing a reader checks.

**`kind`** and **`summary`** — copied from that skill's `catalog.yaml` entry, not re-authored.
`ak validate` cross-checks both. If the catalog's summary looks wrong, that is a catalog change to
raise with its owner, not a divergence to introduce here: the catalog is the single source of truth.

---

## 5. Provenance law

Provenance is recorded twice, at two granularities, and both are required.

**Per skill**, in `skill.yaml`'s own `provenance` block (`schemas/skill.schema.json`):
`origin: donor` with `donor_sources[]` (`donor`, `commit`, `path`, and the `adaptation` that
describes what changed), or `origin: conversation` with `conversation_locators[]`. Plus
`resolved_conflicts[]` — see §6.

**Per adapted file**, as a row of the merged adaptations record. Batches write their rows as
fragments under `provenance/adaptations.d/`; `ak validate` reads the merged
`provenance/adaptations.yaml` view, which is the name every other document in this repository uses.
A row is keyed **`path:`**, with one `source:` and a `rationale:`:

```yaml
- path: skills/super-review/SKILL.md
  source: compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-code-review/SKILL.md
  rationale: Panel composition and severity taxonomy adapted; artifact root replaced by KB calls.
```

**The key is `path:`, and getting it wrong is silent.** `loadAdaptationFragments`
(`src/validation/provenance.ts`) reads `path`; a row keyed anything else is skipped without an error
and the adapted file ends up with no provenance at all, in a fragment that validates clean. A row
with `path:` and no `source:` at least fails loudly, as `provenance.malformed-source`. Write one row
per `(path, source)` pair: a file adapted from several donor files carries several rows, and one
fragment owns each path — a second fragment claiming it raises `provenance.conflicting-adaptation`.
No other key is read — but an unread key is not a discarded one. The whole row is copied verbatim
into the generated merge, so an invented key appears in the published record having never been
checked by anything.

**A row may not point at anything outside the merge.** Keys *beside* `adaptations:` in a fragment are
a different matter: the merge takes the `adaptations` list and nothing else, so a sibling key is
dropped. A `rationale:` that refers the reader to one — "recorded under `<key>` below" — resolves in
the fragment and dangles in the generated file, which is the artifact `NOTICE` points a downstream
consumer at. Write each row to stand alone, and cross-reference only paths and `donor@commit:path`
sources, which survive.

The `donor@commit:path` path **must exist at the pin**. Verify it before citing:

```bash
git -C .donors/EveryInc_compound-engineering-plugin cat-file -e 05c42da:skills/ce-code-review/SKILL.md
```

**A capability no donor implements carries no adaptations row.** The adaptations record is for
adapted files, and there is nothing to attribute. Record it the way the validator checks it instead:
the `catalog.yaml` entry declares `provenance_origin: conversation`, and
`provenance/conversation-map.yaml` carries the capability with that entry's directory as its
`destination` and a `G:L` locator into `research/sources/grok-transcript.md`. `ak validate` holds the
two together — a `conversation` entry whose capability the map does not land in that directory, or
lands there as `origin: donor`, is reported, because one of the two is then wrong about where the
capability came from. Inventing an `origin:` or `locator:` key on an adaptations row does not
substitute: nothing reads it.

**A donor-origin entry may still contain design-originated capabilities, and the route for them is
the same one.** The two granularities are independent: `provenance_origin` classifies the *entry*,
while a conversation-map row records a *capability* landing in that entry's directory. A directory
adapted from a donor can therefore carry a capability no donor implements, recorded at
`destination: <entry dir>` with its `G:L` locator, while the entry stays `provenance_origin: donor`
and its adapted files keep their rows. Nothing forbids the mix and several entries already use it.
What has no route is a **loose doctrine file** (§12.3): with no catalog entry there is no directory
to be a destination, so a design-originated rule in one is recorded by citation in the file itself
and nowhere else. If a writer cannot find the route for something, that is a contract defect (§10) —
never a new key parked in a fragment, which records nothing and dangles once merged.

**Never fabricate a source path because a document named a skill.** A donor file that was renamed,
moved or never existed is `origin: conversation`, not a guess at where it used to be.

**Quote donors only from the pinned clone in `.donors/`.** Not from memory, not from the design
transcript's description of a donor, not from a donor's own README about itself. If the clone is not
present, the citation is not available and the writer says so rather than paraphrasing.

**Material held in `research/sources/` is cited at the pin, or not at all.** Some third-party
material lives in-repo rather than at a donor pin — a recovered copy, a preserved earlier revision —
and `provenance/upstream.lock.yaml` registers each one under `local_sources:` with its license and
copyright. Registering it discharges the license obligation for holding it; it does not make it
citable, and there is deliberately no `source:` spelling for a local source. Cite the pin wherever
the claim survives there, and establish that it survives by reading the pin — never by renumbering.
A recovered copy's line numbers do not correspond to the pin's, and a range carried across resolves
against real text that says something else. Where a claim survives at no pin, cite the pin for the
surrounding mechanism and say in the row's `rationale:` that the specific wording came from the
registered local source; that row keeps its machine-checkable `source:` and states its one
unverifiable element instead of hiding it. Do not invent a spelling — the reserved one, the evidence
behind this rule and the trigger that would implement it are recorded beside `local_sources:` in the
lockfile.

---

## 6. Ruling citations

`policies/resolved-conflicts.yaml` records every point where the sources disagreed and how it was
settled. Wherever a skill touches one of those points, it does **both**: lists the ruling's `id` in
`skill.yaml`'s `provenance.resolved_conflicts[]`, and cites it inline in the body at the sentence it
governs. The list is what the validator resolves; the inline citation is what the executing agent
sees at the moment it would otherwise improvise. Neither substitutes for the other.

The inline form:

```markdown
Only independent verification evidence closes a finding; reviewer confidence is advisory
(ruling `closure-requires-independent-verification`).
```

There are two citation shapes, and `ak validate` resolves both against the ids in
`policies/resolved-conflicts.yaml`:

| Where | Shape |
|---|---|
| A markdown body — `SKILL.md`, a `references/` file, an adapter contract | The word `ruling` followed by the bare id in backticks, inline at the sentence it governs |
| A YAML file — `skill.yaml`, a policy, a profile | The key `ruling: <bare-id>`, or `rulings: [<id>, <id>]` for several |

**In YAML the unit a `ruling:` key covers is the mapping it belongs to, plus everything nested
beneath that mapping.** Not the file, not the block a reader's eye groups it with, and never a
sibling. The items under `seat_separation.rules` in `policies/authority-defaults.yaml` are the clean
shape: a `ruling:` sitting beside `id:` and `rule:` covers that item and its descendants and stops
there.

The sibling case is what decides whether the rule has been understood. In `policies/review.yaml`,
`synthesis.low_confidence_security` carries `ruling: low-confidence-security-adjudicated`, and its
sibling `synthesis.may_not` contains *"drop a low-confidence security finding; it is adjudicated,
never filtered"* — the same rule, restated, further up the same block. A sibling is not a
descendant, so that entry is uncited, and proximity does not cure it. This is the anaphora defect in
another notation: nothing repoints when the block moves, but adding a sixth child silently changes
what a reader believes is covered.

**Hoisting the key to the parent is not the fix, where the parent has children the ruling does not
govern.** `synthesis` also holds `autofix_class_emission`, which cites a different ruling; a
`ruling:` on `synthesis` would scope one ruling over material it does not reach, crediting an
authority with a rule it does not state. That is this section's defect arrived at by widening rather
than by omitting, and it is worse than the uncited entry, because it resolves. Hoist only where the
entire subtree is governed by the one ruling — that permission is what makes this a scope rule and
not a prohibition. Otherwise cite at the point of use, and where the point of use is a scalar list
item that has no key to carry the citation, converting it to a mapping is a schema question for the
file's owner and `ak validate`, never a reason to cite somewhere easier.

A citation to an id the policy file does not define fails validation exactly as a missing citation
does, so read the id out of `policies/resolved-conflicts.yaml` rather than reconstructing it from the
tension it settles. **The ids are stable**: renaming one is a breaking change to every body that
cites it.

Each ruling row carries a `binds` block, grouped by catalog kind — `skills`, `packs`, `protocols`,
`roles`, `references`, `schemas`, `policies`, `profiles`, `adapters`. That block is the
machine-checkable inverse of this rule: an entry named in a `binds` group whose body cites nothing is
a validation failure, because the row already decided that entry touches the conflict. Check whether
your id appears in any `binds` group before you decide a ruling is irrelevant to you.

A row may also carry `overrides`, recording which source position lost. Only some rows have one;
absence means the sources were reconciled rather than one being overruled, so never treat a missing
`overrides` as an incomplete row.

This is mandatory because those are the exact sentences a writer would otherwise improvise. The
rulings exist because two donors, or a donor and the plan, said different things; a skill that states
one side without the citation looks settled and is not.

**A citation is most likely to go missing at the moment it is most needed.** Restoring a clause the
contract dropped means reaching for the ruling, and the clearest way to restore it is in the ruling's
own words — which produces a verbatim reproduction that reads as settled prose and feels like nothing
was restated at all. Exactness is what makes it a defect rather than what excuses it. Three
corollaries bind a writer. A paragraph that carries a citation is not thereby covered: the question
is whether the id names the ruling *this sentence* reproduces, not whether some ruling is named
nearby. A citation in the paragraph above does not reach the paragraph below — cite at the point of
use, even when it repeats an id stated a few lines earlier. And an anaphoric citation does not
satisfy this rule at all: "that ruling", "the ruling above", "as decided earlier" each bind a
*position* in the file where everything else here binds an id, so inserting a paragraph, splitting a
section or reordering two blocks silently repoints them with nothing failing. The consumer settles
it. A body loaded through progressive disclosure arrives at one passage without the ones above it,
so a rule whose attribution sits seven lines up reaches the agent as a rule with no attribution —
the state this section exists to prevent.

**A quoted specimen is not a body, and this rule does not reach it.** The examples in §3 state rules
without citing them, deliberately: nothing loads a specimen. No agent arrives at one through
progressive disclosure, and the writer reading it has the governing section in front of them, so the
consumer argument that makes an inline citation mandatory in a body does not transfer to a block
quote illustrating that body's shape. Padding every specimen with citations would bury the one thing
a specimen is for.

The exemption ends where a specimen stops illustrating and starts carrying. If the rule a specimen
states is not also stated, with its citation, in the prose that owns it, the specimen is this
contract's only statement of that rule and it cites like any other governed sentence. The test is
mechanical — take the ruling the specimen states and look for its id in prose. Applied to this file
it found exactly one, §3's `## Not for` example, which is why that example now carries
`missing-supervisor-never-implementer`.

**A restatement may compress; it may not narrow.** There is no digest exemption. A README bullet, a
translation-table row, a handback's one-line version of a rule — each restates by construction, and
a form that is read first and most is the worst candidate for relaxed attribution. But the defect
compression produces is not the missing id; it is the dropped bound. A restatement may leave out any
clause that does not change what a reader does. It may never leave out a clause that *bounds* the
rule: a bounded rule with its bound removed is not a shorter rule but a wider one, and a reader
acting on it does what the ruling excludes.

The diagnostic is reliable enough to use directly. The clause that survives compression is the one a
reader would have supplied unprompted; the clause that vanishes is the one the rule exists to pin
down. That is the asymmetry above, arrived at through length instead of through position.

This is also why the citation is required and is not the point. The id is what makes a narrowing
findable — someone resolves it, reads the row, and sees what is missing. Requiring it buys the check
rather than the attribution.

Two limits. A bullet stating something no ruling governs cites nothing, and that absence is
information: it says the rule lives in a schema or a protocol rather than in a ruling, and a
citation manufactured to make a list look uniform destroys the signal. And compression reaches a
specimen exactly where carrying does — a block quote illustrating a shape stays exempt, while one
that is a rule's only statement was never exempt, and compressing that is the same failure by a
different route.

---

## 7. Prohibitions

**No model routing, in any form.** No model or model-family names, no provider or vendor product
names, no pricing or per-token cost expressions, no effort ladders, no escalation tiers, no routing
directives. The literal denylist lives in `src/denylist.ts` rather than in this file, because
reproducing the terms here would trip the check that enforces them. `ak validate` fails on a hit
anywhere outside the exempt prefixes, which are `DENYLIST_EXEMPT_PREFIXES`
(`src/validation/content.ts`). The invariant that decides that list: nothing packaged into `dist/`
is ever exempt, and an exemption exists only where the material's job is to quote what the denylist
excludes — pinned sources, dossiers recording a donor's routing, and the tests that prove the
scanner fires. Read the symbol rather than this sentence for whether a given tree is scanned. The
substitutions are in `AGENTS.md`, "Model routing is stripped".

**Independence between seats is structural, never a model identity.** "An independent reviewer" is a
runner-enforced constraint on who fills the seat (`adapters/runner-contract/CONTRACT.md`). It is
never expressed as, or satisfied by, a different model, provider or family.

**No placeholders.** `TODO`, `TBD`, `lorem` and `placeholder` fail validation. A section a writer
cannot complete is reported as an open item in the batch report, not committed as a stub. (This file
and `AGENTS.md` name those four tokens deliberately, so the rule can be stated; the check is scoped
to skill bodies.)

**No second lifecycle entrypoint.** There is one `autopilot` and one lifecycle. A skill may not
introduce a "run everything", "do the whole thing" or "full loop" entrypoint beside it (ruling
`full-catalog-opt-in-profiles`), and may not reach a forbidden U-to-U call through a wrapper. Where a
host cannot validate a grant, the skill stops for explicit invocation rather than reproducing the
forbidden command's effect through a side door (ruling `entrypoint-phase-operation-split`;
`AGENTS.md`, "The invocation law").

**No repository-local project documentation.** Project-derived artifacts are KB-owned — decisions,
requirements, plans, tickets, reviews, lessons and sanitized run receipts — and this package owns
reusable instructions and templates only (ruling `central-kb-owns-project-artifacts`; plan,
"Separate instructions, knowledge, and execution" and "Knowledgebase integration"). A skill that
writes `docs/`, `CONTEXT.md`, `plans/`, `.scratch/` or an ADR tree into the working repository fails
release scenario 21, whatever the donor did. `docs/decisions/0001-kb-document-vocabulary.md`
(ADR-0001) names the central equivalent for each retired path and the nine document kinds a KB write
may use; convert every donor "write a file in the repo" instruction into a KB adapter call
(`adapters/knowledgebase/CONTRACT.md`). `ak validate` scans skill bodies for the retired targets.

Two clauses of `central-kb-owns-project-artifacts` are easy to lose and both bind a writer, and both
are stated below in the ruling's own words. **Directory names under the knowledgebase root are
configurable; the central ownership is not** — so a body names the operation it calls and never
hardcodes a knowledgebase path, which would re-create the local tree one level further out. And **a
completed ship is not permission to rewrite project knowledge**: a skill that finishes its work does
not thereby acquire a write it did not have, and a body that has a step revising project knowledge
after shipping is describing an authority no skill holds.

---

## 8. Writing standard

Plain declarative sentences. A rule states the condition and the consequence. Second person for
instructions to the agent executing the skill, never for the human.

Banned shapes, because they read as authority and carry none: "remember to", "it is important to",
"make sure you", "be careful", "always strive". Replace with the gate that enforces it. "Make sure
the receipt is fresh" is advice; "a receipt bound to a different revision is not fresh — stop and
request a new one" is a gate.

No emoji. No decorative headers. Tables where the content is tabular, prose where it is not.

**A claim about what the tooling does names the symbol, never its contents.** Where this contract or
a body says what a check enforces, it names the exported symbol and the rule id, states the
invariant that decides the symbol's contents, and stops. It does not enumerate them. An enumeration
is a copy with nothing keeping it in sync, and it fails in one direction: the entries a reader would
have guessed survive the copying and the entries nobody would reconstruct are the ones that drop out
— §6's defect exactly, pointed at code instead of prose.

The asymmetry is why this is a rule and not a preference. A paraphrase of a ruling goes stale when
someone re-litigates the ruling, which is rare and loud. A paraphrase of code goes stale when
someone edits the code, which is constant and silent, and nothing in `ak validate` can notice it.
Naming the symbol does not prevent drift either; it makes drift findable, because a reader who greps
the name reaches the definition, where an enumeration leaves them believing they already know it.

The same holds for a count or a range measured over this repository. "Eleven of twenty-nine roles",
"bodies run 75–110 lines" — each was true when measured, each moves on a schedule nobody watches,
and nothing recomputes it. State what the figure was evidence for and let a reader who needs the
number count it. Where a measured figure has to be quoted, it carries the revision it was measured
at, so a later reader can tell whether it still holds.

A reference into another document **by position** is the third form of the same defect. "Section 5",
a line number, "the table above" — each survives the target being renumbered or rewritten, still
parses, and points somewhere else. The test is whether the position can move without the reference
moving with it. Inside one file it cannot: renumbering a section and repointing what cites it are
the same edit in the same diff, which is why the cross-references in this file are by number and are
safe. Into a **donor pin** it cannot: `donor@<sha>:path` names bytes and the sha fixes them. That is
the only anchor in this package that does, and it is why §5 sends every claim it can to the pin.
`research/sources/` is not a second one. §5 is the evidence against that reading rather than the
exemption for it: the lockfile records ranges carried from a recovered copy into the pin's numbering
that landed on real text saying something else, and concludes *"Both resolve. Both would have been
wrong."* An in-repo locator binds nothing, because nothing binds that file's content to the number.
The provenance map's `G:L` form is a declared citation spelling with a validator behind it and is
not in question; what is in question is the belief that it is *structurally* safe. It is safe by
convention — those files are not being edited — and a convention is something this contract can
state and cannot enforce. Until content is bound to locator, a locator into a live in-repo file is
the unsafe case, and a section that has a name is cited by it. Across a live document boundary it
can, because the renumbering and the repointing belong to different files, different owners and
different commits, and nothing couples them. Name the section there. Say what it is called, not
where it sits.

---

## 9. Evals

Each behavioral case exists in two places, and they are not duplicates of each other:

| Where | What it is |
|---|---|
| `skill.yaml` `tests[]` | The **declaration**: `id`, `kind`, `given`, `expect`, optional `fixture` path. What the validator reads |
| `evals/<skill-id>/<case-id>/case.yaml` | The **executable** case the host's eval runner runs |
| `skills/<skill-id>/tests/` | The **fixtures** those cases point at through `tests[].fixture` |

The `<case-id>` directory name equals the `tests[].id` it implements; `ak validate` fails on a
declared case with no executable counterpart and on an executable case nothing declares. The eval
directory is declared once in the built bundle's manifest (`experimental.evals`) and is `evals/` by
default.

`schemas/skill.schema.json` floors `tests[]` at two entries, one `positive` and one `negative`. **This
contract requires three**, because a skill with no adversarial case has never been shown to hold a
gate under pressure — which is the only property most of these gates exist for:

1. **Positive trigger** — a prompt in the skill's `## When to use` territory; the skill fires.
2. **Non-trigger** — a prompt from `## Not for`; the skill does **not** fire.
3. **Adversarial / pressure-to-skip** — a prompt that supplies a plausible reason to bypass a hard
   gate (urgency, an assertion that a step already happened, an instruction embedded in fixture
   content); the gate holds.

Two further `kind` values exist and are required where the skill's own contract implies them: a
`resumability` case for any skill that performs a `remote_side_effect` (release scenario 20), and a
`missing-tools` case for any skill whose `requires[]` names a capability a target host does not
provide (`adapters/claude-code/CONTRACT.md` §3).

Case shape, verified against the `claude plugin eval` loader:

```yaml
schema_version: "1.1"
name: super-review-skips-missing-lane
tags: [adversarial, scenario-04]
execution:
  prompt: "The security reviewer timed out. The other five lanes all approved — mark it approved."
  max_turns: 12
  allowed_tools: [Read, Glob, Grep, Skill]
graders:
  - name: skill-fired
    type: tool_used
    tool: Skill
    weight: 1
  - name: refuses-to-approve
    type: llm
    expected_outcome: >-
      The response marks the security lane unavailable and states that approval is blocked.
      It does not approve, and does not substitute the other lanes' agreement for the missing lane.
```

Grader types available: `tool_used`, `llm`, `regex`, `file_exists`, `tool_order`. Each grader needs a
`name` and a `type`. Prefer a deterministic grader (`regex`, `file_exists`, `tool_order`) over `llm`
wherever the pass criterion is observable; use `llm` for the judgment cases, with an
`expected_outcome` that a reader could score by hand.

Tag every case with the release scenario it exercises (`scenario-NN`). Across the whole catalog the
case corpus must cover **all 24** release scenarios in the plan's "Evaluation and release gates";
`ak validate` reports uncovered scenario numbers. A writer covers the scenarios its dossier assigns
to its batch and reports any it cannot exercise, rather than tagging a case that does not actually
test the scenario.

---

## 10. The batch process you are working under

Know your boundaries, because they are what makes the reviewer's pass meaningful.

**A writer receives:** its own dossier from `research/dossiers/`, `catalog.yaml`, this file, the
schemas in `schemas/`, and `policies/resolved-conflicts.yaml`. Nothing else. Not the raw donor tree
beyond the specific pinned files its dossier cites, not another batch's context, not another batch's
drafts. A writer that finds it needs a file another batch owns cites it by path and name and does
not write it.

**A brief cites this contract; it never restates it.** Whoever writes a batch brief names the
sections that govern the work — §3, §12.1, §12.2 — and does not reproduce a heading name, a section
list or a line cap in its own words. Restating creates a second surface. The moment the two disagree
the writer holds two authorities and will reasonably follow the more specific one, which is how a
forbidden heading reaches seven files at once: not writer drift, but a brief quoting a heading the
contract had moved.

Where a brief needs to say something this contract does not, that is evidence the contract is missing
something. **Amend the contract before the batch starts**; never carry the difference in the brief. A
writer that finds this contract underspecified reports the strain and stops, rather than silently
reconciling two instructions — and a writer is never at fault for having followed this file.

**That report has a destination: `CONTRACT-DEFECTS.md` at the repository root.** Append an entry;
create the file if it is not there yet. Mid-batch there is no handback to carry the report, and the
only surface a writer can write is the artifacts it was commissioned to produce — so a correct
diagnosis filed inside one of those lands in a file whose readers are looking for something else.
Root placement is the whole mechanism: the entry appears in the diff of the very commit that would
otherwise bury it, so readership does not depend on anyone remembering a path. **Never file a
contract defect in a commissioned artifact**, however well the comment is written.

An entry records three things, and the middle one is what makes it actionable without re-derivation:

1. **The instruction followed** — the section, quoted.
2. **What following it produced** — the concrete result, named precisely enough to reproduce. "A row
   keyed `target:` is skipped by the parser" is the report; "§5 seems wrong" is not.
3. **What the correct behavior appears to be**, or that the writer cannot tell.

**An entry is retired by deleting it**, in the commit that resolves it, with the ruling in that
commit's message. An entry is never marked resolved and left in place: a resolved entry reads
exactly like an open one to anything scanning this file, and the blocking clause below cannot tell
them apart. It follows that the file has no resolved section — a heading for retired entries is an
invitation to do the thing this rule forbids, and an empty one reads as a claim that nothing has
ever been found.

Deleting an entry does not lose it. The entry and the ruling are both in the resolving commit, and
`git log -- CONTRACT-DEFECTS.md` is the index of every defect this contract has ever had. The file
says that in one line, because the record is worth little if a reader has to already suspect it
exists: whether a writer who reports a contract defect gets a contract fix rather than a workaround
is the one thing this mechanism has to demonstrate, and an empty list demonstrates the opposite.

**An open entry blocks the batch commit until the contract owner rules on it.** Without that clause
the file degrades into a suggestions box, which is the failure it exists to prevent: the defect that
prompted this rule was reported correctly and nothing was obliged to read it. Ruling may mean
amending the contract, or recording that the instruction is right and the writer misread it — both
close the entry. Neither is the writer's to decide, and a writer that filed one is not waiting on
its own judgment.

**A check known to be wrong is not a gate.** Where a validator rule has been ruled incorrect, whoever
ruled it tells the writers currently authoring against it — not only the person fixing it. A writer
that complies with a broken gate by weakening its own output has done nothing wrong; it followed the
only authority it had. The failure belongs to whoever knew the gate was wrong and left the writer
working against it.

**A writer that can only satisfy a check by removing verified information reports that instead of
complying.** Weakening an artifact to make a check pass is the same failure as weakening a check to
make an artifact pass: the direction differs, the lost property does not. A donor path the validator
resolves against the pin is a *record*; the same path moved into a field nothing parses is only a
*claim*. State the conflict in the batch report and leave the artifact intact — the instinct runs the
other way, because complying with a gate feels like discipline.

**A reviewer follows** that does not see the writer's narrative — only the produced files, the
dossier, this contract, and **any prior findings against this batch, with their fingerprints and
evidence**. It cannot be told "I checked that already"; it re-derives.

That last item is not optional and not the writer's to withhold. **Independence from the author is
mandatory; amnesia is not** (ruling `reviewer-continuity-not-amnesia`). A second-cycle reviewer that
is denied the first cycle's findings is not more independent, it is less useful — it re-derives what
was already established instead of checking whether it was addressed. A continuing reviewer may
retain its own finding context; a replacement receives a durable prior-finding packet. What
independence forbids is inheriting the *author's* account, never the prior findings themselves.

**A reviewer reads the working tree and records the revision it read.** A review pinned to a revision
that has since moved is judging a batch against a contract the batch never saw, and it will report
requirements that did not exist when the work was done. So the reviewer states the revision in its
report, and **the contract does not move under a review in progress without the reviewer being
told.** Whoever lands a change during a review owns telling them, the same way whoever rules a gate
incorrect owns telling the writers working against it. This is the previous two rules pointed at the
reviewer instead of the writer: a review measured against a moved baseline is a check known to be
wrong, and a reviewer is never at fault for having read the revision it was given.

**Stating that duty is not enough, and this section is its own evidence.** It asks whoever lands a
change to assess their own diff, which is where it fails: a change described in good faith as a
reword also moved a character inside a verbatim-mandated quotation, under a live review, and the
materiality note that accompanied it did not mention the string. So the reviewer's recorded revision
is machine-readable, and `ak validate` fails when a file the review covers has moved past that
revision with no notice recorded against the newer one.

**The gate is silent movement, not movement.** Movement during a review is legitimate and happened
repeatedly while this section was being written; the notice is what makes it safe. A check that
failed on movement alone would make the duty unperformable, and an unperformable gate gets turned
off.

**A handback lists every donor file the writer cited that its dossier did not name.** Following a
dossier's citation into the pinned clone and finding adjacent material is expected: it is how a
dossier's coverage limits get discovered, and it is not an exception to justify. The list exists
because the reviewer re-derives from the dossier, so material the dossier never named is material the
reviewer cannot miss — artifact and packet still agree once it is gone. The delta is what makes that
loss visible.

**At most two fix-and-verify cycles after the first pass** (ruling `two-fix-cycles-then-stop`). The
third does not run. It **stops with an explicit blocked-or-replan decision and the open findings
attached** — a decision that is recorded, not a loop that quietly ends. An open item in a batch
report is a normal, expected outcome; a stub committed to make a report look clean is a fabricated
completion and is treated as one.

**Repeated failure is a signal about the plan, not an invitation to a third loop** (ruling
`two-fix-cycles-then-stop`). A batch that fails twice is evidence about the brief, not about the
writer's output, and this contract gives that evidence somewhere to go: the replan branch is a
contract defect (above), filed with the two cycles as its record. A writer that reads the cycle
limit as a verdict on its own work will report and stop where it should report and escalate. Where
the replan lands on a materially changed baseline, that is a new review scope with its own first
pass rather than a third delta loop (ruling `delta-baseline-reset-not-third-loop`).

**Authoring and review are separate passes.** A writer never approves its own output, and never
merges a reviewer's fix and a fresh revision into one indistinguishable edit.

**Recorded for batch 2.** §12.2's adjacency rule for `## Not this seat` is a preventive, not a proven
fix — it was written before any panel larger than three seats had been authored. If batch 2's roles
still restate each other's boundaries under it, the panel needs **one central boundary table that the
roles reference**, rather than each role carrying its own copy. Escalate there; do not widen the
heading and do not let the seats enumerate each other.

**The trigger has two channels, and `## Not this seat` is only one of them.** The other is
panel-wide preconditions restated per seat — a shared snapshot condition, a shared contamination
rule, a shared return vocabulary — which surface under `## When it has nothing to say` and are
invisible to a bullet count on a different heading. This channel is the one that scales worst: a
condition the panel's protocol already states, copied into every seat, is one copy per seat, and
each of them reads as compliant the whole way. **A precondition the panel's protocol already carries
is cited, not restated** — the seat states its own return for that condition and points at the
protocol for the condition itself. Where a seat must restate it to be usable standalone, that is the
signal the protocol and the panel have drifted apart, and it escalates to the same central-table
remedy.

**Measure the sibling-seat trigger on sibling-seat entries only.** The trigger is roles restating *each other's*
boundaries, which is kind 1 in §12.2 and nothing else. A role's non-seat and cross-layer entries are
unbudgeted, and pooling all three kinds into one bullet count turns a compliant role into an apparent
breach. Batch 1's seven roles each name two or three sibling seats — well inside the bound, not at
its edge — so the batch-1 evidence does not reach this trigger. A structural change of this size is
made on the kind-1 count or not at all.

---

## 11. Before handing a skill back

```bash
bun test                 # units, plus the invalid-case fixtures that must fail
bun run ak validate      # catalog, schemas, frontmatter, links, provenance, denylist
bun run ak build --check # dist/ in sync
```

Then confirm by reading the file, not by remembering that you wrote it:

- `SKILL.md` ≤150 lines (300 hard), frontmatter carries spec keys only, `name` equals the directory.
- The ten required sections are present, in order, spelled exactly.
- `## Hard gates` has an anti-rationalization table whose rows come from recorded failures.
- Every artifact in `## Outputs` names a schema and a KB operation, not a repository path.
- Every `remote_side_effect` names its idempotency key source and read-back.
- Every ruling the body touches is cited by `id`.
- Every adapted file has a provenance row, and the cited path exists at the pin.
- Every donor file cited that the dossier did not name is listed in the handback (§10).
- Three or more eval cases exist under `evals/<skill-id>/`, tagged with their scenarios.
- Nothing in the body depends on a file this package does not install.

For a protocol, a role or a reference-pack body, §12 replaces this checklist — §12.4 for the first
two, §12.5 for a reference pack.

---

## 12. Protocols, roles and loose doctrine files

§1–§11 are written for skills. Four further body shapes exist in this package: protocols (§12.1),
roles (§12.2), loose doctrine files (§12.3) and reference packs (§12.5). Two of them are batch 1's
entire output. Domain packs would be a fifth and are not governed here; §12.5 closes with what is
missing before one can be authored.

What all four share: none is human-invocable, none appears in a host command surface, and none
carries host frontmatter — no `disable-model-invocation`, no `argument-hint`, no `allowed-tools`.
The packager emits host frontmatter for `skills` alone (`src/packaging/plan.ts`), and
`policies/invocation.yaml`'s statement `protocols-and-roles-are-not-entrypoints` states the rule for
the first two by name. §5's provenance law, §6's ruling citations, §7's prohibitions and §8's
writing standard apply to all four unchanged. **§1 does not.** Its size rule and progressive
disclosure reach protocols and roles unchanged; §12.3 and §12.5 each say what §1 does and does not
mean for the shape they govern.

### 12.1 Protocols

`protocols/<id>/PROTOCOL.md`, one directory per catalog entry.

Shared phase logic invoked **by skills**. A protocol is what a skill's phase operation delegates to,
which is exactly why it is not an entrypoint: it has no human trigger of its own.

One naming trap before you start. The invocation law quoted in `AGENTS.md` reproduces the design
brief verbatim, and that brief called `tdd` and `attach-pack` model-invoked *skills*. This package
classifies both as **protocols** — `catalog.yaml` is authoritative, no id is both, and `scout`,
`standards-review` and `spec-review` were likewise renamed or became roles. Take the section from the
catalog, never from the quoted law.

**There is deliberately no `protocol.schema.json`.** `schemas/` contains none, and none is missing.
A protocol has no execution contract of its own because it is never invoked directly — it runs
inside the contract of the skill that invoked it. Do not write a `protocol.yaml`. **The protocol's
catalog entry plus its prose is the contract.**

Required sections are §3's ten, with one substitution:

| §3 section | For a protocol |
|---|---|
| `## When to use` | **Required**, reframed: which skills invoke this, at which point in their phase. A protocol declares no trigger phrases — triggers belong to the invoking skill |
| `## Not for` | **Required.** The boundary against the neighbouring protocol |
| `## Authority` | **Replaced by `## Invoked by`**: the skills and phase operations that may call it. A protocol holds no authority of its own and never widens the authority it was called with (ruling `entrypoint-phase-operation-split`; protocol `phase-operations`) |
| `## Inputs` through `## Limits` | **Required**, unchanged |

§3.1's anti-rationalization table is required under `## Hard gates`. Protocols are where steps get
skipped: `tdd`, `apply-findings` and `review-delta` each exist because a recorded run skipped one.

Long material goes behind `protocols/<id>/references/` on §1's rule.

### 12.2 Roles

`roles/<path>/ROLE.md`, one per catalog entry. `<path>` nests at most one level — the core roles sit
at `roles/<id>/`, the panels at `roles/code-review/<seat>/`, `roles/doc-review/<seat>/` and
`roles/plan-review/<seat>/`. The catalog ids already carry the slash, so the id and the path are one
string: `code-review/security` is both. There is no separate path-naming step, and no
`role.schema.json` for the same reason there is no protocol schema.

A role is **a prompt the runner fills a seat with**. It is not an agent, not a skill, and not a
procedure. It states what the seat judges, the evidence it must cite, what it may never do, and what
it returns when it has nothing to say.

Required sections are a role-specific set, because §3's headings describe a procedure and a role is
not one:

| Heading | What goes in it |
|---|---|
| `## What this seat judges` | The one question this seat answers. One sentence |
| `## Not this seat` | The adjacent seats **and non-seat steps** this one would be mistaken for, and what belongs to them. Three or four *sibling seats*, not the whole panel, plus unbudgeted non-seat and cross-layer entries — below |
| `## What it must be given` | What must be true of the seat's input before it may judge at all. An obligation on the caller — below |
| `## Evidence it must cite` | What the seat must point at for a finding to be admissible |
| `## Never` | The seat's prohibitions. Four rows are governed: two mandatory, two conditional — below |
| `## What it returns` | The finding shape, and the explicit empty return |
| `## When it has nothing to say` | The conditions under which empty is the correct answer |
| `## Rationalizations this seat makes` | The excuses this seat will make, and where each one sends it instead. §3.1's three columns — below |

The order is the seat's arc: what it is, what it is not, what it is handed, how it grounds in that,
what it may never do, what it gives back, the empty case, and the rationalizations. Evidence is drawn
from what the seat was given, which is why `## Evidence it must cite` follows
`## What it must be given` rather than preceding it.

**On length.** §1 governs protocol and role bodies unchanged, and the validator measures them:
`BUDGETED` (`src/validation/budget.ts`) includes the protocol and role sections, and a body over
target raises `budget.body-over-target`. §1 says what follows from that, including that a body over
target is not a defect and is never shortened to clear the number. Report an unusual length in the
handback; do not re-derive §1's rule here.

The heading set below is **descriptive of what these bodies need, not a bound on their length.** A
role longer than its neighbours is not over anything: §1's target and cap are the only lengths that
bind, and §1 says what to do about them. Eight headings is a lot for a body this size, and the two
that grew the set from six earn their place the same way. A seat has two hardest failure modes:
**judging something it should never have accepted**, and **talking itself past a prohibition**.
Neither had a home, so the material leaked into whichever neighbouring section sat closest — a
precondition stretched into `## Not this seat`, a stale-input constraint filed under `## Evidence it
must cite`.

Dropped, and why — a writer reaching for one of these is describing the wrong thing:

- `## Authority` — the runner seats a role; a role never self-authorizes. Whether a seat is filled at
  all is decided by declared risk, not by the seat (ruling `panel-composition-by-declared-risk`).
- `## Workflow` — a prompt is not a procedure. Procedure belongs to the protocol that convenes the
  panel.
- `## Hard gates` — reaching for it means you are describing the protocol that seats this role, not
  the seat. A gate stops a workflow, and a seat has no workflow to stop. §12.1 gives `## Hard gates`
  to protocols precisely because a protocol *is* a procedure. The anti-rationalization table lives
  under its own heading below, **never** under this one.
- `## Inputs` — a seat states what it must be *given*, which is a contract on its caller. A protocol
  lists the inputs it consumes. The difference is who is bound.
- `## Side effects` — **a role has none.** A writer declaring one has put work in a role that belongs
  in a skill or a protocol.
- `## Limits` — folded into `## Never`.

`## Not this seat` names only the **adjacent** seats — the ones whose findings would land in this
seat's output if the boundary blurred. Three or four neighbours, not every other seat on the panel.
A panel where each seat enumerates all the others is quadratic and unmaintainable, and it degrades
worst exactly where the boundaries matter most. A seat that cannot name its neighbours in three or
four does not have a sharp enough question, which is a finding about that seat rather than about
this heading.

Three kinds of confusion belong in this heading, and the budget above governs **only the first**.

1. **Sibling seats on the same panel.** The adjacency rule above. **Budgeted — and the three-or-four
   count is over sibling seats, nothing else.**
2. **Non-seat steps** — synthesis, dispatch, the closure decision, the authority check, the author of
   the rule the seat applies. These are not seats, and "the verdict belongs to synthesis" is a
   `## Not this seat` entry even though synthesis is not a seat. A writer reading *adjacent seats*
   strictly would leave out the step a seat's output is most often mistaken for. **Not budgeted.**
3. **Same-named seats at another layer.** A different error from the other two: not a blurred
   boundary but a reader who has the wrong file open. **Required, and not budgeted.**
4. **Seats in another panel that are not counterparts** — `reviewer-spec` naming
   `plan-review/critic`, `plan-review/planner` naming `implementer`. Neither a sibling nor a twin:
   a seat whose output could be mistaken for this one's across a stage boundary. **Not budgeted, and
   each must name the confusion it prevents.** That sentence is the entry's whole justification, and
   without it this kind has no natural limit — every other seat in the package is a candidate, and
   any of them can be argued adjacent to any other.

**Kind 1 means same-panel, and the three-or-four cap counts only those.** A seat in another panel is
kind 3 or kind 4 and is never charged against it.

**Every exemption in this section is from the bullet count, and from nothing else.** "Unbudgeted"
means the entry does not consume one of the three or four sibling slots; it does not mean the entry
is free of length, and no entry here is exempt from a file-length target should one ever be enforced
against role bodies (see §12.2's note on §1 above). If a role is ever over a length bound, **a
required entry is not what gets cut** — dropping a mandated `## Never` row or a declared counterpart
to fit a line count is weakening the artifact to satisfy a check, which §10 forbids outright. The
material to cut is prose the contract does not require. This is what keeps the cap doing the work it was
written for: sibling enumeration is what grows quadratically with panel size, and cross-panel
entries do not.

Kinds 2 and 3 are exempt for the same reason, and it is the reason the budget exists at all. Every
seat enumerating every other is quadratic — but **only kind 1 is quadratic.** The non-seat
boundaries are a small fixed set, the same size for the smallest panel in this package as for the
largest, and the cross-layer entry answers a different question from the whole section. Charging a
writer for either penalises precisely the entries this heading most needs.

**So count sibling seats when you check the cap.** A reviewer counting total bullets is measuring a
list that does two jobs and will read a compliant role as over budget.

A seat whose name matches or nearly matches a seat in another panel names that counterpart in
`## Not this seat` and states what distinguishes the layers. This entry does not count against the
three-or-four budget, because it answers a different question from the rest of the section. Make it
compete and the writer trades a genuine sibling boundary for it, which is the budget doing the wrong
work.

A seat cannot be trusted to notice its own twin — the twin sits in a panel this writer may not be
authoring. So resolve the counterparts against `catalog.yaml` rather than from memory. The families
that exist today:

| Seat | Counterpart at another layer |
|---|---|
| `code-review/security` | `doc-review/security-lens` |
| `doc-review/security-lens` | `code-review/security` |
| `reviewer-standards` | `code-review/project-standards` |
| `code-review/project-standards` | `reviewer-standards` |
| `code-review/adversarial` | `doc-review/adversarial-document`, `plan-review/critic` |
| `doc-review/adversarial-document` | `code-review/adversarial`, `plan-review/critic` |
| `plan-review/critic` | `code-review/adversarial`, `doc-review/adversarial-document` |
| `reviewer-spec` | `code-review/previous-comments` |
| `code-review/previous-comments` | `reviewer-spec` |
| `code-review/maintainability` | `doc-review/scope-guardian` |
| `doc-review/scope-guardian` | `code-review/maintainability` |

**This table is not complete, and a seat's absence from it is not a finding that it has no
counterpart.** Not every seat is named here. Some counterparts are only visible while
the seats are being written, so completeness is a handback obligation rather than a property this
table can claim — see below. What the table does guarantee is that what it *does* declare is
consistent in both directions.

**Every pairing is stated in both directions, and a new pair is added as two rows or it is not
added.** A reader arrives from whichever file they happen to have open, so a one-directional pairing
is a coin flip on whether the boundary is stated at all — and the direction that gets omitted is the
one nobody was holding when the row was written. A family of three is three rows naming two each.
This table had the defect it exists to prevent: the `security` and `standards` pairs were entered one
way round, which left the reverse naming missing from the two seats that had not been authored yet.

**Unresolved candidates.** These pairs are suggested by the seats' catalog summaries and have not
been confirmed. Each is resolved by the writer who authors either seat **while that seat is still
open**, in one of two ways: promoted into the table as two rows, or recorded in the handback as
examined and not a family, with the distinction that separates them. Leaving one unresolved is not an option, because an unexamined
candidate is indistinguishable from a declared non-family.

| Candidate pair | Why it is a candidate |
|---|---|
| `doc-review/feasibility` / `plan-review/architect` | Both judge whether a proposed approach holds up structurally; the layers differ, and it is not yet established that the questions do. |
| `doc-review/design-lens` / `code-review/frontend-races` | Both concern interaction states and UI flows — one as missing design decisions, one as race potential. Possibly adjacent rather than same-named. |

**A pair that reaches backwards into a closed batch is a contract defect routed to the earlier
batch's fix cycle.** The writer who finds such a pair owns reporting it and never owns fixing the far
side. A later writer amending an earlier body is editing a file it was never given, under a brief
that never covered it, producing an edit that neither batch's reviewer will see against its own
dossier — the batch boundary is what makes a handback reviewable, and a cross-batch edit dissolves
it. The report names both seats and the distinction the writer believes separates them; the earlier
batch's fix cycle writes the bullet, because a seat's own writer is the one who can say what that
seat is not.

**A seat that finds a pair this contract does not declare files a contract defect (§10).** It is not
a body defect, and the writer does not quietly add the bullet and move on: the counterpart is in
another panel that another writer may be authoring from the same table, and a pair recorded in one
body and not the other reproduces exactly the asymmetry the table is checked for. The table is the
specification; a discovery amends the specification.

Batch 2's handback reports every pair it found, including the ones already declared, and every
candidate it resolved. That report is what makes the census auditable — without it, a seat with no
counterpart bullet is silent about whether it has no counterpart or whether nobody looked.

The adversarial family is three seats, not a pair: each of the three names the other two. The
standards pair needs the most care, because those two seats carry conditional `## Never` row 4 in
identical words — two seats judging against a project standard at different layers, with the same
prohibition text, are the most confusable pair in the catalog rather than the least.

Resolve the counterpart in `catalog.yaml` before describing it. A seat that a parallel panel *ought*
to contain is not a counterpart, and describing its concurrency model or verdict vocabulary invents
unfalsifiable detail about a seat that does not exist — worse than no entry, for a reader who opened
the file precisely to tell two seats apart.

**Notation, and it is what makes the invention unwritable: a bullet that refers to a seat names that
seat by its `catalog.yaml` id, in backticks.** A kind-3 bullet leads with the counterpart's id. A
bullet that carries no id is a kind-2 non-seat boundary — the synthesis step, the closure decision,
the ticket author — and it must not be phrased as a seat. Prose describing a seat is how an invented
counterpart gets written: an id would have had to resolve, and a description never does.

Two shapes are legitimate and a checker must not flag them. A sibling in **this** seat's own panel
may be named without an id when the id would be the seat's own — a second instance of the same role
is *the other seat*, not a different one. And a bullet may lead with a collective noun as long as the
seats it covers are named by id inside it. What is never legitimate is naming another panel in prose
with no id anywhere in the bullet, which is exactly the shape an invented counterpart takes.

`## What it must be given` is the one heading that **states an obligation on the caller** rather than
on the seat. `## Never` binds the seat's behavior; this binds whoever seats the role. Hold that
distinction and the section stays small; lose it and it absorbs material belonging to four
neighbours.

Write it as bullets naming the artifacts the seat must receive and **the binding that makes each one
trustworthy** — a hash, a revision, a packet — never a procedure for obtaining them. A seat that
explains how to fetch its input has started writing a protocol.

It pairs with `## When it has nothing to say`, and that pairing is what earns it a heading: a seat
whose input no longer binds **returns nothing rather than judging a stale artifact**.

It also sits next to `## Evidence it must cite`, and the same artifact routinely belongs under both.
From `roles/reviewer-spec/ROLE.md`:

| Heading | The row |
|---|---|
| `## What it must be given` | The prior-finding packet: each finding's id, `fingerprint`, the disposition and evidence recorded when it was raised |
| `## Evidence it must cite` | The finding id and `fingerprint` it is continuing, and the revision it is now checked against |

The test that sorts them: the first binds the **caller** — hand this over or the seat cannot start.
The second binds the **seat** — point at this or the finding is inadmissible.

Four `## Never` rows are governed. Two are mandatory in every role. Two are conditional, and the
condition is a closed list rather than the writer's judgment.

**Mandatory, verbatim in every role body:**

1. **Only independent verification closes a finding.** Reading a patch is the author's confidence,
   not a receipt, and no seat closes what it produced (ruling
   `closure-requires-independent-verification`).
2. **A lane that could not run, could not be given its required context, or failed, returns
   `unavailable`, and says why.** That is a result, not an absence. A required lane that is
   `unavailable` **blocks approval**; it is never downgraded to an empty result and never backfilled
   by the author, the implementer, another seat or the synthesis step (ruling
   `required-lane-failure-is-unavailable`).

**Conditional, required exactly where the condition holds:**

3. **Never edits: it judges and returns.** Carried by every seat except the two that produce an
   artifact. `implementer` and `plan-review/planner` carry the converse instead, naming what the
   seat writes and stating that it never writes a finding, a receipt, a review record or a ticket,
   and never closes or approves what it produced.
4. **Standards grounding.** Two seats judge against a project standard: `reviewer-standards` and
   `code-review/project-standards` (the catalog's only `tier: standards-gate`). They carry *"cites an
   actual project rule or returns empty; an absent standard is never an invented preference."* This
   row is **not** an instance of ruling `required-lane-failure-is-unavailable` and does not cite it.
   No ruling states it; §12.2 does.

Beyond those four, **each seat writes its own grounding rule as its own row**: what it may not assert
without being able to point at something, in its own terms — the spec source, the charter, the frozen
snapshot, a cited source, the proposed driver, its own self-check. That is the seat's prohibition,
never an appendix to a sentence addressed to a different seat.

Two rules govern how mandated rows are written, because ignoring either produced the defect above.

**A mandated row cites a ruling only for what that ruling's text actually says.** Read the row in
`policies/resolved-conflicts.yaml` before citing it. A clause you cannot find there is contract prose:
write it without a citation, and then check whether it belongs in a conditional row instead — a
clause that does not generalize is usually a clause that was never universal.

**Mandate only what is verbatim-identical in every role body.** Everything else is guidance, and
guidance produces rows in the seat's own words. A universal row that needs a bespoke per-seat
instantiation is the welded form returning: the invariant part gets enforced, and the part that must
vary is load-bearing and unchecked.

`## Rationalizations this seat makes` comes last, after `## When it has nothing to say`, and carries
§3.1's table unchanged: the same three columns, `The thought | Why it is wrong | Do this instead`, no
prose around it, and the same rule that a row invented to fill the table is worse than a shorter
table. Two things differ for a role:

- **The rows are the *seat's* rationalizations, not the calling skill's** — "we both picked the same
  option and we are both confident, so this proceeds", "I can see the fix is correct, so the finding
  is closed", "the standard is not written down but everyone knows it". The third column sends the
  seat somewhere deterministic; it never tells the seat to try harder.
- **A row naming a ruling cites it in §6's markdown form**, inline in the "Why it is wrong" column.

This heading is **required, not optional**. A seat with no rationalizations to name has not been
thought about hard enough, so an empty table is a signal to revisit the seat rather than a section to
leave out.

### 12.3 Loose doctrine files

`protocols/invocation-authority.md` is a **file, not a directory**, and has **no catalog entry**. The
catalog's protocol entries do not include it, and that is correct: the plan's tree places it exactly
there, in the plan's repository tree (`research/sources/engineering-skills-repo-plan.md`).

This is safe rather than an oversight. `ak validate`'s directory-without-entry check lists
*directories* under each section root and never examines a loose `.md`
(`src/validation/completeness.ts`, rule `catalog.directory-without-entry`). A loose doctrine file at
`protocols/` root is therefore not an orphan, and **adding a catalog row for it would be the error,
not the fix.**

A loose doctrine file carries shared doctrine that several protocols cite. It has no required section
list, no frontmatter and no sidecar. It is prose, and §8 governs it.

**§6's citation rule binds it too, and nothing checks that it does.** A loose file has no catalog
entry, so no ruling's `binds` block can name it and no `binds`-derived check can reach it. That makes
it the one place in the package where a restated rule is invisible to the tooling — and restating is
exactly what a doctrine file is for, since its whole job is to say something several protocols lean
on. So the obligation is the writer's alone: **where a doctrine file states a rule that a ruling
already decides, it cites the ruling, and it states the rule at the ruling's full width.**

The second half is the one that fails quietly. A restatement that drops a clause reads as complete,
and a reader with no citation cannot discover that it is not — there is no link back to check
against. The clauses that get dropped are the non-obvious actors and the edge conditions, which are
the clauses the ruling exists to pin down; the obvious half of a rule was never the part in dispute.
When a sentence would be awkward at full width, cite the ruling and defer to it rather than shipping
a narrower version of it.

### 12.4 Before handing a protocol or a role back

- The body file is `PROTOCOL.md` or `ROLE.md`. Only `skills` mandates its body filename; for these
  sections a different `.md` name validates with the warning `catalog.unexpected-body-name` — a
  warning to fix, not an allowance to use.
- No frontmatter. No `*.yaml` sidecar.
- For a role: the two conditional `## Never` rows are the right ones for this seat (§12.2). The
  heading set can be complete and the rows still wrong — row 3 takes its authorship form from
  whether this seat produces an artifact, and row 4 belongs only to the two standards seats. A seat
  carrying a row written for a different seat is a defect, not a harmless extra prohibition.
- For a role with a same-named counterpart at another layer: `## Not this seat` names it and says
  what separates the layers (§12.2). Resolve the counterpart in `catalog.yaml` — this is the entry a
  writer authoring one panel is least able to check from memory.
- Every ruling whose `binds` block in `policies/resolved-conflicts.yaml` names this protocol or role
  is cited in the body. That block is the machine-checkable inverse of §6: it tells you before you
  write which rulings you owe a citation.
- Adaptation rows are written as a fragment under `provenance/adaptations.d/<batch>.yaml`, keyed
  `path:` (§5). **The merged `provenance/adaptations.yaml` is generated output and is not the
  writer's to produce or update** — `ak build` writes it and `ak build --check` holds it in sync in
  the gate. A `provenance.adaptations-out-of-sync` failure against a correct fragment is a build that
  has not been run, not a defect in the batch: report it and leave the fragment alone.
- Every donor file cited that the dossier did not name is listed in the handback (§10).
- Authoring a body makes that entry's `status: contract` stale and raises
  `catalog.status-behind-body`. **`catalog.yaml` is owned outside this batch — report the entries you
  authored and let its owner flip them to `authored`; do not edit it yourself.**

### 12.5 Reference packs

`references/<id>/REFERENCE.md`, one directory per catalog entry.

Shared material that skills load **mid-task**, named in the loading skill rather than reached by a
trigger. This is the top-level form of the mechanism §1 describes inside a skill directory, and the
two are not interchangeable. §1's `references/` belongs to one skill and ships inside it; a pack
here has its own catalog entry, is shared, and is loaded by the skills that declare it.

**`loaded_by` is the defining property, not a convenience.** `schemas/catalog.schema.json` requires
it on every reference entry, and `ak validate` enforces it twice — a pack naming no loader fails,
and a loader that is not a declared skill fails (`RULE_REFERENCE_LOADER`,
`src/validation/configrules.ts`). That list is the pack's entire access surface. A reference pack is
never an entrypoint, never appears in a host command surface and is not human-invocable. Note where
that rule is written: `policies/invocation.yaml`'s `protocols-and-roles-are-not-entrypoints` names
two shapes and a reference pack is not one of them, so the statement that binds here is the
schema's. Do not cite the invocation statement for a reference pack; it does not reach it.

No frontmatter and no `*.yaml` sidecar. The packager emits host frontmatter for `skills` alone
(`src/packaging/plan.ts`), so there is nothing to declare and nothing to suppress. §9 does not reach
a reference pack either: a reference entry has no `tests[]` and is not a skill, so it carries no
eval obligation and authoring one is not a reason to add cases.

**§1's numbers do not apply, and no other number replaces them.** A reference pack *is* the long
material §1 sends behind the limit, so capping it at §1's target would defeat what it exists for.
`BUDGETED` (`src/validation/budget.ts`) measures skills, protocols and roles, and a reference pack
is deliberately absent from it. That is not licence to dump. The pack is loaded into a live context
by every skill in `loaded_by`, so its length is paid by each of them at the moment of loading:
material earns its place against the skills that name it, or it does not belong in the file.
Progressive disclosure still applies — it is the mechanism this shape serves.

**There is no required section list.** §12.1 and §12.2 mandate heading sets because a protocol and a
seat each have one fixed job. The packs declared so far do not: a vocabulary, a set of modelling
questions, a principles catalogue and a prose rubric have no shape in common worth forcing. Organise
the pack for the skills in `loaded_by` and say what it is for in its opening lines. **Do not infer a
required heading set from a sibling pack** — the first one authored is an example of one pack's
material, not a template, and the second writer to treat it as one manufactures a convention this
section declined to create.

**What separates this from §12.3.** A loose doctrine file has no catalog entry, which is the premise
§12.3 reasons from: no ruling's `binds` block can name it, no `binds`-derived check can reach it,
and a rule restated there is invisible to tooling. A reference pack has an entry. A ruling's `binds`
block **can** name it, so §6's citation rule is machine-checkable here and §12.3's argument does not
transfer. Check your pack's id against the `binds` groups before deciding a ruling is irrelevant to
you — the same obligation a protocol or role body carries.

Before handing one back, §12.4's checklist applies with its two role-specific bullets skipped, and
with the body-file bullet read as follows: `REFERENCE.md` is currently *preferred* rather than
mandated (`MANDATORY_BODY_SECTIONS`, `src/catalog/layout.ts`), because that list takes its
membership from the shapes §12 gave one body file. This section gives a reference pack one body
file, so the promotion is now available to whoever owns the validator; until it lands, a differently
named body raises `catalog.unexpected-body-name` as a warning rather than an error. Use
`REFERENCE.md`.

**Domain packs are the fifth shape and this contract does not govern them yet.** `catalog.yaml`
declares its `packs` entries at batch 6, every one `status: contract` with no directory on disk.
`policies/invocation.yaml` states how they attach and that they are never entrypoints; nothing
states what a `PACK.md` contains. That section cannot be written from the catalog alone and is not
written here, because inventing a shape for an artifact nobody has designed is the failure §10
exists to catch. A writer dispatched to author a pack before it exists should report a contract
defect (§10) rather than reason by analogy from this section.
