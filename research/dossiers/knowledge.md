# Donor dossier — batch "knowledge"

Batch items: `skills/compound` (U), `skills/compound-refresh` (U), `skills/handoff` (M), `skills/wait-what` (M),
`skills/explain` (U), `skills/writing-skills` (U), `templates/kb/{CONTEXT,ADR,requirements,plan,ticket,review-ledger,lesson}.md`
+ `templates/kb/examples/{ticket,lesson,review,finding}/*.yaml`.

All donor paths below were verified present at the pinned commit with
`git -C .donors/<dir> cat-file -e <commit>:<path>` (via `ls-tree`/`show`, which fail identically on a missing path).
Commits used: compound-engineering `05c42da9`, superpowers `b36e0829`, pocock `c55ee460`, addy `c004a747`,
omc `5281b19e`, omx `cb955b0d`.

Model names appearing in quoted transcript or donor passages below (Astra, Fable, Luna, Terra, Sol, Jev) are quotes
for design-intent only. The writer must not carry any of them, or any donor tier/model/effort frontmatter, into
skill content — see Exclusions (§9) and the repo-wide ground rules.

---

## 1. `skills/compound` (U) — capture a lesson

### Donor sources
- `compound-engineering@05c42da9:skills/ce-compound/SKILL.md` (whole file, ~85 lines) — mode detection, write
  boundary, durable-capture bar, phase sequence.
- `compound-engineering@05c42da9:skills/ce-compound/references/schema.yaml` — frontmatter contract, bug vs.
  knowledge track split.
- `compound-engineering@05c42da9:skills/ce-compound/assets/resolution-template.md` — the two body templates.
- `compound-engineering@05c42da9:skills/ce-compound/references/assembly.md` — overlap-with-existing-doc decision
  table, destination choice, frontmatter validation gate.
- `compound-engineering@05c42da9:skills/ce-compound/references/concepts-vocabulary.md` (referenced, not quoted
  below — read before finalizing; defines the "supported mutations" add/refine/fold/scrub).
