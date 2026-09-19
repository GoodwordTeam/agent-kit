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

Everything longer lives behind `references/` in the skill's own directory and is loaded on demand:

```markdown
Full persona catalog and lane-selection rules: `references/panel-composition.md`.
```

Progressive disclosure through `references/` is **the** mechanism. It is explicitly **not** a
full-body shim that defers to another plugin's hooks, skills or session state — a skill written that
way produces an empty body under a plain `claude plugin install` of this package alone, which is the
only install this catalog supports. A `SKILL.md` whose workflow cannot be executed with nothing but
this package's own files is a validation failure, not a design.

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
> own gate, and this skill's reviewers may not be the author.

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
(plan §1.2, §8; release scenario 21).

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
`schemas/skill.schema.json` in full — nineteen required fields — and four of them have no prose
mirror above, which is exactly why each would otherwise be invented differently in every batch.

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
A row has the form:

```yaml
- target: skills/super-review/SKILL.md
  source: compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-code-review/SKILL.md
  origin: donor
  rationale: Panel composition and severity taxonomy adapted; artifact root replaced by KB calls.
```

The `donor@commit:path` path **must exist at the pin**. Verify it before citing:

```bash
git -C .donors/EveryInc_compound-engineering-plugin cat-file -e 05c42da:skills/ce-code-review/SKILL.md
```

A capability no donor implements takes `origin: conversation` and a `G:L` locator into
`research/sources/grok-transcript.md` instead of a source path:

```yaml
- target: skills/super-review/references/readiness-gate.md
  origin: conversation
  locator: G:L1680-1766
  rationale: Composition of the two-lane readiness profile over the panel verdict; no donor states it.
```

**Never fabricate a source path because a document named a skill.** A donor file that was renamed,
moved or never existed is `origin: conversation`, not a guess at where it used to be.

**Quote donors only from the pinned clone in `.donors/`.** Not from memory, not from the design
transcript's description of a donor, not from a donor's own README about itself. If the clone is not
present, the citation is not available and the writer says so rather than paraphrasing.

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

There are two citation shapes, and `ak validate` resolves both against the same 18 ids:

| Where | Shape |
|---|---|
| A markdown body — `SKILL.md`, a `references/` file, an adapter contract | The word `ruling` followed by the bare id in backticks, inline at the sentence it governs |
| A YAML file — `skill.yaml`, a policy, a profile | The key `ruling: <bare-id>`, or `rulings: [<id>, <id>]` for several |

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

---

## 7. Prohibitions

**No model routing, in any form.** No model or model-family names, no provider or vendor product
names, no pricing or per-token cost expressions, no effort ladders, no escalation tiers, no routing
directives. The literal denylist lives in `src/denylist.ts` rather than in this file, because
reproducing the terms here would trip the check that enforces them; `ak validate` fails on a hit
anywhere outside `provenance/` and `research/sources/`, which quote the sources verbatim by design.
The substitutions are in `AGENTS.md`, "Model routing is stripped".

**Independence between seats is structural, never a model identity.** "An independent reviewer" is a
runner-enforced constraint on who fills the seat (`adapters/runner-contract/CONTRACT.md`). It is
never expressed as, or satisfied by, a different model, provider or family.

**No placeholders.** `TODO`, `TBD`, `lorem` and `placeholder` fail validation. A section a writer
cannot complete is reported as an open item in the batch report, not committed as a stub. (This file
and `AGENTS.md` name those four tokens deliberately, so the rule can be stated; the check is scoped
to skill bodies.)

**No second lifecycle entrypoint.** There is one `autopilot` and one lifecycle. A skill may not
introduce a "run everything", "do the whole thing" or "full loop" entrypoint beside it, and may not
reach a forbidden U-to-U call through a wrapper. Where a host cannot validate a grant, the skill
stops for explicit invocation (`AGENTS.md`, "The invocation law").

**No repository-local project documentation.** Project-derived artifacts are KB-owned (plan §1.2,
§8). A skill that writes `docs/`, `CONTEXT.md`, `plans/`, `.scratch/` or an ADR tree into the working
repository fails release scenario 21, whatever the donor did. `docs/decisions/0001-kb-document-vocabulary.md`
(ADR-0001) names the central equivalent for each retired path and the nine document kinds a KB write
may use; convert every donor "write a file in the repo" instruction into a KB adapter call
(`adapters/knowledgebase/CONTRACT.md`). `ak validate` scans skill bodies for the retired targets.

