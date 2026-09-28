<!--
THIRD-PARTY SUMMARY, NOT THE PAPER.

This file is a summary, written by a third party, of:

  Liyan Tang, Cyrus Rashtchian, Chun-Sung Ferng, Andrew Tomkins, Da-Cheng Juan, Tu Vu.
  "WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution."
  arXiv:2608.27454v1, 27 August 2026.

It is not the authors' text and not a quotation of the paper. The maintainer supplied it in the
planning session that brought the learning stack into this package; it is reproduced below
verbatim, with only its line breaks restored. Any claim a catalog file draws from it is a claim
about this summary, and should be checked against the paper before it is cited as the paper's.
Held under research/sources/, which is denylist-exempt because it quotes its sources verbatim.
-->

# WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution

## Executive summary

The work is **“WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution,”** by Liyan Tang, Cyrus Rashtchian, Chun-Sung Ferng, Andrew Tomkins, Da-Cheng Juan, and Tu Vu. It was posted as arXiv:2608.27454v1 on **August 27, 2026**. The authors list Google Research affiliations, with Tu Vu also affiliated with Virginia Tech.

The central idea can be summarized as:

```text
execution
    ↓
immutable traces
    ↓
persistent synthesized knowledge
    ↓
candidate procedural skill
    ↓
held-out evaluation
    ↓
commit skill / rollback skill

          ↑
   outcome always flows
   back into knowledge
```

WikiSkill explicitly separates:

```text
what happened
     ≠
what we learned from it
     ≠
what we currently deploy
```

That distinction is the important part.

The paper maintains three separate states:

* **Raw Layer** — immutable execution traces.
* **Wiki Layer** — persistent knowledge about recurring failures, successful strategies, root causes, previous interventions and their outcomes.
* **Skills Layer** — compact procedural instructions actually given to the runtime agent.

Skills are subject to rollback.

The wiki is not.

A rejected skill modification therefore becomes **new training evidence for the optimizer** rather than disappearing with the rollback. The paper explicitly records proposal diffs and accept/reject outcomes in `skill-impact.md`, and the next proposer is instructed to read that file so it does not blindly repeat rejected approaches.

That is why describing WikiSkill as an **experience compiler** is a useful engineering interpretation:

```text
Traces
  ↓
Diagnostic intermediate representation
  ↓
Procedural compilation
  ↓
Validation
  ↓
Deployable skill
```

The “wiki” effectively becomes a durable IR between experience and executable policy.

---

# 1. What problem WikiSkill solves

Existing self-improving agent systems already do variants of:

```text
run tasks
→ inspect failures
→ propose better instructions
→ test them
→ keep/reject
```

The problem is that much of the reasoning performed during optimization becomes transient.

The WikiSkill authors explicitly contrast their system with systems such as EvoSkill, Trace2Skill and SkillOpt. Those systems preserve some history, extract lessons, or retain rejected-edit feedback, but WikiSkill argues that they do not maintain the accumulated understanding as a **separate evolving knowledge representation**.

Consider this sequence:

```text
Iteration 1:
"Maybe the agent is failing because it doesn't inspect file metadata."

Skill edit:
"Always inspect file metadata first."

Validation:
-4%

ROLLBACK
```

A naïve optimizer leaves you approximately here:

```text
skill = old_skill
```

WikiSkill instead leaves you with:

```text
skill = old_skill

wiki += {
  hypothesis:
    "failure may relate to metadata inspection",

  attempted_fix:
    "always inspect metadata first",

  validation_result:
    -4%,

  conclusion:
    "unconditional metadata inspection is harmful"
}
```

The agent has reverted.

The learning system has not.

---

# 2. Architecture

The workspace described in the paper is approximately:

```text
workspace/
├── raw/
│   └── execution traces
│
├── wiki/
│   ├── index.md
│   ├── log.md / logs.md
│   ├── skill-impact.md
│   │
│   └── patterns/
│       ├── search-loop.md
│       ├── malformed-tool-use.md
│       ├── successful-strategy-x.md
│       └── ...
│
└── skills/
    └── <skill>/
        ├── SKILL.md
        └── PURPOSE.md
```

### Raw layer

Execution traces preserve the complete trajectory: reasoning/actions, tool invocations, tool results and final answers. They are deliberately immutable.

This matters because the wiki is an LLM-generated interpretation.

You retain:

```text
observation
```

separately from:

```text
interpretation of observation
```

That is a strong design choice.

### Wiki layer

The wiki contains:

```text
patterns/
    recurring failures
    successful strategies
    root causes
    concrete workarounds

index.md
    compact retrieval layer

log.md
    evolution chronology

skill-impact.md
    proposed change
    diff
    validation result
    accepted/rejected
```