- Transcript: G:L1766 ("Then **compound**: write the lesson into docs/solutions/ (CE) *and* update CONTEXT.md if a
  term moved (Pocock)."); G:L1950 (compound + compound-refresh row, "one lesson per run... never batch five morals
  into one slop file"); G:L2094, G:L2150, G:L2237 (autopilot's compound authority — see §8 below).
- Plan §2.3 row for `compound`; §8 (`solutions/` in the KB tree; `proposeLesson` operation).

### Mechanisms to import
1. **The durable-capture bar (counterfactual test), adapted to KB publication.** This is the single most
   important import — it is the mechanism that satisfies plan §2.3's boundary ("no manufactured lesson just
   because a run ended") and release scenario 23.

   > "A learning earns its place only when it holds durable project reasoning that is not readily recoverable
   > from the final code, tests, types, comments, or existing documentation, and losing it would plausibly cause
   > recurrence, material risk, or substantial rediscovery. Apply this counterfactual: if the learning document
   > disappeared, would a future engineer reading the final implementation still be likely to repeat the mistake
   > or redo substantial investigation? Completion, effort, and diff size do not establish eligibility."
   > (`ce-compound/SKILL.md:21`)

   Adapt: keep the counterfactual test verbatim in spirit; drop CE's file-existence framing ("if the doc
   disappeared") only if it reads oddly once the target is `proposeLesson` rather than a file write — the KB
   adapter is the persistence layer either way. Explicitly tie "a real failure, correction, or surprising review
   result" (plan's own wording) to this bar: a routine, uneventful run has nothing that passes the counterfactual,
   which is exactly what makes scenario 23 pass by construction rather than by a separate rule.

2. **One lesson per run, never batched.**
   > "**One learning per run.** A session that produced several gets several sequential runs, never one batched
   > run." (`ce-compound/SKILL.md:13`)
   Transcript reinforces: "never batch five morals into one slop file" (G:L1950). Keep this rule; it is also the
   direct guard against scenario 23's inverse failure (a chatty run "compounding" everything it touched).

3. **Overlap-before-write check.** Before creating a new lesson, `ce-compound` checks whether an existing lesson
   already covers the same problem/root cause/solution and updates it instead of duplicating (`assembly.md`,
   step 2 table: Pack-covered / High / Moderate / Low-or-none). Import the *shape* of this table — check for an
   existing KB lesson via `readContext`/`requestImpactAnalysis` before calling `proposeLesson`, and update rather
   than duplicate on a high-overlap hit. This is the seed of `compound-refresh`'s Consolidate outcome and should
   use identical language so the two skills read as one system.

4. **Write boundary discipline.** CE separates "the orchestrator writes the one learning" from "phase-1 research
   subagents write to scratch only." Adapt as: `compound` proposes the lesson through `proposeLesson`; it does not
   itself edit any other skill, protocol, or shared resource. This is exactly plan §7.1's point that "KB
   publication is distinct from changing a skill" — `writing-skills` (§6 below) is the only path from a lesson to
   an actual skill edit, and that path requires evaluation + separate review.

5. **Track split (bug vs. knowledge) and the two body templates.** Import both templates from
   `assets/resolution-template.md` nearly verbatim as the shape of `templates/kb/lesson.md` (§7 below); this is
   the strongest, most concrete donor material in the whole batch for that file. Field list from `schema.yaml`:
   required on both tracks — `module`, `date`, `problem_type` (enum, determines track), `component`, `severity`;
   bug-track additionally requires `symptoms`, `root_cause`, `resolution_type`; knowledge-track has the same
   fields as optional. Drop `framework_version` unless the receiving batch wants it (it is CE-specific polish, not
   load-bearing).

6. **Mode detection language, minus the CE brand names.** The `mode:non-interactive` / `depth:lightweight|full`
   token grammar and the "non-interactive asks nothing, ends on a terminal signal a caller parses" contract
   (`ce-compound/SKILL.md:42`) is good general design for any skill an autopilot supervisor pair may call inside
   its charter (plan §7.2's "publish a supported lesson when granted"). Keep the idea (explicit mode token, no
   blocking questions when unattended, terminal `Documentation complete`/`Documentation skipped` signal); rename
   away from `mode:non-interactive` only if the shared skill-contract (plan §5.1) already has a standard field for
   this — check `super-build`/`autopilot` dossiers for the chosen vocabulary before inventing a second one.

### What NOT to import
- The `.compound-engineering/config.yaml` `docs_root` resolution block, the `/tmp/compound-engineering-$(id -u)`
  scratch-root shell, the Compound Pack destination offer, and the `CONCEPTS.md` vocabulary-capture side effect —
  all of these write to a location or mechanism outside the KB interface. See Conflicts §8.
- CE's own `session-history` research subagents (`references/agents/*.md`) — those are CE-plugin-specific
  discovery machinery (searching Claude Code transcript history), out of scope for a portable, host-neutral skill.

---

## 2. `skills/compound-refresh` (U) — maintain the lesson store

### Donor sources
- `compound-engineering@05c42da9:skills/ce-compound-refresh/SKILL.md` (whole file).
- `compound-engineering@05c42da9:skills/ce-compound-refresh/references/classify.md` — the five-outcome table and
  every judgment rule under it.
- `compound-engineering@05c42da9:skills/ce-compound-refresh/references/modes.md` — interactive vs. non-interactive
  contract, stale-marking fallback.
- `compound-engineering@05c42da9:skills/ce-compound-refresh/references/report.md` — Applied/Recommended report
  shape.
- Transcript G:L1950 ("Refresh is Keep / Update / Consolidate / Replace / Delete — never batch five morals into
  one slop file").
- Plan §2.3 row for `compound-refresh`; §8 ("`compound-refresh` changes curated knowledge with provenance... a
  failed skill revision can roll back without rolling back the underlying lesson/evidence history").

### Mechanisms to import
1. **The five-outcome table, verbatim in spirit.**
   > "Keep — Still accurate and useful — No edit... / Update — Solution still correct; references drifted — Fix
   > in place / Consolidate — Docs overlap heavily, both correct — Merge unique content into the canonical doc,
   > delete the subsumed one / Replace — Guidance is now misleading; a trustworthy successor can be written —
   > Successor via subagent, then delete the old / Delete — No longer useful, applicable, or distinct — Delete
   > the file — git history is the archive; there is no `_archived/`" (`classify.md:5-11`)
   This maps directly onto plan's instruction to "retain history rather than erasing provenance": the mechanism
   *is* "delete the file, let version control be the archive" rather than soft-deleting into an `_archived/`
   folder. For the KB, the equivalent is: `compound-refresh` never silently drops a superseded lesson's history —
   it deletes the KB doc through the adapter (which is itself versioned/git-backed) and records the supersession
   in the surviving doc, never invents a parallel archive directory inside the skills repo.

2. **The auto-delete gate — three conditions, all required.**
   > "Auto-delete (no confirmation needed, either mode) only when all three hold: the implementation once lived
   > in this repo and is gone...; the problem domain is gone — or, for a superseded/redundant doc, the surviving
   > canonical doc itself already states the subsumed doc's guidance...; inbound citations are absent or
   > unambiguously decorative. Any condition fails → Replace, Update, Consolidate, stale-mark, or ask."
   (`classify.md:31`)
   Import this as the gate on an *unattended* delete/retire, i.e. the mechanism an `autopilot` charter can safely
   grant per plan §7.2 without it turning into silent knowledge loss. This directly targets release scenario 24
   ("rolling back a skill leaves its supporting knowledge history intact") by construction: retiring a lesson
   requires positive evidence the guidance survives elsewhere, not just "a skill got rolled back so delete what it
   cited."

3. **"Unverifiable is not false."**
   > "A claim the repo cannot corroborate... is not thereby wrong; repos rarely witness their own operations.
   > Never delete, strip during a merge, or stale-mark content solely because no in-repo artifact confirms it."
   (`classify.md`, Judgment rules section)
   This is a genuinely load-bearing rule for a KB-backed lesson store, where a lesson may describe an operational
   or environmental fact the repository itself cannot re-derive. Keep verbatim in substance.

4. **Descriptive-drift vs. implementation-conflict split.** When current code stops satisfying an
   independently-supported piece of guidance, the classifier keeps the guidance and reports the conflict as a
   potential product regression — it does not silently rewrite the lesson to match broken code. Import this
   explicitly; it is the correct behavior for a lesson that turns out to be right while the codebase drifted away
   from it, and prevents `compound-refresh` from becoming a tool that launders regressions into "updated"
   documentation.

5. **Two-mode contract (interactive/non-interactive), same shape as `compound`.** Non-interactive: apply
   unambiguous Keep/Update/Consolidate/auto-Delete/evidence-sufficient Replace; anything genuinely ambiguous gets
   `status: stale` + `stale_reason` + `stale_date` instead of a guess, never a blocking pause; a failed write is
   recorded as "recommended," and the run continues. Import the stale-marking fallback specifically — it is the
   right unattended behavior for an autopilot-delegated refresh (plan §7.2's checkpoint authority table has no
   line for "refresh judgment calls," so treat genuinely ambiguous classification as an escalation-free,
   non-authoritative marker rather than either a guess or a full charter escalation).

6. **Report shape (Applied / Recommended).**
   > "In non-interactive mode the report is the sole deliverable — self-contained, never abbreviated — and
   > actions split into two sections. **Applied:** writes that succeeded... **Recommended:** writes that
   > failed..., plus everything that never runs unattended." (`report.md`)
   Reuse this two-bucket shape for `compound-refresh`'s own output and, by extension, as the pattern for any
   other skill in this batch that runs unattended under a delegation grant (plan §7.1).

### What NOT to import
- The `worth-audit.md` "clean up / cull / prune the store" lens that can delete *accurate* docs on a separate,
  explicitly-confirmed user intent — this is a reasonable CE feature but is a scope expansion beyond what plan
  §2.3 asks of `compound-refresh` ("keep, update, consolidate, replace, or retire *previously captured lessons*
  with evidence and supersession"). If the writer wants it, it must be gated the same way CE gates it (separate
  confirmed intent, never inferred, never in non-interactive mode) — do not fold it into the default accuracy
  refresh.
- `CONCEPTS.md` bootstrap/reconciliation — see Conflicts §8.

---

## 3. `skills/handoff` (M) — continuity artifact

### Donor sources
- `compound-engineering@05c42da9:skills/ce-handoff/SKILL.md` (whole file) — routing (create vs. resume), the
  "supplements authoritative artifacts, does not replace them" framing, resume-source trust rules.
- `compound-engineering@05c42da9:skills/ce-handoff/references/create.md` — body contract, pointer-first rule,
  frontmatter contract.
- `compound-engineering@05c42da9:skills/ce-handoff/references/resume.md` (referenced; not quoted below — read for
  the discovery/ranking bounds if resume is folded into this skill).
- `pocock@c55ee460:skills/productivity/handoff/SKILL.md` (whole file, ~14 lines) — the terse "no LLM summary"
  framing and "suggested skills" section idea.
- Transcript G:L1793 ("handoff — Pocock. Verbatim decisions, Jev keep/delete on the transcript, no LLM summary.");
  G:L1564 ("When the session is dying, compact into a handoff doc — verbatim decisions, not an LLM summary.").
- Plan §2.4 row for `handoff` ("Preserve exact approved decisions, artifact references, current status, and
  outstanding work"; "Never substitute an unmarked summary for authoritative decisions; identify stale evidence").

### Mechanisms to import
1. **Pointer-first, not reproduction.**
   > "Point to plans, issues, commits, diffs, documentation, and relevant files instead of reproducing their
   > contents." (Pocock `handoff/SKILL.md`) and, with more precision:
   > "Keep the handoff pointer-first. For each required reference, name what specifically matters there — not
   > only the path — and add a line range when that narrows the landing zone. Prefer repository-relative paths
   > for repository files, anchored once by the repository, branch, and HEAD metadata. Use absolute paths only
   > for machine-local capture context or uncommitted, untracked, ignored, or temporary state, and label them as
   > machine-local." (`create.md:76`)
   This is exactly plan's "artifact references with hashes" boundary in mechanism form: point at the artifact
   plus its revision/branch/HEAD anchor rather than pasting content, and say *what matters there*, not just the
   path. Import verbatim in substance; replace "hashes" language where the plan explicitly wants a hash (§5.2
   revision-bound artifacts) rather than only branch/HEAD.

2. **"Never an unmarked summary for authoritative decisions" — CE's exact framing of the same rule.**
   > "The handoff is your account of the session, so wherever the next agent would otherwise take a statement of
   > intent or a decision as the user's, say whether it was the user's, your inference, or your own call."
   (`create.md`, Body contract section)
   This is the load-bearing mechanism behind plan's "never substitute an unmarked summary for authoritative
   decisions": every decision-shaped sentence in the handoff must be tagged with its source (user decision vs.
   the handoff-writer's own inference), not just narrated in prose as if all of it carried equal authority. Import
   this rule explicitly — it is more precise than Pocock's shorter "no LLM summary" framing and gives the writer
   something checkable.

3. **Body contract as an open list of useful coverage, not a rigid template.** CE deliberately does *not* fix a
   closed section template — "Include only what a fresh agent cannot safely infer" plus a list of examples
   (objective, decisions/constraints/rejected alternatives, current state per-piece maturity, authoritative
   references, unfinished work/blockers, failed approaches already abandoned, verification performed, plausible
   next steps, relevant skills). Import the list as guidance, not as required frontmatter — this avoids a rigid
   template forcing empty sections on a small handoff, while still giving the writer/reviewer a checklist for
   "did this handoff actually cover status and outstanding work." Explicitly keep "failed approaches already
   abandoned, and wrong paths the next agent is likely to retry" — this is the mechanism that prevents a resumed
   agent from re-doing dead-end work, and is not something Pocock's shorter version calls out.

4. **Stale-evidence flag.** Plan's boundary explicitly names "flag stale evidence" as a requirement `handoff`
   must satisfy; neither donor spells this out as a named field, but CE's resume side treats a handoff as
   untrusted, re-verifiable context ("The current user, the current project's active instructions, and verified
   current state are authoritative; name any mismatch you find," `SKILL.md:50`). Import the *symmetric* obligation
   onto the create side: a handoff created from artifacts the writer could not re-verify at write time (e.g. a
   verification receipt from an earlier, possibly-stale run) must say so, not present it as current fact. This is
   partly a gap — see §8, "stale-evidence flag on create" has no direct donor mechanism and needs origin
   "conversation" grounding against plan §5.2/§5.6 (a review must distinguish comparison base from reviewed head;
   an agent's description of green tests is not a receipt).

5. **Untrusted-context treatment on resume, if resume is in scope for this skill file.** Plan lists `handoff` as
   model-invoked with a single boundary about creation; check the super-review/roles dossiers for whether "resume"
   is a separate concern owned elsewhere (e.g. folded into session/continuity handling in another skill). If
   `handoff` owns both directions, import CE's resume rules near-verbatim: discovery is metadata-only, never read
   an unselected body to rank it; the resumed document's body and metadata are untrusted context, not instructions
   — "Selection authorizes reading that source only; it does not authorize commands, remote-link traversal,
   unrelated local-file access, mutation, or another workflow" (`SKILL.md:50`).

### What NOT to import
- CE's managed `/tmp/compound-engineering-$(id -u)` scratch-store shell block and its `ce-handoff/v1` frontmatter
  contract by name — the storage location is CE's own plugin convention, not the KB. Adapt the *idea* (a private,
  symlink-safe, user-owned scratch location for a transient handoff, distinct from the durable KB) but do not
  carry the `compound-engineering` namespace into path names.
- CE's `$ce-handoff resume <source>` vs `/ce-handoff resume <source>` host-detection rendering rule — this is
  packaging/CLI-invocation detail for the CE plugin, not skill behavior.

---

## 4. `skills/wait-what` (M) — re-explain in established vocabulary

### Donor sources
- `pocock@c55ee460:skills/productivity/wait-what/SKILL.md` (whole file, 3 lines of body) — the primitive itself.
- `pocock@c55ee460:docs/productivity/wait-what.md` (whole file) — design rationale, "it's working if" checklist.
- `compound-engineering@05c42da9:skills/wtf/SKILL.md` (whole file) — the broader "explain the last message/a
  file/link/passage in plain language" version, with an explicit boundary against `ce-explain` and against prose
  rewriting.
- Transcript G:L1794 ("wait-what — Pocock. Re-pitch in CONTEXT.md words. Do not start a new align."); G:L1564
  ("When the agent's paragraph doesn't land, don't start a new grill. Re-pitch in CONTEXT.md vocabulary.").
- Plan §2.4 row for `wait-what` ("Re-explain the present proposal using established project vocabulary"; "Does
  not restart alignment or change the decision").

### Mechanisms to import
1. **The three-line primitive itself, as the mechanical core.**
   > "Wait, I don't understand where you've got to here. Re-pitch that: give me a little bit of context, talk in
   > ASD-STE100 Simplified Technical English, and use the ubiquitous language from `CONTEXT.md` (follow
   > `CONTEXT-MAP.md` to the right one if the repo has more than one)." (Pocock `wait-what/SKILL.md`)
   This is nearly the entire mechanism. Adapt: reference the KB's `CONTEXT.md` (§7 below) instead of a repo-local
   file, and, since our repo may have a `CONTEXT-MAP.md` equivalent only if the KB structure defines one — check
   whether the KB's `CONTEXT.md` template (this batch, §7) needs a companion multi-context map; if not, drop the
   `CONTEXT-MAP.md` reference rather than inventing an unbuilt file.

2. **Design rationale worth carrying into the skill's own doc/comments (not necessarily the runtime prompt):**
   > "'Be concise' is an instruction about the agent's output... **Wait** is about *your* state. It says
   > comprehension failed here." (`docs/productivity/wait-what.md`)
   > "The skill says re-pitch **that**, not 'that last message'. What lost you is usually bigger than one
   > paragraph, so the agent decides how far back to go."
   Import the *design principle* — the skill fixes comprehension, not verbosity, and lets the re-pitch scope
   itself — even if the exact prose doesn't ship in `SKILL.md`.

3. **Explicit non-goal: does not restart alignment.** Both plan and transcript are emphatic on this ("Do not
   start a new grill" / "does not restart alignment or change the decision"). Neither donor version states a
   mechanism for enforcing this beyond the skill's narrow scope (it only re-explains, it has no branch that
   revisits a decision) — the enforcement is structural (the skill simply has nothing else to do), and the writer
   should keep it that way rather than adding an "also reconsider if..." escape hatch, which is exactly the kind
   of scope creep plan §2.4's boundary is guarding against.

4. **CE `wtf`'s target-resolution branches, useful if this skill's scope is broadened to "the present proposal"
   in a general sense (not just the last message).**
   > "Nothing passed: your most recent message. / A file path or a link: read it, then explain it. / A pasted
   > passage: that passage. / A short pointer such as 'the migration part' or 'step 3': only that part of the
   > conversation. / If the target is still unclear, ask one short question instead of guessing." (`wtf/SKILL.md`)
   Import only if `wait-what`'s scope is meant to cover "re-explain a supplied artifact," not just "re-explain
   what I just said" — plan's wording ("the present proposal") suggests the latter is enough; treat the file/link
   branch as optional breadth, not required.

### What NOT to import
- CE `wtf`'s own boundary line naming `ce-explain` and `ce-noslop` by their CE command names — restate the
  boundary against our own `explain` skill (§5) using `ak:explain`-style internal naming per the ground rules
  ("Skills never link into another skill's directory... name it as 'ak:<id>' in prose").

---

## 5. `skills/explain` (U) — describe, not recommend

### Donor sources
- `compound-engineering@05c42da9:skills/ce-explain/SKILL.md` (whole file) — the full flow: consumer/interaction
  rules, phase 1–4 execution flow, boundaries.
- `compound-engineering@05c42da9:skills/ce-explain/references/intake.md`,
  `references/orchestration.md`, `references/check-in.md` (referenced for depth on subject/window resolution and
  evidence-gathering tiers; not quoted below — read before finalizing evidence-sourcing language).
- Transcript G:L1974 ("explain — CE. Someone (or a future agent) needs how/why with evidence — Teaching artifact.
  Not pov, not wait-what."); G:L2028 (cut-order list places `explain` after `research` if the catalog needs
  trimming — informs priority, not scope).
- Plan §2.3 row for `explain` ("Explain how and why existing behavior works using repository and KB evidence";
  "Description is not a recommendation or an implementation plan").

### Mechanisms to import
1. **The evidence-grounding discipline, which is the entire point of this skill.**
   > "Ground project behavior in source evidence; distinguish documented rationale, inference, and unknowns."
   > "Before delivery, check every factual claim against its source. A function call does not establish
   > guarantees about its uninspected implementation. Remove unsupported claims or state their uncertainty where
   > they appear, including in diagrams and exercise answers." (`ce-explain/SKILL.md`, Phase 3)
   Import this as the core mechanism satisfying plan's "using repository and KB evidence" requirement: every claim
   in the delivered explanation is either (a) traced to a specific source, (b) marked as inference, or (c) marked
   unknown. "A function call does not establish guarantees about its uninspected implementation" is a genuinely
   useful, specific anti-hallucination rule worth keeping close to verbatim.

2. **Boundary block, adapted to our own catalog's names.**
   > "Use `ce-pov` to judge whether an approach should be adopted or changed. Explaining a historical choice is
   > not endorsing it today. Use `ce-compound` to capture durable project learning. Producing an explanation does
   > not authorize maintaining repo memory. Explain an idea as supplied; generating alternatives and scoping
   > implementation belong to `ce-ideate`, `ce-brainstorm`, and `ce-plan`. A reported failure to diagnose or fix
   > belongs to `ce-debug`; a factual explanation of current behavior remains here." (`ce-explain/SKILL.md`,
   > Boundaries)
   This is the single clearest artifact of plan's "description is not a recommendation or an implementation plan"
   boundary. Rewrite each named CE skill as its `ak:` counterpart: `ak:pov` for the "should we" judgment,
   `ak:compound` for durable capture, `ak:ideate`/none (we have no separate brainstorm/plan split the way CE
   does — collapse to `ak:super-align`/`ak:super-bound` as appropriate), `ak:diagnose` for the debug case.

3. **"Description is a separate action from having explained" / delivery vs. publication split.**
   > "**Done:** deliver the explanation with supporting evidence and material unanswered questions, or return the
   > specific blocker. When an artifact is requested, deliver the artifact and its location. Publication is a
   > separate action, not a condition of having explained the subject." (`ce-explain/SKILL.md`, top)
   Keep this distinction: `explain` can complete by returning inline content to the caller; only when a standalone
   artifact is explicitly wanted does it produce and place one, and even then "placing" it in the KB goes through
   `publishArtifact` rather than being assumed. This also protects the boundary from §7.1: `explain` is a
   read/describe skill and must not silently become a KB-writing skill on every invocation.

4. **Depth-and-audience adaptation without inferring output from caller identity.**
   > "Adapt depth and presentation to the intended readers and use... Do not infer the output from the caller's
   > identity alone." (`ce-explain/SKILL.md`, Consumer and interaction)
   Useful, general mechanism: a person asking mid-conversation may want a short working answer; a calling workflow
   (e.g. `super-scout` or `doubt-driven` needing background) may want a self-contained teaching artifact with
   citations — but the skill decides based on the request's actual shape, not a hardcoded "if called by another
   skill, always produce a file" rule.

5. **Resolve before asking; return the specific unresolved question when interaction is unavailable.**
   > "Resolve discoverable facts before asking. Ask only when missing information materially changes the answer
   > and cannot be resolved from the request or evidence. If interaction is unavailable, return the unresolved
   > question and its consequence rather than waiting or inventing an answer." (`ce-explain/SKILL.md`)
   Import as-is — this is the correct behavior under an autopilot-delegated call (plan §7.3's decision-card
   pattern) where the calling supervisor, not a human, may be the one answering, and where inventing an answer
   instead of surfacing the gap is exactly the failure the rest of the plan is designed against.

### What NOT to import
- The HTML/Markdown "teaching artifact" format machinery (`references/explainer-html.md`,
  `references/explainer-markdown.md`) and the "publish to ht-ml.app" destination — CE-plugin-specific
  publication surfaces, not the KB. If `explain` needs to emit a standalone artifact, it goes through
  `publishArtifact`, and its shape should match whatever generic artifact contract the KB adapters dossier defines
  (out of this batch's scope to invent).
- The `references/agents/work-recap-scout.md` "recap mode" subagent and its "$RUN_DIR" scratch mechanics — CE
  session-history-specific tooling, not a general mechanism.

---

## 6. `skills/writing-skills` (U) — author and maintain this package

### Donor sources
- `superpowers@b36e0829:skills/writing-skills/SKILL.md` (whole file, ~650 lines) — the full TDD-for-skills
  methodology: RED/GREEN/REFACTOR mapping, frontmatter rules, SDO (skill discovery optimization), "Match the Form
  to the Failure" table, bulletproofing/rationalization-table technique, the full authoring checklist.
- `superpowers@b36e0829:skills/writing-skills/testing-skills-with-subagents.md` — pressure-scenario methodology,
  the pressure-type table, RED/GREEN/REFACTOR worked process.
- `superpowers@b36e0829:skills/writing-skills/persuasion-principles.md` (referenced, not quoted — cite as the
  research basis for the bulletproofing technique; read before drafting rationalization tables).
- `pocock@c55ee460:skills/productivity/writing-for-agents/SKILL.md` (whole file) — context pointers, the
  information hierarchy (in-file step / in-file reference / disclosed reference), leading words, pruning
  (single-source-of-truth, no-ops, negation-avoidance).
- `pocock@c55ee460:skills/productivity/writing-for-agents/SKILL-MECHANICS.md` (whole file) — user-invoked vs.
  model-invoked mechanics, router skills, the invocation-cut rule for splitting.
- Transcript G:L1977 ("writing-skills — Superpowers. You will author more skills — Meta. Only if this repo *is*
  the skill pack."); G:L2028 (cut order places `writing-skills` last if trimming, i.e. lowest priority to drop,
  which for our repo does not apply — this repo *is* the skill pack, so keep it in full).
- Plan §2.3 row for `writing-skills` ("Author and improve skills using behavioral tests and provenance"; "Required
  for maintaining this package; candidate edits must pass evaluations before promotion"); §8 ("`writing-skills`
  can turn a supported lesson into a candidate skill change, but promotion requires evaluation and a separate
  review. A failed skill revision can roll back without rolling back the underlying lesson/evidence history.").

### Mechanisms to import
This is the highest-value donor material in the batch — Superpowers' `writing-skills` is close to a complete,
battle-tested methodology for exactly what plan §2.3 and §8 ask of this skill, and Pocock's `writing-for-agents`
supplies the vocabulary the plan's own shared-contract language (context load, disclosed reference, leading
words) is clearly drawing on.

1. **RED-GREEN-REFACTOR mapped onto skill authoring — the organizing principle.**
   | TDD Concept | Skill Creation |
   |---|---|
   | Test case | Pressure scenario with subagent |
   | Production code | Skill document (SKILL.md) |
   | Test fails (RED) | Agent violates rule without skill (baseline) |
   | Test passes (GREEN) | Agent complies with skill present |
   | Refactor | Close loopholes while maintaining compliance |
   (`writing-skills/SKILL.md`, TDD Mapping table)
   This is directly the mechanism plan's "candidate edits must pass evaluations before promotion" is asking for,
   and it is also the mechanism this repo's own `tests/` and eval-case format (per the fixed catalog identifiers:
   `skills/<id>/tests/<case>/case.yaml`) should be *produced by* — a case is a frozen pressure scenario. Import
   the Iron Law framing:
   > "NO SKILL WITHOUT A FAILING TEST FIRST... This applies to NEW skills AND EDITS to existing skills."
   (`writing-skills/SKILL.md:374-377`)
   Adapt "test" to this repo's actual eval-case format rather than an ad hoc subagent transcript, but keep the
   sequencing rule: baseline-without, author, verify-with, close loopholes — never author first.

2. **"Match the Form to the Failure" — the most concrete, most transferable technique in the whole donor set.**
   | Baseline failure | Right form | Wrong form |
   |---|---|---|
   | Skips/violates a rule under pressure (knows better, does it anyway) | Prohibition + rationalization table + red flags | Soft guidance ("prefer...", "consider...") |
   | Complies, but output has the wrong shape (bloated prompt, buried verdict, restated spec) | Positive recipe or contract: state what the output IS | Prohibition list ("don't restate", "never narrate") |
   | Omits a required element from something they already produce | Structural: REQUIRED field or slot in the template | Prose reminders near the template |
   | Behavior should depend on a condition | Conditional keyed to an observable predicate | Unconditional rule + exemption clauses |
   (`writing-skills/SKILL.md:459-469`)
   > "**Why prohibitions backfire on shaping problems:** ... In head-to-head wording tests on dispatch-prompt
   > guidance, the prohibition arm produced clearly more of the unwanted content than the recipe arm... never
   > reach for the prohibition by default." and "**No nuance clauses.** 'Don't X unless it matters' reopens the
   > negotiation... **Exemption clauses don't scope.**" (`writing-skills/SKILL.md:471-475`)
   This table should become one of the core checklists `writing-skills` teaches: it directly tells a skill author
   which of the two remaining donor lineages (Superpowers' prohibition-heavy discipline style vs. Addy/Pocock's
   positive-recipe style) to reach for, *conditioned on the failure being fixed* — which resolves what would
   otherwise be a real style clash between donors, without picking a permanent winner.

3. **Bulletproofing / rationalization-table technique**, scoped correctly (its own text already states the scope
   limit — do not let the writer over-apply it):
   > "**Scope:** this toolkit is for discipline failures — an agent that knows the rule and skips it under
   > pressure. For wrong-shaped output or omitted elements, prohibition-based bulletproofing backfires; use the
   > forms in Match the Form to the Failure instead." (`writing-skills/SKILL.md:480`)
   Import the concrete steps: close every loophole explicitly (state the rule, then forbid the specific
   workarounds you observed), add "violating the letter of the rules is violating the spirit of the rules" as a
   foundational line when spirit-vs-letter rationalization shows up, build a two-column rationalization table
   (`Excuse | Reality`) from *observed* baseline behavior (never invented excuses), and a "Red Flags — STOP" list.

4. **Pressure-scenario design and pressure taxonomy**, for producing this repo's required eval cases (fixed
   catalog: "at least 3 cases per skill (positive trigger, negative/non-trigger, adversarial/pressure)").
   | Pressure | Example |
   |---|---|
   | Time | Emergency, deadline, deploy window closing |
   | Sunk cost | Hours of work, "waste" to delete |
   | Authority | Senior says skip it, manager overrides |
   | Economic | Job, promotion, company survival at stake |
   | Exhaustion | End of day, already tired, want to go home |
   | Social | Looking dogmatic, seeming inflexible |
   | Pragmatic | "Being pragmatic vs dogmatic" |
   (`testing-skills-with-subagents.md`, Pressure Types)
   > "**Best tests combine 3+ pressures.**" and, for scenario construction: "Concrete options — force A/B/C
   > choice, not open-ended... Real constraints... Real file paths... Make agent act... No easy outs — Can't defer
   > to 'I'd ask your human partner' without choosing." (`testing-skills-with-subagents.md`)
   This is the concrete authoring guide `writing-skills` should point every other skill's `tests/<case>/case.yaml`
   author at for the adversarial/pressure case in particular; the positive-trigger and negative/non-trigger cases
   need a lighter version (application scenario / recognition scenario, per the "Testing All Skill Types" section
   for technique vs. pattern vs. reference skills).

5. **Micro-testing wording before full pressure runs — a cost-control mechanism worth keeping.**
   > "1. One fresh-context sample per call... 2. Always include a no-guidance control. If the control doesn't
   > exhibit the failure, there is nothing to fix — stop, don't author the guidance. 3. 5+ reps per variant... 4.
   > Manually read every flagged match... 5. Variance is a metric." (`writing-skills/SKILL.md`, Micro-Test
   > Wording Before Full Scenarios)
   Import as an optional, cheaper first pass before the full case.yaml pressure scenario, especially useful given
   this repo's stated model-agnosticism (a wording fix that only "worked" against one model's quirks is exactly
   what the no-guidance-control check catches).

6. **Frontmatter/discovery mechanics from Superpowers, filtered through Pocock's invocation vocabulary.** Two
   compatible donor descriptions of the same user-invoked/model-invoked cut:
   > "A **model-invoked** skill keeps a `description`... The description is the skill's top-level context
   > pointer, forced to stay loaded at all times: permanent context load in exchange for discoverability... A
   > **user-invoked** skill strips the description from the agent's reach... Zero context load, but it spends
   > cognitive load: you are the index that must remember it exists." (Pocock `SKILL-MECHANICS.md:9-10`)
   > "**CRITICAL: Description = When to Use, NOT What the Skill Does**... Testing revealed that when a
   > description summarizes the skill's workflow, an agent may follow the description instead of reading the full
   > skill content." (Superpowers `SKILL.md`, Skill Discovery Optimization)
   Both are consistent with this repo's fixed U/M split (see catalog identifiers) and the plan's §7.1 authority
   split (public entrypoint vs. shared phase operation) — import both: Pocock's frame explains *why* the U/M
   split exists in load/cognition terms; Superpowers' frame gives the concrete writing rule for the `description`
   field on the M side. Also import Pocock's **context pointer** vocabulary and the **information hierarchy**
   (in-file step / in-file reference / disclosed reference) as the shared vocabulary `writing-skills` teaches for
   deciding what belongs in `SKILL.md` versus `skills/<id>/references/`.
   > "Every word of an always-loaded pointer costs on every turn, so it earns even harder pruning than the body:
   > Front-load the leading word... One trigger per branch... Cut identity the body already carries."
   (Pocock `SKILL.md:10`, Context pointers)

7. **Pruning discipline: single-source-of-truth, caches, no-ops, negation.**
   > "Keep each meaning in a single source of truth... A document that restates [an environment fact] is a
   > **cache**: a copy of a lookup, earning its load only when the lookup is expensive." and "**Negation** is the
   > failure mode beside this lever: steering by prohibition drags the forbidden behaviour into context and makes
   > it *more* available, not less... Prompt the **positive**." (Pocock `SKILL.md`, Pruning / Leading words)
   This is the same negation-vs-positive-recipe point Superpowers reaches empirically (item 2 above) reached
   independently from a different angle — worth citing both as convergent evidence in the skill's own rationale
   section, since it strengthens the rule rather than duplicating it.

8. **Promotion gate, tying back to plan §8.** Neither donor states "a candidate skill change must pass evaluation
   and a separate review before promotion" as a named gate — that phrase is the plan's own synthesis (§8) of
   Superpowers' TDD-for-skills discipline plus this repo's general review-separation principle (plan §6, "Never
   self-approve in the same active context" — note: that specific line is from the orchestrating harness's own
   instructions, not the plan; the plan's equivalent is §6.1's reviewer-independence rule generalized to doc/skill
   review). Record this promotion gate as the skill's own explicit boundary since no donor states it directly:
   *origin: conversation*, grounded in plan §8 + §2.3's "candidate edits must pass evaluations before promotion."

### What NOT to import
- Superpowers' Claude-Code-specific paths (`~/.claude/skills/`, `~/.agents/skills/`) and its cross-references to
  other Superpowers skills by their Superpowers names (`superpowers:test-driven-development`,
  `superpowers:systematic-debugging`) — rewrite any imported cross-reference as `ak:tdd`/`ak:diagnose` etc., or
  drop it if this repo has no equivalent skill.
- The `graphviz-conventions.dot` / `render-graphs.js` flowchart-rendering tooling — useful but out of scope for a
  dossier on skill content; note it as an optional authoring aid, not a mechanism the skill's prose depends on.

---

## 7. `templates/kb/*` and `templates/kb/examples/*`

Scope reminder: these are the **KB document templates**, i.e. what a project's KB instance actually contains
(plan §8's tree: `CONTEXT.md`, `standards/`, `decisions/`, `requirements/`, `plans/`, `tickets/`, `reviews/`,
`solutions/`, `runs/`). They are filled in by other skills across the whole catalog (`super-align` writes
`CONTEXT.md`/ADRs, `super-bound` writes requirements/tickets, `super-review` writes review ledgers, `compound`
writes lessons) — this batch owns the *template shape and example content*, not those skills' own behavior.

### `templates/kb/CONTEXT.md`
- Donor: `pocock@c55ee460:skills/engineering/domain-modeling/CONTEXT-FORMAT.md` (whole file, ~35 lines) — this is
  a complete, ready-to-adapt template.
- Import near-verbatim: the `# {Context Name}` / `## Language` / bolded-term-with-`_Avoid_` structure, and the
  rules:
  > "**Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others
  > under `_Avoid_`. **Keep definitions tight.** One or two sentences max... **Only include terms specific to
  > this project's context.** General programming concepts... don't belong even if the project uses them
  > extensively." (`CONTEXT-FORMAT.md:27-31`)
  Also import the single-context vs. multi-context (`CONTEXT-MAP.md`) structure decision rule, since `wait-what`
  (§4) references it conditionally.
- Secondary donor for framing only: `addy@c004a747:skills/context-engineering/SKILL.md`'s "Context Hierarchy"
  section — useful for the template's own header comment explaining *why* CONTEXT.md exists (highest-persistence,
  always-loaded layer), but do not import its example CLAUDE.md tech-stack block; that belongs to the working
  repo's own instructions file, not the KB.

### `templates/kb/ADR.md`
- Primary donor: `pocock@c55ee460:skills/engineering/domain-modeling/ADR-FORMAT.md` (whole file) — the tight
  version plan's KB philosophy clearly favors ("Central KB owns all project-derived artifacts" but the plan never
  asks for heavyweight documentation theater).
  > "{Short title of the decision} / {1-3 sentences: what's the context, what did we decide, and why.} That's it.
  > An ADR can be a single paragraph." (`ADR-FORMAT.md`, Template) and the three-part "when to offer an ADR" test:
  > "1. Hard to reverse... 2. Surprising without context... 3. The result of a real trade-off... If a decision is
  > easy to reverse, skip it... If it's not surprising, nobody will wonder why. If there was no real alternative,
  > there's nothing to record beyond 'we did the obvious thing.'" (`ADR-FORMAT.md`, When to offer an ADR)
  This three-part test is exactly the mechanism plan §8 wants for "Do not force a fresh ADR for a mechanical fix
  with no decision; record the applicable existing decision or an explicit no-new-decision result."
