// Generated from e15be71 by scratchpad/gen.ts -- do not hand-edit the captured
// text or scores. Regenerate against a revision and commit the diff.

/** The ruling texts as of e15be71, which are the corpus the IDF is computed over. */
export const RULINGS_AT_REVISION: ReadonlyArray<{ readonly id: string; readonly text: string }> = [
  { id: "entrypoint-phase-operation-split", text: "Split the public entrypoint from the shared phase operation. A human invokes the entrypoint; a delegated controller invokes an exposed phase operation, and only when the runner validates a grant that covers it. Ordinary workers cannot manufacture a grant or start a new gated phase. Public wrappers and the supervisor pair run the same protocol, so there is no second pipeline. Where a host cannot validate a grant, the skill stops for explicit invocation rather than reproducing the forbidden command's effect through a side door. Ship may draft a lesson candidate; publishing it needs explicit authority or a charter grant." },
  { id: "reviewer-continuity-not-amnesia", text: "\"Fresh\" means independent of the author, never ignorant of prior findings. A continuing specialist may retain its earlier finding context, or a replacement receives a durable prior-finding packet. Either way the seat sees the old finding, its fingerprint and evidence, and the new revision. Independence from the author is mandatory; amnesia is not." },
  { id: "delta-scope-affected-behavior", text: "The delta is bounded by affected behavior, not by changed lines. It reviews the impact neighbourhood of the fix. New findings require novelty evidence — what changed or what regressed that makes this finding new — and unrelated low-priority discovery does not restart. A serious newly discovered issue in an untouched affected caller stays reportable. Scope discipline is not a reason to suppress relevant evidence." },
  { id: "closure-requires-independent-verification", text: "Only independent verification evidence, plus a policy rule saying that evidence is sufficient for that finding, closes a finding. Reviewer confidence and classifier output are advisory and are recorded as such. An agent's description of a green run is not a receipt: a receipt carries the command or probe, exit status, output digest, revision and environment identity. An author may never close their own finding, and a changed patch does not inherit stale receipts." },
  { id: "numeric-heuristics-are-guidance", text: "Both are configurable starting points, established per project, carried in the project record and explained in a reference pack. Neither is validated or enforced here, and neither is grounds for a finding on its own. Real constraints are set per project and exceptions are recorded, rather than forcing artificial file splits or meaningless tests." },
  { id: "diagnose-patch-or-packet-never-both", text: "Diagnosis states the hypothesis before the edit and emits exactly one of two outputs: a verified bounded patch, under a grant that covers it, or a diagnostic work packet. Never both, and never a patch re-implemented from the packet after the packet already carried one. A bug with a reproduction enters through diagnosis; only a fixed result is a work source for the build lane." },
  { id: "ci-repair-restricts-purpose-not-permission", text: "The rule restricts the purpose and scope of the repair, not the standard the change must meet. No skipped checks, no weakened assertions, no lowered thresholds, no removed coverage — without a separate decision. A required product-code change leaves CI repair and re-enters diagnosis, a bounded patch, new verification and affected delta review. Three bounded attempts, then stop." },
  { id: "prototype-human-experience-needs-human", text: "The evaluator is named in advance. A prototype answering a technical question may use automated acceptance criteria and run unattended. A prototype whose question is about human experience stays blocked without a human: on an unattended run it stops and escalates rather than substituting an automated verdict for the experience it exists to produce." },
  { id: "central-kb-owns-project-artifacts", text: "The central knowledgebase owns every project-derived artifact: decisions, requirements, plans, tickets, reviews, lessons and sanitized run receipts. This package owns reusable instructions and templates only. Directory names under the knowledgebase root are configurable; the central ownership is not. A skill never creates an application-local documentation tree as a substitute, and a completed ship is not permission to rewrite project knowledge." },
  { id: "full-catalog-opt-in-profiles", text: "Ship the full catalog, install by profile, and load long material on demand through reference packs. No duplicate donor lifecycles, no second run-everything entrypoint. The default profile is the useful first operational release; the other profiles add scope without adding a competing lifecycle. Progressive disclosure is the mechanism, not a body that depends on another package's hooks." },
  { id: "two-fix-cycles-then-stop", text: "At most two fix-and-verify cycles after the first pass. The third stops with an explicit blocked-or-replan decision and the open findings attached. Repeated failure is a signal about the plan, not an invitation to a third loop. Anything still open is reported." },
  { id: "delta-baseline-reset-not-third-loop", text: "When architecture, requirements, the comparison base or the affected surface changes materially, affected approvals are invalidated and a new baseline is deliberately established. That is a new review scope with its own pass 1, not an unbounded third delta loop. A review run records its comparison base, its reviewed head and the last head verified in the delta loop, so the three are never conflated." },
  { id: "panel-composition-by-declared-risk", text: "The panel is layered. Correctness is the only unconditional seat; the standards gate runs when the project declares standards or when discovery was uncertain; testing, maintainability, agent-native and learnings fire when the diff earns them; security, adversarial and the remaining conditional and stack seats are selected from artifact evidence, in practice from the attached packs. A substantive feature lands at the six-ish panel the design preserves. A documentation typo does not. Security, API and data facts are never dropped because a classifier was uncertain." },
  { id: "required-lane-failure-is-unavailable", text: "A lane that could not run, could not be given its required context, or failed, returns `unavailable`. That is a result, not an absence. A required lane that is `unavailable` blocks approval, is never downgraded to an empty result, and is never backfilled by the author, the implementer, another seat or the synthesis step. The review names the lane and why, and stays resumable. Fail closed when required evidence is absent." },
  { id: "low-confidence-security-adjudicated", text: "A low-confidence security concern stays visible and is adjudicated at the finding adjudication checkpoint. It is never silently discarded by a filtering threshold, and the security or adversarial seat is never skipped because a classifier was uncertain about the artifact. Confidence is an evidence anchor recorded on the finding, not a gate in front of it. Synthesis may not raise a nit's severity because several seats agreed on it either." },
  { id: "safe-auto-restricted-per-seat", text: "The plan's four-value enum is canonical and `schemas/finding.schema.json` is its authority; each donor enum is a proper subset and neither cuts it. The restriction is on *emission by a seat*, never on the vocabulary. No code-review seat emits `safe_auto`: at review time a code edit has no single mechanically correct answer, so classification is a proposal and applying it is the caller's decision under its own authorization. `doc-review/coherence` is the one seat that routinely emits it, for its own closed pattern list, and only where the schema's structural gate already holds — `spec_quality: patch`, `difficulty: mechanical` and a `suggested_fix`. A synthesis or intake step that receives `safe_auto` from a peer lane remaps it to `gated_auto`; it never drops the finding. `advisory` is available to every seat." },
  { id: "supervisor-agreement-is-not-authority", text: "Agreement is necessary and not sufficient. The deterministic authority check runs independently and must also pass: required evidence present and still bound to its hashes, the charter listing this checkpoint and this action. Disagreement, missing evidence, a supervisor failure or an out-of-charter action blocks the checkpoint and produces exactly one escalation. There is no tie-breaking third supervisor and no repeated internal debate; a tie goes to the human." },
  { id: "missing-supervisor-never-implementer", text: "A seat that cannot be filled independently is unavailable, and unavailability blocks the checkpoint. It is never backfilled by the implementer, the author, the spec approver or a seat already sitting on the panel. The supervisor pair never implements and never approves a patch it produced. The security seat specifically may not be filled by the implementer of the change under review nor by whoever approved its spec." },
  { id: "sensitive-actions-need-approved-charter-entry", text: "Merge, deploy, production credentials, destructive data operations, new dependencies, public-contract redesign, sensitive trust-boundary changes, scope expansion, force-push and history rewrite are never granted by default. Each requires an explicit charter entry a human approved up front, naming the action, exactly what is permitted, and an explicit human approval bound to that charter's hash, with any expiry or single-use bound. The pair may never enlarge its own authority; more autonomy is a more specific capability approved in advance, not a decision taken mid-run." },
];