The paper says the history lets later optimizer iterations see previous interventions, avoid repeating rejected changes and identify recurring errors across iterations.

### Skills layer

A skill contains at least:

```text
SKILL.md
PURPOSE.md
```

`SKILL.md` is what the task-performing agent executes.

`PURPOSE.md` maintains provenance linking the skill back to patterns that motivated its creation or modification.

This gives you a causal chain resembling:

```text
trace
↓
pattern
↓
skill change
↓
validation
↓
deployment
```

rather than an opaque prompt mysteriously changing over time.

---

# 3. The actual evolution loop

The paper formalizes state as:

```text
(S_k, W_k)

S = active skills
W = persistent wiki
```

It starts with:

```text
S_0 = ∅
W_0 = ∅
```

and calculates the initial validation score before evolving anything.

A simplified implementation is:

```python
skills = {}
wiki = {}

best_score = evaluate_validation(skills)

for iteration in range(K):

    if best_score == 1.0:
        break

    # Runtime experience
    traces = run_training_tasks(skills)

    # Experience → knowledge
    sample = choose_diagnostic_traces(traces)

    wiki = update_wiki(
        existing_wiki=wiki,
        traces=sample,
    )

    # Knowledge → procedure
    proposal = proposer(
        wiki=wiki,
        skills=skills,
        traces=traces,
    )

    candidate = apply(skills, proposal)

    # Procedure → empirical outcome
    candidate_score = evaluate_validation(candidate)

    if candidate_score > best_score:
        skills = candidate
        best_score = candidate_score
        accepted = True
    else:
        # rollback candidate
        accepted = False

    # Happens even when the candidate was rejected
    wiki.record_skill_impact(
        proposal=proposal,
        score=candidate_score,
        accepted=accepted,
    )
```

This matches Algorithm 1: run training rollouts, maintain the wiki, propose a skill change, evaluate it, commit or rollback the skill, and finally append the proposal outcome to the wiki regardless of the gating decision.

---

# 4. “Atomic skill update” means something fairly specific

The tweet's wording here is accurate.

Each proposer iteration targets **one skill**.

It may:

```text
create
patch
no_action
```

but the candidate change does not arbitrarily mutate the entire skill repository.

Patches use operations resembling:

```json
{
  "op": "replace",
  "target": "...",
  "content": "..."
}
```

or:

```text
append
insert_after
replace
```

The Wiki Maintainer also uses patch-style edits and is explicitly instructed to make minimal modifications rather than repeatedly rewriting everything.

In software-engineering terms:

**one WikiSkill iteration resembles a small PR against the agent's procedural codebase.**

That dramatically improves attribution:

```text
candidate X
caused
score ΔY
```

versus trying to understand ten simultaneous behavior changes.

---

# 5. The Wiki Maintainer

The Maintainer's prompt is published in the appendix.

It is explicitly told to perform **root-cause analysis**, compare successful and unsuccessful trajectories, identify action patterns rather than merely error strings, and document both failures and successful strategies.

Pattern pages contain roughly:

```text
Problem
Root cause
Evidence
Relevant command/action sequence
Known fix/workaround
```

The Maintainer is instructed to:

```text
avoid duplicate patterns
update existing pages with new evidence
keep patterns concise
only retain meaningful/generalizable observations
```

and target roughly 10–30 lines per pattern.

This is another important detail.

WikiSkill isn't:

```text
dump all traces into vector DB
```

It is closer to:

```text
raw telemetry
     ↓
postmortem analysis
     ↓
normalized engineering knowledge
```

---

# 6. The Skill Proposer

The proposer is a ReAct-style agent.

It starts with:

```text
wiki/index.md
wiki/skill-impact.md
training task outcomes
current skills
```

rather than having every trace dumped into its context.

It can then selectively inspect:

```text
specific pattern pages
specific execution traces
```

before proposing an edit.

The published prompt explicitly says:

```text
read wiki first
read skill-impact.md
do not repeat rejected approaches
inspect relevant pattern pages
inspect failed traces
```

and requires the proposer to read **at least four execution traces** before modifying a skill.

So the hierarchy becomes:

```text
index
  ↓
pattern
  ↓
raw evidence
```

which is effectively progressive disclosure for optimizer memory.

---

# 7. The rollback asymmetry is the key idea

Acceptance requires:

```text
candidate_validation_score > best_validation_score
```

Not `>=`.

Strictly better.

If it loses:

```text
skills → rollback
wiki   → continue forward
```

That produces an interesting system invariant:

```text
deployed procedural state:
    monotonic-ish

optimizer knowledge:
    cumulative
```

Or, using a software analogy:

```text
skills/
    production branch

wiki/
    issue tracker +
    postmortems +
    research notebook +
    rejected PR history
```

You can revert production without deleting what the organization learned from the failed deployment.

---

# 8. The strongest experimental result isn't the headline benchmark

WikiSkill beats the compared skill-evolution baselines on average across all five tested model configurations.

Against each model's strongest competing method, the reported average gains are:

```text
Qwen-3.5-4B       +3.3
Qwen-3.5-9B       +5.1
Qwen-3.6-27B     +10.0
Gemma-4-31B       +5.8
Gemini-3.5-Flash +12.0
```

Results are averaged across three independent runs of the **full evolution pipeline**, with paired-bootstrap significance tests using 1,000 resamples.

The more revealing experiment is the ablation.

Using Gemini-3.5-Flash, when the runtime agent **cannot** access the wiki:

```text
Skill Proposer without persistent wiki:
48.7 average

Skill Proposer with persistent wiki:
63.7 average
```

That is:

```text
+15.0 percentage points
```

across LiveMath, SealQA, SpreadsheetBench and OfficeQA.

That is unusually strong evidence that the intermediate persistent knowledge layer is doing useful work rather than simply adding architectural complexity.

---

# 9. A counterintuitive result: don't give the wiki to the runtime agent

This might be my favorite experimental result.

The default WikiSkill configuration gives the **optimizer/proposer** access to the wiki but denies it to the **task-solving Inference Agent**.

Why?

When both have wiki access:

```text
63.7 → 60.9
```

average performance drops.

The authors' explanation is compelling.

Suppose the skill is incomplete.

If the runtime agent can compensate using the wiki:

```text
bad skill
+
rich wiki
=
successful trajectory
```

The optimizer then observes:

```text
"apparently the skill works"
```

even though the deployable artifact itself is deficient.

You have contaminated your training signal.

This implies a broader architecture principle:

```text
teacher context ≠ student context
```

or:

```text
optimizer memory ≠ runtime memory
```

That principle has implications well beyond WikiSkill.

---

# 10. Model scaling and skills appear complementary

Within Qwen, WikiSkill reports improvements over no skills of:

```text
4B:  +12.3 points
9B:  +17.5
27B: +23.9
```

The paper also reports:

```text
Qwen 9B + evolved skills: 47.4 average

Qwen 27B, no skills:       39.4 average
```

So skills aren't merely a crutch for weaker models.

The stronger model can often **execute a complicated learned procedure more reliably**, making external procedural knowledge more valuable as model capability increases.

---

# 11. Skills also transfer across models

A skill evolved using one model can be injected into another.

For example, the paper reports Qwen-3.6-27B-generated skills raising Qwen-3.5-9B on SpreadsheetBench from:

```text
24.3 → 50.5
```

and raising Gemma-4-31B on LiveMath from:

```text
33.9 → 73.7
```

There is also negative transfer.

That matters because it suggests:

```text
skill discovery capability
≠
skill execution capability
```

A future architecture could therefore reasonably use:

```text
expensive frontier model
        ↓
experience compiler
        ↓
validated skills
        ↓
cheaper runtime model
```

provided each compiler/runtime pairing is evaluated.

---

# 12. Concrete example from the paper

The ALFWorld case study shows the persistent-history mechanism nicely.

At Iteration 0:

```text
Wiki detects:
take → examine → move looping behavior

Skill proposer creates:
goal-directed-action

Validation:
rejected
```

The rejected diff remains in `skill-impact.md`.

At Iteration 1, informed by that failed experiment, the proposer creates:

```text
break-repetition-loop
```

with the rule:

```text
Never Return an Item to Its Origin Location
```

That proposal passes validation.

Later rollouts reveal a more complicated multi-operation loop.

The wiki accumulates that new evidence, and at Iteration 4 the skill gets refined with another procedural constraint.

This is essentially:

```text
failure
→ hypothesis
→ failed intervention
→ remembered failure
→ revised hypothesis
→ successful intervention
→ further evidence
→ refinement
```

Actual scientific iteration.

---

# 13. Relationship to earlier work

WikiSkill is not inventing agent memory, skills or reflection from scratch.

It is a particularly clean synthesis of several research threads.