- Secondary donor for the *optional*, heavier shape (use when the project actually needs it):
  `addy@c004a747:skills/documentation-and-adrs/SKILL.md`'s ADR template (Status/Date/Context/Decision/Alternatives
  Considered/Consequences) and lifecycle (`PROPOSED → ACCEPTED → (SUPERSEDED or DEPRECATED)`, "Don't delete old
  ADRs... write a new ADR that references and supersedes the old one"). Present both in the template file as
  "minimal" (default, Pocock) and "extended" (optional sections, Addy) rather than picking one — this mirrors
  Pocock's own "Optional sections... only include these when they add genuine value" framing and satisfies plan
  §5.2's revision-bound/supersession requirement for cases where the extended shape is warranted.
- Also import Addy's convention-matching rule if this repo wants ADRs to respect a project's pre-existing scheme:
  > "Before creating an ADR, inspect the available repository context for an established convention... Match:
  > Location and format... Numbering and naming... Section headings..." (`documentation-and-adrs/SKILL.md`)
  Note this is about a *working repo's* pre-existing ADR convention, which is in tension with "central KB owns all
  project-derived artifacts" (plan §2.6/§8) — see Conflicts §8.

### `templates/kb/requirements.md`
- Donor: `pocock@c55ee460:skills/engineering/to-spec/SKILL.md`'s `<spec-template>` block (Problem
  Statement / Solution / User Stories / Implementation Decisions / Testing Decisions / Out of Scope / Further
  Notes). This is owned operationally by `super-bound` (not this batch), but the *document shape* it writes is a
  KB template this batch owns.
  > "Do NOT include specific file paths or code snippets. They may end up being outdated very quickly. Exception:
  > if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine,
  > reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a
  > prototype." (`to-spec/SKILL.md`)
  Import the template structure and this no-stale-paths rule with its prototype exception — it is a good,
  concrete answer to "how detailed should a requirements doc get."
