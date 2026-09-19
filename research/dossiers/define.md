# Donor dossier — batch "define" (alignment & planning skills)

Batch items: `skills/super-align` (U), `skills/super-bound` (U), `skills/wayfind` (U),
`skills/doc-review` (M, called by super-bound), `references/codebase-design`,
`references/domain-modeling`.

All donor commits were verified present with `git cat-file -e <commit>:<path>` at the pinned
SHAs in the task header before citing them below. Plan section numbers are `plan §x`. Transcript
locators are `G:Lx-Ly` (1-based lines of `research/sources/grok-transcript.md`).

---

## 0. Read this before writing any of the six items

### 0.1 The one big adaptation: every donor "write a file in the repo" instruction becomes a KB call

This is the single largest edit every donor source needs, so it is stated once instead of six
times below. Pocock's skills default to writing `CONTEXT.md`, `docs/adr/NNNN-slug.md`,
`.scratch/<feature-slug>/issues/<NN>-<slug>.md`, `tasks/plan.md`, `tasks/todo.md`,
`docs/intent/[topic].md`. CE's skills default to `<root>/plans/YYYY-MM-DD-HHMM-*.md` under a
`docs_root` resolved from `.compound-engineering/config.yaml`. **None of that survives.** Per
plan §1.2 and §8, "Context, ADRs, requirements, implementation plans, ticket artifacts, review
ledgers, solutions, project standards" are Central-KB-owned; "project documentation does not live
in application repositories" (plan, Scope and source authority). Every donor mechanism below that
says "write X to a file" becomes "compose X in this shape, then call the KB adapter's
`recordDecision` / `publishArtifact` / `readContext`" (plan §8 operation names; CONTRACT.md itself
is a different batch — cite it by name, do not invent its signature). This is also **release
scenario 21** for this batch: a KB write must stay central and must not create an
application-local docs tree. Concretely:

- super-align's CONTEXT.md glossary + ADRs → KB `recordDecision`/`publishArtifact` calls, content
  shaped per Pocock's `CONTEXT-FORMAT.md` / `ADR-FORMAT.md` (§1 below).
- super-bound's spec + tickets → KB `publishArtifact` (spec) and KB `tickets/` records
  (§5.3, §8), not `.scratch/<slug>/issues/`.
