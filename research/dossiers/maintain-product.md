# Donor dossier — batch "maintain-product"

Items: `skills/simplify` (M), `skills/improve-architecture` (U), `skills/deprecate` (U),
`skills/triage` (U), `skills/strategy` (U), `skills/product-pulse` (U).

Plan sections read: §1.2, §1.4, §2.3 (rows for these six), §2.6, §3 (`pack-delete`), §5.1,
§5.5, §6.5, §8, §10, §11. Transcript ranges read: G:L1288–1337 (dossier discipline, for cross-
reference only), G:L1490–1530, G:L1595–1635, G:L1700–1800, G:L1862–1918, G:L1942–2028 (primary),
G:L2040–2120 (autopilot escalation list, cited only for the irreversibility-gate synthesis
below). All donor paths below were checked with `git -C <dir> cat-file -e <commit>:<path>`
against the pinned commits; all returned success.

Read this whole file before writing any of the six skills — §7 (conflicts) and §8
(exclusions) apply to every item, not just the one they're filed under.

---

## 0. Contract reminders specific to this batch

- All six are **standalone supporting skills** (plan §2.3), not lifecycle phases. None of
  them may start `super-align` or `super-ship` (transcript rule, G:L2025: "None of these may
  start align or ship" — applies to the whole standalone-skill list these six belong to).
- Invocation authority per the fixed-identifier list: `simplify` is **M** (model-invoked
  attach — host does *not* get `disable-model-invocation: true`); the other five are **U**
  (host gets `disable-model-invocation: true`; only a human or a runner-validated delegation
  grant starts them — plan §7.1).
- Every one of these six writes *something* durable in its donor form (a repo file, an issue
  comment, an HTML report). Per plan §1.2/§8, only the KB may hold durable project-derived
  artifacts; skills never create a docs tree inside the application repo. This is the single
  biggest adaptation across the whole batch — see §7.1 below before writing any of the six.
- None of these six skills may use the transcript's model-tier nicknames (Luna/Terra/Sol/
  Astra/Jev) even when paraphrasing a G:L passage that uses them. Translate to role language.

---

## 1. `simplify` (M)

### Sources
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-simplify-code/SKILL.md` — primary donor, full process.
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-simplify-code/references/personas/code-quality-reviewer.md`
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-simplify-code/references/personas/code-reuse-reviewer.md`
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-simplify-code/references/personas/efficiency-reviewer.md`
- `addy@c004a74784a08295d52749b04cda634125b9a581:skills/code-simplification/SKILL.md` — secondary donor, process framing and
  tables.
- `omc@5281b19e0d64f8e6dc6767f2130299a88af2dc71:skills/ai-slop-cleaner/SKILL.md` — deletion-first sequencing ideas only.
- `omc@5281b19e0d64f8e6dc6767f2130299a88af2dc71:skills/minimal-code-discipline/SKILL.md` — "existence first" framing, useful
  for the preflight step.
- `omx@cb955b0d5becbef76d2c1f0096b6e1f238e1e7f7:skills/ai-slop-cleaner/SKILL.md` — near-duplicate of the OMC version; its one
  addition worth stealing is the masking-vs-grounded fallback classification (below).

Batch brief donor starting points also named `omx skills/minimal-code-discipline`, but that
path does not exist in the OMX donor at the pinned commit — OMX has `ai-slop-cleaner` only;
`minimal-code-discipline` is OMC-only. Cite it as `omc@5281b19e0d64f8e6dc6767f2130299a88af2dc71:skills/minimal-code-discipline/SKILL.md` alone.