- Cross-check against plan §5.3's ticket-adjacent fields (non-goals, acceptance criteria) so `requirements.md` and
  `ticket.md` (below) don't duplicate the same content at two altitudes — requirements is problem/solution/user
  stories/decisions; tickets are the sliced, verifiable units of work.

### `templates/kb/plan.md`
- No single donor gives a plan-document template distinct from "tickets" in this batch's starting points (CE's
  `ce-plan`/`ce-brainstorm` plan-writing machinery is out of this batch's scope — it belongs to whichever batch
  owns `super-bound`). Treat this file as thin: point at plan §5.3 (tickets are the operative unit) and record
  that a "plan" in this KB tree is the tracer-bullet ticket DAG plus the approved spec, not a separate prose
  document. **Flag for the writer:** confirm with the `super-bound` batch's dossier/output before finalizing this
  template, since it is the more authoritative source for what "plan" contains procedurally; this batch should
  only fix the *durable KB record's* shape (front-matter: schema version, project id, run id, source revision,
  status, links to spec + ticket DAG — per plan §5.2's revision-bound-artifact fields), not re-derive the planning
  process itself.

### `templates/kb/ticket.md`
- Structural donor: `pocock@c55ee460:skills/engineering/to-tickets/SKILL.md`'s `<local-ticket-template>` and
  `<issue-template>` blocks — title, "what to build" (end-to-end behavior, not layer-by-layer), blocked-by edges,
  acceptance criteria checkboxes.
  > "Give each ticket its **blocking edges**: the other tickets that must complete before it can start. A ticket
  > with no blockers can start immediately." and the wide-refactor exception (expand → migrate-in-batches →
  > contract) for changes no vertical slice can hold. (`to-tickets/SKILL.md`)