export interface LabelledCase {
  readonly id: string;
  /** Where it was found, for a human. Never matched on: positions decay. */
  readonly origin: string;
  /** The block verbatim at e15be71. This, not the file, is the fixture. */
  readonly text: string;
  /** A line of the case inside the captured text. Its block is the scored unit. */
  readonly anchor: string;
  /** Citation scope follows the format: the block in markdown, the file in YAML. */
  readonly format: "markdown" | "yaml";
  readonly ruling: string;
  readonly label: "defect" | "not-a-defect" | "undecided";
  /** Why it carries that label. A verdict without reasoning propagates errors. */
  readonly why: string;
  /** Cosine at capture, under the shipping build. */
  readonly score: number;
}

export const LABELLED: ReadonlyArray<LabelledCase> = [
  {
    id: "agents-invocation-law",
    origin: "AGENTS.md:55 at e15be71",
    text: "A human invokes the entrypoint. A controller invokes the phase operation. Where a host cannot\nvalidate a grant, the skill **stops for explicit invocation** rather than reproducing a forbidden\ncommand's effect through a side door.",
    format: "markdown",
    anchor: "A human invokes the entrypoint. A controller invokes the phase operation",
    ruling: "entrypoint-phase-operation-split",
    label: "defect",
    why: "Restates the invocation split in its own words and cites nothing. The section's table above it names the layers but carries no ruling id.",
    score: 0.65,
  },
  {
    id: "agents-numeric-heuristics",
    origin: "AGENTS.md:136 at e15be71",
    text: "The ~100-line PR target and the 80/15/5 test pyramid are configurable starting points (arch §3, §11).\nReal constraints are set per project, and exceptions are **recorded** rather than forcing artificial\nfile splits or meaningless tests.",
    format: "markdown",
    anchor: "configurable starting points (arch",
    ruling: "numeric-heuristics-are-guidance",
    label: "defect",
    why: "Near-verbatim on the ruling's substance, and cites the architecture note instead of the ruling. A citation to a non-ruling source does not discharge 6.",
    score: 0.78,
  },
  {
    id: "authoring-kb-two-clauses",
    origin: "AUTHORING.md:430 at e15be71",
    text: "Two clauses of that ruling are easy to lose and both bind a writer. **Directory names under the\nknowledgebase root are configurable; the central ownership is not** — so a body names the operation\nit calls and never hardcodes a knowledgebase path, which would re-create the local tree one level\nfurther out. And **a completed ship is not permission to rewrite project knowledge**: a skill that\nfinishes its work does not thereby acquire a write it did not have, and a body that has a step\nrevising project knowledge after shipping is describing an authority no skill holds.",
    format: "markdown",
    anchor: "Two clauses of that ruling are easy to lose",
    ruling: "central-kb-owns-project-artifacts",
    label: "defect",
    why: "States two clauses of the ruling and reaches its citation only through the words 'that ruling', across a blank line, in the paragraph above. 6 requires the citation inline at the sentence it governs, because an agent loading one paragraph never sees the line above it. Three agents first called this a false positive; it is not.",
    score: 0.60,
  },
  {
    id: "authoring-repeated-failure",
    origin: "AUTHORING.md:607 at e15be71",
    text: "**Repeated failure is a signal about the plan, not an invitation to a third loop.** A batch that\nfails twice is evidence about the brief, not about the writer's output, and this contract gives that\nevidence somewhere to go: the replan branch is a contract defect (above), filed with the two cycles\nas its record. A writer that reads the cycle limit as a verdict on its own work will report and stop\nwhere it should report and escalate. Where the replan lands on a materially changed baseline, that is\na new review scope with its own first pass rather than a third delta loop (ruling\n`delta-baseline-reset-not-third-loop`).",
    format: "markdown",
    anchor: "Repeated failure is a signal about the plan",
    ruling: "two-fix-cycles-then-stop",
    label: "defect",
    why: "Reproduces the ruling's third sentence verbatim while citing a different ruling at the end of the same paragraph. The strongest instance in the corpus, and the one a section-wide or file-wide citation scope would clear.",
    score: 0.55,
  },
  {
    id: "tdd-receipt-not-narrative",
    origin: "protocols/tdd/PROTOCOL.md:79 at e15be71",
    text: "Gate: an agent's description of a green run is not a receipt. A receipt carries the command or\nprobe, exit status, output digest, revision and environment identity.",
    format: "markdown",
    anchor: "an agent's description of a green run is not a receipt",
    ruling: "closure-requires-independent-verification",
    label: "defect",
    why: "The second of two consecutive Gate paragraphs stating different clauses of one ruling. The first cites it; this one did not. N independent clauses generate N citation obligations.",
    score: 0.69,
  },
  {
    id: "agents-donor-mapping-row",
    origin: "AGENTS.md:76 at e15be71",
    text: "| Design-brief concept | What this repo does instead |\n|---|---|\n| Tier choice / confidence scoring before a spawn | Deterministic policy checks against artifact evidence |\n| Named-model implementer seating | An `implementer` role; the runner binds who fills it |\n| \"Cross-family on purpose\" supervisor pairing | Two `supervisor` seats declared **independent**; independence is a runner-enforced constraint |\n| \"Fail closed on low confidence\" | \"Fail closed when required evidence is absent\" |\n| \"Do not put <model> on security\" | The security seat may not be filled by the implementer or the spec approver |\n| In-skill cost/token caps | Budgets passed in by the runner; the repo enforces only the cap it was handed |",
    format: "markdown",
    anchor: "The security seat may not be filled by the implementer",
    ruling: "missing-supervisor-never-implementer",
    label: "defect",
    why: "Overturned from not-a-defect. The right cell, under a column headed 'What this repo does instead', states the ruling's closing sentence in the repo's own voice with no authority attached, and an agent loading the row sees an actionable rule. Calling it 'a table row' was a form argument about the container -- the same move rejected one case above. The row directly beneath it quotes the closing sentence of `required-lane-failure-is-unavailable` verbatim, in quotation marks, also uncited. AGENTS.md now carries the citation this check named.",
    score: 0.56,
  },
  {
    id: "readme-ruling-digest",
    origin: "README.md:104 at e15be71",
    text: "- **Artifacts are revision-bound.** Approvals bind to a content hash, never a filename. A changed plan\n  does not inherit the old plan's approval; a changed patch does not inherit stale receipts.\n- **Findings are P0–P3.** Critical/Important/Nit/FYI are presentation labels, not a replacement.\n  Synthesis may only *worsen* a grade. Low-confidence security findings are adjudicated, never\n  silently filtered.\n- **Only independent verification closes a finding.** Reviewer or classifier confidence is advisory.\n- **Delta review is bounded by affected behavior, not changed lines.** A serious newly discovered\n  issue in an untouched caller stays reportable.\n- **\"Fresh reviewer\" means independent of the author**, not amnesiac between cycles.\n- **Two fix cycles, then stop.** Anything still open is reported, not looped.\n- **Numeric heuristics are guidance.** The ~100-line PR target and 80/15/5 pyramid are configurable,\n  not gates.",
    format: "markdown",
    anchor: "Delta review is bounded by affected behavior",
    ruling: "delta-scope-affected-behavior",
    label: "defect",
    why: "Overturned from undecided. It is a restatement -- the surrounding block is six bullets restating six rulings, and at a lowered threshold five surfaced with the correct ruling ranked first each time, scoring 0.29 to 0.64 for the identical act. The open question was the unit, not the claim: the finding is the block and a reader could call the row unactionable. README has since been repaired bullet by bullet, six citations, which answers it in practice.",
    score: 0.64,
  },
  {
    id: "review-delta-field-list",
    origin: "protocols/review-delta/PROTOCOL.md:41 at e15be71",
    text: "- Persisted from pass 1: the finding list, the input hashes, the dispositions and the evidence.\n- Added for the delta: the latest fix diff, the touched dependencies, and the\n  `schemas/verification.schema.json` receipts bound to the new head.\n- The snapshot: `comparison_base`, `reviewed_head` and `last_head_verified`, recorded so the\n  three are never conflated.\n- For each finding, the prior-finding packet — `finding_id`, `fingerprint`, `severity`,\n  `evidence`, `disposition`, `input_hashes`, `source_revision`. A continuing seat may retain its\n  earlier context; a replacement receives this packet. Either way the seat sees the old finding\n  and the new revision (ruling `reviewer-continuity-not-amnesia`).",
    format: "markdown",
    anchor: "comparison_base`, `reviewed_head` and `last_head_verified`",
    ruling: "delta-baseline-reset-not-third-loop",
    label: "defect",
    why: "Overturned from not-a-defect, and the clearest of the three errors. I read it as the field-name class because it lists three field names -- but it also carries the ruling's own closing clause, 'so the three are never conflated', verbatim. The enumeration was the container and I never read the sentence. The bullet now cites the ruling this check named. The field-name class is real and is represented here by `apply-findings-snapshot-bullet`, which sits below the threshold.",
    score: 0.60,
  },
  {
    id: "product-prototype-rationale",
    origin: "profiles/product.yaml:69 at e15be71",
    text: "# profiles/product.yaml — product judgment, kept out of ordinary implementation contexts.\n#\n# Authority: plan §2.3 (retained standalone supporting skills), §6.5 (product lens and premise\n# review), §11 (opt-in profiles).\n#\n# Machine-read by `ak validate` against the `profiles:` field in catalog.yaml.\n#\n# A profile is a capability and scope set. It names no model, provider, cost or routing rule.\n\nschema_version: 1\nprofile: product\ndefault: false\nrequires: [core]\n\nwhy_it_exists: >-\n  Four skills that decide what is worth building rather than how to build it. They are separated\n  from core because a recommendation is not authorization, and because in a repository with no\n  standing product anchors they have nothing to ground a judgment on. A team that has those\n  anchors gets real value; a team that does not gets confident opinions, which is worse than\n  silence.\n\nincludes:\n  skills:\n    count: 4\n    entries: [ideate, pov, strategy, product-pulse]\n    notes:\n      ideate: Generate options, then critique them. No implicit commitment or scope expansion.\n      pov: >-\n        Project-grounded recommendation with optional independent opinions. Read-only. Dissent\n        and insufficient-evidence results survive to the output; a recommendation authorizes\n        nothing.\n      strategy: >-\n        Works from standing product goals and strategic constraints. No automatic feature\n        expansion.\n      product-pulse: >-\n        Inspects changes and signals against existing product anchors. A report, not permission\n        to change the roadmap.\n\n  packs: []\n  protocols: []\n  roles: []\n  references: []\n  rationale_for_empty: >-\n    The product lens these skills need is already installed with core: `doc-review/product-lens`\n    and `doc-review/adversarial-document` ship in core because `doc-review` does. This profile\n    adds entrypoints, not judgment machinery.\n\n  capabilities:\n    required: [repository-read, artifact-write]\n    optional: [kb-read, network-fetch, human-channel]\n\nprerequisites:\n  - >-\n    A project record with standing goals, anchors or constraints. Without one, `pov` returns an\n    insufficient-grounding result and `strategy` and `product-pulse` have no baseline to compare\n    against. That is the correct behavior, not a failure, but it makes the install pointless.\n\ndeliberately_excludes:\n  - id: authorization\n    why: >-\n      None of these skills approves, plans or implements anything. A chosen option becomes work\n      through super-align and super-bound, with a human approving the direction.\n  - id: reopening-settled-decisions\n    why: >-\n      A rejected product option is not silently reopened. Reopening requires new evidence, named\n      and bound to a revision (release scenario 12).\n  - id: prototype\n    why: >-\n      `prototype` is a core primitive, not a product skill. A product question that only an\n      artifact can settle reaches for it there — and stays blocked without a human when the\n      question is about human experience.\n  - id: bakeoff\n    why: >-\n      Competing bounded experiments in separate workspaces are repository maintenance work, not\n      product judgment. It ships in maintainer.\n\nrulings: [prototype-human-experience-needs-human, full-catalog-opt-in-profiles]",
    format: "yaml",
    anchor: "`prototype` is a core primitive",
    ruling: "missing-supervisor-never-implementer",
    label: "not-a-defect",
    why: "A profile rationale paraphrasing the prototype ruling, in a file whose `rulings:` key cites it. Captured whole, because YAML citation scope is the file: as a block alone it scores 0.50 and reports, and in its file it scores 0.20 and does not. That gap is the file-scope rule working, and it is the reason a YAML case cannot be captured as a paragraph. Also the only case here well below threshold, so without it nothing guards a change that drags rejections up across the line.",
    score: 0.20,
  },
  {
    id: "apply-findings-snapshot-bullet",
    origin: "protocols/apply-findings/PROTOCOL.md:46 at e15be71",
    text: "- Findings under `schemas/finding.schema.json` with `status: accepted`, each carrying\n  `spec_quality`, `difficulty`, `autofix_class`, `evidence` and `authorization_ref`. A finding\n  arriving from a peer lane with `autofix_class: safe_auto` is remapped to `gated_auto` on intake\n  and never dropped — the action class is not a claim about whether the finding is true (ruling\n  `safe-auto-restricted-per-seat`).\n- The prior-finding packet when this is not the first cycle: `finding_id`, `fingerprint`,\n  `severity`, `evidence`, `disposition`, `input_hashes`, `source_revision`\n  (`policies/review.yaml` `continuity`). The seat that closes a finding sees the old finding and\n  the new revision; independence is from the author, never amnesia (ruling\n  `reviewer-continuity-not-amnesia`).\n- The snapshot: comparison base, reviewed head and input hashes.\n- The verification command and environment the receipts will bind to.",
    format: "markdown",
    anchor: "The snapshot: comparison base, reviewed head and input hashes",
    ruling: "supervisor-agreement-is-not-authority",
    label: "not-a-defect",
    why: "A bullet naming snapshot fields, inside a block listing the packet a seat receives. The documented field-name class, and the nearest rejection in the set at 0.49 -- so it is the case that moves first if the threshold is lowered. Reported once as the third known true instance; it is not. The genuine one sits a few lines below and scores zero.",
    score: 0.49,
  },
];