### The backbone: CE's SKILL.md, almost as-is
CE's `ce-simplify-code` already *is* the plan's `simplify` contract, nearly verbatim against
the batch brief ("explain existing behavior before deletion; behavioral evidence; never
change the product contract under cleanup"). Use its five-step shape as the skeleton:

1. **Resolve scope** — user-named scope is authoritative and must not be widened; otherwise
   branch-vs-base diff, then staged/unstaged diff, then explicitly-named files. A scope that
   turns out to be docs/generated/vendored/lockfiles only stops before any reviewer runs
   ("nothing to simplify"). Quote worth keeping near-verbatim (adapt the tool-discovery
   sentence to our own blocking-question convention, see §7.3):
   > "If none of the above produces a non-empty scope, stop and ask the user what to simplify
   > rather than guessing."
2. **Three parallel review lenses**, each reading its own full rubric file (never paraphrased
   from memory) against the resolved diff:
   - **code-reuse-reviewer** — existing utilities/helpers, stdlib/runtime primitives, platform
     guarantees; each finding names the replacement symbol.
   - **code-quality-reviewer** — redundant state, parameter sprawl, copy-paste variation,
     leaky abstractions, stringly-typed code, unnecessary wrapper elements (frontend-only,
     skip elsewhere), nested conditionals 3+ deep, restating comments, dead code/unused
     imports (only after verifying project-wide non-use), context-drifted vocabulary,
     pre-release compatibility scaffolding.
   - **efficiency-reviewer** — unnecessary work, missed concurrency, hot-path bloat, no-op
     update storms, TOCTOU existence checks, unbounded memory/listener leaks, overly broad
     reads.
   Import all three rubric bodies as this skill's `references/personas/*.md` — they are the
   concrete checklist plan §2.3's "explain existing behavior before deletion" cashes out to.
3. **Fix**: apply worthwhile findings, record skipped ones without asking; edit only the
   resolved scope plus the import/export lines it needs; **never simplify away a safety
   check** (trust-boundary validation, data-loss protection, security checks, accessibility
   affordances); an interface/shape is only removable once verified to have no deployed,
   persisted, public, external, dependent-branch, or in-repo caller outside the scope —
   this is the donor's own Hyrum's-Law-shaped compatibility gate, keep it intact.
4. **Verify**: typecheck + lint project-wide, tests scoped to blast radius (full suite when
   the runner can't scope); fix or revert simplification-caused failures — never relax
   assertions, weaken types, or skip tests; if no suite/lint/typecheck exists, say so
   explicitly rather than silently skipping verification.
5. **Summarize**: applied/skipped counts by lens, check outcomes; never use net-lines-removed
   as the success metric.

Quote worth keeping for the "explain before deletion" boundary (adapt "unshipped" framing —
our contract doesn't assume a git branch model, but the compatibility test itself is sound):
> "An interface or data shape that existed only in an earlier iteration of the current
> unshipped scope is not protected behavior once you verify it has no deployed, persisted,
> public, external, dependent-branch, or in-repo caller outside the resolved scope."

### What to import from Addy's `code-simplification` additively
Addy's version is process-compatible with CE's but adds three things CE's terser SKILL.md
lacks and the batch brief explicitly wants:
- **Chesterton's Fence as an explicit pre-step** ("Step 1: Understand Before Touching"),
  with a concrete question checklist (responsibility, callers, edge cases, tests, git blame
  for original context) — use this to open `simplify`'s "explain existing behavior" gate
  before CE's Step 1 (scope resolution) rather than folding it silently into Step 3.
- **A rationalization-counter table** ("Common Rationalizations"), e.g.:
  > "It's working, no need to touch it" → "Working code that's hard to read will be hard to
  > fix when it breaks."
  > "I'll refactor while adding this feature" → "Separate refactoring from feature work."
  Import this table format directly (plan §2.3 doesn't name it, but the batch brief's parent
  table calls out "rationalization counters" generically at plan §6.1-adjacent findings
  language, and CE's own sibling `ce-noslop` uses the same device) — it is cheap, concrete,
  and the batch brief's "regression-safe" framing benefits from a named list of excuses that
  must not shortcut verification.
- **The Rule of 500**: a refactor touching 500+ lines should reach for automation (codemods,
  AST transforms) instead of hand edits — worth keeping as a scale note, not a hard gate.
- Its five-principle framing (preserve behavior exactly / follow project conventions / prefer
  clarity over cleverness / maintain balance / scope to what changed) is a good *opening*
  paragraph before CE's numbered steps; don't duplicate CE's step list under a second
  vocabulary.

### What to import from OMC/OMX additively (per batch brief parenthetical)
- **Sequencing discipline**: "protect current behavior first (lock with regression tests) →
  write a cleanup plan before code → classify the slop before editing → one smell-focused
  pass at a time (dead code, then duplicates, then naming/errors, then tests) → run quality
  gates → evidence-dense report." This is a useful *ordering* wrapper around CE's three
  parallel lenses — CE's three reviewers can still run together, but "regression tests exist
  or a verification plan is recorded" should gate the whole pass, not just Step 4.
- **The masking-vs-grounded fallback classification** (OMX's addition over OMC's own text) is
  worth borrowing as one more finding category alongside CE's three lenses: a "masking
  fallback" hides evidence, bypasses a contract, swallows failures, or silently defaults —
  always a red flag; a "grounded compatibility/fail-safe fallback" is narrow, documented,
  tested on both paths, and may be kept. This directly serves "never change the product
  contract under cleanup."
- Do **not** import OMC/OMX's UI/design-slop checklist (Korean type sizes, shadow overuse,
  gradient restraint, generic Tailwind blue). That is frontend visual review, not this skill's
  job — `pack-frontend` and the design-focused skills own that lens; importing it here would
  quietly turn a general "M" cleanup skill into a frontend opinion engine for every language.
- Do **not** import OMX's `$ralplan` escalation line for "broad/ambiguous/cross-layer/
  architectural findings." We have no `$ralplan` slash command. The plan-equivalent move is:
  a finding that is architecture-level (not a mechanical/local fix) is out of `simplify`'s
  scope entirely — name it in the summary as worth a separate `ak:improve-architecture` or
  `ak:diagnose` pass, don't attempt it and don't silently drop it.

### Exclude
- CE's "Model selection" sub-step ("Use the platform's balanced mid-tier model for these
  reviewers... In Claude Code this is the Sonnet class") — model-tier language, forbidden.
  Drop the whole paragraph; subagent dispatch happens without a tier directive.
- CE's Claude-Code/Codex-specific dispatch primitive names (`Agent`/`Task`/`spawn_agent`) and
  its "Bounded dispatch"/"Agent lifecycle"/"Permission mode" host-plumbing paragraphs — these
  belong in `adapters/claude-code` and `adapters/codex`, not in the skill body. Keep only the
  behavioral requirement ("read each persona file and pass it verbatim; don't paraphrase from
  memory") in the skill body.
- Any literal `/ce-simplify-code`, `/code-simplification`, or other donor slash name — refer
  to this skill only as itself; never insert another plugin's command name.

---

## 2. `improve-architecture` (U)

### Sources
- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/improve-codebase-architecture/SKILL.md` — primary donor,
  full process.
- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/improve-codebase-architecture/HTML-REPORT.md` — report
  scaffold detail; skim only, it's mostly Tailwind/Mermaid markup instructions.
- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/codebase-design/SKILL.md` — the shared vocabulary this
  skill is required to use (module, interface, depth, seam, adapter, leverage, locality, the
  deletion test, "the interface is the test surface", "one adapter = hypothetical seam, two =
  real"). This file is the source for `references/codebase-design/` (another batch's output);
  `improve-architecture` links to it, it does not restate it.
- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/codebase-design/DEEPENING.md` — dependency-category
  taxonomy (in-process / local-substitutable / remote-but-owned / true-external) used once a
  candidate is picked; also belongs to `references/codebase-design/`.

### Mechanisms to import
1. **Scope before scan (YAGNI)**: if the user named a direction, take it; otherwise walk
   `git log --oneline` history to find hot spots and let recently-changed areas pull
   attention first; widen the net only if changes are scattered. This is the concrete
   mechanism behind the plan's "periodic shallowness survey."
2. **Exploration heuristics** (organic, not a rigid checklist) — worth quoting as the question
   set a sub-agent should carry into the codebase walk:
   > "Where does understanding one concept require bouncing between many small modules? ...
   > Where have pure functions been extracted just for testability, but the real bugs hide in
   > how they're called (no locality)? ... Which parts of the codebase are untested, or hard
   > to test through their current interface?"
3. **The deletion test** as the accept/reject filter for "is this module actually shallow":
   would deleting it concentrate complexity elsewhere, or just move it? "Yes, concentrates" is
   the signal.
4. **Present candidates, ask which one, then grill only that one.** This is the mechanism that
   *already* enforces "no unsolicited repository-wide rewrite" (plan §2.3 boundary) — the
   donor never proposes doing all candidates; it proposes several, then the user picks exactly
   one to take further. Each candidate card carries: files involved, problem, plain-English
   solution, benefits (in locality/leverage terms), a before/after diagram, and a
   `Strong / Worth exploring / Speculative` strength badge, ending with one named "Top
   recommendation."
5. **ADR-conflict handling**: only surface a candidate that contradicts an existing ADR when
   the friction is real enough to justify reopening it, and mark that plainly in the card
   (a warning callout naming the ADR) — don't list every theoretical refactor an ADR forbids.
6. **The grilling loop** (interactive decision tree over the one chosen candidate: constraints,
   dependencies, deepened-module shape, what sits behind the seam, what tests survive) and its
   two side-effect rules:
   - naming a deepened module after a concept not yet in the domain glossary → add the term
   - the user rejecting the candidate for a load-bearing reason → offer to record that reason
     durably, *only* when a future explorer would actually need it to avoid re-suggesting the
     same thing (skip ephemeral/self-evident reasons)

### What must change to fit our contract
- **No direct call to a "grilling" skill or to `super-align`.** The donor calls a separate
  Skill tool for "grilling"; in our catalog, grilling-as-vocabulary lives inside
  `super-align`'s job description (plan §2.1 row), and the transcript rule at G:L2025 says
  none of the standalone user-invoked skills — this one included — may start `align`. Write
  the grilling loop as inline dialogue owned by `improve-architecture` itself (question-at-a-
  time, using the host's blocking-question tool), not as a call to another public skill.
- **Repo-local writes become KB writes.** The donor writes ADRs to `docs/adr/` and glossary
  terms to `CONTEXT.md` at the repo root. Under plan §1.2/§8, both are KB-owned project facts
  (`knowledgebase/projects/<id>/decisions/`, `.../CONTEXT.md`). Route both through the KB
  adapter's `recordDecision` operation instead of writing repo files directly. See §7.1.
- **The HTML report stays repo-external and is fine as-is.** It's written to `$TMPDIR`
  (`architecture-review-<timestamp>.html`), never committed, and opened locally — this is
  transient scratch output, not a durable KB artifact, so it does not need to move into the
  KB. Keep the temp-dir + `xdg-open`/`open`/`start` pattern.
- **Origin gap — what happens after grilling concludes.** Neither the donor nor plan §2.3
  states who implements the chosen deepening. The transcript's own "outside the loop, on
  purpose" diagram (G:L2013–2020) places `improve-architecture` off the main spine with no
  arrow into `build`, and G:L2025 forbids it from starting `align` or `ship` itself. Mark the
  hand-off as **origin: conversation** (G:L2013–2025): `improve-architecture`'s output is a
  recorded decision (via `recordDecision`) plus the grilled interface shape in chat; turning
  that into actual code is a *new* work source the human separately feeds into `ak:super-align`
  or `ak:super-bound` — `improve-architecture` must not silently continue into implementation
  after the grilling loop ends.

### Exclude
- Nothing model/tier-specific appears in this donor file. Do drop the Tailwind/Mermaid CDN
  specifics from `HTML-REPORT.md` if the writer inlines any of it — those are presentation
  choices, not contract content, and belong to whatever minimal report-scaffold the writer
  chooses, not a donor-pinned CDN dependency list.

---

## 3. `deprecate` (U)

### Sources
- `addy@c004a74784a08295d52749b04cda634125b9a581:skills/deprecation-and-migration/SKILL.md` — primary donor, full process.
- `addy@c004a74784a08295d52749b04cda634125b9a581:evals/cases/deprecation-and-migration.json` — donor's own eval case shape;
  useful as one more example of positive/negative framing, not to be imported verbatim (donor
  eval format differs from our `case.yaml` schema — see §9 Eval design).
- Transcript: G:L1513 (Hyrum's Law → `deprecation-and-migration`, "Code as liability"),
  G:L1775 (`pack-delete` row: "removals, deprecations | Chesterton + code-as-liability |
  standards + human if unexplained"), G:L1973 ("Bigger than pack-delete. Sequence, dual-run,
  Hyrum").

### Mechanisms to import
1. **The five-question deprecation decision gate**, run before anything else: does this still
   provide unique value → does a replacement exist (never deprecate without one) → how many
   consumers depend on it → what's each consumer's migration cost → what's the cost of *not*
   deprecating. This is the "compatibility... and consumer evidence" the batch brief names.
2. **Advisory vs. compulsory deprecation**, with advisory as the default and compulsory
   reserved for security/blocking/unsustainable-maintenance cases; compulsory requires
   shipping migration tooling, not just an announcement deadline.
3. **The four-step migration process**: build the replacement first → announce with a
   concrete deprecation notice + migration guide → migrate consumers incrementally (one at a
   time, verify each) → only then remove, and only after verifying zero active usage.
4. **Named migration patterns**, each a short recipe worth keeping as reference material:
   Strangler (phase traffic 0%→10%→50%→100% before removing old), Adapter (old interface,
   new implementation underneath), Feature-flag migration.
5. **Expand/Contract for schema changes** — the sharpest, most concrete mechanism in this
   donor and the one most worth preserving near-verbatim, including the worked rename
   example:
   > "The fix is to never change a column in place. Migrate in additive phases so old and new
   > code are both valid at every step."
   > EXPAND (add nullable column) → MIGRATE (dual-write, backfill in batches) → CONTRACT
   > (switch reads, stop old writes, drop in a later separate deploy).
   Keep its rules verbatim in substance: additive-first/destructive-last-and-alone; every
   migration has a tested down path; backfill in throttled batches off the hot path; build
   large indexes without blocking writes; decouple risky cutovers with a feature flag.
6. **Zombie-code criteria** (no commits in 6+ months with active consumers, no owner, failing
   tests nobody fixes, vulnerable unpatched dependencies, docs referencing dead systems) →
   forced choice: assign an owner and maintain it properly, or deprecate with a concrete plan.
   No indefinite limbo.
7. **The rationalization table** — import directly, it is exactly the "excuse → rebuttal"
   device the plan wants generally; strongest entries:
   > "Just rename the column, it's one line" → "During the rollout, old and new code run
   > together — one will query a column that no longer exists. Expand/contract, never rename
   > in place."
   > "We'll write the rollback if we need it" → "A migration with no down path is a deploy
   > you can't reverse."

### What must change to fit our contract
- **Irreversible steps need their own explicit gate, separate from the skill's own
  invocation.** Addy's donor treats "Step 4: Remove the Old System" as just the next linear
  step once zero-usage is verified — there's no separate stop-and-confirm baked in beyond the
  zero-usage check itself. Plan §2.3's boundary for `deprecate` explicitly says "irreversible
  steps remain separately gated," which is a stronger requirement than the donor states. This
  is a genuine **gap — origin: conversation**, synthesized from the autopilot escalation list
  at G:L2100–2109 (item 4: "Irreversible data: migration, delete, backfill, drop"; item 10:
  "...db push, force-push, history rewrite" — written for supervisor authority, but the same
  irreversibility logic generalizes to a human-invoked skill): the removal/drop/backfill-
  completion step must be its own explicit confirmation inside `deprecate`'s flow, distinct
  from "the user ran `deprecate`" — don't fold Step 4 into the same continuous pass as the
  announce/migrate steps without a checkpoint.
- **`deprecate` attaches `pack-delete`.** Per the fixed-identifier list, `deprecate/SKILL.md`
  should link to `../../packs/pack-delete/PACK.md` (relative path per plan §"Links"), and per
  transcript G:L1973 treat itself as strictly bigger in scope than that pack ("sequence,
  dual-run, Hyrum" vs. pack-delete's narrower "Chesterton + code-as-liability" attach rule).
  `pack-delete` itself is a different batch's output — don't duplicate its content here, only
  reference it.
- **Deprecation notices and migration guides are KB artifacts, not files this skill writes
  into the working repo.** The donor's own template writes a `## Deprecation Notice` markdown
  block with no stated destination (it reads as "write this somewhere in your docs"). Route it
  through `publishArtifact` to the project's KB (e.g. under `decisions/` or a dedicated
  deprecations record), not as a new file in the application repo. See §7.1.
- **Consumer-count and usage-verification claims need `requestImpactAnalysis`.** "How many
  users/consumers depend on it" and "verify zero active usage (metrics, logs, dependency
  analysis)" are exactly what the KB adapter's `requestImpactAnalysis` operation is for —
  route those checks through it rather than inventing an ad hoc grep-only heuristic.

### Exclude
- No model/tier language present in this donor. No donor slash commands to strip either —
  clean adaptation target.

---

## 4. `triage` (U)

### Sources
- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/triage/SKILL.md` — primary donor, full state machine.
- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/triage/AGENT-BRIEF.md` — the brief template and its
  four durability/behavioral/acceptance-criteria/scope principles.
- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/triage/OUT-OF-SCOPE.md` — the rejected-request knowledge
  base mechanism.
- `pocock@c55ee46073ed923f86ce59a5eb3b6d895095d1b7:skills/engineering/setup-matt-pocock-skills/triage-labels.md` — the label
  mapping this skill depends on; confirms the donor's own "tell the user to run setup if no
  mapping exists" stop condition is backed by a real configuration file, not hand-waved.

### Mechanisms to import
1. **Two category roles × five state roles**, exactly one of each per issue: `bug` /
   `enhancement`; `needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` /
   `wontfix`. State transition rule: unlabeled → `needs-triage` first; `needs-info` returns to
   `needs-triage` once the reporter replies; maintainer can override anytime but unusual
   transitions get flagged before proceeding. **This label vocabulary has no priority/severity
   field at all** — triage's own role model is already scoped to category+state only, which is
   the concrete mechanism behind plan §2.3's "cannot silently reprioritize beyond delegated
   scope": there is nothing in the donor's role set that *could* reprioritize a roadmap.
2. **"A PR is an issue with attached code"** — same roles, states, and machine apply to
   external PRs, with named deltas: `ready-for-agent` means a brief is attached and an agent
   should take the next diff step; `ready-for-human` means a human should merge; the
   "gather context" step additionally checks out the diff and runs relevant tests/commands.
3. **The stop condition the batch brief names verbatim** — import this near word-for-word:
   > "These are canonical role names. The actual label strings used in the issue tracker may
   > differ. The mapping should have been provided to you. If not, tell the user to run
   > [setup] ." — replace the donor's `/setup-matt-pocock-skills` reference with a request to
   > configure the real tracker-label mapping through whatever this catalog's config surface
   > turns out to be; do not proceed with invented label strings.
4. **The five-step per-issue flow**: gather context (read body/comments/labels/diff, parse
   prior triage notes so resolved questions aren't re-asked, run a redundancy check against
   the codebase by domain concept not literal wording, run a prior-rejection check against
   `.out-of-scope/`) → recommend with reasoning and wait for direction → **verify the claim**
   (reproduce a bug from the reporter's steps, or check out a PR's diff and run its tests;
   report confirmed/failed/insufficient-detail) → grill only if needed → apply the outcome.
5. **The verification step is the strongest mechanism here and the one most worth keeping
   intact**: no disposition is proposed on an unverified claim. Quote:
   > "A confirmed verification makes a much stronger agent brief."
6. **Disposition-dependent close behavior**: `wontfix` from "already implemented" points to
   where the feature lives and does **not** write to the rejected-knowledge base (that KB is
   for rejected requests, not built ones); `wontfix` from "rejected enhancement" writes a
   record there; `wontfix` from "rejected bug" just explains and closes.
7. **The agent-brief writing discipline** (`AGENT-BRIEF.md`): durable over precise (describe
   interfaces/types/contracts, never file paths or line numbers, since the codebase will
   shift before an AFK agent picks it up); behavioral not procedural ("what", not "how" —
   the agent explores and decides implementation itself); complete, independently-verifiable
   acceptance criteria; explicit out-of-scope list to prevent gold-plating. This maps directly
   onto our `ticket` contract's `implementation` type (plan §5.3) — a `ready-for-agent`
   disposition is, in our vocabulary, "producing an implementation ticket," and
   `ready-for-human` the same shape marked as not delegable.
8. **Quick override path**: an explicit maintainer instruction ("move #42 to ready-for-agent")
   is trusted and applied directly, skipping grilling, after a one-line confirmation of the
   actions about to happen (role change, comment, close).
9. **Resuming**: read prior triage notes first, check for reporter replies to open questions,
   present an updated picture before continuing — never re-ask resolved questions.
10. **The mandatory disclaimer** on every posted comment:
    > "This was generated by AI during triage."
    Keep this requirement — it is a transparency mechanism, not donor-specific branding.

### What must change to fit our contract
- **`.out-of-scope/*.md` is a repo-local docs tree.** Per plan §1.2/§8, this becomes a KB
  record (`recordDecision`, or a dedicated rejected-requests collection under the project's
  KB root) rather than a directory inside the application repo. The matching behavior (check
  existing rejections by concept similarity before triaging a new request; append to the
  existing record rather than duplicating) carries over unchanged — only the storage location
  moves. See §7.1.
- **Agent briefs and triage notes stay tracker comments** (GitHub/Linear/Jira issue or PR
  comments) — this is *not* a repo-docs violation, since the tracker is explicitly the
  system of record plan §8 names ("Choose one ticket system of record and project to the
  other representation"). Keep this part of the donor mechanism as-is.
- Drop the literal `/triage`, `/setup-matt-pocock-skills` slash references; the "call the
  Skill tool twice, for 'grilling' and 'domain-modeling'" step should become: use the host's
  blocking-question flow for the grilling dialogue (same adaptation as `improve-architecture`
  above — no call to `super-align`), and reference `references/domain-modeling/` (another
  batch's output) by relative link rather than by a slash name.

### Exclude
- No model/tier language in this donor.

---

## 5. `strategy` (U)

### Sources
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-strategy/SKILL.md` — primary donor, full process.
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-strategy/references/strategy-template.md` — the document template
  and its fill-in/post-write checklist.
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-strategy/references/interview.md` — interview question order and
  pushback bar (179 lines; read in full when writing, only the phase list is summarized here).
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-strategy/references/update-run.md` — how an existing doc is revised
  without disturbing untouched sections; ownership test for "solely our format" vs. "shared,
  edit in place."

### Mechanisms to import
1. **The core boundary, quote directly** — this is the batch brief's "no automatic feature
   expansion" in the donor's own words:
   > "Anchor, not plan. Strategy is what the product is and why. Features belong in
   > `ce-brainstorm`/`ideate`, schedules and prioritization in the issue tracker,
   > implementation plans in `ce-plan`/`super-bound`; do not let them creep into the doc, and
   > do not update the tracker or reconcile in-flight work."
   > "The user answers; the repo only grounds the question. Use evidence to ask a sharper
   > question, never to fill in a section. Do not derive the strategy from the repo."
   > "Short is a feature. Push back on expansion rather than adding sections."
2. **Grounding before asking**: read the existing strategy doc if present, take "what this
   product is" from stated intent (README, sibling docs, code organization) bounded to "what
   is this and who is it for" — not a full repo profile; take "what's getting attention" from
   recent commits/PRs, used only to inform the Tracks question and staleness detection, never
   as a conclusion on its own. Show the model in chat (3-5 lines, each claim sourced) and
   invite correction before the first question.
3. **The interview order**: Purpose → Positioning → Users → Key metrics → Tracks → Stress test
   → Boundaries (always written, sourced from the stress test) → Milestones (optional) →
   Brand (optional).
4. **The template's discipline**: 3-5 metrics max, 2-4 tracks max ("if you can't keep it to 4,
   something is wrong — fold related tracks together"), Boundaries is the one section that's
   always present even when nothing else is settled, a "resist a change when" line captures
   what the stress test surfaced.
5. **The update-run ownership test**: a strategy doc the skill fully owns is rewritten to the
   template's current shape and order on every write (headings renamed, sections reordered,
   missing required sections offered); a doc in *any other shape* (hand-written, from another
   tool) is edited by meaning, in its own shape and idiom — never restructured, never given
   uninvited headings. Two things are never touched either way: an author-approved-marked
   section, and a doc the user doesn't own — those get reported as a conflict instead.
6. **Downstream handoff, one line**: name where the artifact lives and which skills pick it up
   next as grounding.

### What must change to fit our contract
- **`STRATEGY.md` at the repo root is exactly the repo-local-docs-tree problem plan §1.2/§8
  forbids.** The whole skill becomes: interview as designed → write the resulting document as
  a KB artifact via `publishArtifact` (e.g., a `strategy` document under the project's KB
  root) instead of a root-level file. The "downstream skills read it when it exists" behavior
  becomes those skills calling `readContext` against the KB rather than opening a repo file.
  The ownership test (solely-owned vs. shared-shape doc) still applies, just against the KB
  artifact's revision history instead of a working-tree file — see plan §5.2 ("revision-bound
  artifacts... approvals bind to an artifact's hash or revision, not to its filename").
- **Drop CE's own config-layering infrastructure** (`.compound-engineering/config.yaml` /
  `config.local.yaml`, the `ce-docs-root`/`ce-config-layers` resolution blocks). That's CE's
  own plugin's persistence mechanism, not something to reproduce. The *idea* — a project-level
  override that this skill's grounding pass reads — has no equivalent need once the artifact
  root is the KB; don't invent a parallel config file for it.
- **"The current year is 2026"** — a dated instruction hardcoded for a specific present. Drop
  entirely; today's date is a runtime fact, not a fixed constant to bake into skill content.
- **`argument-hint` frontmatter and the literal "call the host's blocking question tool"
  wording are fine to keep** (already host-neutral prose, matching the "match by capability,
  never probe to discover" pattern this repo should use everywhere); just drop the raw
  `allowed-tools:` frontmatter block and `agents/openai.yaml` file — those belong in the
  Claude Code / Codex adapters, not the skill body.

### Exclude
- No donor slash names beyond CE's own family (`ce-ideate`, `ce-brainstorm`, `ce-plan`,
  `ce-dogfood`) — translate every one of these to `ak:<id>` prose per the Links rule, or drop
  the reference if no such skill exists in our catalog (`ce-dogfood` has no counterpart here;
  drop that mention rather than inventing one).

---

## 6. `product-pulse` (U)

### Sources
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-product-pulse/SKILL.md` — primary donor, full process.
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-product-pulse/references/report-template.md` — report template,
  per-metric source-resolution rule, and post-write checklist.
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-product-pulse/references/run.md` — which queries run in parallel vs.
  serially, the DB-enabled check, quality sampling.
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-product-pulse/references/config.md` — the `pulse_*` key schema
  (skim for the shape only; the keys themselves are CE-plugin-specific, see below).
- `compound-engineering@05c42da94fd318fa081f29d17bf947762aa477b1:skills/ce-product-pulse/references/setup.md` — first-run interview and the
  read-write-credential refusal.

### Mechanisms to import
1. **The boundary block, quote directly** — this is the batch brief's "a report, not
   permission to change the roadmap," already in the donor's own words:
   > "Read-only, everywhere. The skill does not mutate the product, the database, or any
   > external system... A database source must be a read-only connection — the interview
   > refuses read-write credentials, and DB access is optional."
   > "No PII in saved reports. No user emails, account IDs, or message content in the file
   > written to disk."
   > "Read it like a founder. No hardcoded thresholds, no default 'good'/'bad' labels, no
   > alerting: present the numbers and let the reader judge."
   > "Not a shipping log or a dashboard replacement."
2. **The lookback window mechanism**: default `24h` unless configured or explicitly given;
   apply a 15-minute trailing buffer to the window's upper bound to absorb analytics
   ingestion lag (`[now-24h-15m, now-15m]` for a 24h window) — small, concrete, and worth
   keeping exactly.
3. **Strategy-anchored metric resolution**: read the strategy artifact's key-metrics section
   (when it exists) and, for each metric, decide how to render it — omit if excluded, mark
   `no data (instrumentation pending)` if flagged pending, otherwise resolve a source (an
   explicit per-metric override, else a default analytics source labeled `(default source)`
   so implicit routing stays visible) and render current value + delta. If a query returns
   nothing, still list it as `no data` rather than dropping it silently.
4. **The report shape**: Headlines (top 3 lines carry the single most important thing) →
   Usage (primary engagement, value realization, conversions, strategy metrics carried
   forward, optional quality sample) → System performance (latency percentiles, top-N errors
   by count with one-line no-PII context each) → Followups (3-5 max, each specific enough to
   act on) → a footer naming source windows and the trailing buffer. Target 30-40 lines total.
5. **Delta discipline**: percent deltas always compare to the prior equal-length window; if no
   comparison is possible, omit the delta rather than inventing one.
6. **What to surface in chat vs. what stays in the file**: post the Headlines verbatim, the
   top Followup if it looks urgent, and the saved location — never paste the full report into
   chat; the file is the artifact.
7. **Scheduling is offered, never automatic**: mention once at first-run setup, mention again
   lightly after the third or later ad-hoc run, never nag every run, never schedule without
   explicit confirmation.

### What must change to fit our contract
- **`<root>/pulse-reports/*.md` at the repo root is the same repo-local-docs problem as
  `STRATEGY.md`.** Route the finished report through `publishArtifact` to the project's KB
  (e.g. under a `runs/` or dedicated pulse-reports collection) instead of writing into the
  application repository. The "past pulses browse as a timeline" property is exactly what a
  KB history should give for free once this moves.
- **Drop CE's `.compound-engineering/config.*.yaml` persistence mechanism** for the same
  reason as `strategy` above — it's CE's own plugin infrastructure. The `pulse_*` key *schema*
  (lookback default, excluded/pending metric lists, per-metric source overrides, error-count
  configuration, DB-enabled flag) is worth keeping as the shape of this skill's own
  configuration surface; just don't reproduce the two-file cascade mechanism verbatim — resolve
  it through whatever this catalog's own project-profile/config convention turns out to be
  (see plan §3's note that packs/skills "attach... never a phase" and read project facts from
  KB-linked profiles, not a bespoke per-skill config file).
- **`agents/openai.yaml`** — Codex-specific agent config, drop; adapter-layer concern only.
- **Cross-skill file coupling becomes a KB read.** The donor reads `STRATEGY.md` directly off
  disk to get key metrics; once `strategy` publishes to the KB instead (§5 above),
  `product-pulse` should read those same metrics via `readContext` against the KB, not by
  opening a sibling skill's output file.

### Exclude
- No model/tier language in this donor. Its MCP/data-source tool references are already
  host-neutral prose ("the host's blocking question tool already in the current tool list") —
  keep that pattern, drop only the raw `allowed-tools:` frontmatter list.

---

## 7. Conflicts and resolutions

### 7.1 Repo-local docs trees vs. the central KB (the batch-wide conflict)
Every donor in this batch that writes a durable artifact writes it into the working
repository: CE's `strategy` → `STRATEGY.md` at repo root; CE's `product-pulse` →
`<root>/pulse-reports/*.md`; Pocock's `improve-codebase-architecture` → `docs/adr/*.md` and
`CONTEXT.md`; Pocock's `triage` → `.out-of-scope/*.md`. Plan §1.2 ("project facts and
decisions" are KB-owned) and §8 ("Project artifacts go to the central KB through the KB
interface operations; skills never create a docs tree inside the application repo" — this
exact sentence is also in this run's ground rules) are unambiguous that none of this may
land as new files in the target repository.

**Resolution**: for each of the five affected skills, replace the donor's direct file write
with the matching KB adapter operation:

| Donor write | Skill | KB operation |
|---|---|---|
| `STRATEGY.md` | strategy | `publishArtifact` (strategy document) |
| `<root>/pulse-reports/*.md` | product-pulse | `publishArtifact` (pulse report) |
| `docs/adr/*.md`, `CONTEXT.md` term additions | improve-architecture | `recordDecision` |
| `.out-of-scope/*.md` | triage | `recordDecision` (rejected-request record) |
| deprecation notice / migration guide | deprecate | `publishArtifact` |

The one exception is `improve-architecture`'s HTML report, which is genuinely transient
($TMPDIR, opened locally, never committed) and stays as-is (§2 above). Tracker comments
(triage's agent briefs and notes) also stay as-is — the tracker is the system of record for
tickets, not a docs tree (plan §8).

### 7.2 Model/tier language in CE's `ce-simplify-code`
CE's Step 2 names a specific model tier ("the platform's balanced mid-tier model... In Claude
Code this is the Sonnet class"). Plan scope explicitly excludes model selection, and the
ground rules forbid naming model families or tiers anywhere in skill content. Resolution:
drop the paragraph; subagents inherit the parent's model with no override, per plan §7.2's
"this repo does not calculate provider prices or choose models."

### 7.3 Host-specific tool-discovery prose is fine; host-specific frontmatter/config is not
Multiple donors in this batch (CE's `simplify`, `strategy`, `product-pulse`) already write
their "ask the user a question" instruction in host-neutral form: *match the blocking-question
tool by capability already present in the current tool list, never probe to discover it,
fall back to numbered chat options only if no such tool is listed or a real call errors.* This
prose pattern is good and portable — keep it verbatim across all three skills that use it.
What is **not** portable is the raw `allowed-tools:` frontmatter list and the `agents/
openai.yaml` sidecar files CE ships per skill — those are Claude-Code/Codex plumbing and
belong in `adapters/claude-code/` and `adapters/codex/`, expressed through `skill.yaml`'s
`requires` field (plan §5.1), not copied into the skill body or its frontmatter.

### 7.4 `simplify` vs. `improve-architecture` scope boundary
Both skills touch "shallow" code, and a careless writer could blur them. Plan and donors keep
them distinct on two axes: `simplify` is **M** (model-invoked attach), bounded to a
diff/scope, behavior-preserving, and produces an applied/skipped patch in the same pass;
`improve-architecture` is **U**, unbounded to any particular diff, periodic/standalone
("outside any feature loop" — transcript), and produces a *proposal* plus a grilled interface
shape, not a patch, in this skill's own run. Resolution: keep the boundary exactly as stated
in plan §2.3 — `simplify` never proposes a structural redesign (that's a finding to hand off,
per §1 above), and `improve-architecture` never executes a fix inline (per §2's hand-off gap).

### 7.5 `deprecate` vs. `pack-delete` scope
Transcript G:L1973 states `deprecate` is "bigger than pack-delete. Sequence, dual-run,
Hyrum." Resolution: `pack-delete` (another batch's output) is the narrow, artifact-attached
constraint pack that fires on any removal/deprecation diff (Chesterton + code-as-liability,
per G:L1775); `deprecate` is the full user-invoked skill for planning and executing a
compatibility-aware removal across its whole lifecycle (announce → migrate → remove), and
attaches `pack-delete` as one input rather than duplicating its check.

---

## 8. Gaps (no donor provides this; mark `origin: conversation`)

1. **`improve-architecture`'s post-grilling hand-off.** No donor and no plan table cell states
   who implements the chosen deepening. Resolution synthesized from G:L2013–2025 (the "outside
   the loop" diagram plus the "none of these may start align or ship" rule): the skill's own
   output stops at a recorded decision + grilled shape; implementation is a new work source
   the human feeds into `ak:super-align`/`ak:super-bound` separately. See §2 above.
2. **`deprecate`'s "irreversible steps remain separately gated" boundary** (plan §2.3) has no
   direct donor mechanism — Addy's Step 4 (remove) is just the next linear step after a
   zero-usage check, with no distinct confirmation gate. Synthesized from the autopilot
   escalation list at G:L2100–2109 (irreversible-data and destructive-git items), generalized
   to a human-invoked skill: the removal/drop step needs its own explicit go, separate from
   the initial `deprecate` invocation. See §3 above.
3. **Cross-skill KB coupling generally** (product-pulse reading strategy's metrics,
   deprecate/triage reading consumer/impact evidence) has no donor mechanism at all — every
   donor assumes direct file or codebase access. The KB adapter operations named in plan §8
   (`readContext`, `requestImpactAnalysis`) are the plan's own answer to this, not a donor
   import; treat them as `origin: plan §8`, not `origin: conversation`, since the plan itself
   (not the transcript) specifies them.

No other gaps identified for this batch — every other mechanism in the six skills has direct
donor backing per the citations above.

---

## 9. Exclusions (do not import)

- **Model/tier/effort/pricing language**: CE `ce-simplify-code`'s "Sonnet class" line (§1/§7.2
  above). No other donor in this batch names a model, tier, or price.
- **Donor slash-command names**: `/ce-simplify-code`, `/ce-strategy`, `/ce-product-pulse`,
  `/ce-ideate`, `/ce-brainstorm`, `/ce-plan`, `/ce-dogfood`, `/triage`, `/grilling`,
  `/domain-modeling`, `/setup-matt-pocock-skills`, `/webperf`, `/code-simplification`,
  `/deprecation-and-migration`. Reference this catalog's own skills as `ak:<id>` in prose;
  drop mentions of donor skills with no counterpart here (e.g. `ce-dogfood`) rather than
  inventing one.
- **Host-specific frontmatter and sidecars**: `allowed-tools:` blocks, `argument-hint`
  (keep the *concept* — an optional focus argument — but not the literal Claude-Code
  frontmatter key unless the catalog's `skill.yaml` defines an equivalent), and every
  `agents/openai.yaml` file across the four donor skills that have one.
- **CE's own plugin persistence layer**: `.compound-engineering/config.yaml` /
  `config.local.yaml`, the `ce-docs-root`/`ce-config-layers` resolution blocks in
  `product-pulse` and (implicitly) `strategy`. Repo-local docs trees generally: `STRATEGY.md`,
  `<root>/pulse-reports/`, `docs/adr/`, `CONTEXT.md` writes, `.out-of-scope/` — all become KB
  writes per §7.1.
- **A dated constant**: CE `ce-strategy`'s "The current year is 2026" instruction.
- **Repository-wide/duplicate-lifecycle behavior**: none of the six donors in this batch
  attempt to duplicate `super-align`/`super-build`/`super-review`, so there is nothing of that
  shape to exclude here beyond the `improve-architecture`→`align` hand-off already resolved
  in §2/§8.
- **OMC/OMX's UI/design-slop checklist** inside `ai-slop-cleaner` — out of scope for the
  general-purpose `simplify` skill (§1 above).
- Nothing in this batch touches `/lfg`, `/teach`, or visual-review HTML — no donor content
  here needed exclusion on those specific grounds.

---

## 10. Eval design

Per plan §10 ("Behavioral skill evaluations... positive activation, negative activation,
pressure-to-skip scenarios") and this run's fixed-identifier eval format (`skills/<id>/tests/
<case>/case.yaml`, schema_version "1.1", case name `<skill>--<case>`, tags including
`skill:<id>` and `class:positive|negative|adversarial`, minimum 3 cases per skill, never a
model field). **No numbered release scenario from plan §10's list of 24 was explicitly
assigned to this batch** in the task brief — that list is written against `super-review`/
`autopilot`/build-loop behavior, not these six standalone skills, so none of the 24 map onto
this batch's items without stretching. Treat the behaviors below as this batch's own
positive/negative/pressure coverage instead of trying to force-fit a numbered scenario.

**simplify (M)**
- Positive: a settled diff containing a duplicated helper, a dead import, and a redundant
  existence check → all three lenses fire, findings applied, verification (typecheck/lint/
  tests) run and reported.
- Negative/non-trigger: (a) a request to *add* a feature — routes to `ak:super-build`, not
  `simplify`; (b) a diff containing only docs/lockfile/vendored changes — reports "nothing to
  simplify" without spawning reviewers; (c) a diff that is already clean — each lens reports
  nothing to flag rather than manufacturing a finding.
- Pressure-to-skip: caller says "just delete it fast, skip the tests" — Step 4 verification
  still runs; a "simplification" that would remove a trust-boundary check, security check, or
  a public interface still depended on by an external caller is skipped, not applied, even
  under time pressure.
- Adversarial: a masking fallback (swallowed error, silent default) presented as "just
  cleanup" — classified and flagged, not silently kept or silently deleted without evidence.

**improve-architecture (U)**
- Positive: user asks "what should we deepen in this codebase" outside any feature loop →
  survey runs, multiple candidates presented, user picks one, grilling proceeds on that one
  only.
- Negative/non-trigger: (a) mid-feature-build code smells — routes to `simplify` or stays in
  `super-build`'s task review, not this skill; (b) the model tries to self-invoke this skill
  just because code looks messy — blocked, since this is **U** with `disable-model-invocation`.
- Pressure-to-skip: "just refactor everything while you're at it" — the skill holds to
  presenting candidates and grilling exactly one; it does not silently expand to a repo-wide
  rewrite.
- Adversarial: a candidate that contradicts an existing ADR with only a "not worth it right
  now" rationale — not surfaced as reopening-worthy (only load-bearing reasons justify
  revisiting an ADR).

**deprecate (U)**
- Positive: removing a public API/surface with an existing replacement and quantifiable
  consumers → decision gate answered, advisory/compulsory chosen, migration guide produced,
  consumers migrated incrementally, removal gated separately at the end.
- Negative/non-trigger: dead code with zero consumers and no public surface — that's
  `simplify`/`pack-delete`'s job, not a full `deprecate` run.
- Pressure-to-skip: "just delete it now, nobody uses it" with no consumer evidence — blocked
  until usage is actually verified (zero active usage check), not taken on assertion.
- Adversarial: a schema column rename/drop requested "in one migration, it's just one line" —
  rejected in favor of expand/contract phasing; a migration proposed with no tested down path
  is blocked before merge.

**triage (U)**
- Positive: maintainer runs triage against a real, configured label mapping → bucket display,
  redundancy + prior-rejection checks, recommendation, claim verification, correct disposition
  applied.
- Negative/non-trigger (the batch brief's named stop condition): no real tracker/label policy
  configured → the skill stops and asks for the mapping to be set up rather than inventing
  label strings or improvising a policy.
- Pressure-to-skip: "just bulk-close these" — claim verification (reproduce the bug / check
  the PR diff) still runs before a disposition is applied, even for a batch of issues; a quick
  maintainer override ("move #42 to ready-for-agent") is honored directly but still confirmed
  in one line before acting.
- Boundary check: triage relabels category/state only — an attempt to have it reorder roadmap
  priority or reassign ownership beyond category/state is out of its role vocabulary entirely.

**strategy (U)**
- Positive: first run on a product with standing anchors → grounding shown, interview run in
  order, template filled from surviving answers, one edit round offered.
- Negative/non-trigger: a "library weekend" / no real product context — the skill is rare-use
  by design (transcript: "Rare. Do not install for a library weekend") and should not force a
  strategy doc into existence where there's no product framing to anchor it.
- Pressure-to-skip: caller wants the skill to infer the strategy from the repo instead of
  asking — refused ("the repo only grounds the question... do not derive the strategy from
  the repo").
- Boundary check: an attempt to use this skill to schedule work or update the tracker is
  refused — that's out of scope by design ("do not update the tracker or reconcile in-flight
  work").

**product-pulse (U)**
- Positive: configured signal sources, valid lookback window → report generated within the
  30-40 line target, headlines lead, strategy metrics rendered with deltas or marked no-data.
- Negative/non-trigger: no product anchors/strategy configured — the optional product profile
  is genuinely optional; the skill still produces Usage/System-performance/Followups without
  a Strategy-metrics subsection rather than failing or fabricating anchors.
- Pressure-to-skip: caller wants a write-mode DB connection for "better data" — refused (DB
  access is read-only or not used at all); caller wants raw user emails/IDs in the saved
  report for debugging — refused (no PII in the saved file, ever).
- Boundary check: a request to use the pulse report as grounds for changing the roadmap
  directly — refused; it is "a report, not permission to change the roadmap" (batch brief).