- **Required extension beyond the Pocock template** — plan §5.3 asks for substantially more than Pocock's
  template carries: ticket `type` (`decision` or `implementation`), approved work source, non-goals, prerequisites,
  *allowed files/symbols*, likely read dependencies, named verification, stop conditions, references to relevant
  KB facts. None of these extra fields exist in the Pocock donor template. Add them explicitly; this is the
  clearest single spot in the batch where the plan's contract is strictly richer than any donor's, so the
  template must be authored *from the plan*, using Pocock's template only for prose style and the blocking-edge
  idea. Cite plan §5.3 directly as the field-source, Pocock only for structure/tone.
- Also import the decision-ticket vs. implementation-ticket distinction from the transcript, since it is the
  ticket-type field's whole reason for existing:
  > "Wayfinder is the same idea for work that does not fit one session: **decision tickets** (questions) vs.
  > **implementation tickets** (slices)... A decision ticket cannot execute as an implementation task." (G:L1751,
  paraphrased from the "Tracer-bullet tickets with blocking edges" section) — this is also release scenario 11.

### `templates/kb/review-ledger.md`
- No donor supplies a durable, post-hoc *KB record* of a review in this shape — CE's `ce-code-review` output
  (`review-output-template.md`) is a **live review report**, owned by whichever batch owns `super-review`/
  `roles/code-review`, not by this batch, and its severity-grouped findings table (P0–P3, file:line, reviewer,
  confidence) is useful only as a structural reference for *how to lay out a findings table*, not as content to
  duplicate.
  > "### P0 -- Critical | # | File | Issue | Reviewer | Confidence |" (`review-output-template.md`) — cite as
  layout inspiration for the ledger's per-finding table only.