| System                | Durable artifact                                     | Core idea                                                  |
| --------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| Reflexion             | textual reflections                                  | agents improve from verbal feedback                        |
| ExpeL                 | reusable insights/experiences                        | accumulate experience without weight updates               |
| Voyager               | executable code skill library                        | lifelong procedural learning                               |
| Agent Workflow Memory | reusable workflows                                   | infer recurring routines from trajectories                 |
| Trace2Skill           | consolidated skills                                  | compile many trajectory-local lessons                      |
| EvoSkill              | evolving skills + candidate history                  | failure-driven skill discovery                             |
| SkillOpt              | optimized skill + rejected-edit feedback             | validation-gated procedural optimization                   |
| **WikiSkill**         | **raw traces + persistent wiki + deployable skills** | **make accumulated optimizer knowledge first-class state** |

Reflexion stores natural-language self-reflection for later attempts.

ExpeL explicitly accumulates experiences and extracts reusable natural-language knowledge without model-weight updates.

Voyager introduced a continuously expanding library of executable skills, improved through environment feedback and self-verification.

Agent Workflow Memory induces reusable workflows from historical agent trajectories.

Trace2Skill analyzes many trajectories in parallel and consolidates local lessons into transferable skills.

EvoSkill iteratively analyzes failures and retains skill candidates that improve held-out performance.

WikiSkill's real novelty is narrower and more interesting:

```text
the system's accumulated understanding
is a durable object distinct from
the currently deployed policy.
```

---

# 14. Karpathy's LLM Wiki is an explicit precursor

The paper explicitly says it was inspired by Andrej Karpathy's **LLM Wiki** idea.

Karpathy's concept was essentially:

```text
raw documents
→ persistent synthesized wiki
→ future reasoning
```

instead of:

```text
raw documents
→ retrieve chunks
→ synthesize answer
→ throw synthesis away
```

Karpathy describes the problem as RAG repeatedly rediscovering knowledge from scratch rather than accumulating it.

WikiSkill changes the input/output domain:

```text
Karpathy:
sources → accumulated knowledge

WikiSkill:
agent experience → accumulated knowledge → executable procedure
```

That lineage is explicit in the paper.

---

# 15. What the paper does *not* solve

There are important constraints.

### Skill retrieval is effectively bypassed

The experiment directly injects the full current skill content into the runtime agent.

The authors explicitly do this to remove routing/retrieval errors as a confounder.

A production system with:

```text
100
1,000
10,000 skills
```

still needs:

```text
skill discovery
routing
ranking
compatibility
conflict resolution
```

### The wiki grows forever

The authors explicitly acknowledge that WikiSkill currently has **no automatic pruning mechanism**.

Long-term, you need something like:

```text
support count
contradiction count
recency
environment version
model compatibility
confidence
superseded_by
```

for every pattern.

### Strict validation blocks stepping stones

Because every accepted edit must immediately beat the historical best:

```text
A → B
```

is forbidden if B is performance-neutral, even if:

```text
A → B → C
```

would eventually produce a large improvement.

The paper explicitly identifies this limitation.

### Validation sets are small

For example:

```text
SealQA     16 train / 10 val / 85 test
ALFWorld   39 train / 18 val / 134 test
LiveMath   35 train / 18 val / 124 test
```

Repeated adaptive validation against 10–40 examples introduces obvious overfitting/noise risks.

### Very long-horizon tasks remain untested

The authors explicitly say they do not test tasks requiring hundreds of environment actions or multi-hour execution.

---

# 16. Security problem: persistent knowledge makes poisoning more serious

This part is my extrapolation rather than something the paper establishes experimentally.

A malicious tool result could produce:

```text
bad observation
→ bad wiki pattern
→ persistent optimizer belief
→ future skill proposals
```

And unlike a bad skill:

```text
the wiki isn't rolled back.
```

So production WikiSkill needs trust boundaries.

I would attach provenance to every wiki claim:

```ts
interface WikiClaim {
  id: string

  statement: string

  evidence: {
    traceId: string
    eventIds: string[]
  }[]

  supportCount: number
  contradictionCount: number

  environmentVersion: string
  modelFamily?: string

  firstObservedAt: string
  lastObservedAt: string

  confidence: number

  status:
    | "candidate"
    | "supported"
    | "contested"
    | "deprecated"
}
```

Markdown can remain the human-facing representation.

It should not be the source of truth.

---

# 17. How I would implement this for a serious agent harness

I would preserve the paper's architecture but make the event model stricter.

```text
               ┌────────────────────┐
               │ Runtime Agent      │
               └─────────┬──────────┘
                         │
                         ▼
                Immutable Trace Store
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
      Pattern Compiler          Trace Explorer
             │                       │
             ▼                       │
      Knowledge Graph / Wiki ◄───────┘
             │
             ▼
        Skill Proposer
             │
             ▼
       Candidate branch
             │
             ▼
       Evaluation harness
          ╱       ╲
       pass         fail
        │            │
      merge        discard
        │            │
        └──────┬─────┘
               ▼
      Experience ledger
               │
               └────► Wiki
```