---

## 8. Writing standard

Plain declarative sentences. A rule states the condition and the consequence. Second person for
instructions to the agent executing the skill, never for the human.

Banned shapes, because they read as authority and carry none: "remember to", "it is important to",
"make sure you", "be careful", "always strive". Replace with the gate that enforces it. "Make sure
the receipt is fresh" is advice; "a receipt bound to a different revision is not fresh — stop and
request a new one" is a gate.

No emoji. No decorative headers. Tables where the content is tabular, prose where it is not.

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
case corpus must cover **all 24** release scenarios in plan §10; `ak validate` reports uncovered
scenario numbers. A writer covers the scenarios its dossier assigns to its batch and reports any it
cannot exercise, rather than tagging a case that does not actually test the scenario.

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
dossier, and this contract. It cannot be told "I checked that already"; it re-derives.

**A handback lists every donor file the writer cited that its dossier did not name.** Following a
dossier's citation into the pinned clone and finding adjacent material is expected: it is how a
dossier's coverage limits get discovered, and it is not an exception to justify. The list exists
because the reviewer re-derives from the dossier, so material the dossier never named is material the
reviewer cannot miss — artifact and packet still agree once it is gone. The delta is what makes that
loss visible.

**At most two fix cycles.** Anything still open after the second cycle is reported with its evidence,
not looped. An open item in a batch report is a normal, expected outcome; a stub committed to make a
report look clean is a fabricated completion and is treated as one.

**Authoring and review are separate passes.** A writer never approves its own output, and never
merges a reviewer's fix and a fresh revision into one indistinguishable edit.

**Recorded for batch 2.** §12.2's adjacency rule for `## Not this seat` is a preventive, not a proven
fix — it was written before any panel larger than three seats had been authored. If batch 2's roles
still restate each other's boundaries under it, the panel needs **one central boundary table that the
roles reference**, rather than each role carrying its own copy. Escalate there; do not widen the
heading and do not let the seats enumerate each other.

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

For a protocol or a role body, §12 replaces this checklist.

---

## 12. Protocols, roles and loose doctrine files

§1–§11 are written for skills. Three further body shapes exist in this package, and two of them are
batch 1's entire output.

What all three share: none is human-invocable, none appears in a host command surface, and neither a
protocol nor a role carries host frontmatter — no `disable-model-invocation`, no `argument-hint`, no
`allowed-tools`, and the packager emits none of them (`policies/invocation.yaml`, statement
`protocols-and-roles-are-not-entrypoints`). §1's size rule and progressive disclosure, §5's
provenance law, §6's ruling citations, §7's prohibitions and §8's writing standard all apply
unchanged.

### 12.1 Protocols

`protocols/<id>/PROTOCOL.md`, one directory per catalog entry, seven of them.

Shared phase logic invoked **by skills**. A protocol is what a skill's phase operation delegates to,
which is exactly why it is not an entrypoint: it has no human trigger of its own.

One naming trap before you start. The invocation law quoted in `AGENTS.md` reproduces the design
brief verbatim, and that brief called `tdd` and `attach-pack` model-invoked *skills*. This package
classifies both as **protocols** — `catalog.yaml` is authoritative, no id is both, and `scout`,
`standards-review` and `spec-review` were likewise renamed or became roles. Take the section from the
catalog, never from the quoted law.

**There is deliberately no `protocol.schema.json`.** The fourteen schemas contain none, and none is
missing. A protocol has no execution contract of its own because it is never invoked directly — it
runs inside the contract of the skill that invoked it. Do not write a `protocol.yaml`. **The
protocol's catalog entry plus its prose is the contract.**

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

`roles/<path>/ROLE.md`, twenty-nine of them. `<path>` nests at most one level — the four core roles
sit at `roles/<id>/`, the three panels at `roles/code-review/<seat>/`, `roles/doc-review/<seat>/` and
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
| `## Not this seat` | The adjacent seats this one would be mistaken for, and what belongs to them. Three or four, not fourteen, plus a required cross-layer entry — below |
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