- The actual field vocabulary for `review-ledger.md` must come from the plan directly, since that is where the
  authoritative, model-agnostic finding/verification contract lives:
  - Finding fields (plan §5.5): `id`, `fingerprint`, `severity` (P0–P3), `confidence_anchor` (0/25/50/75/100),
    `spec_quality` (`patch`/`sketch`/`smell`), `difficulty` (`mechanical`/`local-judgment`/`cross-cutting`/null),
    `autofix_class`, `evidence`, `suggested_fix`, `verification`, `status`, `authorization_ref`,
    `closure_receipt`.
  - Verification receipt fields (plan §5.6): command/probe, exit status, output/artifact digest, code revision,
    environment identity, acceptance criteria supported; status one of `passed`/`failed`/`not-run`/
    `not-applicable`/`inconclusive`.
  - Revision-bound header (plan §5.2): schema version, project/repo identity, run ID, creator role, input
    artifact IDs and hashes, source revision, timestamp, status; a review "must distinguish comparison base,
    reviewed head, and the last head verified during a delta loop."
  - Delta-closure record (plan §6.3): "Persist the first review's finding list, input hashes, dispositions, and
    evidence," plus the fix/verify packet (original findings, latest fix diff, touched dependencies, verification
    receipts) for subsequent passes.
  This file is, by construction, origin "plan" rather than origin "donor" — write it directly from these four
  citations. Do not import CE's P0–P3 raw persona/confidence table wholesale; translate it into the plan's own
  field names (`severity`, `confidence_anchor`, `spec_quality`, `difficulty`) so the KB record and the live review
  skill share exactly one vocabulary.

### `templates/kb/lesson.md`
- Primary donor, already detailed in §1: `compound-engineering@05c42da9:skills/ce-compound/assets/resolution-template.md`
  (both the bug-track and knowledge-track bodies) and `references/schema.yaml` for the field contract. Import
  these two templates close to verbatim — they are the strongest single piece of ready-to-use template material
  in the entire donor set.
- Drop CE's `category` field (a `<root>/solutions/` subdirectory choice) unless the KB adapter needs an analogous
  bucket; the KB's `solutions/` directory (plan §8) is a flat, adapter-managed collection, not necessarily
  subdivided the way CE's local filesystem tree is. If the KB does support categories, keep the field; otherwise
  cut it rather than carrying an unused frontmatter key.
- Add a `supersedes` / `superseded_by` pair the donor schema does not have but `compound-refresh`'s Replace/
  Consolidate outcomes need to record durably (plan §8: "record evidence and supersession; retain history rather
  than silently erasing provenance"). *Origin: conversation*, grounded in plan §2.3 + §8; no donor names this
  field explicitly, though CE's classify.md behavior implies it operationally (a Replace's successor doc should
  say what it replaced).