- wayfind's map issue + child tickets → the map is inherently a *tracker* artifact (it needs
  native blocking/assignment). Per plan §8, "Store tracker IDs and URLs as links to the
  authoritative ticket record. Choose one ticket system of record." When a real tracker
  (GitHub/Linear) is configured, wayfind uses it directly, same as upstream, and the KB stores a
  link. When no tracker is configured, the KB's own `tickets/` directory is the fallback system of
  record (replaces Pocock's "local-markdown tracker" default) — never a `.scratch/` folder in the
  working repo.
- doc-review's decision primer / fingerprints / settled-decisions history → these are round-to-round
  *session* state (kept for the duration of one review run) plus durable dispositions that belong
  in the KB's `reviews/` record once the run ends, not a bespoke file CE writes into the app
  repo's `docs/`.

### 0.2 Ticket schema unification resolves the "decision ticket vs implementation ticket" tension

G:L1556 and G:L1692/1795 use "decision ticket" (wayfinder) and "implementation ticket" (to-tickets
tracer bullet) as if they were two vocabularies. Plan §5.3 resolves this: there is **one**
`ticket` artifact with a `type` field of `decision` or `implementation`. wayfind emits only
`type: decision` tickets (Pocock's `research` / `prototype` / `grilling` / `task` are subtypes of
`decision`, per wayfinder's own "Ticket Types" section — none of Pocock's four subtypes is an
implementation slice). super-bound's to-tickets machinery emits `type: implementation` tickets
(tracer-bullet DAG). Both conform to `schemas/ticket.schema.json` (owned by another batch — cite
by name only). plan §2.4's wayfind boundary line — "Decision tickets cannot be sent to an
implementer as though approved" — is exactly the type-check a validator runs on this shared
schema: an implementer consuming a ticket rejects one whose `type` is `decision`.

### 0.3 Invocation law: super-align, super-bound, and wayfind are all U — none may call each other

Per plan §7.1 and G:L1672-1678/1627: a user-invoked skill may call model-invoked skills but never
another user-invoked skill; only a runner-validated delegation grant may invoke a shared *phase
operation*. super-align, super-bound, and wayfind are all `U` in the fixed catalog. Concretely:

- **wayfind resolving a "grilling"-type decision ticket does not itself re-implement the interview
  loop and does not programmatically invoke super-align** (U cannot call U). G:L1795 — "Resolving
  a decision ticket is align, not build" — reads as: the human picks up the ticket's Question and
  starts a *new, ordinary, human-invoked* `super-align` run seeded with that question; wayfind's
  job stops at handing over the ticket text and claiming/closing it afterward. This is a dossier
  recommendation (the transcript states the boundary but not the mechanics); flag it as such to
  the writer and make it explicit in wayfind's SKILL.md rather than silently duplicating align's
  interview mechanic inside wayfind.
- wayfind resolving a `research`-type ticket **can** dispatch the `research` skill directly — per
  the fixed catalog, `research` is `M`, and U→M is allowed (Pocock's wayfinder already does this:
  "Resolved by a subagent that calls the Skill tool with 'research'").
- wayfind resolving a `prototype`-type ticket **can** dispatch `prototype` directly for the same
  reason (`prototype` is `M` in the fixed catalog, even though Pocock's original is written as
  HITL — a human is still present for the reaction, only the invocation-authority label differs).
- super-bound calling `doc-review` is U→M, explicitly allowed and explicitly the wiring plan §2.3
  specifies ("doc-review ... called by super-bound").
- super-bound invoking the `consensus-plan-gate` protocol is **not** a skill call at all — it is an
  internal protocol operation gated by "genuine architectural disagreement, high risk, or a
  review-driven replan" (plan §2.3, §6.5), reached through the same
  public-entrypoint/shared-phase-operation split as everything else in plan §7.1. Link to it as
  `../../protocols/consensus-plan-gate/PROTOCOL.md` even though that protocol is a different
  batch's output — this is a forward reference the writer should leave in place; note it as a
  cross-batch dependency rather than fabricating protocol content here.

### 0.4 Model-agnostic stripping applies uniformly

Every donor snippet below that names a model tier (Luna/Terra/Sol/Astra/Jev, "Astra-low", "Luna
Max", seat-pricing tables) is excluded per the ground rules and per plan (Scope and source
authority: "excludes model selection, model pricing, provider configuration, effort ladders,
model escalation"). Where a donor mechanism is *entangled* with a model-tier decision (e.g. CE
doc-review's persona "Seat Tier" table, or the "smart chair / dumb specialists" discussion), keep
the *routing rule* (which persona activates on which signal, cheap-mechanical-vs-expensive-judgment
split as an abstract distinction) and drop the tier names. Concretely for this batch: keep CE's
persona *activation signals* (§4 below) verbatim in substance; drop every "Luna/Terra/Sol/Astra"
label CE attaches to a persona.

---

## 1. `skills/super-align` (U)

### 1.1 Sources

- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/productivity/grilling/SKILL.md`
  (whole file, 20 lines) — the **only** interview primitive to import; grill-me and grill-with-docs
  are both one-line wrappers around it (`grill-me/SKILL.md`, `grill-with-docs/SKILL.md`, same
  commit) — do not treat those as separate mechanisms, just note that grill-with-docs = grilling +
  domain-modeling run together, which is what super-align already does by combining §1 and the
  domain-modeling reference.
- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/domain-modeling/SKILL.md`,
  `.../domain-modeling/ADR-FORMAT.md`, `.../domain-modeling/CONTEXT-FORMAT.md` — the glossary/ADR
  content shapes align writes through the KB (see §0.1). Also the direct source for
  `references/domain-modeling` (§6 below) — align *loads* that reference rather than duplicating
  its text.
- `superpowers@b36e0829c6d0140e93cfef2ca599b1b07d4a7797:skills/brainstorming/SKILL.md`
  (whole file) — the HARD-GATE, the approval-never-scales-down rule, the "propose 2-3 approaches"
  step, the red-flags/rationalization table, the one-way ratchet on path classification.
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-brainstorm/SKILL.md#L1-L45`
  and `.../skills/ce-brainstorm/references/phase-0.md#L1-L45` — the "right-sized requirements
  discovery" tiering (Lightweight / Standard / Deep), the coherent-work gate (split a bundled
  multi-outcome request before brainstorming any one of them), and the rule that an already-clear
  request still gets *some* tier classification rather than skipping straight to build.
- `addy@c004a74784a08295d52749b04cda634125b9a581:skills/interview-me/SKILL.md`
  (whole file) — the evidence-discipline mechanics: HYPOTHESIS/CONFIDENCE numbers, one question
  with a guess attached, the "want vs. should-want" probe, the five-field restate
  (Outcome/User/Why now/Success/Constraint/**Out of scope**), the explicit-yes gate, the
  rationalization table, the verification checklist.
- G:L1684-1694 (the `align` design itself), G:L1509 and G:L1532 and G:L1550-1552 (what to steal
  from Addy/Pocock re: grilling vs interview-me and the grill→CONTEXT.md pipeline), G:L1591 and
  G:L1625 (the one-line summary of align in the grafts table and the "five files of content"
  list).

### 1.2 Mechanisms to import

**From Pocock `grilling` — the core loop, verbatim mechanics, adapt only the write target (§0.1):**

> "Map this as a **design tree**: every decision branches into the decisions that hang off it.
> Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already
> settled... Ask the whole frontier in one round: number each question and give your recommended
> answer. Then wait for the user's answers before the next round."

Import the exact round format (numbered `❓ **Q1**` + `➡️` recommended answer), the frontier
recomputation after each round, the rule that fact-finding is the agent's job never the user's
("dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself...
don't block on it"), and the termination condition ("done when the frontier is empty... Do not act
on it until the user confirms"). This is the mechanical backbone of super-align's questioning
phase; the transcript's "One question at a time. Prefer multiple choice. Propose 2-3 approaches
with tradeoffs, not one 'recommendation.'" (G:L1688) is this same mechanism plus Superpowers'
approach-generation step folded in.

**From Superpowers `brainstorming` — the gate and the approval discipline:**

> "Do NOT invoke any implementation skill, write any code, scaffold any project, or take any
> implementation action until you have told your human partner what you intend and they have
> approved it. This applies to EVERY task on EVERY path below — the ceremony scales with the task;
> the approval gate never does."

This is exactly plan §2.1's "no implementation before approval" boundary and G:L1690's HARD-GATE
("no files written except CONTEXT.md / a tiny ADR until the human says the design is approved").
Import the **anti-pattern table** wholesale (the "too simple to need approval" excuses and their
rebuttals — "Simple means a short design, not no design"), and the **one-way ratchet**: "Hidden
complexity discovered mid-task upgrades the path — stop, say so, and step up. Nothing downgrades
mid-task." Also import "Propose 2-3 approaches — with trade-offs and your recommendation... Lead
with your recommended option and explain why."

Note: Superpowers' own three-path system (Spike/Bounded/Architectural) is *itself* the
right-sizing job that CE's Lightweight/Standard/Deep tiering (below) also does. Do not import
both as parallel classifiers — merge into one tier vocabulary in the actual skill (the dossier does
not prescribe which name wins; that is a writing decision, not a sourcing one). Either way, the
important shared idea to keep from both is: **a trivial/bounded task still gets a short in-chat
design and an explicit approval, it just skips writing a spec file** — this is what lets a "typo
fix" or "reviewed ticket entering at build" (plan §1.1) skip super-align's ceremony without
skipping the gate that stops silent implementation.

**From CE `ce-brainstorm`/`phase-0.md` — right-sized requirements discovery:**

> "Lightweight ends in chat. The result is a paragraph in the synthesis... No file is written...
> A file is written only when the dialogue produced a decision that a downstream consumer needs
> recorded under a stable ID, or when the user asks for one."

Import the **tiering test** (Lightweight/Standard/Deep by ambiguity and cross-cutting-ness, "if the
scope is unclear... take the heavier tier") and the **coherent-work gate**: "check whether the
request contains more than one independently plannable product outcome... Propose a plain-language
breakdown... Ask which one area this brainstorm should own." This is the mechanism that keeps
super-align from silently scope-creeping a multi-feature ask into one blob decision.

Do **not** import CE's `docs_root`/`config.yaml` artifact-root resolution machinery, its
Direct/Chat-brief/Durable *output-contract* naming (that's ce-plan's vocabulary, redundant with the
tier test above), or any HTML-rendering/output-format logic — all CE-plugin-specific plumbing
excluded per ground rules and §0.4.

**From Addy `interview-me` — evidence discipline, the batch brief's named mechanism:**

Import the full five-step process: (1) HYPOTHESIS + CONFIDENCE number, with a one-line reason
attached whenever confidence is below ~70%; (2) one question at a time, each with `GUESS:` and its
reasoning attached; (3) the "want vs. should-want" probe — *"If you didn't have to justify this to
anyone, what would you actually want?"* — fired when the user gives a
convention-signaling/buzzword answer; (4) the five(+one)-field restate — Outcome / User / Why now /
Success / Constraint / **Out of scope** (non-negotiable field); (5) the explicit-yes gate, with its
enumerated list of things that are **not** yes ("Whatever you think is best," "Sounds good," "Sure,
let's go," silence). Import the **95% Confidence Stop** test verbatim as the termination
condition companion to grilling's "frontier is empty" test — they are complementary, not
competing: frontier-empty is a structural completeness check, the confidence stop is a predictive
check ("Can I predict the user's reaction to the next three questions I would ask?"). Import the
**rationalization table** (8 rows: "The ask is clear enough," "Asking too many questions wastes
their time," etc.) and the **red flags** list, both directly reusable for super-align's own
anti-pattern section, merged with Superpowers' equivalent table rather than duplicated.

Plan §2.1's phrase "Addy evidence discipline" (also G:L1509: "Numbers without a source get a
reason or get dropped") maps onto interview-me's confidence-number-with-reason rule plus its
"want vs should want" probe — both target the same failure mode (accepting a plausible-sounding
but unverified answer).

### 1.3 Passages worth adapting (short, best concrete phrasing)

- Grilling's round format (quoted above) — adapt only by pointing the "update CONTEXT.md inline"
  step (domain-modeling's own instruction) at the KB `recordDecision` call instead of a file write.
- Superpowers' anti-pattern table row: `"It's bounded and the design is obvious — I'll start while
  they read it" → "The gate is the approval, not the design's length. Present, then stop until you
  hear yes."` — directly reusable, change nothing.
- interview-me's Step 5 enumeration of false-yes answers — directly reusable as the definition of
  what counts as "the human says the design is approved" for the HARD-GATE.
- interview-me's Output section: *"If the user wants the intent to persist... offer to save it."*
  — adapt "save it to `docs/intent/[topic].md`" to "offer to record it via the KB adapter"
  (§0.1).

### 1.4 Output contract recap (from plan, for the writer's convenience — not sourced from a donor)

Approved direction or an explicit unresolved decision ticket (never silent). KB CONTEXT and ADR
drafts via the KB contract. No implementation before approval. When a fork the human can't answer
surfaces, emit a `type: decision` ticket (§0.2) rather than guessing — this is wayfind's territory
if the fork is part of a larger multi-session effort (§3), or a same-session escalation to the
human if it is not.

---

## 2. `skills/super-bound` (U)

### 2.1 Sources

- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-plan/SKILL.md#L1-L60`
  — "executable planning" framing: Specify→Plan is CE's job split ("`ce-brainstorm` defines WHAT,
  `ce-plan` plans HOW"), the **mandatory doc-review chaining** after the plan is written
  (non-interactive mode), and the settled-decision-invalidation escape hatch (a decision made
  earlier in the same session that new evidence contradicts must not be silently overridden —
  return an explicit blocked/replan signal, never resolve it silently). Do not import CE's
  Direct/Chat-brief/Durable output-contract vocabulary, `docs_root` resolution, or HTML rendering
  (§0.4, and redundant with super-align's tiering, §1.2).
- `superpowers@b36e0829c6d0140e93cfef2ca599b1b07d4a7797:skills/writing-plans/SKILL.md`
  (whole file) — "zero-context work packets," the **Interfaces block** (Consumes/Produces with
  exact signatures — "this block is how they learn the names and types neighboring tasks use"),
  Task Right-Sizing ("the smallest unit that carries its own test cycle and is worth a fresh
  reviewer's gate"), the **No Placeholders** list (verbatim bannable phrases — TBD, "add
  appropriate error handling," "similar to Task N"), and the **Self-Review** checklist (spec
  coverage, placeholder scan, type consistency) run by the planner itself before handoff.
- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/to-spec/SKILL.md`
  (whole file) — the six-section spec template (Problem Statement / Solution / User Stories /
  Implementation Decisions / Testing Decisions / Out of Scope / Further Notes), the **seam-first**
  instruction ("Sketch out the seams at which you're going to test the feature... Use the highest
  seam possible... the ideal number is one"), and the rule that file paths/code snippets are
  excluded from the spec *except* when a prototype already encoded a decision precisely (state
  machine, reducer, schema, type shape) — then inline just the decision-bearing fragment.
- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/to-tickets/SKILL.md`
  (whole file) — tracer-bullet vertical-slice rules, the **blocking-edges** contract, the
  **wide-refactor exception** (expand→migrate-in-batches→contract, when one mechanical rename
  breaks thousands of call sites and no vertical slice can land green), the frontier-working rule
  ("any ticket whose blockers are all done"), and the local-file vs. real-tracker publish split
  (directly informs the KB-vs-external-tracker resolution in §0.1).
- `addy@c004a74784a08295d52749b04cda634125b9a581:skills/spec-driven-development/SKILL.md#L1-L130`
  — Phase 0 **capability map** (decompose a bundled multi-capability request into a dependency
  table with stable kebab-case module ids *before* writing any one spec — same job as
  super-align's coherent-work gate, but for bound's larger/multi-module case), the
  **ASSUMPTIONS I'M MAKING** surfacing block, and the **three-tier boundaries** contract (Always
  do / Ask first / Never do).
- `addy@c004a74784a08295d52749b04cda634125b9a581:skills/planning-and-task-breakdown/SKILL.md#L1-L100`
  — the dependency-graph-bottom-up ordering, vertical-vs-horizontal slicing worked example (good
  reusable illustration alongside Pocock's to-tickets), and the per-task acceptance/verification/
  dependencies/files-touched template — cross-check against Pocock's to-tickets templates rather
  than importing a second, competing task-template.
- `addy@c004a74784a08295d52749b04cda634125b9a581:skills/constraint-driven-development/SKILL.md#L1-L90`
  — the "detect before you ask" step (read `package.json`/CI config/etc. before asking the user
  anything) and the four-question-with-defaults interview pattern, as the source for super-bound's
  once-per-repo **constraints file** (G:L1701: "PR size ~100 LOC when possible, pyramid 80/15/5,
  Beyoncé rule, Hyrum on public surfaces, Chesterton on deletes" — treat these as advisory
  defaults per plan §3, never hard limits).
- G:L1698-1706 (the `bound` design itself: Spec/Tickets split, doc-review call, constraints file),
  G:L1556 (decision-ticket vs. implementation-ticket, resolved in §0.2), G:L1597 ("is this a
  decision ticket or an implementation ticket?" as the per-ticket gate — strip the Jev-routing
  framing, keep the gate itself as a deterministic type check per §0.2).

### 2.2 Mechanisms to import

**Two artifacts, different jobs (transcript's framing, directly matches plan §2.1's required
output list):**

> "**Spec** — destination. Problem, non-goals, acceptance, test seams. No file paths unless a
> prototype already settled a decision... Run ce-doc-review on it... **Tickets** — tracer-bullet
> DAG. Each ticket is one visible slice, exclusive file ownership, blocking edges, named
> verification. Superpowers' zero-context rule: a Luna worker with an empty window must be able to
> do it. If you cannot write the ticket that way, it is still a decision ticket." (G:L1698-1704)

This is the whole shape of super-bound: compose the spec from to-spec's template + writing-plans'
zero-context discipline, run `doc-review` on it (M invoked from U, §0.3), only then decompose into
tickets via to-tickets' tracer-bullet method with writing-plans' Interfaces block and Task
Right-Sizing bar, and gate every ticket through the type check in §0.2 (fails zero-context → it
was actually a decision, route back toward super-align/wayfind, don't force it).

**Zero-context work packets (writing-plans):** import "Assume they are a skilled developer, but
know almost nothing about our toolset or problem domain" as the calibration line, and the
Interfaces block format:

```
**Interfaces:**
- Consumes: [what this task uses from earlier tasks — exact signatures]
- Produces: [what later tasks rely on — exact function names, parameter
  and return types...]
```

This is the concrete mechanism behind plan §5.3's "dependency DAG... likely read dependencies"
ticket fields — it is what makes a ticket genuinely zero-context rather than just short.

**No Placeholders (writing-plans) — reusable almost verbatim as a super-bound stop condition,**
and notably it is the donor source of this repo's own ground rule ("No unfinished-content
markers"): "TBD", "implement later", "add appropriate error handling" / "add validation" /
"handle edge cases" without specifics, "Similar to Task N" (repeat the code instead), steps that
describe without showing.

**Tracer bullets + blocking edges + wide-refactor exception (to-tickets):** import the vertical-
slice rules block verbatim in substance:

> "Each slice cuts a narrow but COMPLETE path through every layer... A completed slice is demoable
> or verifiable on its own... Each slice is sized to fit in a single fresh context window."

and the wide-refactor carve-out (expand → migrate-in-batches, each batch its own ticket blocked by
the expand step, keeping CI green batch to batch → contract, blocked by every migrate batch) —
this is the one place tracer-bullet slicing is explicitly *not* the right shape, and plan §5.3's
"Dependency edges are not sufficient for safe parallelism: check write ownership, shared generated
artifacts, global migration numbering" is exactly this scenario generalized.

**Seams-first spec discipline (to-spec):** "the fewer seams across the codebase, the better - the
ideal number is one" — this is the direct tie to `references/codebase-design`'s seam vocabulary
(§5). Note the plan's explicit restriction (plan §2.4/§4 table row) that codebase-design is
"Loaded by align and improve-architecture, not additional slash commands" — super-bound should
*use* seam language already established during super-align's approved direction rather than
re-loading the full reference itself; if bound genuinely needs the vocabulary fresh, flag that as
a plan-vs-content tension for the writer to resolve explicitly (§8 Conflicts), don't silently
violate the stated restriction.

**Capability map (Addy spec-driven-development Phase 0):** the decomposition table format —

```
| Module id | Responsibility | Depends on |
|---|---|---|
| identity | Accounts, sessions, SSO | — |
```

— is the multi-module-request equivalent of super-align's coherent-work gate, but scaled to
bound's larger case (a spec that turns out to bundle several independently shippable specs). Import
the stable-kebab-case-id rule and "the map is gated like every phase" (human review before any
module spec is written).

**Constraints (once per repo):** import the "detect before you ask" table (read `package.json` /
CI config / etc. first) and the default-attached-question pattern from constraint-driven-
development, but scope it down: super-bound's constraints file is plan §3's advisory pack
defaults (PR-size, test-pyramid), not the full accessibility/performance/security constraint
system (that is `packs/pack-*`, a different batch — cross-reference by name, don't rebuild it
here).

### 2.3 Passages worth adapting

- to-spec's spec template header-to-footer is close to drop-in; rename per plan §5.3's ticket/spec
  field names (non-goals, acceptance criteria, verification commands) where they diverge from
  to-spec's own section names (Out of Scope, Testing Decisions).
- writing-plans' Plan Document Header block (`**Goal:**`, `**Architecture:**`, `**Spec:**`,
  `## Global Constraints`) is a good concrete shape for the top of a `type: implementation` ticket
  batch header — adapt the "REQUIRED SUB-SKILL" superpowers cross-reference away (that names a
  Superpowers-specific execution skill we are not keeping as a separate command; super-build owns
  execution in this catalog).
- to-tickets' local-vs-tracker publish split — adapt "local files → `.scratch/<slug>/issues/`" to
  "local fallback → KB `tickets/`" per §0.1.

---

## 3. `skills/wayfind` (U)

### 3.1 Sources

- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/wayfinder/SKILL.md`
  (whole file, ~100 lines) — this is effectively the entire donor source for this skill; import
  its structure closely, adapting only the tracker-abstraction and invocation-authority points
  noted below. Key sections to carry over near-verbatim in substance:
  - **Plan, don't do:** "each ticket resolves a decision, and the map is done when the way is
    clear... An effort can override this in its **Notes**, carrying execution into the map
    itself, but absent that, produce decisions, not deliverables."
  - **The Map** body template (Destination / Notes / Decisions so far / Not yet specified / Out
    of scope) — import verbatim as the map artifact shape.
  - **Ticket Types:** HITL vs AFK distinction, and the four subtypes — `research` (AFK, resolved
    by dispatching the `research` skill), `prototype` (HITL, resolved by dispatching `prototype`),
    `grilling` (HITL, "the default case" — resolved per §0.3's recommendation, not by
    self-invoking align), `task` (HITL or AFK, "the one type that does rather than decides").
  - **Fog of war / Not yet specified / Out of scope** — the three-way distinction between a
    sharp-but-blocked question (ticket), a sensed-but-unsharpened question (fog), and a
    consciously excluded question (out of scope; "never graduates"). This is a genuinely novel
    and precise mechanism worth importing whole — it has no equivalent elsewhere in the other
    donors.
  - **Invocation, "Chart the map"** 6-step procedure and **"Work through the map"** 5-step
    procedure — import both, with step 1 of "Chart the map" ("Call the Skill tool twice, for
    'grilling' and 'domain-modeling'") reinterpreted per §0.3 (load `references/domain-modeling`
    directly — that's a reference, not a U/M-restricted skill call — and run the grilling
    *mechanism* inline here since charting the map's destination is wayfind's own job, distinct
    from resolving a decision ticket later, which is where the U-cannot-call-U rule bites).
  - **Never resolve more than one ticket per session, with the exception of research tickets** —
    import verbatim as a hard limit.
  - **Refer by name** — "A wall of `#42, #43, #44` is illegible; names read at a glance" — good,
    reusable UX rule with no dependency on tracker internals.
- G:L1787-1795 (wayfind's one-paragraph primitive description: "Map longer work into decision
  tickets... Resolving a decision ticket is align, not build."), G:L1556 (decision-ticket vs.
  implementation-ticket framing, resolved in §0.2), G:L1532 (wayfinder listed among the human-gate
  commands, confirming U), G:L1627 ("stops the Luna chair from starting a wayfinder" — the
  invocation-law point behind §0.3).

### 3.2 Mechanisms to import

The **Map/ticket/frontier vocabulary is the whole mechanism** — there is nothing to synthesize
from a second donor here, unlike super-align/super-bound. The adaptation work is entirely about
fitting Pocock's tracker-native design (native blocking relationships, issue assignment as claim)
onto our KB-or-external-tracker duality (§0.1) and our stricter invocation law (§0.3). Two donor
passages are the load-bearing ones for that adaptation:

> "Where the map, its child tickets, blocking, and frontier queries physically live is
> tracker-specific... If no tracker has been provided, default to the local-markdown tracker."

— map this directly onto §0.1's resolution: "local-markdown tracker" becomes "KB `tickets/`."

> "A session **claims** a ticket by assigning it to the dev driving the map, **first**, before any
> work, so concurrent sessions skip it. That assignee *is* the claim."

— when the system of record is a real external tracker this imports unchanged (native assignment).
When the fallback is the KB, the writer needs an explicit claim mechanism in the KB ticket record
(e.g., a `claimed_by`/`claimed_at` field) since the KB adapter's listed operations in plan §8
(`readContext`, `recordDecision`, `publishArtifact`, `linkCodeEvidence`, `requestImpactAnalysis`,
`linkPullRequests`, `proposeLesson`) do not obviously include an atomic claim primitive — flag this
as a gap for the KB CONTRACT.md batch (§7 below), do not invent a KB operation here.

### 3.3 Passages worth adapting

- The ticket type table's dispatch verbs ("Resolved by a subagent that calls the Skill tool with
  'research'") — adapt "Skill tool" phrasing generically since this repo targets multiple hosts
  (plan §1.3), not just Claude Code's Skill tool specifically.
- "Every map and ticket is an issue, so it has a **name**: its title" — if the KB fallback tracker
  represents tickets as files rather than issues, the "name" concept still applies (front-matter
  title), just adapt "issue" → "ticket record."

---

## 4. `skills/doc-review` (M, called by super-bound)

### 4.1 Sources

- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-doc-review/SKILL.md`
  (whole file, 75 lines) — the phase structure (intake → team selection/dispatch → cross-model
  pass, optional and excluded per §0.4 → synthesis/presentation → next action) and the **Done
  when** condition: "every selected reviewer has returned or is named as failed in Coverage,
  retained findings have a verified consequence for the agreed work, and every authorized
  correction assigned to Apply has been made and checked." Drop the `<root>` /
  `.compound-engineering/config.yaml` artifact-root block entirely (§0.1/§0.4); drop the
  cross-model / peer-CLI pass entirely (it is CE's multi-vendor-agent feature, orthogonal to this
  repo's model-agnostic mandate, and not named anywhere in plan §6.5's doc-review description).
- `.../skills/ce-doc-review/references/persona-selection.md` (whole file, 41 lines) — the
  **exact** activation-signal text for all five conditional personas, matching plan §6.5's catalog
  (coherence, feasibility always-on; product-lens, design-lens, security-lens, scope-guardian,
  adversarial conditional). This is close to drop-in; keep the signal descriptions, drop nothing.
- `.../skills/ce-doc-review/references/personas/{coherence,feasibility,product-lens,design-lens,
  security-lens,scope-guardian,adversarial-document}-reviewer.md` — matches the fixed catalog's
  `roles/doc-review/{coherence,feasibility,product-lens,design-lens,security-lens,scope-guardian,
  adversarial}.md` file set exactly, one donor file per target file. See §4.2 for what to pull
  from each.
- `.../skills/ce-doc-review/references/synthesis-and-presentation.md` (343 lines) — the routing
  pipeline (§3.1-3.9 in the donor's own numbering) and, most importantly for this batch's named
  release scenario, **R29 (Rejected-Finding Suppression)** and **R30 (Fix-Landed Matching
  Predicate)** in full (quoted §4.2 below).
- `.../skills/ce-doc-review/references/decision-primer.md` (whole file, 47 lines) — the
  round-to-round primer format and the rule for which actions count as "rejected" (Skip, Defer,
  Acknowledge; a *user-settled* Withdraw; explicitly **not** an Apply-triggered Withdraw).
- `.../skills/ce-doc-review/references/open-questions-defer.md` (whole file, 158 lines) — the
  Defer append mechanic and its idempotence dedup key
  (`normalize(section) + normalize(title) + why_fingerprint`); useful mainly as the concrete
  worked *example* of what "fingerprint... not only line number" (plan §5.5) looks like in
  practice for a document (as opposed to a code finding).
- `.../skills/ce-doc-review/references/review-output-template.md` (whole file, 123 lines) — the
  exact bucket-to-CE-vocabulary mapping used in §4.2, and the Coverage table shape (per-persona
  status/findings/Auto/Proposed/Decisions/FYI/Residual counts, plus `Dropped:`/`Restated:`
  footnotes) — a good concrete shape for `doc-review`'s output artifact, adapted to plan §5.5's
  canonical field names (severity, confidence_anchor, spec_quality, etc.) rather than CE's own
  enum spellings.
- G:L600-800 in full (already read; this is the transcript's own extended discussion of
  ce-doc-review, including the "four buckets, not a 34-item questionnaire" table quoted in §4.2,
  the smart-chair/dumb-specialist framing — model-tier content excluded per §0.4, keep only the
  underlying point that mechanical corrections and judgment corrections need different authority
  — and the loop-protocol diagram).
- G:L1942-1952, G:L1978-2000 ("doc-review" and "codebase-design + domain-modeling" rows in the
  never-cut/keep-if tables, and the invocation-rule line "doc-review is invoked by bound, not by a
  Luna chair" — the U→M wiring already covered in §0.3).

### 4.2 Mechanisms to import

**Document-type classification from content, not path (matches plan §6.5's "classifies
requirements versus implementation plans from content"):**

> "A unified artifact with only a Product Contract is **`unified-requirements`**; missing
> implementation sections are expected. Any implementation planning makes it **`unified-plan`**...
> **Classify by content, not readiness labels or file path.**" (`ce-doc-review/SKILL.md`)

**Persona team, always-on + conditional (import `persona-selection.md`'s signal text near-
verbatim):** always: `coherence`, `feasibility`. Conditional, exact activation tests:

- `product-lens`: "the document stakes a product position... that a knowledgeable stakeholder
  could reasonably challenge and that no upstream Product Contract settled, **or** the work
  carries strategic weight."
- `design-lens`: UI/UX references, flows/screens/views, interaction descriptions, responsive/a11y.
- `security-lens`: auth, exposed endpoints, **sensitive** data handling — "Ordinary data handling
  is not a trigger... an internal schema migration... activates this lens only when the data is
  sensitive or the change alters who can read or write it."
- `scope-guardian`: multiple priority tiers, >8 distinct requirements/units, stretch/nice-to-have
  sections, misaligned scope-boundary language.
- `adversarial`: high-value challenge surface — 2+ challengeable claims on a requirements doc, a
  high-stakes domain (auth/payments/data migration/privacy/crypto) regardless of doc type, a new
  abstraction/framework, a plan with **no validated upstream Product Contract**, explicit scope
  extension beyond origin, or an explicit-alternatives section.

**Suppression on a validated plan (the mechanism behind plan §6.5's "meaning-changing forks never
silently settled" and this batch's assigned eval behaviors) — import the pattern from every
persona file's "Document type adaptation" section, illustrated by `product-lens-reviewer.md`:**

> "`Document type: plan` AND `Origin:` is a path (not `none`): the premise has already been
> validated upstream. **Suppress** Section 1 (Premise challenge) and Section 5 (Prioritization
> coherence) entirely... Run [only the sections that check whether the plan still serves the
> already-settled goals]."

Each of the seven persona files states its own version of this suppression rule (see the raw
excerpts already captured in this session — coherence adapts by ID-scheme instead of
premise/plan; feasibility tightens scope on a requirements doc rather than suppressing on a plan;
scope-guardian, adversarial, and design-lens each state their own suppressed-section list). Import
each persona's own version into its own `roles/doc-review/<lens>.md` file — do not flatten them
into one shared suppression paragraph, the suppressed techniques differ per persona.

**Four buckets (transcript's framing, matches plan §6.5 exactly; batch brief's named output
format):**

> "Applied — Proven error that blocks a decision *already in the doc*... Auto, annotated
> session-settled. Proposed fixes — Worthwhile, but not already authorized / not full
> confidence... One grouped confirmation. Decisions — Real forks. 'Which remedy?' never 'shall we
> proceed?'... Human, one question per fork. FYI — Observed. No question... Nobody." (G:L669-679)

Map this onto CE's own internal routing vocabulary from `review-output-template.md`/
`synthesis-and-presentation.md` for a precise implementation: **Applied** = findings routed to
`safe_auto`/`gated_auto` *and* actually applied (anchor 75/100, admitted, obligation or
mechanical); **Proposed fixes** = the grouped-confirmation batch (obligations + `gated_auto`
findings not yet confirmed); **Decisions** = `manual`-routed findings (anchor 75/100, a genuine
fork the document itself doesn't resolve); **FYI** = anchor-50 findings, never actionable, never
entering the walk-through. Anchors 0/25 are dropped silently before any bucket (§3.2 of
`synthesis-and-presentation.md`) — carry this three-tier confidence-gate-then-bucket structure
into `doc-review`'s SKILL.md rather than re-deriving it.

**The chair-cannot-settle-forks rule (directly supports "meaning-changing forks never silently
settled"):**

> "Auto-apply here is more aggressive than code review in one specific way: it will change wording
> *and meaning* if that's what it takes to make an already-written decision executable. 'R3 says
> the API is public, security section says internal only' is not a style fix. The chair must not
> let Luna invent which side wins. That's a Decision, not Applied." (G:L682, model-tier name
> dropped per §0.4)

Donor-side equivalent, model-agnostic and directly quotable: `synthesis-and-presentation.md` §3.6
— *"Fixes found only by another model. These never qualify for `safe_auto`... Silent application
requires that local reviewer to independently identify the same issue (R18)."* Generalize R18's
point past the specific "another model" framing: a correction that changes what the document
*decides* (not just how it says it) requires independent corroboration before any automatic
application, never a single reviewer's unilateral pick.

**R29 — the mechanism for scenario 12 ("a rejected product option is not silently reopened
without new evidence"). Import the rule near-verbatim:**

> "Synthesis suppresses re-raised rejected findings rather than showing them to the user again...
> **Matching test:** a finding matches when its `normalize(section) + normalize(title)`
> fingerprint matches and its evidence substrings overlap the prior finding's by more than 50%.
> Suppress a matching finding only when the evidence and assumptions supporting the prior
> rejection remain current. **Changed evidence:** reassess the finding when material changes to
> the document, relevant source, constraints, or newly available facts undermine the prior
> rejection. An unchanged document quote does not establish unchanged evidence."

This is precisely the batch brief's "a rejected option is not reopened without new evidence"
boundary and precisely scenario 12. Also import R30 (fix-landed verification: a later round
quoting the same problematic text as a prior "fixed" finding is flagged as "fix did not land," not
silently treated as a new finding; a later round's *non-actionable* "this landed correctly"
observation is suppressed and logged in Coverage, not shown as a new finding) — R29 and R30 share
one matching test and belong together in the skill's persistence design.

**Persisted primer / fingerprints / settled decisions / input revisions (batch brief's named
requirement) — import `decision-primer.md`'s rendering format and its four-way classification of
prior decisions (applied / rejected-class [Skip, Defer, Acknowledge, user-settled Withdraw] /
provisional [Apply-triggered Withdraw, re-checked next round, not carried in the primer]).** Note
explicitly in the skill: *"Decisions do not persist across sessions. A later review of the same
document starts at round 1 with no primer carried over"* — this is intra-session state (§0.1); a
*separate*, durable disposition record is what goes to the KB once the review run ends, so a later
session can still see "this was rejected before" even though the live primer itself is gone. Flag
this two-layer distinction (session primer vs. durable KB disposition) explicitly for the writer;
it is not spelled out this precisely in the plan and is this dossier's synthesis of plan §0.1 +
CE's own stated session-scoping.

**Two-cycle limit (matches plan §6.5's "run at most two fix/verify cycles" pattern applied to
docs):**

> "Loop protocol, same as code, tighter because docs mutate meaning... Pass 3 if a Decision keeps
> bouncing → stop. that's ralplan or a human, not another doc-review." (G:L~735-740) — CE's own
> stated iteration limit is "After 2 refinement passes, recommend completion" (`synthesis-and-
> presentation.md`, Phase 5) — consistent with the transcript's "Two cycles."

### 4.3 Passages worth adapting

- `SKILL.md`'s "Done when" line is close to drop-in as `doc-review`'s completion condition; strip
  the "non-interactive mode" CE-specific phrasing but keep the substance (every selected reviewer
  accounted for in Coverage, retained findings tied to a verified consequence, every authorized
  Apply actually made and checked).
- `review-output-template.md`'s Coverage table is a good concrete artifact shape; rename its
  columns to plan §5.5's finding vocabulary (`confidence_anchor` instead of bare `Confidence`,
  etc.) so `doc-review`'s output and `super-review`'s (a different batch) share one finding
  schema rather than two dialects.
- Each persona file's opening one-line framing (e.g. coherence: "You are a technical editor
  reading for internal consistency. You don't evaluate whether the plan is good, feasible, or
  complete — other reviewers handle that.") is good, tight framing text, directly reusable per
  `roles/doc-review/<lens>.md`.

---

## 5. `references/codebase-design`

### 5.1 Sources

- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/codebase-design/SKILL.md`
  (whole file, ~110 lines) — this **is** the reference; import essentially the whole glossary and
  principles section, adapting only the framing sentence ("Use this language and these principles
  wherever code is being designed or restructured") to match plan §2.4's stated loaders (align,
  improve-architecture — the latter is a different batch).
- `.../skills/engineering/codebase-design/DEEPENING.md` (37 lines) and
  `.../skills/engineering/codebase-design/DESIGN-IT-TWICE.md` (44 lines) — optional deeper files;
  include both as `references/codebase-design/`'s own sub-files (the reference package's `README.md`
  entry per the fixed catalog can point to them the same way the donor's `SKILL.md` points to them),
  since `improve-architecture` (a different batch) explicitly needs the deepening/dependency-
  category material and there is no reason to fork it.

### 5.2 Mechanisms and glossary to import (near-verbatim — this is vocabulary, not process)

Import the glossary terms with their exact "Avoid" lists — the donor is explicit that consistent
naming is the entire point ("Use these terms exactly: don't substitute 'component,' 'service,'
'API,' or 'boundary.'"): **Module**, **Interface** ("everything a caller must know to use the
module correctly: the type signature, but also invariants, ordering constraints, error modes...");
**Implementation** vs. **Adapter** (the same module can be "a small adapter with a large
implementation... or a large adapter with a small implementation"); **Depth** ("leverage at the
interface... A module is deep when a large amount of behaviour sits behind a small interface");
**Seam** *(explicitly credited to Michael Feathers in the donor — keep that attribution)* ("a place
where you can alter behaviour without editing in that place; the location at which a module's
interface lives... Avoid: boundary (overloaded with DDD's bounded context)"); **Leverage**;
**Locality**.

Import the **deletion test** ("Imagine deleting the module. If complexity vanishes, it was a
pass-through. If complexity reappears across N callers, it was earning its keep") and **"One
adapter means a hypothetical seam. Two adapters means a real one"** — both are crisp, load-bearing
heuristics worth quoting exactly. Import the **Rejected framings** section as-is (it is the donor
explicitly defending its own vocabulary choices against Ousterhout's ratio-based depth metric and
against overloading "interface"/"boundary") — this is exactly the kind of "shared vocabulary"
plan §2.4 asks for and gives the writer a ready-made rationale to cite instead of re-deriving it.

### 5.3 Passages worth adapting

None structurally — this file needs almost no adaptation beyond trimming to fit a reference-package
`README.md` + optional-files shape (fixed catalog: `references/<id>/README.md` (entry) + optional
files) instead of a donor `SKILL.md` + companion `.md` files shape. Do not add any model-tier or
donor-plugin-specific content; there is none in the source to strip.

---

## 6. `references/domain-modeling`

### 6.1 Sources

- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/domain-modeling/SKILL.md`
  (whole file) — the file-structure convention (single `CONTEXT.md` vs. `CONTEXT-MAP.md` +
  per-context `CONTEXT.md`), and the five "During the session" moves (challenge against the
  glossary, sharpen fuzzy language, discuss concrete scenarios, cross-reference with code, update
  inline). Adapt "update `CONTEXT.md` inline" to "call the KB adapter's `recordDecision`" per
  §0.1 — this is the one substantive edit this file needs.
- `.../skills/engineering/domain-modeling/CONTEXT-FORMAT.md` (whole file) — the glossary entry
  format (`**Term**: definition. _Avoid_: synonyms`), the "Be opinionated... pick the best one and
  list the others under `_Avoid_`" rule, the "only include terms specific to this project's
  context" filter (excludes general programming concepts even if heavily used), and the
  `CONTEXT-MAP.md` multi-context format with its `## Relationships` section (event-driven
  relationship documentation between contexts — good concrete example to keep).
- `.../skills/engineering/domain-modeling/ADR-FORMAT.md` (whole file) — this is the **exact
  source** for plan §2.4's "ADR triggers." Import the three-part test verbatim:

  > "1. **Hard to reverse**: the cost of changing your mind later is meaningful. 2. **Surprising
  > without context**: a future reader will look at the code and wonder 'why on earth did they do
  > it this way?' 3. **The result of a real trade-off**: there were genuine alternatives and you
  > picked one for specific reasons. If any of the three is missing, skip the ADR."

  and the **"What qualifies"** category list (architectural shape, integration patterns between
  contexts, technology choices that carry lock-in, boundary/scope decisions — "The explicit no-s
  are as valuable as the yes-s," deliberate deviations from the obvious path, constraints not
  visible in the code, rejected alternatives when non-obvious). Import the minimal template too:
  a title plus "1-3 sentences: what's the context, what did we decide, and why" — explicitly *not*
  a heavyweight sectioned document by default.

### 6.2 Mechanisms to import

The **glossary-challenge move**, quoted directly because it is the sharpest concrete example of
"ubiquitous language" enforcement in the donor set:

> "When the user uses a term that conflicts with the existing language in CONTEXT.md, call it out
> immediately. 'Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?'"

and the **cross-reference-with-code** move: "When the user states how something works, check
whether the code agrees. If you find a contradiction, surface it." Both are directly reusable as
super-align's in-session behavior when it *loads* this reference (plan §2.4: loaded by align, not
a slash command of its own).

Import the explicit non-goal: "`CONTEXT.md` should be totally devoid of implementation details. Do
not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It
is a glossary and nothing else." This boundary matters for the writer because it is what keeps
super-align's glossary output (plan §2.1: "Writes language, not a 40-page PRD... glossary, avoided
synonyms, 3-7 ADRs") from ballooning into a second spec artifact that duplicates super-bound's job.

### 6.3 Passages worth adapting

- "Create files lazily: only when you have something to write" — adapt "files" language to "KB
  records" per §0.1, but keep the laziness principle itself (don't pre-create an empty glossary or
  ADR log before there is a term/decision to record).
- The `CONTEXT-MAP.md` multi-context convention is useful mainly for large/monorepo targets; note
  it for the writer but do not over-invest — nothing else in this batch's plan sections calls out
  multi-context repos specifically.

---

## 7. Gaps (capability required by plan/transcript, no donor provides it — origin: conversation)

- **KB adapter's ticket-claim primitive.** wayfind's "claim by assignment, first, before any work"
  mechanic (§3.2) has no obvious equivalent among the seven KB operations plan §8 names
  (`readContext`, `recordDecision`, `publishArtifact`, `linkCodeEvidence`,
  `requestImpactAnalysis`, `linkPullRequests`, `proposeLesson`) for the no-external-tracker
  fallback case. origin: conversation, G:L1(map/ticket claim discussed only in the Pocock donor,
  not in the transcript at all) — mark as a gap for the `adapters/knowledgebase/CONTRACT.md` batch
  to resolve, not to invent here.
- **The two-layer session-primer vs. durable-KB-disposition split for doc-review** (§4.2, R29
  paragraph). The donor states session-only scoping; the plan states KB-centrality; neither states
  how a *later, separate* review session learns "this was already rejected once" without CE's
  intra-session primer. origin: conversation (this dossier's synthesis of plan §0.1 + §8's
  `reviews/` KB directory + CE's own stated session boundary) — the writer should record doc-
  review's durable disposition via `recordDecision`/`publishArtifact` at end-of-run so a future
  run's KB `readContext` can reconstruct an equivalent (if coarser) primer; there is no donor text
  describing this reconstruction step.
- **super-align's decision-ticket handoff to wayfind vs. to a same-session human escalation.** The
  plan does not state the threshold ("part of a larger multi-session effort" vs. not); the
  transcript states only that unresolved forks become decision tickets (G:L1692) without saying
  who creates the wayfind map. origin: conversation — recommend (not mandate) that super-align
  itself only ever produces a same-session escalation or a single decision ticket handed to the
  human, and that starting an actual wayfind *map* (as opposed to one ticket) is always a
  separate, human-initiated decision, consistent with wayfind being U and unable to be started by
  another U skill (§0.3).

---

## 8. Conflicts (donor vs. donor, or donor vs. plan) and resolutions

1. **"Decision ticket" (wayfinder) vs. "implementation ticket" (to-tickets) as if two schemas.**
   Resolved in §0.2: one `ticket` artifact, `type: decision | implementation`, per plan §5.3.
   wayfind only ever emits `type: decision`; super-bound's to-tickets machinery only ever emits
   `type: implementation`.
2. **Wayfinder's own instruction to "call the Skill tool twice, for 'grilling' and
   'domain-modeling'" when resolving a decision ticket** conflicts with plan §7.1's U-cannot-call-U
   rule, since both wayfind and (the skill that owns grilling) super-align are U. Resolved in §0.3:
   charting the map's *destination* (wayfind's own first step, before any ticket exists) may run
   the grilling mechanism inline, because that happens inside the wayfind session itself, not as a
   call to another U skill; *resolving* an already-created `grilling`-type ticket later hands
   control back to the human to start a fresh, ordinary super-align invocation.
3. **CE's cross-model peer-review pass in `ce-doc-review`** (dispatching a peer CLI/vendor agent
   and reconciling its findings) is excluded per §0.4 (model/vendor-specific) and is not named
   anywhere in plan §6.5's doc-review description. Resolution: drop it entirely from `doc-review`;
   the R18 "no silent apply from a single, uncorroborated source" *principle* survives generalized
   past the vendor-specific framing (§4.2), but the peer-dispatch mechanism itself does not import.
4. **`references/codebase-design` restricted to "align and improve-architecture" (plan §2.4) vs.
   to-spec's own instruction that spec-writing (super-bound's job) should sketch seams first**
   (§2.2). Resolved in §2.2: super-bound reuses seam vocabulary already established during the
   preceding super-align run rather than re-loading the reference itself; flagged explicitly, not
   silently resolved, since a reviewer may prefer a different fix to this tension.
5. **CE's `docs_root`/repo-local artifact convention vs. plan's central-KB mandate** — pervasive;
   stated once in §0.1 rather than repeated per item.

---

## 9. Exclusions (donor content that must NOT be imported into this batch's output)

- Every model/tier/vendor name and price/effort table (CE's persona "Seat Tier" table,
  Pareto/latency/cost figures) — per ground rules and plan's Scope section.
- CE's `docs_root` / `.compound-engineering/config.yaml` two-layer config resolution, its
  Direct/Chat-brief/Durable output-contract system, its `OUTPUT_FORMAT` (markdown-vs-HTML)
  rendering logic, and its cross-model/peer-CLI review pass — all CE-plugin-specific plumbing
  (§0.4, §8.3).
- CE's `mode:return-to-caller` / `lfg` integration hooks in `ce-brainstorm` — no `/lfg` here (plan §2.6).
- Superpowers' "Visual Companion" browser-based mockup tool in `brainstorming/SKILL.md` — not part
  of the align contract; note its existence but do not import its invocation mechanics.
- Superpowers' `writing-plans` "Execution Handoff" naming `subagent-driven-development` /
  `executing-plans` as the two downstream execution choices — Superpowers' own slash commands;
  super-bound hands off to `super-build` only (plan §1.1's single lifecycle).
- Addy's `interview-me` non-interactive-context refusal framed as "Do not invoke in CI pipelines...
  `/loop`, or autonomous-loop" — keep the substance (a live human is required for HITL parts of
  grilling/interview), drop the literal `/loop` cross-reference (a different plugin's command).
- Pocock's `wayfinder` "never resolve more than one ticket per session, with the exception of
  research tickets" is a keeper (§3.2) but its tracker-specific UI language ("visually in the
  tracker's own UI") should be generalized since the KB fallback has no such UI guarantee.
- Any donor mention of `/teach`, visual-review HTML, or a second `/plan`-shaped command alongside
  these — all explicit plan §2.6 exclusions, reconfirmed: none of the six donor source
  files above contain such content directly, but adjacent sibling files in the same donor
  directories do (e.g. Pocock's `teach/SKILL.md`) and must not be pulled in by a broad directory
  copy.

---

## 10. Eval design

### 10.1 Behaviors worth testing, per skill

**`super-align`**
- Positive trigger: a vague, ambiguous feature request with no acceptance criteria — should open
  a grilling round, never write an implementation file.
- Non-trigger neighbors: (a) a request with specific acceptance criteria and referenced existing
  patterns already stated — should route to a short in-chat confirmation, not a full round-based
  interview (CE's "requirements already clear" path, §1.2); (b) a single-file typo fix — should
  not invoke super-align at all (routes straight to build, per plan §1.1).
- Pressure-to-skip: user says "just implement it" / "whatever you think is best" mid-interview —
  the HARD-GATE must hold; "whatever you think" must not be accepted as approval (interview-me
  §1.5's explicit-yes gate).
- Adversarial: user tries to get super-align to write a spec file or code before saying an explicit
  yes to the restated direction — must refuse and re-restate instead.

**`super-bound`**
- Positive trigger: an approved direction (post-align) ready for spec + ticket breakdown.
- Non-trigger neighbors: a reviewed ticket that plan §1.1 says "can enter at build" directly —
  should not force a full bound pass.
- Pressure-to-skip: user demands file paths and code snippets in the spec before any prototype has
  settled a decision — to-spec's own rule (§2.1) should refuse and keep the spec decision-level.
- Consensus-plan-gate must fire *only* on genuine architectural disagreement/high risk/
  review-driven replan (plan §2.3/§6.5) — a routine ticket breakdown must never trigger it
  automatically.
- A ticket that fails the zero-context test (an implementer with an empty window cannot do it)
  must be rejected as `type: implementation` and either reshaped or reclassified `type: decision`
  (§0.2) — never shipped as an implementation ticket regardless.

**`wayfind`**
- Positive trigger: a loose, multi-session-scale idea with genuine fog ahead.
- Non-trigger neighbor: a bounded idea where charting reveals no fog at all — wayfinder's own
  stated behavior ("If this surfaces no fog... you don't need a map. Stop and ask the user how
  they'd like to proceed") must fire, not a forced map.
- Pressure/adversarial: an agent session tries to resolve more than one ticket in a single session
  (outside the research-ticket exception), or treats an open `type: decision` ticket as though it
  were approved and hands it directly to an implementer — both must be blocked (scenario-12-
  adjacent: this is the ticket-type version of "don't silently promote an unresolved fork").
- Adversarial: an agent tries to mark a ticket "out of scope" to avoid resolving an inconvenient
  open decision — the Out-of-scope section requires "the gist plus why," and out-of-scope work
  "returns only if the destination is redrawn" — test that a bare unjustified out-of-scope closure
  is rejected.

**`doc-review`**
- Positive trigger: a written spec/plan artifact exists and needs review before tickets are cut.
- Non-trigger neighbor: a code diff — must route to (a different batch's) code-review catalog, not
  doc-review's persona set; test that doc-review refuses/redirects rather than reviewing a diff.
- **Scenario 12 (assigned):** a Decision bucket item was previously rejected by the user in round
  1 (Skip/Defer/Acknowledge); round 2 re-runs on an unchanged document — the same finding must be
  suppressed (R29), not re-asked, *unless* the fixture also changes the supporting evidence, in
  which case it must resurface with a stated reason ("changed evidence" branch of R29).
- **Scenario 21 (assigned):** a doc-review run over a spec must not create or write into any
  `docs/`-shaped directory inside the *application* repository under test; all durable output goes
  through the KB adapter calls. Test by asserting no new file appears under the working repo's
  tree and that the expected KB operation was invoked with the expected content.
- Adversarial: a low-confidence but real security-lens finding (anchor 50) must still appear in
  the FYI subsection — never silently dropped the way anchor-0/25 findings are (plan §6.1's "A
  low-confidence security concern remains visible and gets adjudicated" applied to docs).
- Pressure: after two full review rounds, a third round on the same still-bouncing Decision must
  stop and escalate (transcript's "Pass 3... stop. that's ralplan or a human") rather than looping
  a third time.

### 10.2 Cases per skill (minimum 3, per fixed-catalog eval requirement)

Each skill needs at least one `class:positive`, `class:negative`, and `class:adversarial` case
(`skills/<id>/tests/<case>/case.yaml`, tags `skill:<id>`, `class:...`, `scenario:<n>` where a
release scenario applies) — §10.1 supplies the content; `doc-review` additionally needs one case
tagged `scenario:12` and one tagged `scenario:21`, this batch's assigned release scenarios.