Eight headings is a lot for a file that runs 75–110 lines, and the two that grew the set from six
earn their place the same way. A seat has two hardest failure modes: **judging something it should
never have accepted**, and **talking itself past a prohibition**. Neither had a home, so the material
leaked into whichever neighbouring section sat closest — a precondition stretched into
`## Not this seat`, a stale-input constraint filed under `## Evidence it must cite`.

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
seat's output if the boundary blurred. Three or four neighbours, not fourteen. Fifteen seats each
enumerating the other fourteen is quadratic and unmaintainable, and it degrades worst exactly where
the boundaries matter most. A seat that cannot name its neighbours in three or four does not have a
sharp enough question, which is a finding about that seat rather than about this heading.

Three kinds of confusion belong in this heading, and the budget above governs only the first two.

1. **Sibling seats on the same panel.** The adjacency rule above. Budgeted.
2. **Non-seat steps** — synthesis, dispatch. These are not seats, and "the verdict belongs to
   synthesis" is a `## Not this seat` entry even though synthesis is not a seat. A writer reading
   *adjacent seats* strictly would leave out the step a seat's output is most often mistaken for.
   Budgeted.
3. **Same-named seats at another layer.** A different error from the other two: not a blurred
   boundary but a reader who has the wrong file open. **Required, and not budgeted.**

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
| `reviewer-standards` | `code-review/project-standards` |
| `code-review/adversarial` | `doc-review/adversarial-document`, `plan-review/critic` |
| `doc-review/adversarial-document` | `code-review/adversarial`, `plan-review/critic` |
| `plan-review/critic` | `code-review/adversarial`, `doc-review/adversarial-document` |

The adversarial family is three seats, not a pair: each of the three names the other two. The
standards pair needs the most care, because those two seats carry conditional `## Never` row 4 in
identical words — two seats judging against a project standard at different layers, with the same
prohibition text, are the most confusable pair in the catalog rather than the least.

Resolve the counterpart in `catalog.yaml` before describing it. A seat that a parallel panel *ought*
to contain is not a counterpart, and describing its concurrency model or verdict vocabulary invents
unfalsifiable detail about a seat that does not exist — worse than no entry, for a reader who opened
the file precisely to tell two seats apart.

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

**Mandatory, verbatim in all twenty-nine:**

1. **Only independent verification closes a finding.** Reading a patch is the author's confidence,
   not a receipt, and no seat closes what it produced (ruling
   `closure-requires-independent-verification`).
2. **A lane that could not run returns `unavailable`.** That is a result, not an absence: never an
   empty result, and never backfilled by the author, another seat or the synthesis step (ruling
   `required-lane-failure-is-unavailable`).

**Conditional, required exactly where the condition holds:**

3. **Authorship.** Twenty-seven seats carry *"never edits: it judges and returns."* The two that
   produce an artifact — `implementer` and `plan-review/planner` — carry the converse instead,
   naming what the seat writes and stating that it never writes a finding, a receipt, a review record
   or a ticket, and never closes or approves what it produced.
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

**Mandate only what is verbatim-identical in all twenty-nine.** Everything else is guidance, and
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
catalog's seven protocols do not include it, and that is correct: the plan's tree places it exactly
there (`research/sources/engineering-skills-repo-plan.md:220`).

This is safe rather than an oversight. `ak validate`'s directory-without-entry check lists
*directories* under each section root and never examines a loose `.md`
(`src/validation/completeness.ts`, rule `catalog.directory-without-entry`). A loose doctrine file at
`protocols/` root is therefore not an orphan, and **adding a catalog row for it would be the error,
not the fix.**

A loose doctrine file carries shared doctrine that several protocols cite. It has no required section
list, no frontmatter and no sidecar. It is prose, and §8 governs it.

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
- Every donor file cited that the dossier did not name is listed in the handback (§10).
- Authoring a body makes that entry's `status: contract` stale and raises
  `catalog.status-behind-body`. **`catalog.yaml` is owned outside this batch — report the entries you
  authored and let its owner flip them to `authored`; do not edit it yourself.**