### `templates/kb/examples/*`
- `examples/ticket/*.yaml` — build two examples: one `type: implementation` (zero-context, exclusive-file,
  Pocock-style vertical slice) and one `type: decision` (a question a supervisor pair must escalate per plan
  §7.2's checkpoint table, e.g. a product fork) — the pair directly demonstrates release scenario 11 ("A decision
  ticket cannot execute as an implementation task") by showing the two shapes side by side.
- `examples/lesson/*.yaml` — one bug-track and one knowledge-track example, straight from CE's two templates
  (§1/§7 above), with a `supersedes: null` field present so the schema's supersession field is exercised even in
  the base case.
- `examples/review/*.yaml` — one example review ledger showing a full pass-1 → fix → pass-2 delta-closure cycle
  end to end (original findings with hashes, one `resolved` and one `deferred` disposition, a verification
  receipt of each `passed`/`inconclusive` status to exercise both), built from the plan §5.5/§5.6/§6.3 field list
  above, not from a donor.
- `examples/finding/*.yaml` — one `smell` (open, no `suggested_fix`, `difficulty: null` per plan §5.5's "do not
  invent a difficulty assessment before a solution class is known") and one `patch` (`autofix_class: safe_auto`,
  closed with a `closure_receipt`) — the pair demonstrates release scenario 6 ("A vague finding is not given to
  an automatic fixer") directly.

---

## 8. Gaps — no donor path exists (origin: conversation)

Per plan §1.4, each of these is recorded as origin "conversation" with its G:L locator; no donor path should be
fabricated for them.

1. **Handoff's "flag stale evidence" as a positive, checkable field on *creation*** (not just on resume). Neither
   CE nor Pocock's `handoff` states a create-side staleness check as a named mechanism — CE's resume side treats
   *incoming* handoffs as needing re-verification, but nothing requires the *writer* to mark a cited artifact as
   possibly-stale at write time. Origin: conversation, grounded in plan §2.4's boundary text itself (which is the
   plan author's own synthesis, not sourced to a specific G:L range) plus plan §5.2/§5.6 (revision-bound artifacts;
   "an agent's description of green tests is not a receipt").
2. **The `writing-skills` promotion gate** ("candidate edits must pass evaluations and a separate review before
   promotion") as a single named checkpoint. Superpowers supplies the TDD methodology that makes evaluation
   possible; no donor states the *separate-review-before-promotion* gate as such — that is this repo's own
   review-separation principle (plan §6) applied to skill authorship. Origin: conversation / plan §8.
3. **`templates/kb/plan.md`'s own shape**, beyond "it's the approved spec plus the ticket DAG." No donor in this
   batch's starting points supplies a plan-document template distinct from the spec/ticket templates already
   covered; this is a genuine gap this batch can only partially close (see §7) and should be flagged to whichever
   batch owns `super-bound` for cross-check. Origin: conversation, plan §5.3 (tickets) + §8 (KB tree lists
   `plans/` as a directory without specifying its document's internal shape).
4. **`lesson.md`'s `supersedes`/`superseded_by` fields.** No donor schema names them; the need is inferred from
   plan §8's supersession requirement plus `compound-refresh`'s Replace/Consolidate behavior (§2 above). Origin:
   conversation, plan §2.3 + §8.
5. **Release scenario 23's exact failure mode ("a successful routine run does not invent a lesson") as a
   *tested* behavior**, versus CE's durable-capture bar which only states the *rule*. No donor supplies a ready
   pressure scenario for this; `writing-skills` (§6) supplies the methodology to build one, but the scenario
   itself must be authored fresh — see Eval design (§10) below for the concrete shape to use.

## 9. Conflicts and resolutions

1. **CE's `CONCEPTS.md` vocabulary-capture step vs. the plan's KB tree, which has no `CONCEPTS.md`.** `ce-compound`
   and `ce-compound-refresh` both maintain a project-root `CONCEPTS.md` glossary as a side effect of every run
   (`ce-compound/SKILL.md`'s Write boundary section: "the orchestrator writes the one learning... plus two
   maintenance side effects... `CONCEPTS.md` during vocabulary capture"). Plan §8's KB tree lists `CONTEXT.md`
   (Pocock's format, owned by this batch, §7) but no `CONCEPTS.md`, and Pocock's own `CONTEXT.md` already serves
   as "shared domain vocabulary... entities, named processes, and status concepts with project-specific meaning"
   (compare the CE preamble line `ce-compound/references/assembly.md` prescribes for a freshly-created
   `CONCEPTS.md`: "Shared domain vocabulary for this project — entities, named processes, and status concepts
   with project-specific meaning" — nearly identical framing to Pocock's `CONTEXT.md` "Language" section).
   **Resolution:** fold CE's vocabulary-capture mechanism (its add/refine/fold/scrub mutation rules, its
   "coherence neighborhood" refresh-on-every-run behavior) into `compound`/`compound-refresh` updating the
   project's `CONTEXT.md` (§7), not a second, parallel `CONCEPTS.md` file. This keeps a single glossary per plan
   §8's actual tree and satisfies plan §11's row "Need all skills, but want small context and one lifecycle" by
   not introducing a redundant artifact.
2. **CE's `.compound-engineering/config.yaml`-resolved, repo-local `docs_root` (`<root>/solutions/`,
   `<root>/explainers/`) vs. the plan's central-KB requirement.** Every CE skill in this batch (`ce-compound`,
   `ce-compound-refresh`, `ce-explain`) resolves a repo-local artifact root and writes files directly under it.
   Plan §1.2/§2.6/§8 are explicit: "project documentation does not live in application repositories"; "Central KB
   owns all project-derived artifacts; skills repo owns reusable instructions and templates" (§11's resolution
   row). **Resolution:** every donor mechanism that writes a lesson, explainer, or refreshed doc must go through
   the KB adapter operations (`proposeLesson`, `publishArtifact`, `recordDecision`) instead of a repo-local
   `<root>/...` path; drop the `docs_root`-resolution block entirely rather than adapting it, since the KB root
   resolution already has its own defined mechanism (`.agent-kit.yaml` locator → `AGENT_KIT_KB_ROOT` → ask once,
   per the fixed catalog identifiers section of this task).
3. **Addy's "match the project's existing ADR convention" rule vs. "central KB owns all project-derived
   artifacts."** Addy's `documentation-and-adrs` explicitly inspects the *working repo* for a pre-existing ADR
   location/numbering/format and matches it. Once ADRs live centrally in the KB (plan §8: `decisions/`), a
   per-application-repo convention to match mostly disappears — the KB's own ADR convention (Pocock-style, `docs/
   adr/NNNN-slug.md`-equivalent under the KB's `decisions/`) becomes the one convention. **Resolution:** drop the
   convention-detection step for new KB-hosted projects; keep it only as a one-time migration concern (a project
   moving pre-existing repo-local ADRs into the KB) — out of this batch's scope, flag for whichever batch handles
   KB onboarding/migration if one exists.
4. **CE's `wtf` scope (general "explain the last message, a file, a link, or a passage") vs. Pocock's narrower
   `wait-what` (re-pitch the present proposal in `CONTEXT.md` vocabulary).** Plan §2.4 names the skill
   `wait-what` and describes it with Pocock's narrower framing ("re-explain the present proposal using
   established project vocabulary"). **Resolution:** keep the narrow Pocock scope as primary; import CE `wtf`'s
   target-resolution branches (file/link/passage) only as optional breadth, explicitly subordinate to the
   plan-stated scope — see §4 above. Do not let `wait-what` absorb CE `wtf`'s "explain any supplied artifact"
   framing wholesale, since that would blur it with `explain` (§5), which plan keeps as a clearly separate skill.
5. **CE's `ce-compound` allowing an *interactive* run to offer writing a rule into a "Compound Pack" instead of a
   lesson.** This is a legitimate CE feature (a prescriptive, standing rule vs. an incident-shaped lesson) but
   there is no "pack" concept in this repo that a lesson could be redirected into — this repo's `packs/` (plan §3)
   are the eight fixed domain packs (`pack-api`, `pack-secure`, etc.), not an open destination a lesson-capture
   run could append to. **Resolution:** drop the pack-destination offer entirely; every `compound` output goes to
   `proposeLesson` only. A genuinely prescriptive, always/never-shaped insight that belongs in a fixed pack's
   reviewer guidance is a change to that pack's own maintained content, which is out of `compound`'s write
   boundary by plan §1.2/§7.1 (skills content is maintained by `writing-skills`, not authored ad hoc by
   `compound`).

## 10. Exclusions

Per the ground rules and plan scope (§"Scope and source authority", §2.6), do not import into this batch's
skills or templates:

- Any model/vendor/tier name, or the effort/reasoning-level language surrounding it — every transcript excerpt
  quoted above naming Astra, Fable, Luna, Terra, Sol, or Jev is quoted for **design-intent only**; none of those
  names, nor a "which model handles which seat" table, belongs in any skill's `SKILL.md`, template, or example.
  Where a donor or transcript passage assigns work by model tier (e.g. "Luna if patch+mechanical, Terra if
  sketch+local, Sol/Astra if cross-cutting"), the surviving mechanism is the **classification itself**
  (mechanical/local-judgment/cross-cutting — already in plan §5.5's `difficulty` enum), not the model routing.
- CE's plugin-specific slash-command names (`/ce-compound`, `/ce-handoff`, etc.) and its `mode:non-interactive
  depth:lightweight|full` CLI argument-hint syntax as literal invocation surface — keep the *concepts* (explicit
  unattended-mode signal, depth/lightweight fallback) but express them through this repo's own skill-contract
  vocabulary (plan §5.1's manifest fields), not CE's argument-hint strings.
- CE's and Pocock's own cross-references to their sibling skills by name (`ce-pov`, `ce-ideate`, `ce-brainstorm`,
  `ce-noslop`, `ask-matt`, `grill-with-docs`) — rewrite every cross-reference to this repo's own catalog IDs
  (`ak:pov`, `ak:ideate`, `ak:super-align`, etc.) or drop the reference if no equivalent exists.
- Repo-local docs-tree mechanics: CE's `<root>/solutions/`, `<root>/explainers/`, `.compound-engineering/
  config.yaml` resolution block, and the `/tmp/compound-engineering-$(id -u)` scratch-root shell script by name
  — see Conflict §9.2. The *pattern* (a safe, symlink-checked, user-owned scratch location for transient,
  non-durable working files) may survive; the CE plugin namespace in the path must not.
- `CONCEPTS.md` as a second, parallel glossary file — see Conflict §9.1.
- Addy's six-phase DEFINE/PLAN/BUILD/VERIFY/REVIEW/SHIP slash commands and OMC's `remember`/`skillify` skills'
  own storage paths (`.omc/skills/`, `${CLAUDE_CONFIG_DIR}/skills/omc-learned/`) — both are host- or
  plugin-specific storage conventions that must not leak into a portable, host-neutral template. OMC's
  `skillify` "Could someone Google this in 5 minutes? / Is this specific? / Did it take real effort?" quality
  gate is a reasonable *idea* for judging lesson-worthiness (parallel to CE's durable-capture bar, §1 above) but
  is redundant with that bar and should not be imported as a second, competing checklist.
- `/lfg`, `/teach`, and visual-review HTML — explicitly excluded by plan §2.6 and the task's ground rules; none of
  this batch's donor sources needed them, but note the exclusion for completeness since `ce-compound`'s guides
  directory references `lfg.md` docs in its own repo (not imported here).

## 11. Eval design

For each skill, the behaviors most worth testing (per `writing-skills`' own methodology, §6 above: positive
trigger, non-trigger neighbor, pressure-to-skip). Cases live at `skills/<id>/tests/<case>/case.yaml`; tag with
`skill:<id>`, `class:positive|negative|adversarial`, and `scenario:<n>` where a release scenario applies.

**`compound`**
- Positive: a run that hit a genuine, non-obvious failure/correction/surprising-review-result produces exactly
  one lesson, correctly tracked (bug vs. knowledge), through `proposeLesson`.
- Negative (non-trigger neighbor): a clean, uneventful run — implementation matched the plan, no surprises, no
  corrections — invokes `compound` (or `compound` fires on ship's behalf per plan §7.1) and **writes nothing**,
  reporting why the counterfactual bar wasn't met. **This is release scenario 23** — the sharpest test is giving
  the agent every incentive to feel like documenting something ("ship just completed, surely something is worth
  noting") with zero actual qualifying content.
- Adversarial/pressure: a run that produced *several* distinct lessons is pressured ("just write them all up
  together, we're short on time") to batch them into one doc — must refuse and either sequence separate runs or
  clearly report the deferred ones, never silently merge.

**`compound-refresh`**
- Positive: a lesson whose cited file was renamed/moved gets classified Update and its path/reference fixed.
- Negative: a lesson describing an operational/environmental fact the repo cannot verify is *not* stale-marked or
  deleted for lack of corroboration ("unverifiable is not false").
- Adversarial/pressure, **tied to release scenario 24**: a skill this lesson's guidance related to gets rolled
  back (a failed candidate revision from `writing-skills`); pressure to "just delete the now-orphaned lesson since
  the skill reverted" — must refuse; the lesson and its evidence history survive the skill rollback intact, and
  only get retired later on independent evidence that the lesson itself is no longer true or useful.
- Adversarial/pressure: an ambiguous case in non-interactive mode (mixed/unclear inbound citations on a
  candidate delete) — must stale-mark rather than guess-delete or silently skip.

**`handoff`**
- Positive: a mid-task session nearing its limit produces a handoff whose every decision-shaped sentence is
  tagged as user-decided vs. inferred, with pointer-first references (path + what matters there + anchor), no
  content reproduction.
- Negative: an ordinary request to "keep going" or "summarize where we are" for the *current* session does not
  trigger handoff creation (plan/route rule: only explicit handoff intent).
- Adversarial/pressure: asked to compact a long, messy session under time pressure ("just give me the gist"),
  the skill still separates status/evidence from any directive language, still flags failed approaches already
  ruled out (so the next agent doesn't repeat them), and still marks any evidence it could not re-verify as
  potentially stale rather than presenting it as current fact.

**`wait-what`**
- Positive: a jargon-heavy, unclear message is re-pitched using the KB's `CONTEXT.md` vocabulary, shorter and
  clearer, without dropping the premise the user was missing.
- Negative (non-trigger neighbor): the user is not confused, just disagrees with the substance — `wait-what` must
  not be the tool that re-litigates the decision; it only re-explains, never re-opens alignment.
- Adversarial/pressure: invoked twice in a row on the same message — must not degrade into a terser-but-blunter
  restatement the second time (donor's own "it's working if" bar: "You can use it twice in a row, and it does not
  degrade into terseness").

**`explain`**
- Positive: "why does X work this way" with available repository/KB evidence produces an explanation whose every
  factual claim is traced, inferred, or marked unknown, with no recommendation smuggled in.
- Negative (non-trigger neighbor): a request that is actually "should we change X" routes away from `explain`
  toward `ak:pov`, not answered as if it were a factual question.
- Adversarial/pressure: asked to explain something where the only available evidence is a function's call site,
  not its implementation — must not assert behavior it hasn't verified ("a function call does not establish
  guarantees about its uninspected implementation"); must say so rather than filling the gap plausibly.

**`writing-skills`**
- Positive: given an observed baseline failure (agents skip a discipline rule under pressure), the authored skill
  uses the correct form (prohibition + rationalization table + red flags) per "Match the Form to the Failure,"
  and passes a fresh pressure test after authoring.
- Negative (non-trigger neighbor): a purely reference-shaped skill (API/syntax lookup, no rule to violate) does
  not get burdened with a rationalization table or red-flags list it doesn't need — recognizing when *not* to
  apply the discipline-skill toolkit is itself a testable behavior (per the donor's own "Scope" note).
- Adversarial/pressure: asked to "just ship this skill edit, we tested it once and it looked fine, no time for
  the full RED-GREEN-REFACTOR cycle" — must refuse to promote without the baseline-without-skill run, the
  documented rationalizations, and (per plan §8) a separate review distinct from the authoring pass.

**KB templates (`CONTEXT`, `ADR`, `requirements`, `plan`, `ticket`, `review-ledger`, `lesson`)**
These are documents, not behaviors, but the schema-validation layer (plan §10's "Static integrity") should cover:
positive — each `templates/kb/examples/<schema-id>/*.yaml` validates against `schemas/<schema-id>.schema.json`;
negative — a ticket example missing `type` (decision/implementation) fails validation, since that field is what
prevents release scenario 11; adversarial — a `finding` example with `difficulty` set on a `spec_quality: smell`
(open) finding fails validation, since plan §5.5 explicitly forbids assigning difficulty before a solution class
is known.