Core persistence could be:

```ts
type Trace = {
  id: string
  taskId: string
  runId: string
  agentVersion: string
  skillRevision: string

  events: AgentEvent[]

  score: number
  artifacts: ArtifactRef[]
}

type Pattern = {
  id: string
  type: "failure" | "success" | "mixed"

  summary: string
  rootCause: string[]

  evidence: EvidenceRef[]

  workaround?: string[]

  confidence: number
  status: "active" | "contested" | "superseded"
}

type SkillProposal = {
  id: string

  baseRevision: string

  action:
    | "create"
    | "patch"
    | "delete"

  affectedSkill: string

  motivatingPatterns: string[]

  diff: string
}

type Validation = {
  proposalId: string

  baselineRevision: string

  candidateRevision: string

  perTaskScores: Record<string, number>

  aggregateScore: number

  accepted: boolean
}
```

Then make everything event-sourced:

```text
TRACE_RECORDED
PATTERN_CREATED
PATTERN_UPDATED
PROPOSAL_CREATED
VALIDATION_COMPLETED
SKILL_ACCEPTED
SKILL_REJECTED
PATTERN_CONTRADICTED
PATTERN_SUPERSEDED
```

Now the wiki becomes a materialized projection over historical experience instead of an opaque collection of Markdown mutations.

---

# 18. What I would change from the paper

For production, I would use a gate more sophisticated than:

```text
candidate_score > best_score
```

Instead:

```text
paired evaluation
+
confidence interval
+
regression budget
+
task-family stratification
```

For example:

```text
accept if:

P(candidate > incumbent) > 0.95

AND

critical_regressions == 0

AND

expected_improvement > ε
```

I would also preserve neutral candidates as branches:

```text
main
├── candidate-A
├── candidate-B
└── candidate-C
```

rather than immediately destroying everything except the single best revision.

This effectively turns skill optimization into search over a procedural program space.

---

# 19. Another major implication: software agents can build institutional knowledge

For coding agents specifically, imagine accumulating:

```text
wiki/
├── architecture/
├── debugging/
├── migrations/
├── regressions/
├── tests/
├── build-system/
├── dependency-gotchas/
├── deployment/
└── repo-specific-patterns/
```

Every resolved task produces:

```text
raw trace
       ↓
"what happened?"
       ↓
"what generalized?"
       ↓
"does an existing skill need modification?"
       ↓
evaluation
```

After 10,000 tasks you would no longer have merely:

```text
an LLM + repo
```

You would have:

```text
LLM
+
repo
+
operational history
+
institutional knowledge
+
validated procedural playbooks
```

The agent effectively accumulates **seniority**.

That is the big idea I would take from WikiSkill.

Not just memory.

Not just RAG.

Not just skills.

**Experience that compounds into validated procedure.**

---

# 20. What is genuinely new versus recombination

Most components individually already existed:

```text
execution traces       known
reflection             known
persistent memory      known
skill libraries        known
validation gates       known
rollback               known
textual optimizer      known
```

The valuable contribution is the state decomposition:

```text
RAW EXPERIENCE
      ↓
PERSISTENT EPISTEMIC STATE
      ↓
DEPLOYABLE PROCEDURAL STATE
```

combined with asymmetric rollback:

```text
procedure can regress → rollback it

knowledge of the experiment → retain it
```

That is a very clean abstraction.

And the +15-point persistent-wiki ablation provides unusually direct experimental support that the separation matters.

---

# 21. Research status and code

As of **September 16, 2026**, I found the paper as an arXiv preprint, but not an official Google Research implementation repository.

Several public implementations have already appeared, but the repositories I found explicitly describe themselves as **independent reimplementations** rather than author-released Google code.

One particularly interesting community implementation already supports Hermes, Claude Code, Codex and Copilot backends and implements the persistent wiki / validation rollback structure described in the paper. It should still be treated as third-party rather than canonical author code.

---

# Conclusion

WikiSkill's durable contribution can be reduced to one architectural principle:

```text
Agent history should not merely change behavior.

It should create an explicit,
persistent,
auditable body of knowledge
from which behavior can be repeatedly recompiled.
```

The architecture then becomes:

```text
experience
   ↓
knowledge
   ↓
procedure
   ↓
evaluation
   ↓
experience
```

with:

```text
knowledge persistence
+
procedural rollback
```

Those two semantics are deliberately different.

That is what makes the system more than another self-reflection loop.

It starts looking like a genuine **continual software-learning system for agents**.
