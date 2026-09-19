[Skip to main content](https://grok.com/c/8e616436-3ef7-4352-95cc-016add88af41?rid=cffbaa19-5dde-466c-96ba-c0b893d87e9c#grok-content-area)

[svg](https://grok.com/)

- ⌘J
-
- [svg](https://grok.com/library)
-

svg

svg

-
-
-
-
-
-

svg

-
-
-
-
-
-
-
-
-
-
-
-

svg

svg

- svg

*

So I've seen folks hand gpt luna the entire context and have it orchestrate astra implementers to save on tokens how does this compare over astra and Luna workers

**svg**

svg

svg

Thought for 58s

The pattern you saw is the one that actually makes sense. The “Astra bosses, Luna codes” setup that most Codex people installed first is often the expensive, slower, worse one. Here’s the unvarnished comparison.[**⁠X**](https://x.com/anshuc/article/2098811738674147520)

## The two setups

**Astra root + Luna workers** (the community default: save-my-astra, donvito Pro profile, “Genius Boss / Idiot Worker”):

- Astra stays in the main thread the whole time: plan, spawn, poll, review, stitch.
- Luna (usually max or xhigh) does explore / implement / test in subagents.
- Looks rational on a napkin: keep the $10/$50 model off grunt work.

**Luna root + Astra implementers** (what you’ve seen people do: “Idiot Boss / Genius Worker”):

- Luna gets the whole repo/context and stays cheap in the loop.
- Astra gets spawned as the implementer in one continuous thread, with short handoffs: goal + screenshot/diff + “fix what you see, recap, stop.”
- Luna does glue, browser checks, screenshots, status. Astra does the actual thinking-in-code.

There’s a third cheap-mode variant (donvito Plus profile): Luna max root + Luna medium workers + one Astra-low reviewer. That’s Luna all the way down with a single expensive glance at the end. Fine for mechanical work. Don’t use it when architecture or taste matter.[**⁠GitHub**](https://github.com/donvito/codex-astra-luna-orchestrator)

## Why the “smart” setup burns you

Astra as orchestrator is a quota incinerator for reasons that have nothing to do with how smart it is.

**The root never leaves.** In a measured donvito-style run (cross-component bug, \~16 files), Astra-low root ate \~50% of session tokens while emitting 6.9k output tokens. It sat there rereading context, writing worker prompts, and reviewing. Real work was \~340k uncached input + 26k output; the 9.3M “total” was almost all cache theater. That one task ate two-thirds of a fresh Plus 5-hour window.[**⁠GitHub**](https://github.com/donvito/codex-astra-luna-orchestrator/blob/main/guides/token-usage.md)

**Polling is the silent killer.** Someone instrumented an Astra-orchestrating-Luna session and found Astra waking every 30 seconds to ask “are the workers done yet?” Forty-seven of forty-seven checks returned nothing. Those empty polls burned 7.13M parent input tokens — 68% of Astra’s parent-side input. Five-hour usage went 53% → 100% in 33 minutes. Same account, a Luna-max session chewing 9.54M input over 127 minutes only moved the 5h window +8 points. The expensive model was spending most of its life staring at a closed door.[**⁠Reddit**](https://www.reddit.com/r/codex/comments/1wa9c9d/i_investigated_why_gpt6_astra_burns_quota_so_fast/)

**Delegation is lossy and then you pay to mop it.** Anshu ran the same product prompts three ways. Astra-orchestrating-Luna was *more expensive than Astra solo*, 5× slower on the web app, and visibly worse. Astra had to compress taste into a spec, Luna wrote blockier/simpler code, then Astra spent more tokens reviewing and patching. You pay the big model twice: once to explain, once to clean up.

That’s the “easier said than done” tax. A strong model dumping a tasteful 3D room planner spec onto Luna is like a great designer writing a 2,000-word brief for a junior who will still ship a Bootstrap template. You didn’t save money. You bought a worse product and a cleanup invoice.

## Why Luna-orchestrating-Astra can actually save tokens

Price gap is brutal:

| **ModelInput / 1MCached / 1MOutput / 1M** |         |         |         |
| ----------------------------------------- | ------- | ------- | ------- |
| GPT-6 Astra                               | \~$10   | \~$1    | \~$50   |
| GPT-5.6 Luna                              | \~$0.20 | \~$0.02 | \~$1.20 |

**svg**

That’s \~50× on input and \~42× on output. Every token the root spends sitting in the loop, polling, restating context, and writing novels to workers is the token you should be most allergic to. Put the cheap model in that chair. Put the expensive model on the tokens that change the codebase.[**⁠Indmoney**](https://www.indmoney.com/blog/us-stocks/gpt-6-astra-explained-agi-nvidia-openai)

Anshu’s inversion on the same 3D-studio / robot-arm prompts: quality close to Astra solo, **>50% cheaper, \~30% faster**. Luna’s prompts to Astra were deliberately dumb: product brief + screenshot, no technical opinions. Astra implemented in one continuous thread (prefix cache stays hot), stopped when told, recapped briefly. Luna did the browser QA loop. Three rounds max.

The implementer-side data agrees that Astra should be the one writing code when quality matters. A r/codex wireframing A/B:

- **Astra low implementer:** 8m16s, zero repairs, 79.9k reported tokens, cleaner design.
- **Luna max implementer:** 36m18s + 19m42s of repair, two repair cycles, 191.8k tokens, messier UI copy and structure.

Slightly higher weekly burn on Astra (2% vs 1%) and similar 5h-window hit (29% vs 27%), because most of the burn was *loading context*, not generation. Time and quality were not close. Terminal-Bench 4.0 is the same story at scale: Astra-low 42% vs Luna-max 12%. Luna is not a “slightly worse Astra.” It’s a different animal.[**⁠Reddit**](https://www.reddit.com/r/codex/comments/1w8hmcz/astra_low_vs_luna_max_implementer_experiment_part/)

So the inverted pattern is not “use the dumb model for everything.” It’s “don’t spend Astra tokens on babysitting.”

## Head-to-head

**Cost / quota**

- Astra+Luna-workers: often *worse* than Astra solo once you count parent context growth, worker-prompt writing, review, and the 30-second poll loop. Root is the largest line item in every measured orchestrated session.
- Luna+Astra-implementers: can cut cost in half vs Astra solo *if* you keep Astra’s thread continuous, handoffs tiny, and Luna mute on technical opinions.
- Plus 5h window is the real constraint, not API sticker price. Luna can chew millions of tokens and barely move the needle; Astra can idle-poll you into a reset.

**Quality**

- Astra writing the code wins. Not close on anything with taste, architecture, or non-obvious bugs.
- Luna writing the code loses twice: worse first pass, then you burn Astra (or more Luna) repairing it. Rework eats the “savings.”
- Luna as boss is fine at “is the button there, here’s a screenshot, go again.” It is not fine at “here’s how auth should work across these four services.”

**Speed**

- Anshu: inverted was \~30% faster than Astra solo on those product tasks.
- Reddit: Astra implementer 8 minutes vs Luna implementer 36+19.
- Astra-orchestrating-Luna can be *slower* than just letting Astra cook, because of spawn/wait/review/cleanup.

**Failure modes unique to each**

Luna-boss / Astra-worker fails when:

- The task is a multi-service system with late-binding architecture decisions. Luna will either under-specify or invent a bad plan and Astra will faithfully implement the bad plan.
- You let Luna write technical opinions into the handoff. Then you paid Astra to execute a junior’s design.
- You fragment Astra into many short workers instead of one cached thread. You throw away prefix cache and make Astra rediscover the repo every spawn.
- Backend/security/schema work where the expensive model keeps getting pulled back in anyway. One commenter saw 72% savings on a landing page with per-request routing, only 26% on a backend API. Visual/product is the inversion’s home turf.

Astra-boss / Luna-worker fails when:

- The parent busy-polls (default Codex behavior unless you jack wait timeouts into the minutes).
- The work isn’t actually mechanical. Luna max over-engineers, takes forever, and still needs repairs.
- You spawn overlapping writers. File fights + Astra reconciliation = more expensive than solo.
- You orchestrate one-file edits. Delegation overhead dominates. Don’t.

## How to actually run the inverted pattern without it turning into slop

This is the part most people skip, then declare the idea “doesn’t work.”

1. **Luna is glue, not an architect.** Its job: next item off the list, hand to Astra, screenshot, “pass/fail,” recap. If you catch it prescribing solutions, you’re doing it wrong.
2. **One continuous Astra implementer thread**, not a spray of Astra subagents. Cache is the whole economic trick. Anshu’s prompt is the right shape: product brief + latest screenshot, no technical opinions, stop after implementation, brief recap, cap the rounds.
3. **Give Luna the full context on purpose.** That’s the point. The cheap model can afford to hold the repo map, the screenshots, the failing tests. Astra should receive a *narrow* packet, not a second copy of the universe.
4. **Don’t invert on ambitious multi-step systems.** Anshu says this himself. If the plan is the hard part, Astra (or Sol) writes the plan. Then you can still use Astra or Sol as implementer for the gnarly slices and Luna for the mechanical ones. Mixing “Luna decides the architecture” with “Astra types the code” is how you get a beautifully implemented disaster.
5. **If you stay on the standard Astra-root setup**, at least kill the 30-second poll. min\_wait\_timeout\_ms / default\_wait\_timeout\_ms in the multi-agent config, set to minutes, not seconds. And stop Astra from doing work while workers run. Otherwise you’re lighting the 5h window on “any update? any update? any update?”
6. **Measure your own window, not vibes.** Codex writes rollout logs. Uncached input + 5h/7d used\_percent are the numbers that matter. Total tokens is a vanity metric when cache hit rate is 96%.

## Practical routing, not ideology

| **SituationUse**                                              |                                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Ambiguous system, architecture, unknown bug, expensive rework | Astra solo. Delegation tax > savings.                                            |
| Product/UI/visual, bounded feature, you care about taste      | Luna root + Astra implementer, tiny handoffs, screenshots as ground truth.       |
| Clear plan, disjoint files, mechanical edits, tests, docs     | Astra or Sol writes the plan once; Luna workers execute. Or skip Astra entirely. |
| Plus quota, long session, lots of waiting/QA                  | Luna in the chair. Always. The root is the line item.                            |
| Hard implementation, well-specified                           | Astra low / Sol as implementer. Luna max is slower and dumber here.              |
| One-file fix                                                  | No orchestration. Just hit it.                                                   |

**svg**

The industry default (“smart model manages, cheap model labors”) is cargo-culted from human orgs where the senior’s *time* is the scarce resource. Here the scarce resource is **expensive tokens spent sitting in a loop**. A junior manager with a senior IC is a weird org chart and a correct token chart.

If you want the short version: handing Luna the whole context and letting it dispatch Astra implementers beats Astra+Luna-workers on quota and often on wall time, *as long as* Luna doesn’t get to have ideas and Astra gets a long cached thread. The moment the problem is “what should we even build / how does this system fit together,” put Astra back in charge of the plan — or skip the circus and let Astra do the job itself.

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

335 sources

**svg**

In terms of reviews? How does parallel subagents with different disciplines smart boss / dumb boss convos?

I'm talking compound engineerings code review or omc code review or ralplan

**svg**

svg

svg

Thought for 34s

These three things are not competing “review buttons.” They sit on different layers, and the smart-boss / dumb-boss split does **not** transfer cleanly from implementation.

- **CE code review** = parallel specialist *diff* review.
- **OMC/OMX code review** = two independent *diff* lanes, then a merge rule.
- **Ralplan** = sequential *plan* review. It does not look at your diff.

If you treat ralplan like a code review, you paid for a planning tribunal and got zero line-level findings.[**⁠Crossaitools**](https://crossaitools.com/skills/everyinc/compound-engineering-plugin/ce-code-review)

## What each one actually does

### Compound Engineering /ce-code-review

This is the one built for “parallel subagents with different disciplines.”

Parent reads the diff, picks personas from a catalog, fans them out read-only, each returns structured JSON (P0–P3, file\:line, confidence, autofix class). Parent merges, dedups, routes. Reviewers do not edit. They do not share a conversation. That’s the whole trick: separate context, separate obsession.[**⁠Awesomeskill**](https://awesomeskill.ai/skill/everyinc-compound-engineering-plugin-ce-code-review)

Current shape (they already cut the old 12–17 overlapping circus down):

**Always-on**

- correctness (every multi-agent review)
- project-standards (only if CODING\_STANDARDS.md / criteria files exist, or discovery is uncertain — fail closed)

**Spawn only if the diff actually touches that surface**

- testing, maintainability, agent-native, learnings
- security, performance, api-contract, data-migration, reliability, adversarial
- stack-specific: frontend races, Swift/iOS
- deployment-verification when migrations look destructive

A docs tweak might spawn 1–2 reviewers. An auth + migration PR can spawn 8. They stopped the “review like Fowler” cosplay and just name the principles. Trevin’s point: fewer personas, less duplicate token burn, less “three agents said the same nit.”[**⁠@trevin**](https://x.com/trevin/status/2094285091589812379?referrer=grok-com)

Parent is a **meeting chair**, not a second author. Specialists do the seeing. Parent does selection + merge.

### OMC / OMX $code-review

Same family, thinner fan-out.

**OMX (Codex):** spawn code-reviewer and architect **in parallel**, clean context, same scope. No model override — they inherit whatever the parent session is. Then a hard merge rule:[**⁠GitHub**](https://github.com/Yeachan-Heo/oh-my-codex/blob/main/skills/code-review/SKILL.md)

- architect BLOCK → REQUEST CHANGES
- reviewer REQUEST CHANGES → REQUEST CHANGES
- architect WATCH → COMMENT
- APPROVE only if reviewer says APPROVE **and** architect is CLEAR **and** both returned evidence
- if either lane dies: review is **unavailable**. No self-review fallback. Fail closed.

They already merged style/quality/API/perf reviewers into one code-reviewer. Security is folded in, not a separate spawn. So you get two disciplines, not twelve.[**⁠Raw.githubusercontent**](https://raw.githubusercontent.com/Yeachan-Heo/oh-my-codex/HEAD/docs/agents.html)

**OMC (Claude-hosted, older /review):** critic + plan-reviewer(s) in parallel, then a review-agent synthesizes. Autopilot Phase 4 is the fatter version: architect + security-reviewer + code-reviewer all must approve. Same idea, more Claude-shaped.[**⁠Agentskills**](https://agentskills.so/skills/yeachan-heo-oh-my-claudecode-review)

OMC/OMX is a **two-lane court**. CE is a **specialist panel**. Different cost, different recall.

### Ralplan

Not a code review. It’s the consensus-planning gate before $ultragoal.

1. Planner writes a plan + RALPLAN-DR (principles, drivers, ≥2 options).
2. Architect reviews that **fixed snapshot**. Steelman antithesis, real tradeoff, no mutating the plan.
3. Critic reviews the **same snapshot**, independently. Does **not** see the Architect writeup.
4. Planner synthesizes both. Critic verdict: APPROVE / ITERATE / REJECT. Max 5 loops.

Architect and Critic are **forbidden to run in parallel**. That’s load-bearing. Parallel here would leak context and you get two agents nodding at each other. They want two uncontaminated shots at the same plan. --architect codex / --critic codex exist specifically to put a different model family on those seats.[**⁠GitHub**](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/main/skills/ralplan/SKILL.md)

Ralplan is where you spend judgment tokens **before** anyone writes code. Using it as a post-diff review is using a blueprint inspector as a building inspector.

## Parallel disciplines vs “just another agent”

A useful review subagent has three properties:

1. **Fresh context.** Never the thread that wrote the code. Same-context self-review is masturbation with extra steps.
2. **One job.** Security does not also nitpick naming. That’s how you get 40 LOW comments and miss the authz hole.
3. **Structured return.** JSON with severity + file\:line + fix. Prose novels cannot be merged.

CE is designed around all three. OMX gets 1 and 3, with only two jobs. Ralplan gets 1 and a brutal 3, but the artifact is a plan, and the reviews are sequential on purpose.

If your “parallel review” is three Lunas all prompted “review this PR,” you did not get disciplines. You got three correlated vibes.

## Smart boss / dumb boss, applied to review

Implementation and review want **opposite** token placements.

| **LayerWhat the expensive model should doWhat the cheap model should do** |                                                      |                                                 |
| ------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| Implementation                                                            | Write the code (genius worker)                       | Chair, screenshot, dispatch                     |
| Diff review                                                               | Sit in the specialist seats                          | Select personas, merge JSON, apply P2 autofixes |
| Plan review (ralplan)                                                     | Architect + Critic, possibly Planner on hard systems | Maybe the loop runner, never the Critic         |

**svg**

### Dumb boss + smart parallel reviewers — this is the one that works for diffs

Luna (or Terra) holds the repo, picks the CE personas / OMX lanes from the actual diff, spawns Astra/Sol/Opus as **read-only specialists**, merges the JSON, prints the P0/P1 list.

Why it works:

- Reviewers are the quality. You want Astra-low or Sol looking at security and correctness, not Luna max free-associating OWASP.
- Parent tokens are the expensive ones in a long session (same lesson as last time). A Luna chair can afford to hold the full diff + eight JSON reports.
- Specialists get a **narrow packet**: diff, file list, standards file, “only report X.” Not the implementation chat history.
- Independence is free. They never saw how the code was born.

This is CE’s actual architecture with the Anshu inversion applied to the **chair**, not the reviewers.

### Smart boss + dumb parallel reviewers — the trap people keep installing

Astra sits in the parent, spawns Luna-max “security / testing / architecture” workers.

This is Genius Boss / Idiot Worker again, and it fails the same way:

- Luna security reviewer is a keyword scanner with confidence. It will miss the ownership check and invent three style nits.
- Astra then re-reads the diff to see if Luna was full of shit. You paid the expensive model twice.
- Parent still polls. Review workers are short, so the 30-second “any update?” tax is a larger fraction of the job.
- You get a long, impressive-looking report that a human still cannot trust.

Donvito’s own topology already admits this: even on the Plus profile where Luna is the root **and** the workers, the **reviewer stays Astra-low**. They will cheap out on implementation before they cheap out on the independent glance. That’s the tell.[**⁠GitHub**](https://github.com/donvito/codex-astra-luna-orchestrator/blob/main/guides/plus-plan.md)

### Smart boss + smart reviewers — quality ceiling, quota funeral

Astra parent + Astra/Sol specialists. Best signal. Fine on Pro when the change is auth, payments, migrations, public API. Stupid on a CSS tweak. CE will still spawn 6+ agents if you let the catalog run hot; each one rereads the diff. This is where people melt a 5h window on a review that should have been one Astra-low pass.

### Dumb boss + dumb reviewers — skip it

Luna reviewing Luna code with Luna specialists is a committee of interns. Cheap. Useless for anything that can page you at 3am.

## How the three systems sit on that grid

**CE** is already “panel of specialists, chair merges.” The only decision left is model per seat.

Good CE routing:

- Chair: Luna max or Terra. Selection + dedup is mechanical if the JSON schema is tight.
- correctness / security / adversarial: Astra-low or Sol. These are the seats that catch real bugs.
- testing / maintainability / project-standards: Luna or Terra is enough.
- stack-specific (races, Swift): match the domain; don’t put Luna on concurrent UI.
- Cap the fan-out. CE already does this with spawn gates. Do not “run all personas.” That’s how you buy 8 copies of the same P3.

CE’s adversarial persona can also fire a **cross-model** pass through a peer CLI. That’s the one place “different model family” actually matters: correlated blind spots. Astra reviewing Astra-written code will forgive Astra-shaped mistakes. Claude or Gemini on that seat is worth the token.[**⁠Crossaitools**](https://crossaitools.com/skills/everyinc/compound-engineering-plugin/ce-code-review)

**OMC/OMX code-review** is stricter and cheaper.

Two lanes, fail closed, inherit parent model. That’s a problem if your parent is Luna: both reviewer and architect become Luna, and the merge rule will APPROVE slop with a straight face.

So for OMX: **don’t inherit blindly**. Put Astra-low / Sol on both lanes, or at least on architect. Let Luna chair and apply the merge table. If you leave OMX’s “no model override” as gospel while running a Luna parent, you gutted the review.

OMC’s older /review with a synthesizer agent is the same pattern: parallel specialists, then one brain to reconcile. That synthesizer should not be dumber than the specialists or it will drop P0s that two agents phrased differently.

**Ralplan** should stay sequential, and the expensive model belongs in Architect and Critic.

- Planner can be Sol/Terra if the task is bounded. Astra if the system is ambiguous.
- Architect: smart. This seat exists to produce a steelman against the plan.
- Critic: smart, **different** from Architect if you can swing it (--critic codex while Planner/Architect stay Claude, or the reverse). Same-model Critic is a slightly delayed echo.
- Do not parallelize Architect and Critic. The skill is explicit. Independence dies if they share a turn.
- Do not let Luna be Critic. A cheap model told to be ruthless becomes a vibe-checker. Ralplan’s whole value is “this plan is allowed to die.”

Ralplan then hands a durable plan to $ultragoal. **That** is when you bring CE or OMX review in — after code exists.

The sane pipeline is:

**svg**

```
ralplan (smart Architect + smart Critic, sequential)
    → implement (Luna chair / Astra implementer, from last message)
    → ce-code-review or omx $code-review (Luna chair / smart specialists, parallel)
    → human only on P0/P1 or architect BLOCK
```

Three different conversations. Do not smash them into one “review agent.”

## What actually breaks

**Same-thread review.** If the implementer “reviews its own diff,” every system above is theater. OMX literally refuses to treat that as merge-ready. Listen to it.

**Too many disciplines on a tiny diff.** CE will over-spawn if you ignore gates. Maintainability + testing + correctness on a 12-line bugfix is three models restating “looks fine.” Token waste, noise, you start ignoring P2s.

**Chair that has opinions.** Same Anshu failure mode. If Luna-as-chair rewrites the security finding into “probably fine,” you paid Astra to find it and Luna to bury it. Chair merges. Chair does not editorialize.

**Parallelizing ralplan.** You save two minutes and lose the only property that makes Critic useful.

**Reviewers that can write.** CE personas are read-only on purpose. The second a “reviewer” starts “fixing,” it becomes a second implementer with a license to wander. Apply-safe P2s is a *later* stage, with a separate worker and tests.

**Polling.** Review workers are short-lived. Astra-as-chair polling them every 30s is even dumber here than during implementation. Long wait timeouts or evented completion. Otherwise the review costs more than the feature.

## Practical routing

| **ChangeReview setup**                        |                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Docs / copy / one-file obvious fix            | No panel. One Astra-low or even skip.                                                                                         |
| Normal feature, well-specified                | OMX two-lane (reviewer + architect) on Astra-low/Sol, Luna chair.                                                             |
| Auth, payments, migrations, public API        | CE with conditionals on: correctness + security + adversarial + the surface that actually moved. Smart models in those seats. |
| “Did we build the right thing?” before coding | Ralplan. Not CE. Not OMX review.                                                                                              |
| Plus quota, long day                          | Luna chair everywhere. Spend Astra on correctness/security/adversarial and on ralplan Critic. Nothing else.                   |
| You just used Astra to implement              | Different model on adversarial / architect. Same-family review is how elegant bugs survive.                                   |

**svg**

Reviews do not save tokens by making the reviewers cheap. They save tokens by making the **chair** cheap, keeping specialists **narrow and independent**, and not running a planning tribunal on a diff or a diff panel on a plan.

CE is the discipline panel. OMX is the two-lane court that fails closed. Ralplan is the pre-game argument. Smart models belong in the seats that can kill the change. Dumb models belong in the seat that schedules those people and staples their notes together.

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=x.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=reddit.com\&sz=256)

254 sources

**svg**

What about subsequent review loops after the first big thorough review

**svg**

svg

svg

Thought for 9s

The first review is discovery. Everything after that is supposed to be a **delta audit against a known list**, not “run the whole panel again and hope.” Most people blow the second loop by treating it like the first.[**⁠X**](https://x.com/trevin/status/2047066108763770998)

## What changes after pass 1

Pass 1 answers: *what is wrong with this change?*

Pass 2+ answers three smaller questions:

1. Are the accepted findings actually gone?
2. Did the fix introduce new damage **in the touched lines**?
3. Are we looping on the same argument?

If your second review is still “spawn security + correctness + maintainability + testing + adversarial on the full PR,” you are paying discovery prices for a verification job. That’s how Plus windows die on a 40-line follow-up.

Keep the pass-1 artifact. That JSON / finding table **is** the spec for every later loop. No artifact, no cheap loop — you’re back to a first review.

## How the three systems already do this

### Compound Engineering

They split the job on purpose. /ce-code-review is pre-PR discovery. After comments exist, you do **not** re-run the persona circus as the main engine.[**⁠GitHub**](https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/ce-resolve-pr-feedback.md)

- **/ce-resolve-pr-feedback**: one-shot closer. Fetch unresolved threads, judge them in one place, dispatch fixers only for items the chair already accepted, commit, reply, resolve. **At most two fix-verify cycles.** After that, leftover pain becomes a needs-human recurring pattern, not ticket #47.
- **/ce-babysit-pr**: the watch loop. It does not review. It wakes on new comments / CI / base movement and calls resolve or debug. Quiet time is supposed to cost zero tokens.
- Clustering: after two cycles, thematically similar comments on the same code area get collapsed into “this is a pattern, stop whack-a-mole.”
- Actionability filter: a 👍 is not a finding. Don’t spawn a worker for it.

That’s the right shape. Chair judges. Fixer mutates. Re-verify is narrow. Human gets the thing that refused to die.

v3 also stopped bucket-level rubber-stamping (“apply all P2s”). Subsequent loops decide **per finding**. That’s slower socially and cheaper in tokens, because you don’t re-litigate a premise twelve times.

### OMC / OMX

Two different loops, don’t mix them up.

**Diff re-review:** $code-review again, but the merge rule is the same fail-closed two-lane court. Autopilot’s current contract is ralplan → ralph → code-review, and a dirty review does **not** just “fix and look again.” It can bounce **back to ralplan** with return\_to\_ralplan\_reason. That’s the adult version: if review keeps failing, the plan was wrong, not the last patch.[**⁠GitHub**](https://github.com/Yeachan-Heo/oh-my-codex/pull/2001)

**$ultraqa:** up to 5 adversarial e2e cycles. Stop if the same failure hits 3 times. This is behavior verification, not persona review. Use it when the question is “does it still break under hostile input,” not “is this diff pretty.”

Community Codex review-fix loops (resume the same reviewer session, max 3–5) are the cheap version of pass 2: same reviewer, same thread, “here’s the new diff against your last findings.” Session resume keeps prefix cache hot. New reviewer spawn on the whole PR is the expensive version.[**⁠GitHub**](https://github.com/eishan05/codex-review-loop)

### Ralplan

Pass 2+ is still sequential Architect → Critic, max 5, full closed loop on any non-APPROVE. Cheap-out failure mode: skip Architect and only re-hit Critic. The skill forbids that because Critic then reviews a plan Architect never saw.[**⁠GitHub**](https://github.com/Yeachan-Heo/oh-my-codex/blob/main/skills/ralplan/SKILL.md)

The smarter variants (gajae-code / newer ralplan forks) add a **ratchet on pass 2+**:

- delta-only review
- novelty justification (you don’t get to invent a new objection without saying why it wasn’t available on pass 1)
- verdict monotonicity (CLEAR shouldn’t flip to BLOCK without new evidence)
- severity scoping
- Critic counter-reviews Architect scope inflation

That’s the rule you want everywhere, not just in planning. A later review that is *broader* than the first one is usually the reviewer getting bored and finding hobbies.

## The loop that doesn’t suck

**svg**

```
Pass 1  full panel / two-lane court
        → finding list with ids, severity, file:line, accepted/deferred/wontfix

Fix     one worker, accepted items only, smallest diff
        → tests for those items

Pass 2  delta review against THAT list + the new hunks
        → each finding: gone / still there / fixed-but-regressed
        → NEW findings allowed only on changed lines, and only P0/P1

Pass 3  only if P0/P1 remain or the delta grew
        → same delta protocol
        → if the same finding is still alive: escalate, don't loop
```

Hard stops, not vibes:

| **StopWhy**                                     |                                         |
| ----------------------------------------------- | --------------------------------------- |
| 2 fix-verify cycles for comment resolution (CE) | Third cycle is arguing with a ghost     |
| 3–5 for automated review-fix                    | After that you’re polishing             |
| Same failure 3× (UltraQA)                       | Wrong approach, not missing a semicolon |
| Finding still open after two honest fixes       | needs-human or bounce to ralplan        |
| New findings on untouched files in pass 2       | Reviewer shopping. Kill it              |

**svg**

If pass 2 surfaces a *new class* of issue (authz, data loss, API break) that pass 1 should have caught, that’s a panel miss. One targeted specialist on that class. Not “rerun CE.” Then write it into CODING\_STANDARDS.md / docs/solutions/ so pass 1 next month isn’t blind the same way. That’s the actual “compound” step. Everything else is just another review.

## Smart boss / dumb boss on loop 2+

This is where the inversion gets sharper.

**Chair stays cheap.** Luna/Terra. The job is now clerical: map finding IDs → current code, spawn the right fixer, request a delta re-review, update the table. An Astra chair rereading the whole PR to “see if we’re good” is the polling tax in a new outfit.

**Fixer is sized to the finding, not the original feature.**

| **FindingFixer**                              |                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| gated\_auto / mechanical                      | Luna. One file, one test.                                                   |
| Real bug, local                               | Luna max or Terra                                                           |
| The fix changes a contract, auth, or the plan | Astra/Sol, and maybe you just left the review loop and went back to ralplan |

**svg**

Do **not** put Astra on “remove unused import, then we’ll think about the auth hole.” That’s how subsequent loops cost more than the feature.

**Re-reviewer should be the same specialist, not a new panel.**

- Security finding still open → security persona only, on the hunk, with the old finding text in the prompt.
- OMX: resume the architect/reviewer threads if you can. Fresh spawn loses “I already said X, did you actually fix X.”
- Cross-model adversarial is a **pass-1 or merge-gate** move. Running Claude vs Astra every loop is expensive correlation insurance you don’t need on a 12-line patch.

**Dumb reviewers on later loops are fine for “is this line gone.”** They are not fine for “is the new approach sound.” If the fix redesigned the thing, that’s not a subsequent review. That’s a new first review on a new diff. Call it that and pay for it.

## What each stack should look like after the first pass

**CE after pass 1**

1. Keep the merged report. Those IDs are now tickets.
2. Apply safe\_auto / accepted gated\_auto with one fixer.
3. Re-review **only residual P0/P1 + the new diff**. Correctness is enough unless the hunk hit auth/migrations.
4. Human comments on the PR → ce-resolve-pr-feedback, not ce-code-review.
5. Two cycles. Then cluster and escalate.
6. ce-babysit-pr if you want the watch; don’t sit Astra in a 30-second poll on CI.

**OMC/OMX after pass 1**

1. Dirty $code-review → if the findings are local, ralph/fixer + resume reviewer.
2. If the findings say the *shape* is wrong, return\_to\_ralplan\_reason and pay for Architect/Critic again. Patching a bad plan in a review loop is how you get a beautiful implementation of the wrong system.
3. $ultraqa after the diff is clean, not instead of it. QA cycles that mutate code behind the reviewer’s back create a fourth, unofficial loop.

**Ralplan after pass 1**

1. Full Architect → Critic again, sequential, on the **revised plan snapshot**.
2. Pass 2+ should be delta + ratchet if your build supports it. If not, enforce it in the prompt: “only object to what changed or what the last verdict left open.”
3. Five caps. Then show the user the stuck plan. Do not “just execute the best we have” on auth/migrations.

## The failure modes that eat subsequent loops

**Finding churn.** Pass 2 invents new P3s on files nobody touched. Your chair must reject those by policy, not “the specialist is thorough.” Thoroughness already happened.

**Fixer drift.** Worker “while I’m here” refactors a neighbor. Now the delta is huge and you’ve reset to pass 1. Exclusive file ownership still applies.

**Unverified apply.** Reviewer said “add a null check,” fixer added it, nobody ran the test that would prove the path. Next review says “still looks open” because the evidence is a vibes diff. Every subsequent loop needs a *check*, not a *claim*.

**Same-thread self-review after the fix.** The implementer marking its own findings resolved is how P0s become “addressed” in the table and still live in prod. Re-review stays a different lane, even when the model is cheaper.

**Infinite Ralph.** “Until clean” without a cap is a token incinerator. Clean is defined as: accepted P0/P1 gone, no new P0/P1 on the delta, tests for those paths green. P2/P3 leftovers are a list, not a reason to loop.

**Chair with opinions, again.** Luna-as-chair deciding “this P0 is probably fine now” is how you skip the specialist. Chair updates status from **evidence the reviewer returned**, not from hope.

## Practical routing for loop 2+

| **SituationDo this**               |                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Pass 1 clean                       | Stop. Do not “one more review to be sure.”                                             |
| Only mechanical leftovers          | Luna fixer, Luna or Terra delta check, done                                            |
| P0/P1 still open, same files       | Same specialist, delta packet, Astra/Sol if it was a smart seat on pass 1              |
| Fix changed architecture           | Dead review loop. Back to ralplan.                                                     |
| Human / bot comments on the PR     | resolve-pr-feedback, two cycles, then human                                            |
| CI red after a review fix          | debug that failure. Don’t re-review the original feature.                              |
| Third time around the same finding | Escalate. The loop has no new information.                                             |
| Plus quota, long PR                | Luna chair + babysit. Spend Astra only when a new P0 appears or the plan itself broke. |

**svg**

First review is where you buy coverage. Subsequent reviews are where you buy *closure*. If loop 2 costs like loop 1, you didn’t keep the finding list, you didn’t bound the delta, and you put the expensive model back in the chair. That’s not thoroughness. That’s amnesia with a bigger invoice.

[image](https://www.google.com/s2/favicons?domain=raw.githubusercontent.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=x.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=raw.githubusercontent.com\&sz=256)

136 sources

**svg**

What about CE doc review?

**svg**

svg

svg

Thought for 21s

/ce-doc-review is the sibling of /ce-code-review, not a markdown-flavored copy of it. Same chassis (parallel personas, merge, confidence gates). Different object, different danger, different cheap/expensive split.[**⁠GitHub**](https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/skills/ce-doc-review.md)

Code review asks: *does this diff do what we already decided?*

Doc review asks: *is the decision even coherent, feasible, and the one we meant?*

If you run code-review personas on a plan you get style nits about headings. If you run doc-review after the code exists you are holding a blueprint inspection on a finished building. Wrong artifact.

## What it actually reviews

Two document shapes, classified from **content**, not path:[**⁠Awesomeskill**](https://awesomeskill.ai/skill/everyinc-compound-engineering-plugin-ce-doc-review)

| **ShapeSignalsQuestion** |                                                                                      |                                                           |
| ------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **Requirements**         | actors, flows, acceptance examples, R1/A1/AE1, what/why/success                      | Are we building the right thing?                          |
| **Plan**                 | implementation units, Goal/Files/Approach/Test scenarios, U1, file paths, sequencing | Can an executor carry this out without inventing product? |

**svg**

Ambiguous → requirements. That’s conservative on purpose. A plan that is secretly still arguing about *what* to build should get premise review, not a fake “ready to implement” stamp.

Unified-plan artifacts get sliced. Reviewers do not each eat the whole novel. Product Contract vs Implementation Units vs Verification are different jobs.

It is **findings, not a verdict.** /ce-pov is the essay (“here’s the bottom line”). Doc-review is the issue list that can edit the file. /ce-noslop is prose. Do not mash those three together.[**⁠Every**](https://every.to/compound-engineering/guides/ce-noslop)

## The panel

Always on:

- **coherence** — the doc disagrees with itself. Scope says X is out, requirements sneak it back in. Header says “6 requirements,” body has 5. Broken section refs. This is the mechanical janitor.
- **feasibility** — can this survive contact with the repo? On a *plan*, this goes deep (files, sequencing, test scenarios that can’t exist). On *requirements*, it stays tight: “would this direction force a fundamental rework?” It is not allowed to start designing.

Conditional, from what the doc actually claims:

- **product-lens** — challengeable “what/why/first” claims, strategic weight
- **design-lens** — flows, screens, UX language
- **security-lens** — auth, public APIs, sensitive data, payments, trust boundaries
- **scope-guardian** — priority tiers, giant requirement piles, boundary language that looks drunk
- **adversarial** — high-stakes domains, new abstractions, missing origin, explicit alternatives, requirements-shaped premises

Load-bearing rule: on a **plan** that already has a validated Product Contract upstream, product / adversarial / scope **suppress premise techniques** and only check implementation. The product argument already happened. Re-opening “should we even build this?” on every plan review is how you never ship and how you burn Astra on philosophy. On a requirements doc they run the full kit.[**⁠GitHub**](https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/skills/ce-doc-review.md)

That’s the same “don’t re-discover on loop 2” idea, encoded in the persona itself.

Official-ish seat pricing inside the skill, which maps cleanly onto Luna/Astra:

| **SeatTier they want**                                |                  |
| ----------------------------------------------------- | ---------------- |
| coherence                                             | cheapest capable |
| design-lens, scope-guardian                           | mid              |
| feasibility, product-lens, security-lens, adversarial | parent or high   |

**svg**

So: Luna on coherence. Terra on design/scope. Astra/Sol on feasibility + the three judgment lenses. Do not put Luna on adversarial-for-auth. Do not put Astra on “header said 6, list has 5.”

Cross-model is narrower than people think. Dedicated twins only for **adversarial / product-lens / security-lens**, plus one whole-doc sweep from a peer CLI (Codex/Claude/Grok/etc.). Needs an actual peer agent, not an API key. Peers are read-only. One retry on overload, then drop. This is the “different family so Astra doesn’t forgive Astra-shaped plans” move. Use it on requirements for auth/payments/public API. Skip it on a 2-page internal refactor plan.[**⁠GitHub**](https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/ce-doc-review.md)

## Routing is the whole product

Personas dump findings. Synthesis does the adult work:

1. Drop anchors 0 and 25 (false positive / unverified vibe).
2. 50 → FYI. Real but not worth a decision.
3. 75/100 → actionable, then split by fix class.
4. Cross-persona agreement can promote one anchor step. Agreement does **not** promote a nit into a crisis.

Then four buckets, not a 34-item questionnaire:[**⁠GitHub**](https://github.com/EveryInc/compound-engineering-plugin/pull/1373)

| **BucketWhat it isWho acts** |                                                                                                                                    |                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Applied**                  | Proven error that blocks a decision *already in the doc*. Header/body mismatch, dead refs, missing field the unit format requires. | Auto, annotated session-settled: |
| **Proposed fixes**           | Worthwhile, but not already authorized / not full confidence                                                                       | One grouped confirmation         |
| **Decisions**                | Real forks. “Which remedy?” never “shall we proceed?”                                                                              | Human, one question per fork     |
| **FYI**                      | Observed. No question.                                                                                                             | Nobody                           |

**svg**

They learned this the hard way. Early runs handed you 34 findings and asked about things whose answers were already decided. v3 + later PRs: ask only where a choice exists, batch the rest. A question that is actually a statement trains you to rubber-stamp.

Auto-apply here is **more aggressive than code review** in one specific way: it will change wording *and meaning* if that’s what it takes to make an already-written decision executable. “R3 says the API is public, security section says internal only” is not a style fix. The chair must not let Luna invent which side wins. That’s a Decision, not Applied. Coherence owns the mechanical class (safe\_auto at confidence 100 when the doc itself is the authority). Product forks never ride that rail.

If only a *peer model* found the issue, a local reviewer re-checks the source **without seeing the first model’s claims**. No independent support → it does not auto-apply. That’s the anti-hallucination gate for cross-model.

## Where it sits vs ralplan and code review

**svg**

```
ce-brainstorm  →  requirements doc  →  ce-doc-review (full premise kit)
ce-plan        →  plan doc          →  ce-doc-review (implementation kit, non-interactive)
ce-work        →  code              →  ce-code-review
```

ce-plan already chains doc-review in mode\:non-interactive after it writes the plan. You usually should not invoke it again as a ritual. Standalone is for “this plan has been sitting and I don’t trust it” or a doc that didn’t come from CE.[**⁠GitHub**](https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/ce-doc-review.md)

**vs ralplan:** same *layer* (plan quality), different *machine*.

- Ralplan is a sequential court: Planner writes, Architect steelmans, Critic kills or passes. Output is APPROVE/ITERATE/REJECT on the whole plan.
- Doc-review is a parallel findings engine. Output is an edited doc plus a decision list. No single verdict.

Use ralplan when you need the plan to be allowed to *die*. Use doc-review when the plan is allowed to live but is sloppy, contradictory, or missing test scenarios. Running both on the same artifact is reasonable once: ralplan for the argument, CE doc-review for the executable residue (IDs, scenarios, contradictions). Running both every loop is two planning religions taxing the same tokens.

**vs ce-code-review:** do not reuse the code catalog. Correctness-on-a-diff is not coherence-on-a-spec. Security-lens on a requirements doc is looking for missing threat surface in the *contract*. Security-reviewer on a diff is looking for the missing owns? check on line 42.

## Subsequent loops

They already built the primer we said you should keep by hand.

- Applied findings come back next round so the next pass **verifies the fix landed**, not rediscovers it.
- Rejected / deferred / acknowledged findings are suppressed by fingerprint + evidence-substring. Lose the evidence snippet and suppression degrades to title-matching, which both re-surfaces junk and over-suppresses real issues.
- session-settled: stays on the applied line. A later persona that wants to reopen it must argue **infeasibility**, not taste, and it is never auto-applied.
- If the doc, scope, and relevant source files did not change, you can return to the existing finding list **without** re-dispatching the panel. Fresh review only if the inputs moved or the evidence is gone.[**⁠GitHub**](https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/ce-doc-review.md)

Cross-session: a brand-new invoke does **not** carry the primer. If you kill the session, persist the finding table yourself or you buy another first review.

Loop protocol, same as code, tighter because docs mutate meaning:

**svg**

```
Pass 1  full panel for this shape
        → Applied / Proposed / Decisions / FYI
        → persist primer

Edit    only accepted items
        → do not "while I'm here" add a new product claim

Pass 2  do NOT re-fan-out
        → verify Applied landed
        → only reopen Decisions still open
        → new findings allowed only on changed sections
        → premise lenses stay suppressed on a validated plan

Pass 3  if a Decision keeps bouncing
        → stop. that's ralplan or a human, not another doc-review
```

Two cycles. Third cycle on the same contradiction means the doc is holding two products. A reviewer cannot merge those. You can.

## Smart boss / dumb boss on docs

This is closer to ralplan than to code review, because **the artifact is the decision**.

**Chair: cheap.** Luna can classify shape, pick personas, merge JSON, apply coherence safe\_auto, maintain the primer. That’s clerical.

**Do not let the cheap chair settle product forks.** The eval that bit them: open auto-apply to confidence 75 and the model applied a real product fork in six of seven runs. The model does not experience uncertainty as uncertainty. Luna-as-chair “just picking the obvious side” is how you silently change what you are building.[**⁠GitHub**](https://github.com/EveryInc/compound-engineering-plugin/pull/1373)

**Specialists:**

| **LensModel**                    |                                                   |
| -------------------------------- | ------------------------------------------------- |
| coherence                        | Luna. Mechanical.                                 |
| design / scope                   | Terra or Luna max                                 |
| feasibility on a plan            | Astra-low or Sol. This seat looks at the repo.    |
| product / security / adversarial | Astra/Sol, and cross-model if the domain is spicy |

**svg**

**Dumb specialists on a requirements doc is how you get a beautifully consistent plan for the wrong product.** Coherence will happily make both halves agree on the bad premise.

**Smart chair + dumb lenses** is the other trap: Astra rereads the whole plan, then spawns Luna “security-lens,” then rereads Luna’s essay to see if it was nonsense. Same Genius-Boss tax as code review, except the output is a spec that implementers will treat as gospel.

**Fixer on later loops:** Luna for Applied items (renumber, fix refs, add the missing Test scenario field). Astra only if the accepted finding was a feasibility/security hole that changes units. Exclusive section ownership. No “also rewrite the motivation.”

## What to actually run

| **SituationMove**                             |                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Fresh requirements from brainstorm            | Doc-review, full premise kit, smart product/adversarial. Human on Decisions.                                             |
| Plan just written by ce-plan                  | Already ran non-interactive. Read the unresolved list. Don’t ritual-rerun.                                               |
| Plan exists, repo moved, units look fictional | Feasibility + coherence only. Not product-lens.                                                                          |
| Auth/payments/public API requirements         | Add security-lens + adversarial + cross-model. Pay Astra here. This is cheaper than paying Astra to discover it in code. |
| Two-bullet plan                               | Skip. The skill says so.                                                                                                 |
| You want “is this a good idea?” as an essay   | /ce-pov, not doc-review.                                                                                                 |
| Loop 2 on the same file                       | Primer + verify Applied. No panel.                                                                                       |
| Same Decision open twice                      | Leave CE. That’s ralplan or you.                                                                                         |
| Plus quota                                    | Luna chair, Luna coherence, one Astra pass on feasibility+security if the doc earned it.                                 |

**svg**

Doc-review is where you spend judgment tokens **before** implementers start treating the plan as law. Cheap chair, expensive lenses on the seats that can change *what* you build, mechanical auto-fix only when the document itself is the authority, and every later loop is a primer check — not another five-persona book club.

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=ai-mba.io\&sz=256)

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

88 sources

**svg**

What about CE poc?

**svg**

svg

svg

Thought for 16s

You typed **poc**. In this stack that’s almost certainly **/ce-pov** — the verdict/oracle skill I contrasted with doc-review. If you actually meant a proof-of-concept, that’s **/ce-prototype**. If you meant Every’s shared markdown editor, that’s **/ce-proof**. Different animals. This is the POV one.[**⁠Raw.githubusercontent**](https://raw.githubusercontent.com/EveryInc/compound-engineering-plugin/main/docs/guides/ce-pov.md)

## What /ce-pov is

A **read-only judgment**. Not findings. Not a plan. Not an implementation.

Three subject shapes, three output contracts:

| **You hand itYou get back**                                              |                                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| External adoption / exposure (“adopt Drizzle?”, “does this CVE hit us?”) | **Adopt / Trial / Hold / Reject / Not-our-problem** plus evidence and conditions |
| A document (“what do you think of this plan?”)                           | Direction, decisive strengths and risks, next action *if* justified              |
| A supplied approach set (“polling vs notifications?”)                    | A position, or an honest toss-up with the real tradeoffs                         |

**svg**

Hold is a first-class answer. So is Reject. So is Either is viable. Manufacturing certainty is a skill failure, not a flex.[**⁠Raw.githubusercontent**](https://raw.githubusercontent.com/EveryInc/compound-engineering-plugin/main/skills/ce-pov/references/method.md)

It will not implement the recommendation. A POV is not authorization. That’s the whole point.

## How it is not doc-review, ralplan, or bakeoff

| **SkillJob**                  |                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------- |
| **ce-doc-review**             | Issue list on a spec. Can edit the doc. Personas hunt contradictions.            |
| **ce-pov**                    | One supported take. Does not edit. Does not spawn coherence/feasibility.         |
| **ralplan**                   | Sequential court that can *kill* a plan (APPROVE/ITERATE/REJECT).                |
| **ce-bakeoff**                | *Build* competing solutions, then pick. POV judges material that already exists. |
| **ce-explain**                | How/why something in the repo is the way it is. Description, not a verdict.      |
| **ce-ideate / ce-brainstorm** | Open field. POV refuses to disguise discovery as a grade.                        |

**svg**

If the option set isn’t bounded, POV returns the unresolved scope to its owner instead of fake-verdicting an open field. That’s the correct “I won’t launder brainstorming into Adopt.”

Doc-review can tell you U3 has no test scenario. POV tells you the plan is pointed at the wrong product. Use both when the doc is load-bearing: review for executable residue, POV for “should this exist.”

## Grounding is the product

Every POV has to clear a **project floor**: a verified fact in *this* repo. Named incumbent with a file\:line, a dependency, an issue, a prior decision. Chat history does not count until a scout corroborates it. Fail that floor → Hold — insufficient project grounding, with the inspection list. No vibe Adopt.[**⁠Raw.githubusercontent**](https://raw.githubusercontent.com/EveryInc/compound-engineering-plugin/main/skills/ce-pov/references/method.md)

External-adoption also needs an **external floor**: at least one verified outside source. Docs/approaches only need that if the bottom line actually hangs on an external claim.

Skeptic stance is mandatory: hunt disconfirming evidence, name “keep the incumbent” and “do nothing.” Conversation momentum is treated as a bias source, not evidence.

Phases, short:

0. Frame the question and kill unbounded “what should we do about life” asks.
1. Ground. Scouts gather candidate-specific evidence. Can call ce-explain for “why is this code like this.”
2. Verify floors.
3. Freeze *this* model’s POV **before** any panel.
4. Deliver. Stop. No “shall I implement it?”

Scout ≠ judge. Scouts return dossiers. The chair forms the take. Same independence rule as review specialists.

## Oracle panel

This is the part people actually want.

**svg**

```
/ce-pov oracle on the three options
/ce-pov compare your take on docs/plans/new-checkout.md with Codex and Grok
/ce-pov I think we should do X. oracle this
```

Mechanics that matter:[**⁠X**](https://x.com/trevin/article/2079954613319749661)

- Host forms its own position **first**. Peers never see it. Then they inspect the repo independently and argue where they disagree.
- Bare oracle = up to two reachable *different-model* peers. Named peers are honored exactly, no cap.
- Peers **inform**, they do not vote. No majority Adopt.
- Failed peer does not block the solo judgment. The writeup has to say who ran and who ate shit.
- Attribution comes from serving-model **receipts**, not the name you typed. Cursor Auto without a receipt is unverified and does **not** count as cross-model corroboration.
- Mentioning a panel or declining one does not trigger one. “Oracle this” in an ongoing thread does.

This is the Anshu inversion applied to *judgment*: one chair, independent smart workers, no shared context contamination. It is also the only CE skill whose whole point is “get a different model family in the room before we treat this as law.”

## Smart boss / dumb boss

POV is a **smart-seat** skill. A Luna-only POV on “should we rip out the auth layer” is a confident intern with a blog post.

| **RoleModel**                              |                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Chair / final POV                          | Astra or Sol. This *is* the expensive judgment.                                                        |
| Scouts (repo facts, “do we already use X”) | Luna. Mechanical grounding.                                                                            |
| ce-explain callee                          | Terra/Sol if the behavior is gnarly; Luna if it’s “where is the incumbent.”                            |
| Oracle peers                               | **Different family**, not a second Astra. Codex vs Claude vs Grok. Same-family oracle is masturbation. |
| Reconciliation writeup                     | Same chair that froze the solo POV. Luna must not “average” the panel into mush.                       |

**svg**

Dumb-boss version that still works: Luna chairs the *ceremony* (dispatch scouts, call peers, format the doc), Astra writes the frozen POV and the reconciliation. If Luna writes the verdict, you paid for theater.

Do not put eight personas on a POV. That’s doc-review. POV is one brain, optional two independent brains, then an argument. More seats just correlate.

## Subsequent loops

There isn’t a review-style pass 2. A second /ce-pov on the same question is only legitimate when **the evidence changed**: new incumbent, new constraint, peer you didn’t have, CVE that landed, bakeoff artifacts that didn’t exist.

If nothing moved, you already have the take. Re-running is how you shop for Adopt.

What people do instead of a loop, and shouldn’t:

- “POV said Trial, so implement the whole migration.” No. Trial’s next step is a scoped spike. That’s ce-prototype or a bounded plan unit, not ce-work on the flagship.
- “Panel disagreed, run oracle again with more models.” You already have dissent. Adding a fourth model is noise unless they bring a *new* evidence class.
- Using POV as a substitute for ralplan after a dirty code-review. Different question. POV can say the *direction* is still right while ralplan kills the *plan*.

Durable capture is a separate request. Ordinary answers live in the thread. If you want it in docs/solutions/ or a plan, say so. Otherwise the next session will re-ground from scratch, which is correct — yesterday’s Adopt is a hypothesis until the project floor still holds.

## Where it sits in the pipeline

**svg**

```
open field          → ce-ideate / ce-brainstorm
need an artifact    → ce-prototype
need competing builds → ce-bakeoff
need a grade        → ce-pov
need an issue list  → ce-doc-review
need the plan to be allowed to die → ralplan
then code           → ce-work / ce-code-review
```

Brainstorm will punt “should we adopt X?” to POV instead of scoping a project you haven’t committed to. That’s the right handoff.

## If you meant POC, not POV

**/ce-prototype**: throwaway artifact so a *human* can feel the thing. Fidelity matches the question that talk cannot settle. Stops on unattended/LFG runs because there is no person to experience it. Writes decisions back into a Product Contract or hands off to brainstorm/plan. Implementer-shaped. Astra/Luna split from the first message applies: cheap chair, strong implementer, human is the reviewer.[**⁠Raw.githubusercontent**](https://raw.githubusercontent.com/EveryInc/compound-engineering-plugin/main/docs/guides/ce-prototype.md)

**/ce-proof**: publish local markdown to Every’s Proof editor. Collaboration plumbing. Not a review. Not a verdict.

---

POV is where you spend the expensive model on *whether*, with a forced evidence floor and an optional hostile second family in the room. Doc-review is *what’s wrong with this text*. Don’t run POV as a findings engine, don’t run doc-review as a strategy meeting, and don’t let Luna issue Adopt.

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=raw.githubusercontent.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

72 sources

**svg**

We can also use terra for the fix loops yeah? Ore is Luna cheaper and comparable?

**svg**

svg

svg

Thought for 19s

Yes. Terra is a legitimate fixer. It is not automatically the right one. Luna is cheaper by a lot, and on a *well-specified* fix it is often close enough that Terra is just a more expensive Luna. The gap shows up when the finding is a problem statement, not a patch spec.

## The money

API sticker, post July-30 cut:

| **Input / 1MCached / 1MOutput / 1M** |        |              |          |
| ------------------------------------ | ------ | ------------ | -------- |
| Luna                                 | $0.20  | $0.02        | $1.20    |
| Terra                                | $2.00  | $0.20        | $12.00   |
| Sol                                  | \~$4–5 | \~$0.40–0.50 | \~$20–30 |
| Astra                                | \~$10  | \~$1         | \~$50    |

**svg**

That’s **\~10×** Terra over Luna on both sides. On Codex Plus the 5h window is even nastier: Luna is listed around 250–2000 local messages per window, Terra 25–200. One Terra fixer sitting in a loop eats the window like a junior Astra.[**⁠Codexti**](https://codexti.me/gpt-5-6)

If you put Terra on every safe\_auto unused-import, you are lighting the scarce resource on janitorial work.

## The quality gap on *fixes*, not on “coding”

Published agent indexes are close: Terra \~77 vs Luna \~75 on the Coding Agent Index; Terminal-Bench in the mid-80s for both depending whose chart you trust. That is “same neighborhood,” not “Terra is a real engineer and Luna is a formatter.”[**⁠Codexti**](https://codexti.me/gpt-5-6)

What actually moves fix-loop cost is **rework**, not the first-pass score.

- Tight finding + test: Luna medium/high lands it. A r/codex home-lab set had Luna Medium at **97% of Terra Medium** with **\~59% less usage**. That’s the shape of a good review leftover.[**⁠Reddit**](https://www.reddit.com/r/codex/comments/1v3cl32/luna_vs_terra_vs_sol_benchmark_for_my_use_case/)
- Vague finding (“this auth path is racy”): Luna will write *a* fix. Often the wrong one. Then you pay the specialist to re-review, then maybe Terra/Sol to do it again. One repair cycle wipes the 10×.
- That’s the same failure as Luna-max implementer on the wireframe: 36 minutes + two repairs vs Astra-low in 8 with none. Fix loops inherit that if you feed them mush.

Luna Max is also slower to first token and more verbose at max effort. “Just turn Luna to max for everything” is how a cheap model becomes a slow mid-tier with worse taste.

## Routing the fixer, not a religion

The finding’s **autofix class** is the switch. You already paid for that classification on pass 1. Use it.

| **Finding shapeFixerWhy**                                                                                   |                                      |                                                               |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| safe\_auto / mechanical: rename, unused import, header count, missing field in the plan template, test name | **Luna low/medium**                  | Spec is the patch. Judgment is zero.                          |
| Local bug, file\:line, suggested fix, test named                                                            | **Luna medium / xhigh**              | Bounded. Escalate only if the first shot fails the test.      |
| Real bug, local, but the suggested fix is a sketch                                                          | **Terra medium/high**                | Needs to pick an approach inside one module.                  |
| Multi-file, contract, error-handling, concurrency, “also update callers”                                    | **Terra high**                       | This is everyday implementation, which is Terra’s actual job. |
| Auth, payments, migrations, public API, the fix changes the plan                                            | **Sol / Astra-low**                  | You left the cheap-fix loop. Don’t pretend.                   |
| Doc-review Applied items (refs, IDs, scenario field)                                                        | **Luna**                             | Coherence work.                                               |
| Doc-review Decision that you accepted (“public vs internal”)                                                | **Terra or Sol**, then maybe ralplan | Meaning changed.                                              |

**svg**

Default for *loop 2+* after a good CE/OMX review: **Luna**. The review already did the thinking. The fixer should be a clerk with a compiler.

Default Terra when pass 1 was sloppy (“security issues in auth.ts”) or the accepted item has no concrete suggested\_fix. Terra is the everyday implementer. That is a different job than “apply finding F12.”

## Effort ladder so you don’t get cute

Match smaller model with more effort, bigger model with less:

- Luna medium → Luna xhigh before you jump to Terra
- Terra medium → Terra high before you jump to Sol
- Do not Luna-max a one-line lint. Do not Terra-max a rename.

Community Pareto-ish read: Luna High is the cheap floor, Terra Max is the next *real* step (\~3.5× Luna High quota for a visible coding bump), Sol Max almost 2× Terra for a small extra bump. For a 15-line accepted finding, you want the floor, not the next plateau.[**⁠Reddit**](https://www.reddit.com/r/codex/comments/1ut3bnp/the_codex_pareto_frontier_luna_high_terra_max_sol/)

## Subsequent loop, with Terra in the picture

**svg**

```
Pass 1 review     smart specialists (unchanged)

Fix
  mechanical / specified  → Luna
  local-but-judgy         → Terra
  blast-radius / security → Sol/Astra, and maybe you bounced out

Verify
  “is F12 gone + tests green”  → Luna
  “did this approach actually work” → same specialist that filed it, or Terra
```

Do not Terra-verify a Luna mechanical fix. That’s a $12/M model rereading a diff to confirm an import died. Luna can read a test result.

Cap stays two fix-verify cycles. If Luna fails the named test once, **one** Terra retry on that same finding. Second fail → human or back to the plan. Do not Luna-max three times “to save money.”

## When Terra is a waste vs when Luna is a trap

**Terra is a waste** when:

- the finding already contains the patch
- there’s a deterministic check (test, typecheck, schema)
- you’re in a Plus 5h hole and the leftovers are P2/P3
- you’re about to spawn four Terra fixers in parallel on disjoint nits

**Luna is a trap** when:

- the finding is a smell without a unique fix
- callers / types / invariants have to be inferred
- last Luna pass already “fixed” it and the specialist said still open
- the hunk is auth/data/API and you’re telling yourself “it’s just a small fix”

One comment on the routing-skill thread is the cope version: “Terra isn’t good for anything, Luna max or jump to Sol.” That’s half right on *price* and wrong on *shape*. Terra exists because most leftover review work is “everyday implementation with the destination known.” That seat is Terra, not Luna-max LARPing as Sol, and not Sol polishing a test assertion.

**Short version:** use Terra for fix loops when the accepted item still needs an engineer. Use Luna when it needs a technician. Luna is cheaper and comparable on the technician pile, which should be most of loop 2 if pass 1 did its job. If your fix loops always “need Terra,” your reviews are handing over essays, not findings.

[image](https://www.google.com/s2/favicons?domain=sonarsource.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=ynaito.dev\&sz=256)

[image](https://www.google.com/s2/favicons?domain=umesh-malik.com\&sz=256)

108 sources

**svg**

Maybe ce code review scores difficulty and vagueness

**svg**

svg

svg

Thought for 15s

Yes. That’s the right missing axis. CE does **not** score difficulty or vagueness today. It scores three other things and hopes they imply routing.

## What CE already puts on a finding

| **FieldAnswersDoes not answer** |                                                                 |                                           |
| ------------------------------- | --------------------------------------------------------------- | ----------------------------------------- |
| severity P0–P3                  | How bad if we ship it                                           | How hard the patch is                     |
| confidence / anchors            | Is this even real                                               | How specified the fix is                  |
| autofix\_class                  | Follow-up *shape*: mechanical / gated / needs design / advisory | Which model should type                   |
| suggested\_fix present?         | Is there a concrete patch sketch                                | Whether that sketch is the only valid one |
| requires\_verification          | Fix isn’t done without a check                                  | How gnarly the check is                   |

**svg**

autofix\_class is the closest proxy. Their own words: safe\_auto = “local and deterministic — fixer applies it without design judgment.” gated\_auto = concrete fix, but it crosses a contract. manual = design decision. That’s **judgment required: yes/no/kinda**, not “Luna vs Terra vs Sol.”[**⁠GitHub**](https://github.com/EveryInc/compound-engineering-plugin/issues/686)

They already treat vagueness as a defect, not a score. Quality gate: if the finding says “consider / might / could” without a concrete action, rewrite it. Good instinct. Incomplete. A finding can be fully actionable and still have three valid patches. That’s vagueness of *solution space*, not of English.

So you can already route crudely:

- safe\_auto + suggested\_fix + high confidence → Luna
- manual or no suggested\_fix → Terra/Sol
- P0 + security persona → don’t care about class, escalate

That’s a blunt instrument. A P3 with a mushy “consider extracting a service” will look manual and burn Terra. A P0 “add current\_user.owns? on line 42” is gated\_auto and Luna can often do it if you accept the gate separately.

## Why two extra scores earn their keep

Urgency ≠ hardness ≠ specifiedness. You keep mixing them and the fixer gets the wrong brain.

- **P0 + specified + local** (missing ownership check, exact guard, test named) → Luna. Severity is high; the *work* is a technician job.
- **P3 + vague + cross-cutting** (“this module feels coupled”) → not a fix loop at all. Advisory or bounce to plan. Terra will happily invent an architecture.
- **P1 + specified + hard** (known race, fix is a lock/queue redesign inside one file) → Terra high / Sol. Spec is tight, mechanics aren’t.
- **P1 + vague** (“auth path is racy”) → do not dispatch a fixer. Send it back to the specialist or to ce-debug. A vague P1 is how Luna writes the wrong mutex and you pay Sol to undo it.

Difficulty is “how much inference does the patch take.”

Vagueness is “how many patches would satisfy this sentence.”

Those two numbers tell you the model. Severity tells you whether to bother. Confidence tells you whether to believe the ticket.

## Don’t add 0–100 sliders

Doc-review already burned that. Personas cluster on 0.72 and you get coin-flip gates. Use **anchors with behavioral tests**, same trick they used for confidence.[**⁠GitHub**](https://github.com/EveryInc/compound-engineering-plugin/pull/622)

**Vagueness** (solution-space, not prose quality)

| **AnchorTest** |                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| specified      | One concrete suggested\_fix, file\:line, unique reasonable patch. A second engineer would land the same diff.                    |
| bounded        | 2–3 acceptable patches named, or the fix is “add a guard here” without the exact shape. Destination known, mechanism not unique. |
| open           | Problem stated, solution space unnamed. “This is racy / coupled / wrong.” Not a fixer ticket.                                    |

**svg**

If the persona cannot emit specified or bounded, it does not get to emit manual with a shrug. It either tightens the finding or marks advisory / needs-human.

**Difficulty** (inference load of applying a *specified or bounded* fix)

| **AnchorTest** |                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| mechanical     | Pattern already in-repo or the patch is local additive (null check, rename, missing test, dead code). No new abstraction. |
| local-judgment | One module, need to pick among the bounded options, types/callers in view. Everyday Terra work.                           |
| cross-cutting  | Callers, contracts, state machine, concurrency, schema, or the plan itself moves.                                         |

**svg**

Forbidden combo: open + any difficulty. Difficulty without a solution class is fanfic. Synthesis should drop or bounce those.

Keep them orthogonal to autofix\_class. Class is still “may we auto-apply / must a human gate / is this even a fix.” A specified + mechanical finding can still be gated\_auto because it changes a public response shape. Luna can write it; a human (or the chair policy) still has to say yes.

## Routing table that falls out

**svg**

```
if vagueness == open:
    no fixer. debug / specialist / ralplan / human
elif vagueness == specified and difficulty == mechanical:
    Luna low/medium
elif vagueness == specified and difficulty == local-judgment:
    Luna xhigh first; Terra medium if Luna fails the named test once
elif vagueness == bounded and difficulty == mechanical:
    Luna medium  (pick the first named option, don't invent a fourth)
elif vagueness == bounded and difficulty == local-judgment:
    Terra medium/high
elif difficulty == cross-cutting:
    Terra high if bounded and non-security
    Sol/Astra if security, data, public API, or plan-changing
```

Chair (Luna) only reads the two anchors + persona + class. It does not “feel” the diff again. That’s the whole point of scoring at review time: you spend the expensive model once, while the specialist still has the code in working memory.

## Who is allowed to set the scores

The **persona**, not the chair. The chair will grade everything mechanical to keep the cheap fixer. Synthesis may only **worsen** the grade (specified → bounded → open, mechanical → local-judgment → cross-cutting), never brighten it. Same conservative-merge rule they already use on autofix\_class.

Cross-persona merge: if correctness says specified and security says bounded on the same fingerprint, take bounded. If one says open, the ticket is open until a human or the specialist tightens it.

Do not let Luna-as-reviewer invent these scores. The seats that find P0/P1 (correctness, security, adversarial) are the ones whose difficulty/vagueness you trust. Coherence-on-a-doc can mark mechanical/specified all day.

## What not to do

**Don’t collapse it into one “complexity: 7.”** You’ll route a specified P0 ownership check to Sol because “auth is scary,” and a vague P3 coupling rant to Luna because “it’s just a suggestion.”

**Don’t score the whole PR.** A PR can contain one mechanical P3 and one cross-cutting P1. Per-finding or this is useless.

**Don’t use it to re-fan-out the panel.** Scores drive the *fixer* and whether pass 2 is a delta check vs a specialist re-read. They don’t mean “this finding was hard so run all six personas again.”

**Don’t treat suggested\_fix as specified.** Personas will hallucinate a tidy patch for an open problem. The test is uniqueness, not presence of a paragraph. If two competent fixes exist and only one is written down, that’s bounded at best.

**Don’t auto-apply off difficulty.** Apply permission stays autofix\_class + policy. Difficulty only picks the typist.

## You can fake this tomorrow without a schema change

Until CE grows the fields, derive them:

**svg**

```
specified  = has file:line AND suggested_fix AND no "consider/might/or"
bounded    = has suggested_fix XOR (2+ options named)
open       = else, if still actionable

mechanical     = safe_auto OR (suggested_fix is <15 lines AND single file AND no contract words)
local-judgment = gated_auto in one file / one module
cross-cutting  = manual OR files > 2 OR persona in {security, adversarial} with state/API/schema
```

That’s lossy, but it’s enough to stop sending every leftover to Terra “just in case.” Log when Luna fails a specified+mechanical item — if that rate is high, your derivation is lying and the persona’s suggested\_fix is slop.

So: yes, score those two at review time, as discrete anchors, persona-authored, synthesis-only-worsens, orthogonal to severity and autofix\_class. Then the fix loop stops being a vibe and becomes a lookup. That’s the actual upgrade over “Terra for fixes, I guess.”

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=awesomeskill.ai\&sz=256)

[image](https://www.google.com/s2/favicons?domain=docs.github.com\&sz=256)

78 sources

**svg**

In addition, what does the literature say on using Luna / haiku for for exploration? Searching. Especially supplemented by tools like ripgrep, got nexus, graphify

**svg**

svg

svg

Thought for 20s

Yes. The literature and the production harnesses mostly agree: **cheap models are good explorers when the tool does the navigation and the contract is “return file\:line + evidence, not a theory.”** They get expensive-looking work done because exploration is *search + filter*, not *invention*. They fail when you ask them to *close* the question.

## What the papers actually measured

Four results matter. They are not “Luna is smart.” They are “search is a different job.”

**1. Tools lift small models more than parameters do.**

*Agent Distillation* (Kang et al., NeurIPS 2025 Spotlight) distilled full tool-using agent trajectories — retrieval + code — into 0.5B / 1.5B / 3B models. Those small agents beat next-tier models that only got CoT distillation. The claim is not that a 3B model reasons like a frontier model. It is that **the loop (search → read → decide next query) is learnable and transferable**, and that is most of exploration.[**⁠arXiv**](https://arxiv.org/abs/2505.17612)

**2. A search specialist can match frontier retrieval at a fraction of the cost.**

Applied Compute post-trained Qwen 35B-A3B in an RL sandbox whose tools were exactly read\_file, ripgrep, glob, list\_dir over \~9k real repos. Result they advertise: frontier-beating retrieval accuracy, \~100× cheaper per search, 2–10× lower latency. Training *changed the tool mix* — the model learned when to stop grepping. A bash-only twin just grepped harder (4.0 → 8.9 ripgrep calls) and got worse. So: cheap + tools works; cheap + “keep searching” does not.[**⁠Appliedcompute**](https://appliedcompute.com/case-studies/turbopuffer)

**3. SWE-grep (Cognition / Windsurf) is the production version of that idea.**

They trained retrieval-only agents to do **4 serial turns × 8 parallel tool calls** (grep, read, glob). They match frontier models on context retrieval and are 4.5–20× faster than Haiku 4.5 on Cerebras. Reward weights **precision over recall**: polluting the parent’s context is worse than missing a file, because the parent is a few searches away from recovering a miss and a poisoned context is sticky. That is the load-bearing sentence for your scout design.[**⁠Cognition**](https://cognition.ai/blog/swe-grep)

**4. Grep is not a joke baseline.**

GrepRAG (Wang et al., arXiv 2601.23254): an LLM that just writes ripgrep commands already rivals graph-based RAG on repo-level code completion. Their cleaned-up GrepRAG (identifier-weighted rerank + structure-aware dedup) beats prior SOTA by **7–15% relative exact match** on CrossCodeEval. Ripgrep on diffusers was \~0.4s vs 3–7s for the graph/index baselines; on a 754k-LOC Java repo the index methods blew past 50s. Lexical retrieval wins when the thing you want has a name. Graphs win when the thing you want is an *edge*.[**⁠arXiv**](https://arxiv.org/abs/2601.23254)

A fifth, practical one: Entire.io timed agent traces and found making search 10× faster (14.7ms → 1.7ms) moved end-to-end wall clock from 38.6s to 37.0s. Tool execution was **0.4% of the run**. The model’s serial thinking is the bill. So “give Luna a faster grep” is not how you save money. “Give Luna fewer turns and a structured return” is.[**⁠Entire**](https://entire.io/blog/improving-agentic-search-in-coding-agents)

## What the harnesses already do

This is no longer a blog take. It is default routing.

- Claude Code shipped **Explore on Haiku** on purpose. Cat Wu: Haiku 4.5 “now powers the Explore subagent.” Read-only, file discovery / code search. Official product split: expensive model plans, cheap model maps.[**⁠X**](https://x.com/_catwu/status/1978509178206388674)
- HumanLayer’s RPI pack does the same: codebase-locator, codebase-analyzer, codebase-pattern-finder drop from Sonnet to **Haiku** under “Faster Research Subagents.” Implementer and reviewer stay on Sonnet. They isolated the seats that are allowed to be dumb-and-fast.[**⁠Docs.humanlayer**](https://docs.humanlayer.com/reference/subagent-models)
- Codex community has standardized luna\_scout: read-only, file\:line evidence, implementation boundary, no architecture essay. That is SWE-grep’s contract written as a TOML.[**⁠GitHub**](https://github.com/benis-boy/agentic-dev-template-2026/blob/main/.opencode/agents/luna-scout.md)
- They also *walked some of it back*. Claude Code v2.1.198 made Explore **inherit the parent** (capped at Opus) because Haiku was overflowing on real MCP tool dumps (“Prompt is too long”). Cheap explorer + fat tool surface is a real failure, not a vibe. Pin Explore to Haiku **and** strip MCP to Read/Grep/Glob + your graph tools, or Haiku dies before it searches.[**⁠GitHub**](https://github.com/anthropics/claude-code/issues/72940)

Modem’s instrumented “how agents read code” run is the cautionary table: a skill that structures search cut tokens 16–66% across models. Haiku and Sonnet then **failed large-file bug hunts by exhausting the budget paging**, not by answering wrong. Sol and Grok 4.5 finished. Cheap explorer without a stop rule will burn a window proving it is thorough.[**⁠Modem**](https://modem.dev/blog/how-coding-agents-read-your-code)

## What GitNexus and Graphify change

They are not two greps. They change *which question* a cheap model can answer.

| **ripgrepGitNexusGraphify** |                                                              |                                                                                             |                                                                                                                   |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Job                         | “Where is this string / identifier?”                         | “What breaks if I touch this symbol?”                                                       | “How does this code sit next to the ADR / schema / paper?”                                                        |
| Index                       | None. Scan now.                                              | Live code graph + optional PDG/taint. impact, context, query, detect\_changes               | tree-sitter AST locally (no LLM), plus LLM enrichment for docs/PDFs. query / path / explain                       |
| Cheap-model fit             | Excellent. Regex + filter is Haiku/Luna native.              | Excellent *if* the tool returns the blast radius. The model should not walk 4 hops by hand. | Good for “show me the path.” Bad if you ask Luna to *build* the semantic layer — that’s the paid enrichment pass. |
| Failure                     | Rename, dynamic dispatch, generated code, “auth-ish” queries | Stale index, languages it doesn’t parse, confidence theater on inferred edges               | Treating inferred/ambiguous edges as EXTRACTED; using it as a grep replacement                                    |

**svg**

GitNexus’s impact tool is the whole point: depth-1 “WILL BREAK,” depth-2 “LIKELY AFFECTED,” with a confidence tag. That is program analysis, not “Luna thinks about callers.” Graphify’s bet is scope — code + docs + schema in one traversable graph, no embeddings. Complementary, not substitutes. “What callers exist?” → GitNexus. “Why did we do it this way?” → Graphify. “Where is createSession?” → ripgrep.[**⁠Shirokoff**](https://shirokoff.ca/blog/code-knowledge-graphs-graphify-codegraph-gitnexus)

GrepRAG vs the graph vendors is not a contradiction. Grep wins **lookup**. Graphs win **multi-hop / blast radius / why**. A cheap model plus the wrong tool on the wrong question looks dumb. A cheap model plus the right tool looks like a staff engineer’s rg session.

## When Luna / Haiku exploration is actually good

The successful setups share a contract:

1. **Read-only.** Scout cannot edit. That is non-negotiable in every pack that works.
2. **Named question.** “Find the login handler and its tests,” not “understand auth.”
3. **Return shape is evidence.** File\:line, snippet, “confirmed vs assumed,” files *not* to touch. SWE-grep’s precision bias belongs here: 8 tight hits beat 40 maybes.
4. **Hard turn cap.** 4 serial turns, parallel greps inside each turn. Unbounded “very thorough” is how Haiku pages a 5k-line file to death.
5. **Parent does not ingest the raw dump.** Scout writes a dossier. Chair reads the dossier. Cognition measured this: leftover context in the main agent hurts more than a miss.
6. **Tool surface is small.** rg / glob / read + one graph query. Not 200 MCP tools. Haiku’s context window is the binding constraint, not its IQ.

Under that contract, published and production evidence says a Haiku/Luna scout is **comparable to a Sonnet/Terra scout on retrieval F1**, much cheaper, and often faster because it does not “think” between greps. That is why Anthropic put Explore on Haiku and why Codex people keep minting luna\_scout.

## When it is a trap

These are the measured failure modes, not taste:

- **The question is an edge, the tool is a string.** “What breaks if I change this return type?” via ripgrep. Luna will list textual matches and miss the one interface in another package. That’s GitNexus impact, or a smart model walking the graph.
- **The question is causal.** “Why is this flaky?” Exploration can *locate* the test and the sleep. It cannot close the root cause. That’s ce-debug / Sol, not a scout.
- **Dynamic / generated / renamed world.** GrepRAG itself flags high-frequency tokens and rigid truncation. Cheap models are worse at noticing the graph is lying.
- **Scout becomes the only map.** If Astra implements off a Luna dossier that missed a caller, you bought a cheap search and an expensive bug. SWE-grep’s own downstream note: the parent must be allowed to search again. One-shot scout → implement is how the wireframe A/B died.
- **Thoroughness as a personality.** Modem: Haiku/Sonnet burned the budget *reading*. Cap turns. Prefer rg -n -g '!\*\*/test/\*\*' --max-count 20 over “read the module.”
- **MCP obesity.** Haiku Explore + 200 tools = spawn failure. Strip tools per agent type.
- **Using the graph builder as the explorer.** Graphify’s code parse is free (tree-sitter). Its *doc/PDF* enrichment is an LLM pass — do not put that on Luna if the answer depends on the ADR’s actual claim. Query the already-built graph with Luna; build the semantic layer with Terra/Sol.

## How this plugs into the stack you already have

**svg**

```
Explore (cheap)     Luna/Haiku + rg + GitNexus.impact + Graphify.path
                    → dossier: files, edges, confirmed vs assumed
Judge (expensive)   Astra/Sol/ce-pov reads dossier, may issue 1–2 follow-up queries
Plan / Review       existing CE / ralplan
Fix                 Luna if specified+mechanical, Terra if local-judgment
```

Scout scoring, same two anchors as findings:

| **Scout questionToolModel**                           |                         |                                                                           |
| ----------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------- |
| “Where is X defined / referenced?”                    | ripgrep / ast-grep      | Luna low                                                                  |
| “Who calls this, one hop?”                            | GitNexus context        | Luna medium                                                               |
| “Blast radius of this signature change?”              | GitNexus impact         | Luna medium to *fetch*; Terra to *decide if we care*                      |
| “Where does this requirement live in the ADR + code?” | Graphify path / explain | Luna to fetch the path; Sol if the path is the argument                   |
| “Is this even the right module?”                      | mixed, 4-turn cap       | Luna, then one Terra pass if the dossier says assumed more than confirmed |

**svg**

Do not run Graphify *and* GitNexus *and* a 12-turn Haiku Explore on the same question. Pick the tool that matches the question, one cheap scout, dossier in, chair decides whether the map is good enough to type.

**Short version the literature supports:** exploration is a retrieval policy, not an IQ test. Small / cheap models with ripgrep already rival graphs on *lookup*; graphs earn their keep on *edges*; specialized search models match frontier retrieval on purpose-built benches; production harnesses already put Haiku/Luna on Explore. The failure is always the same: letting the cheap scout write the conclusion, or letting it dump forty files into the expensive model’s mouth.

[image](https://www.google.com/s2/favicons?domain=cognition.ai\&sz=256)

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=clifor.ai\&sz=256)

232 sources

**svg**

Lastly. Look at the new release: jev

**svg**

svg

svg

Thought for 37s

Jev is TypeSafe’s **System One** model, early access as of September 15. Named after Jevons. It does not write code, findings, or prose. You send **state + typed questions**; it returns **Choice / Score / Noul** plus probabilities in one parallel pass, 70–500ms, **$0.042 per million input tokens, output free**.[**⁠Datacamp**](https://www.datacamp.com/blog/system-one-models-jev)

That is the clerk we kept assigning to Luna, except Luna still has to *say something*. Jev cannot emit a sentence, so it cannot invent a patch, a rationale, or a product fork. Schema-valid is guaranteed. True is not.

## What it actually is

Three primitives. That’s the whole API:

| **PrimitiveYou defineYou get** |                               |                                    |
| ------------------------------ | ----------------------------- | ---------------------------------- |
| **Noul**                       | A yes/no predicate in English | P(yes)                             |
| **Choice**                     | Up to 255 options you named   | Full distribution                  |
| **Score**                      | An ordered scale you named    | A point on that scale + confidence |

**svg**

No tools. No generation. \~32k tokens of *state* in a \~64k request. Text in, typed values out. Trained with RLCD (reinforcement learning for calibrated decisions), Diogo Almeida (InstructGPT), $40M DCVC.[**⁠Langchain**](https://www.langchain.com/blog/building-a-harness-with-jev)

“0% hallucination” means it cannot emit a type outside your schema. It can still pick the **wrong option at 0.91**. Calibration is the product claim; treat it as a threshold knob, not a witness.

Vendor homepage: 193× faster / 444× cheaper vs frontier on *their* classification workflows. Independent scrape of the first three days of X: user-measured median **\~5× speed, \~32× cheaper, \~270ms**. Vercel put it on AI Gateway as typesafe-ai/jev and reports up to **18× faster at p95 than Luna** on the classifier seat they replaced; they now run it as a default safety reviewer. TypeSafe’s own 4-workflow bench: **\~68%, tied with Terra**, below Sol/Opus, at \~1/76th Terra’s cost per case. Every.to (same shop as Compound Engineering) ran 777 judgments in 0.7s for a quarter cent.[**⁠Openchamber**](https://openchamber.dev/blog/jev-typesafe-ai)

So: Terra-class *decision* accuracy at Luna-or-better *price/latency*, with no string to parse. Not a coding model.

## Where it sits in the stack we already drew

Jev is System-1 for the harness. The expensive models stay System-2. It does not replace scouts, personas, POV, or fixers. It **routes and gates** them.

| **Seat we already wantedJev’s jobStill not Jev** |                                                                                                                        |                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Luna vs Terra vs Sol vs Astra                    | One Choice per turn. jev-router already maps Fast→Luna/Haiku, Balanced→Terra/Sonnet, Strong→Sol/Opus, Long→Astra/Fable | The models themselves                                     |
| Difficulty + vagueness on CE findings            | Choice {specified, bounded, open} × {mechanical, local-judgment, cross-cutting}                                        | Writing the finding. Personas still have to read the diff |
| “Is this specified enough for Luna?”             | Noul ready\_for\_luna                                                                                                  | Applying the patch                                        |
| Scout dossier before the parent eats it          | Noul per hit: on-question? confirmed vs assumed                                                                        | ripgrep / GitNexus / Graphify                             |
| Pass 2 “did F12 land?”                           | Noul against finding + diff + named test                                                                               | A second six-persona review                               |
| Apply vs Decision vs FYI                         | Choice over those four buckets                                                                                         | Settling a product fork                                   |
| Compaction                                       | keep/delete chunks **verbatim** (fast-jev-compaction)                                                                  | Compound notes, ADRs                                      |
| Tool-call auto-approve                           | Noul, fail closed (pi-jev-auto-mode)                                                                                   | Irreversible / auth / data                                |
| ce-pov / ralplan / oracle                        | Nothing                                                                                                                | Open questions, dissent, “why”                            |

**svg**

Community already wired the obvious seats this week: jev-mcp (verify / screen / find), jev-router, jev-codex-router, jev-review, jev-code. None of them write code. That’s the point.[**⁠GitHub**](https://github.com/jkudish/jev-mcp)

## The finding scores, now a 200ms call

You don’t need CE to grow schema fields first. After the panel dumps JSON:

**svg**

```
state:   finding + evidence snippets + suggested_fix
questions:
  spec_quality: Choice [patch, sketch, smell]
  difficulty:   Choice [mechanical, local-judgment, cross-cutting]
  ready_luna:   Noul "a second engineer would land the same diff from this text"
  keep:         Noul "this is still worth a fix loop"
```

Then the table we already wrote is a lookup:

- patch + mechanical + ready\_luna high → Luna
- sketch + local-judgment → Terra
- cross-cutting or security persona → Sol/Astra
- smell or open or low confidence → no fixer; bounce to specialist / debug / human

Synthesis may only **worsen** those grades, same as autofix\_class. Jev is the clerk. The persona is still the author of the ticket.

Same trick on a Luna scout dossier: Noul each cited file “on-question?” before Astra sees it. That’s SWE-grep’s precision-over-recall rule as an API. Drop the misses; parent may search once more. Do not dump 40 rg hits into Sol.

## What it does not do, even if the launch thread is loud

- **It does not explore.** No tools, 32k state cap. Luna + rg + GitNexus impact still finds the callers. Jev can *rank* a candidate list you already fetched (jev\_find). Sending the repo as state is how you get a confident wrong Choice.
- **It does not review a diff.** jev-review is a quality *signal*, not ce-code-review. Personas walk the code; Jev triages the resulting list.
- **It does not replace POV / ralplan / oracle.** Those produce arguments and can kill a plan. Jev picks from a list you already believe is complete. If the option set is wrong, Jev is a very fast wrong light.
- **It does not write suggested\_fix.** If you needed a sentence, you needed Luna/Terra.
- **Confidence is not evidence.** Fail closed below your threshold. A 0.55 Noul is a coin flip you paid $0.00001 for.
- **Price may be introductory.** TypeSafe has not proven $0.042 is the durable number. Design so you can swap the classifier.

Official jaggedness, worth taking literally: bad at math/dates/counts, weak on multi-hop, needs **filtered** state, no generation. If the decision depends on a number in the diff, count it yourself and put the count in the question.

## How the loop looks with Jev in it

**svg**

```
Explore     Luna + rg + GitNexus/Graphify
            → dossier

Gate        Jev: which files are on-question?
            drop the rest before the parent

Judge       Astra/Sol / ce-pov / CE personas
            (only on what survived the gate)

Score       Jev on each finding:
            spec × difficulty × ready_luna × keep

Fix         Luna / Terra / Sol from that lookup
            one retry up the ladder if the named test fails

Verify      Jev Noul “F12 gone?” + the test
            not another panel

Keep        Jev keep/delete on the transcript
            verbatim, no LLM summary
```

Two cycles still. Jev does not give you a third for free; it makes the first two cheap enough that you stop skipping the gate.

**One line:** Jev is the typed confidence gate we kept wishing CE and the Luna chair would grow. Put it in front of routing, finding triage, scout ingest, and pass-2 verify. Do not let it write, explore, or settle “what should we build.” That’s still the expensive model, and now it only runs when Jev says the question is real.

[image](https://www.google.com/s2/favicons?domain=datacamp.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=every.to\&sz=256)

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

158 sources

**svg**

Next up just like we are drawing a lot of inspo from compound engineering and omc I want to draw inspo from agent-skills (the one based on Google sdlc, turbo popular) and Matt pococks's skills

**svg**

svg

svg

Thought for 33s

Two packs, two different bets. Addy’s **agent-skills** (\~96k) is Google’s published engineering culture turned into a six-phase spine. Pocock’s **skills** (\~265k) is the opposite: composable primitives that refuse to own your process. Steal from both. Do not install both spines.[**⁠GitHub**](https://github.com/addyosmani/agent-skills)

## What each one actually is

**addyosmani/agent-skills** — senior-engineer scaffolding an agent will skip. DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP. Domain skills auto-trigger (api-and-interface-design when you’re touching an API). Saturated with *Software Engineering at Google*: Hyrum’s Law, Beyoncé rule, 80/15/5 pyramid, Chesterton’s Fence, \~100-line changes, trunk-based, shift-left, code-as-liability. interview-me is the Define-phase grill. /review is five-axis quality, not CE personas. /ship is a launch checklist, not git push.[**⁠Addyosmani**](https://addyosmani.com/blog/agent-skills/)

**mattpocock/skills** — “real engineering, not vibe coding,” explicitly anti-GSD/BMAD/Spec-Kit. Skills are small and hackable. The load-bearing split: **user-invoked vs model-invoked**. You type /grill-with-docs. The agent may reach for /tdd and /code-review on its own. A user-invoked skill may call model-invoked ones, **never another user-invoked skill**. That single rule is how he keeps the agent from running your life. Shared memory is the issue tracker + CONTEXT.md + tiny ADRs, not a CE unified plan.[**⁠Raw.githubusercontent**](https://raw.githubusercontent.com/mattpocock/skills/main/README.md)

helderberto/agent-skills is a cousin of Addy’s spine (same six boxes, personal toolbelt, /hb\:review fans out audits). Useful as a second specimen of “phase orchestrates audits.” Not a third religion.

## What to steal from Addy (Google SDLC)

Not the Cloud Run recipes. The **discipline agents skip**.

| **PracticeWhere it livesWhat you actually copy** |                           |                                                                                                                                             |
| ------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Spec before code                                 | /spec, interview-me       | One question at a time. Numbers without a source get a reason or get dropped. Same as CE brainstorm, tighter on evidence.                   |
| Constraints once                                 | /constraints              | Quality bar is a file, not a vibe in the review prompt. CE’s CODING\_STANDARDS.md is the same idea — keep one, don’t grow a second.         |
| VERIFY ≠ REVIEW                                  | /test then /review        | Tests are proof. Review is leftover judgment. Your “pass 2 is not another panel” rule is this split.                                        |
| Five-axis review + small diffs                   | code-review-and-quality   | Google review culture: \~100 LOC, labels **Critical / Nit / Optional / FYI**. Map onto CE P0–P3 + our spec\_quality. Nits never wake Astra. |
| Chesterton’s Fence                               | code-simplification       | Don’t delete what you can’t explain. Jev Noul “do we know why this exists?” before Luna rips it out.                                        |
| Hyrum’s Law                                      | api-and-interface-design  | Every observable behavior will be depended on. gated\_auto on public surface is this, named.                                                |
| Beyoncé rule + pyramid                           | TDD skill                 | If you ain’t tested it, it don’t exist. 80 unit / 15 integration / 5 e2e. Luna writes the 80. Terra writes the 15. Humans/Sol own the 5.    |
| Code as liability                                | deprecation-and-migration | Deleting is a first-class skill. Most agent loops only add.                                                                                 |
| Ship is a gate you pull                          | /ship                     | disable-model-invocation on anything that leaves the machine. helderberto does this too. Keep it.                                           |
| Anti-rationalization tables                      | throughout                | Excuse → rebuttal baked into the skill. “Tests are slow” / “this is just a spike.” Agents love those. Write them down.                      |

**svg**

Addy’s auto-activation is the other steal: **domain skills attach by artifact, not by ceremony.** Touching an API loads Hyrum. Touching JSX loads frontend-ui. That’s how CE should pick personas, and how Jev should pick which constraint pack is in force. Don’t load the whole Google book every turn.

Do **not** steal Addy’s six slash commands as a second CE loop. You already have ideate → brainstorm → plan → work → review → compound. A parallel DEFINE/PLAN/BUILD spine is how you get two priests arguing about whose /plan is canonical.

## What to steal from Pocock

The primitives. The invocation law. The memory shape.

**1. User-invoked vs model-invoked is a routing rule, not a UI quirk.**

/grill-with-docs, /to-spec, /to-tickets, /implement, /wayfinder, /ship-equivalents are human gates. /tdd, /code-review, /diagnosing-bugs, /prototype, grilling are things the implementer is allowed to reach for. Your Luna chair must not be allowed to start a grill or a wayfinder. That’s a product fork wearing a workflow hat.

**2. Two-axis review, parallel, no bleed.**

Pocock’s /code-review is only **Standards** and **Spec**. One subagent each. Spec asks “did we build the ticket?” Standards asks “did we make a mess?” They must not share a brain. That is cleaner than CE’s six-persona catalog for *loop-2 verify*, and cleaner than Addy’s five-axis essay for everyday diffs.

Map:

| **Pocock axisOur seat** |                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Spec                    | CE plan / ticket / suggested\_fix contract. Luna can check boxes. Jev Noul “F12 landed.” |
| Standards               | CE project-standards + Fowler smells. Terra if local-judgment.                           |
| Security / adversarial  | Still CE / OMX / Sol. Pocock does not pretend two axes cover auth. Don’t either.         |

**svg**

**3. Grill is alignment, not a spec generator.**

/grill-me can run 40–100 questions. Output is shared understanding, then /to-spec *writes* the artifact. CE brainstorm tries to do both in one skill and drifts into plan-shaped requirements. Steal the split: expensive model (or you) answers the grill; Luna types the spec; ce-doc-review / Jev score the spec.

grill-with-docs is the version that earns its keep long-term: every resolved branch updates CONTEXT.md and a tiny ADR. That’s Pocock’s compound loop. Smaller than CE docs/solutions/. Better as a glossary + decision log the scout can grep.

**4. Tracer-bullet tickets with blocking edges.**

/to-tickets produces slices you can see working, plus a DAG. Two tickets with no shared edge can run as parallel Luna/Terra workers. That is the missing link between a CE plan (U1…U18 in one file) and the exclusive-file-ownership rule we already wanted. Wayfinder is the same idea for work that does not fit one session: **decision tickets** (questions) vs **implementation tickets** (slices). A decision ticket is ralplan/POV. An implementation ticket is a fixer. Mixing them is how Luna “implements” a product fork.

**5. Diagnose is not review.**

reproduce → minimise → hypothesise → instrument → fix → regression-test. That’s ce-debug, not another persona. Cheap scout finds the repro. Sol hypothesises. Luna writes the regression test.

**6. wait-what and handoff.**

When the agent’s paragraph doesn’t land, don’t start a new grill. Re-pitch in CONTEXT.md vocabulary. When the session is dying, compact into a handoff doc — verbatim decisions, not an LLM summary. Jev keep/delete is the mechanical version of this.

**7. Prototype answers a question only an artifact can settle.**

Same job as CE /ce-prototype. One skill, not two. Keep CE’s “stop if no human will feel it.”

## What they share that we should keep, and where they fight

| **AddyPocockUs**  |                                    |                                 |                                                                                                                  |
| ----------------- | ---------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Spine             | Mandatory six phases               | Optional pipeline               | CE already has one. Don’t grow a second.                                                                         |
| Review            | Institutional five-axis + small PR | Two axes, parallel              | CE personas on pass 1. Pocock two-axis + Jev on pass 2. Addy labels (Critical/Nit/FYI) as the Jev Choice set.    |
| Alignment         | interview-me                       | grilling primitive              | One grill. Not both. Pocock’s is the better primitive (reusable, writes CONTEXT.md).                             |
| Tests             | Beyoncé + pyramid                  | /tdd red-green as model-invoked | TDD is model-invoked on implement. Pyramid is a constraint file.                                                 |
| Memory            | ADRs / docs skill                  | Issue tracker + CONTEXT.md      | Tracker for tickets. CONTEXT.md for language. CE solutions/ for post-ship lessons. Three layers, different jobs. |
| Ship              | Launch checklist                   | You still pull git              | Gate is user-invoked. Always.                                                                                    |
| Process ownership | Wants you to live in the SDLC      | Refuses to own it               | Pocock’s law. Addy’s *content* (Hyrum, Fence, liability) as constraint packs, not as a second /plan.             |

**svg**

Fight you must not referee every session: Addy wants /plan as a phase. Pocock wants /grill then tickets and no framework. CE wants /ce-plan then /ce-work. Pick **CE as the spine you already use**, graft Pocock’s invocation law and two-axis verify, graft Addy’s constraint packs and VERIFY≠REVIEW.

## Concrete grafts onto the harness

**svg**

```
Align        Pocock grilling (user-invoked)
             → CONTEXT.md + ADRs
             → CE brainstorm / to-spec only after the grill stops

Bound        Pocock to-tickets (DAG, tracer bullets)
             Addy constraints file (pyramid, Hyrum, PR size)
             Jev: is this a decision ticket or an implementation ticket?

Explore      Luna + rg + GitNexus (unchanged)
             Jev: on-question? before parent ingest

Build        CE work / Pocock implement
             model-invoked tdd
             Luna/Terra from Jev spec×difficulty

Verify       Addy /test (proof)
             Jev Noul “ticket AC green?”

Review p1    CE / OMX personas (expensive, once)
             Addy Critical/Nit/FYI as the severity vocabulary

Review p2    Pocock Standards ‖ Spec, parallel, no bleed
             Jev routes the fixer
             no second panel

Ship         user-invoked only
             Addy launch checklist + helderberto-style safe-repo
             CE compound writes the lesson
```

Steal these five files of *content*, not the slash names:

1. Addy’s anti-rationalization tables into the TDD and simplify skills.
2. Addy’s Hyrum / Fence / liability as three short constraint packs Jev can attach by artifact type.
3. Pocock’s grilling as the only interview primitive.
4. Pocock’s two-axis review as pass-2.
5. Pocock’s user-invoked / model-invoked law in whatever AGENTS.md you already have — including “user-invoked may not call user-invoked.” That stops the Luna chair from starting a wayfinder.

Skip: Addy’s full 25-skill install, Pocock’s /teach unless you’re writing a course, helderberto’s visual-review HTML unless you like annotated diffs, anyone’s second /plan.

**One line:** Addy is the *standards library* (Google practices agents skip). Pocock is the *control plane* (who is allowed to start which loop, and how memory is shaped). CE stays the *spine*. Jev stays the *clerk*. Don’t let three SDLCs into one repo.

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=cloud.google.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

182 sources

**svg**

We're adding the repo specific ones you identified + "super" versions of the lifecycle ones. Amalgamations of CE, obra superpowers, pococock and agent stills.

The balest ideas and smartest things about each into our combined take

**svg**

svg

svg

Thought for 25s

Four donors, one spine. CE keeps the loop. Superpowers donates the gates. Pocock donates control and memory. Addy donates the standards library. Everything else is a pack that attaches, not a second religion.

## What each one is actually for

| **DonorBald ideaSmart mechanismDo not steal** |                                              |                                                                                                                                       |                                                     |
| --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **CE**                                        | Each unit of work makes the next one cheaper | Living plan + structured findings + compound docs                                                                                     | A second /plan that fights Superpowers’ spec        |
| **Superpowers**                               | Skills are **mandatory**, not suggestions    | HARD-GATE before code. Fresh subagent per task. Two-stage review. Zero-context plans. Hypothesis before edit                          | “Specs are the only thing that matters” as theology |
| **Pocock**                                    | You own the process                          | User-invoked vs model-invoked. User-invoked cannot call user-invoked. CONTEXT.md + tracer-bullet DAG. Decision tickets ≠ impl tickets | /teach, a parallel pipeline                         |
| **Addy**                                      | Agents skip the senior-engineer parts        | Constraint packs (Hyrum, Fence, Beyoncé, pyramid, liability). VERIFY ≠ REVIEW. Critical/Nit/FYI. Anti-rationalization tables          | Six slash commands as a second SDLC                 |

**svg**

## Invocation law (Pocock, non-negotiable)

Write this in AGENTS.md once.

- **User-invoked:** align, bound, wayfind, ship, compound. Only a human starts these.
- **Model-invoked:** scout, tdd, diagnose, standards-review, spec-review, prototype, attach-pack.
- A user-invoked skill may call model-invoked skills.
- A user-invoked skill may **not** call another user-invoked skill. That is how a Luna chair starts a product fork.
- Domain packs auto-attach by artifact type. They never start a phase.

Jev sits in front of every spawn: Choice of tier + Noul “is this a decision ticket or an impl ticket?” Fail closed on low confidence.

## The super lifecycle (seven skills, not twenty)

Names are ours. Behavior is stolen.

### 1. align (user-invoked) — grill + HARD-GATE

From Pocock grilling + Superpowers brainstorming + CE brainstorm + Addy interview-me.

- One question at a time. Prefer multiple choice. Propose 2–3 approaches with tradeoffs, not one “recommendation.”
- Numbers without a source get a reason or get dropped (Addy).
- **HARD-GATE:** no files written except CONTEXT.md / a tiny ADR until the human says the design is approved (Superpowers).
- Writes **language**, not a 40-page PRD: glossary, avoided synonyms, 3–7 ADRs. That’s Pocock’s compound loop in miniature.
- If the session produces a fork the human can’t answer, emit a **decision ticket** (wayfinder), not an impl ticket.

Chair: you + Sol/Astra. Luna types the glossary. Jev scores “is this still open?”

### 2. bound (user-invoked) — spec + tickets + constraints

From CE plan + Superpowers writing-plans + Pocock to-spec / to-tickets + Addy /constraints.

Two artifacts, different jobs:

**Spec** — destination. Problem, non-goals, acceptance, test seams. No file paths unless a prototype already settled a decision (Pocock). Run ce-doc-review on it. Coherence = Luna. Product-lens = Sol. Decision items bounce back to align.

**Tickets** — tracer-bullet DAG. Each ticket is  one visible slice, exclusive file ownership, blocking edges, named verification. Superpowers’ zero-context rule: a Luna worker with an empty window must be able to do it. If you cannot write the ticket that way, it is still a decision ticket.

**Constraints file** (once per repo): PR size \~100 LOC when possible, pyramid 80/15/5, Beyoncé rule, Hyrum on public surfaces, Chesterton on deletes. Jev attaches the relevant pack by artifact. You do not paste Google’s book into every prompt.

### 3. scout (model-invoked) — cheap map

Unchanged from last turn. Luna + rg + GitNexus impact + Graphify path. Turn cap 4. Return file\:line, confirmed vs assumed, files not to touch. Jev Noul each hit “on-question?” before the parent ingests. Scout cannot edit. Scout cannot conclude.

### 4. build (model-invoked, started by user saying go) — SDD + TDD

From Superpowers SDD / executing-plans + Pocock implement + CE ce-work.

Default path:

**svg**

```
for each ready ticket (no open blockers):
  worktree          (Superpowers)
  implementer       Luna or Terra from Jev spec×difficulty
                    TDD mandatory: red before green (Addy Beyoncé + Superpowers TDD)
  spec-reviewer     fresh subagent, spec axis only (Pocock + Superpowers stage 1)
  standards-reviewer fresh subagent, standards axis only (Pocock + Superpowers stage 2)
  if either fails:  one retry up the model ladder, new reviewer (told nothing of the last try)
  commit            one question per commit (Superpowers)
```

Independent tickets run in parallel. Shared files do not. That is the DAG doing work.

executing-plans (batch + human checkpoint) is the fallback when you cannot spawn, or the blast radius is high. Not the default.

Anti-rationalization table lives **in this skill**, stolen from Addy: “tests are slow,” “this is just a spike,” “I’ll refactor after.” Written rebuttals. Agents love those excuses.

### 5. verify (model-invoked) — proof, not opinion

From Addy VERIFY ≠ REVIEW + Superpowers verification-before-completion.

- Named tests from the ticket, typecheck, the probe the ticket named.
- Jev Noul “AC green?” against the test output, not against the implementer’s story.
- No “looks good.” No persona. If the proof is missing, the ticket is not done. Beyoncé.

### 6. review (user-invoked for pass 1; model-invoked for pass 2)

Two different skills pretending to be one word. Split them in the file.

**Pass 1 — panel** (CE / OMX, expensive, once).

Correctness, security, adversarial, plus stack packs that Jev/attach-pack selected. Structured findings: severity **Critical / Important / Nit / FYI** (Addy labels, mapped to P0–P3), spec\_quality {patch, sketch, smell}, difficulty {mechanical, local-judgment, cross-cutting}, evidence, suggested\_fix when it exists. Synthesis only worsens grades. Self-review forbidden.

**Pass 2 — two-axis delta** (Pocock + Superpowers).

Spec reviewer and standards reviewer on the *fix diff only*, against the persisted finding list. Jev Noul “F12 gone?” New findings need a novelty sentence or they drop. Max two cycles. Security/data/API leftovers escalate to Sol, they do not get a third Luna pass.

Nits never wake Astra. FYI never becomes a ticket.

### 7. ship (user-invoked only)

From Addy launch checklist + Superpowers finishing-a-development-branch + CE compound + helderberto safe-repo.

- disable-model-invocation: true. Always.
- Gate: verify green + sensitive-data scan on the diff + constraints check (Hyrum on public surface, Fence on deletes).
- Then commit/PR however you already do it.
- Then **compound**: write the lesson into docs/solutions/ (CE) *and* update CONTEXT.md if a term moved (Pocock). Next align is cheaper. That is the whole point of CE.

## Repo-specific packs (auto-attach, never a phase)

These are Addy’s domain skills, rebuilt as short constraint packs + CE personas. Jev Choice picks which ones load from the diff/spec.

| **PackAttaches whenBald ruleReviewer it feeds** |                                  |                                                           |                                   |
| ----------------------------------------------- | -------------------------------- | --------------------------------------------------------- | --------------------------------- |
| pack-api                                        | public interface, proto, OpenAPI | Hyrum: every observable will be depended on → gated\_auto | correctness + a contract lens     |
| pack-delete                                     | removals, deprecations           | Chesterton + code-as-liability                            | standards + human if unexplained  |
| pack-test                                       | new behavior                     | Beyoncé + 80/15/5                                         | test-effectiveness lens           |
| pack-secure                                     | auth, payments, secrets, tenancy | fail closed, no Luna on the patch                         | security + adversarial            |
| pack-frontend                                   | JSX/CSS/routes                   | a11y + i18n if user-visible strings                       | optional CE frontend persona      |
| pack-data                                       | schema, migrations               | irreversible → Sol, launch-checklist flags                | Sol / human                       |
| pack-perf                                       | hot path, bundle, query          | measure before rewrite (Addy /webperf)                    | only if the ticket named a budget |
| pack-deps                                       | lockfile / manifest              | supply chain, no surprise majors                          | deps audit, Luna can apply pins   |

**svg**

Do not load all eight. Attach from the artifact. That is Addy’s auto-activation without the 25-skill dump.

## Supporting primitives (not lifecycle)

Keep these small and model-invoked unless noted:

- diagnose — Superpowers systematic-debugging: hypothesis **before** edit. Scout finds the repro. Sol states the hypothesis. Luna writes the regression test. Not a review.
- prototype — CE + Pocock. One question, throwaway, stop if no human will feel it.
- handoff — Pocock. Verbatim decisions, Jev keep/delete on the transcript, no LLM summary.
- wait-what — Pocock. Re-pitch in CONTEXT.md words. Do not start a new align.
- wayfind — user-invoked. Decision-ticket map for work that does not fit one session. Resolving a decision ticket is align, not build.

## Model / Jev seating on this spine

**svg**

```
align / wayfind / product Decision     you + Astra/Sol
bound (spec)                           Sol writes, Luna types, ce-doc-review
bound (tickets)                        Luna once the spec is approved
scout                                  Luna + tools, Jev filters
build implementer                      Luna if patch+mechanical
                                       Terra if sketch+local
                                       Sol/Astra if cross-cutting / pack-secure / pack-data
build spec-reviewer                    cheap, can be Luna or Jev Noul
build standards-reviewer               Terra default
verify                                 tests + Jev
review pass 1                          expensive specialists
review pass 2                          two-axis + Jev
ship / compound                        you pull ship; Luna writes the lesson
```

## What we drop so this stays one religion

- Addy’s /spec /plan /build /test /review /ship as commands. Same boxes, CE names.
- Superpowers “the code does not matter.” The code is the battleground (Pocock). The spec is the contract. Both exist.
- CE six-persona fan-out on every subsequent loop.
- Pocock /teach.
- A Luna chair that can start align or ship.
- Installing all four repos side by side and hoping descriptions route correctly. They will fight.

## The one-page loop

**svg**

```
you ──align──► CONTEXT.md + ADRs          HARD-GATE
      │
      bound ──► spec (reviewed) + ticket DAG + constraints
      │
      scout ──► dossier (Jev-filtered)
      │
      build ──► worktree + TDD + fresh implementer
      │           spec-review ‖ standards-review
      │           one retry up the ladder
      verify ──► named tests + Jev
      │
      review1 ─► CE/OMX panel, once
      fix     ─► Luna/Terra from spec×difficulty
      review2 ─► two-axis delta, max twice
      │
you ──ship──► gate + PR
      compound ► docs/solutions + CONTEXT.md
```

That is the amalgamation: Superpowers’ gates, Pocock’s control plane, Addy’s packs, CE’s spine and findings contract, Jev as the clerk on every spawn. Seven lifecycle skills, eight attachable packs, five primitives. If a new skill cannot say which of those it is, it does not ship.

[image](https://www.google.com/s2/favicons?domain=augmentclaude.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=joanmedia.dev\&sz=256)

[image](https://www.google.com/s2/favicons?domain=claudeskills.info\&sz=256)

92 sources

**svg**

The ce six persona is useful on the first review

**svg**

svg

svg

Thought for 13s

Yes. Pass 1 is the CE panel. Two-axis and Jev do not get to replace it.[**⁠Raw.githubusercontent**](https://raw.githubusercontent.com/EveryInc/compound-engineering-plugin/main/docs/guides/ce-code-review.md)

What people call “the six” is CE’s **always-useful first slice**, not the whole catalog. Current CE is layered, not a fixed six: correctness is the only true always-on; project-standards fires when a standards file exists; testing, maintainability, agent-native, and learnings fire when the diff earns them. A small behavioral change often lands at that six-ish set. Security, adversarial, API-contract, data-migration, performance, reliability, and stack personas are **conditionals on top**, selected from the diff — same idea as Addy’s attach-packs.[**⁠Raw.githubusercontent**](https://raw.githubusercontent.com/EveryInc/compound-engineering-plugin/main/skills/ce-code-review/references/select-and-route.md)

Lock it this way:

**Pass 1 — CE panel, once, on the full first diff.**

Independent subagents. No shared scratchpad. Structured findings only. Report-only unless you said apply.

Minimum set on any real feature diff:

| **SeatWhy it exists on pass 1What two-axis cannot substitute** |                                                      |                                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| correctness                                                    | Intent vs code, edge cases, state, error paths       | Spec-review only checks the *ticket*, not “this will break at nil”  |
| testing                                                        | Behavioral change with no test work (CE’s 5th check) | Beyoncé in verify is proof of *named* tests, not missing ones       |
| maintainability                                                | Coupling / abstraction debt you will eat next week   | Standards-reviewer only checks the constraints file                 |
| project-standards                                              | Your CODING\_STANDARDS.md, cited rule by rule        | Empty if no file; it must not invent taste                          |
| security                                                       | When auth, input, tenancy, or public surface moved   | Two-axis will rubber-stamp a clean ticket that is still exploitable |
| adversarial                                                    | When the diff is big or money/auth/data/API          | Correctness is a builder brain. This one tries to break it          |

**svg**

Then attach from the artifact, same as the packs: API-contract with pack-api, data-migration with pack-data, performance only if a budget exists, stack persona if the files match, learnings if docs/solutions/ has hits. Do not spawn the whole catalog on a 20-line typo fix. CE already shrinks for small low-risk diffs — keep that shrink.

Rules that make the six *useful* instead of loud:

- Each persona returns CE findings: P0–P3 (or Critical/Important/Nit/FYI), confidence anchor, spec\_quality, difficulty, evidence, suggested\_fix when it has one.
- Synthesis may only **worsen** grades. Two personas agreeing on a nit does not promote it.
- Security at anchor 50 still files — CE’s exception. Do not let Jev suppress that.
- Self-review forbidden. Implementer does not sit on this panel.
- Expensive models on security / adversarial / data. Luna may type correctness/testing if Jev says the diff is local. Do not put Luna on security.

**Pass 2 is not a second panel.** After fixes:

**svg**

```
persisted finding list
  → spec-reviewer   (did F12 land?)
  → standards-reviewer (did we make a mess?)
  → Jev Noul per finding
```

New findings on pass 2 need a novelty sentence or they drop. Security leftovers escalate to Sol, they do not get another six-way fan-out. Max two fix cycles.

That is the division of labor: CE personas *discover* on the first thorough pass. Pocock two-axis *closes* tickets. Addy packs *decide who extra sits* on pass 1. Jev *routes the fixer* and *verifies landed*. Drop any of those and you either miss the first-pass bugs the six are for, or you pay the six again for a two-line patch.

[image](https://www.google.com/s2/favicons?domain=raw.githubusercontent.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=raw.githubusercontent.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=raw.githubusercontent.com\&sz=256)

56 sources

**svg**

Let's select the most useful skills from each to keep . Beyond our "super" amalgamations.

There's fantastic ideas on each that can come in handy (like CE compound)

**svg**

svg

svg

Thought for 33s

The seven supers own the default loop. These are the extras that still earn a skill file because they do a **different job**. If the spine already does it, it is folded, not kept.

## Never cut

These are the distinctive bets. Lose one and you lose that pack’s reason to exist.

| **SkillFromJob the spine does not doWhen you reach for it** |                                                   |                                                                                                                                                       |                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **compound** + **compound-refresh**                         | CE                                                | Write one lesson per run into docs/solutions/. Refresh is Keep / Update / Consolidate / Replace / Delete — never batch five morals into one slop file | ship *calls* this. You also run it after a nasty debug or a review that surprised you                               |
| **ideate**                                                  | CE                                                | Six frames, generate-all-then-critique, adversarial cut                                                                                               | **Before** align. Align assumes you already picked a direction                                                      |
| **pov**                                                     | CE                                                | Project-grounded verdict, optional oracle. Read-only. Can kill a plan                                                                                 | “Should we.” Not “how.” Not a code review                                                                           |
| **bakeoff**                                                 | CE                                                | Independent competing implementations, then pick with evidence                                                                                        | When align produced two live approaches and arguing won’t settle it                                                 |
| **doc-review**                                              | CE                                                | Findings on a spec / ADR / CONTEXT.md — coherence vs product-lens                                                                                     | bound calls this on the spec. Do not send a spec through review                                                     |
| **receiving-review**                                        | Superpowers (+ CE resolve-pr-feedback)            | Existing comments are *claims*. Walk Apply / Defer / Skip with evidence                                                                               | Human or bot comments on a PR. This is not pass-1 and not pass-2                                                    |
| **diagnose**                                                | Superpowers systematic-debugging + Pocock         | Hypothesis **before** edit. 3 strikes → architecture, not another patch                                                                               | Bug / flake / “it doesn’t do that.” Not a review                                                                    |
| **improve-architecture**                                    | Pocock                                            | Periodic shallowness survey, pick one deepening, then grill it                                                                                        | Outside any feature loop. Nothing else hunts “this module is a bag of methods”                                      |
| **doubt-driven**                                            | Addy                                              | CLAIM → EXTRACT → DOUBT → RECONCILE on a fresh context                                                                                                | Irreversible or cross-module claims *before* they harden. Different from pass-1 (after the diff) and pov (adoption) |
| **simplify**                                                | Addy code-simplification + CE noslop + Chesterton | Delete / shrink with Fence in force                                                                                                                   | After build, before pass-1, or as its own pass on a muddy module                                                    |

**svg**

compound is the one you named. Keep it as a skill, not a paragraph at the end of ship. The artifact and the “one lesson, named failure, next time cheaper” rule *are* Compound Engineering.

## Keep if you actually live that way

Situational. High leverage when the precondition is true; dead weight otherwise.

| **SkillFromPreconditionNotes**            |             |                                                         |                                                                                         |
| ----------------------------------------- | ----------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **research**                              | Pocock      | You need cited *external* primary sources               | Scout is repo-local. This is the web/docs cousin, background agent, writes a cited note |
| **source-driven**                         | Addy        | Touching a framework / SDK you should not memory-code   | Model-invoked attach when the pack would have fired anyway. Cite the official page      |
| **deprecate**                             | Addy        | Removing or migrating a public surface                  | Bigger than pack-delete. Sequence, dual-run, Hyrum                                      |
| **explain**                               | CE          | Someone (or a future agent) needs how/why with evidence | Teaching artifact. Not pov, not wait-what                                               |
| **triage**                                | Pocock      | You run a real tracker with roles/labels                | State machine on issues. Skip if issues are just a graveyard                            |
| **strategy** / **product-pulse**          | CE          | You have a product with standing anchors                | Rare. Do not install for a library weekend                                              |
| **writing-skills**                        | Superpowers | You will author more skills                             | Meta. Only if this repo *is* the skill pack                                             |
| **codebase-design** + **domain-modeling** | Pocock      | You want the vocabulary                                 | Keep as **references** align / improve-architecture load. Not slash commands            |

**svg**

## Folded on purpose (do not keep a second slash)

Already inside the supers. A leftover /ce-plan next to bound is how two priests start.

- CE brainstorm / plan / work / code-review / debug / prototype / handoff / worktree
- Superpowers using-superpowers, writing-plans, executing-plans, SDD, TDD, worktrees, verification-before-completion, finishing-a-branch, dispatching-parallel-agents
- Pocock grill, to-spec, to-tickets, implement, tdd, code-review, ask-matt, wayfinder, prototype
- Addy spec / plan / build / test / review / ship / interview-me / constraints / TDD / git / ci-cd / docs-adrs

wayfinder, prototype, handoff, wait-what stay as the **primitives** we already listed, not as a fifth catalog.

## Do not keep

- /lfg and any “run the whole company” button
- /teach
- Visual-review HTML unless you like annotated diffs
- 17 CE personas as individually invoked skills — they are pass-1 machinery
- Addy’s /build auto as default
- Installing all four plugins side by side and hoping descriptions route

## How they sit next to the spine

**svg**

```
ideate? ──► align ──► bound ──► scout ──► build ──► verify ──► review1 ──► fix ──► review2 ──► ship
              │          │         │         │                              │                    │
             pov        doc-review source-   simplify                       receiving-review     compound
             bakeoff    doubt-driven driven                                 diagnose             compound-refresh
                        research                                            (if it's a bug)
                                                                            deprecate

outside the loop, on purpose:
  improve-architecture
  explain
  strategy / pulse
  triage
```

Invocation rule is the same as the spine:

- User-invoked: compound, ideate, pov, bakeoff, receiving-review, improve-architecture, doubt-driven, deprecate, explain, triage, strategy
- Model-invoked attach: source-driven, simplify
- doc-review is invoked by bound, not by a Luna chair
- None of these may start align or ship

If the rack still feels fat, cut in this order: strategy / pulse → triage → research → explain → writing-skills. Stop before compound, pov, receiving-review, diagnose, improve-architecture, doubt-driven, bakeoff. Those are the ideas that are actually fantastic, not just well-named.

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=skills.sh\&sz=256)

53 sources

**svg**

We're gearing towards automation. We need to design the autopilot skill. Which uses the strongest models astra and fable as the user. These models take on the role of the user and supervise the SDLC we've built. They only reach out when they truly can't get by without our input.

**svg**

svg

svg

Thought for 18s

Autopilot is a **proxy user**, not a second pipeline. Astra and Fable sit in *your* chair and run the SDLC we already built. They do not invent a /lfg spine. Merge, production, and anything irreversible stay yours unless you granted that run.[**⁠Raw.githubusercontent**](https://raw.githubusercontent.com/EveryInc/compound-engineering-plugin/main/docs/guides/lfg.md)

## What it is

**svg**

```
you  ──invoke autopilot──►  supervisor pair (Astra ‖ Fable)
                                │
                                │  plays USER on: align answers, spec/ticket
                                │  approval, review triage, "go" on build,
                                │  ship-to-PR, compound lesson
                                │
                                ▼
                         the seven supers
                         + keepers (pov, bakeoff, diagnose…)
                                │
                                ▼
                         open PR + ledger
                         or a single escalation to you
```

- **User-invoked only.** disable-model-invocation: true. Luna/Terra/Sol may not start it.
- **Two supervisors, no shared scratchpad.** Same question, independent answers. Agreement + high confidence → they act as you. Disagreement → you. That is the pov oracle rule applied to the chair.
- **They never implement.** Implementers stay Luna/Terra/Sol from Jev. A supervisor that also writes the patch is self-review. Banned.
- **Default end state is an open PR, not a merge.** Same as current lfg. Merging is a grant you opt into per run.[**⁠GitHub**](https://github.com/everyinc/compound-engineering-plugin/blob/main/skills/lfg/SKILL.md)

Fable on Claude, Astra on GPT. Cross-family on purpose. Same-lab pair will share blind spots.

## Authority budget

Write this as a file the run cannot edit (docs/agents/autopilot-charter.md or equivalent). The pair may only spend what the charter names.

**They may decide (recorded ruling, work continues)**

| **GateAllowed proxy-user act** |                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| align questions                | Pick among the 2–3 options the grill already listed, if all options stay inside stated non-goals                          |
| bound spec                     | Approve if doc-review has no open Decision items and both supervisors accept the spec                                     |
| Tickets                        | Approve a DAG that is zero-context and exclusive-file. Split a ticket that is still a product fork                        |
| build go                       | Start SDD on **implementation tickets only**                                                                              |
| Review triage                  | Apply patch + mechanical + ready\_luna. Defer nits/FYI. Skip smells                                                       |
| Pass-2                         | Close a finding Jev + spec-reviewer both say landed                                                                       |
| ship                           | Commit, push, open PR. Watch CI. Repair *test* failures inside the cap                                                    |
| compound                       | Write one lesson if a named failure actually happened                                                                     |
| Plan conflicts                 | Non-catastrophic ambiguity: record a ruling against the spec and continue (Superpowers learned this the 9-hour-stall way) |

**svg**

**They must escalate (stop, one question, wait)**

Anything that is a **decision ticket** wearing an impl ticket’s clothes, plus:

1. Product fork — two approaches still alive after grill, bakeoff not run or bakeoff split
2. Public API / protocol / schema that existing clients can observe (Hyrum)
3. Auth, tenancy, payments, secrets, personal data
4. Irreversible data: migration, delete, backfill, drop
5. Scope expanded past the original request by more than a missing test / rename
6. pov would have been the right skill
7. Pass-1 **Critical** that is not a mechanical patch
8. Security persona finding at any confidence (CE’s P0-at-50 rule survives autopilot)
9. Delete with no Chesterton answer
10. Merge to default, deploy, prod secret, db push, force-push, history rewrite
11. Third fix cycle on the same finding
12. Supervisors disagree, or either confidence is below the charter threshold
13. Jev ready\_for\_luna low **and** the ticket is not clearly Terra-shaped either
14. Cost/time cap hit
15. The work source is missing — no approved spec, no diagnose\:fixed

Recommendation is not authorization. A beautiful Astra rationale is still a recommendation until the charter says that class is in budget.[**⁠Humanlayer**](https://humanlayer.systems/index-en.html)

## The run

**svg**

```
1. Charter + caps
   budget, max hours, max $ / tokens, merge?=no, deploy?=no
   work source: request | plan path | bug repro

2. Route
   not a code change → run the keeper that owns it (explain / pov / ideate)
   end. no branch.
   bug with repro → diagnose first; only `fixed` is a work source
   feature → align (pair answers grill) → bound → doc-review
             open Decision item → escalate, do not “approve anyway”

3. Build
   scout → Jev filter → SDD
   pair is the user at checkpoints, not the implementer
   verify is tests + Jev, not a vibe from Astra

4. Review
   pass-1 CE panel as designed
   pair triages with the authority table
   Critical / security / open → escalate
   else fix loops (max 2) with pass-2 two-axis + Jev

5. Ship
   open PR, CI watch, repair test failures only
   compound one lesson
   ledger dumped on the PR

6. Stop
   DONE | ESCALATE | CAP
```

Steal from lfg: nothing is implemented without a work source verified this run. Steal the stop-and-verify between phases. Do not steal “never pause.” Pausing *is* the product.[**⁠Raw.githubusercontent**](https://raw.githubusercontent.com/EveryInc/compound-engineering-plugin/main/docs/guides/lfg.md)

## How the pair actually “is the user”

Every time the spine would have asked you:

1. Chair publishes a **decision card** (options, evidence, deadline = this turn).
2. Astra and Fable answer in isolation: choice, rationale ≤ 8 lines, confidence, would\_escalate?.
3. Jev scores the card: in\_charter? decision\_vs\_impl novelty. Jev cannot approve. It can only say “this card is the kind they are allowed to answer.”
4. Tally:
   - same choice, both above threshold, Jev in\_charter → act, write the ruling into the ledger
   - else → escalate with the card + both answers + the action they *would* have taken

No third supervisor to break ties. Tie = you.

They may call keepers as you would: pov before they spend budget on a “should we,” bakeoff when two impls are cheap enough to build, doubt-driven on a cross-module claim, doc-review on their own spec (different models than the authors). They may not call ideate to silently widen the request.

## Escalation contract

One message to you. Not a diary.

**svg**

```
NEED:          <the one question>
OPTIONS:       A / B / C (or Approve / Reject / Narrow)
TRIED:         <what the pair already ruled out, with evidence>
DEFAULT:       <what they will do if you say "just pick">
CHARTER:       which rule triggered (fork | hyrum | security | disagree | cap | …)
BLOCKED:       spec § / ticket / finding id
```

Until you answer: no new tickets, no ship, no pack-delete. Scout and verify may keep running. That is the only background allowed.

If you do not answer before the cap: status CAP, PR draft if one exists, ledger attached, nothing merged.

## Caps (or it becomes /lfg with extra steps)

Per run, in the charter:

- Wall clock and token/$ budget
- Max align turns the pair may answer before they must escalate anyway (grill cannot be 100 questions to itself)
- Max tickets
- Max fix cycles: 2
- Max CI repair loops: 3, tests only
- No new dependencies without you
- No persona-panel replay on pass 2
- Supervisor context is a **dossier** (spec, ticket DAG, findings list, last ruling), not the implementer transcript

Handoff / Jev keep-delete applies to the supervisor window the same way it applies to implementers. A 200k “I am the user” transcript will rubber-stamp itself.

## Model seating under autopilot

| **RoleWho**                   |                                                                      |
| ----------------------------- | -------------------------------------------------------------------- |
| Proxy user (pair)             | Astra ‖ Fable only                                                   |
| Align typist / ticket clerk   | Luna                                                                 |
| Scout                         | Luna + tools, Jev filter                                             |
| Implementer                   | Luna / Terra / Sol from Jev — **never** the sitting supervisor       |
| Pass-1 security / adversarial | Sol or the *other* frontier, not the one that just approved the spec |
| Pass-2 spec / standards       | cheap + Jev                                                          |
| Clerk                         | Jev                                                                  |
| Merge / deploy / secrets      | you                                                                  |

**svg**

If Fable approved the spec, Fable does not sit security on that diff. Cross the pair.

## Failure modes this design is for

| **FailureGuard**                                       |                                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| Supervisor writes the code, then approves it           | Implementer ≠ pair                                                   |
| Pair agrees on a product fork because they share taste | Cross-family + disagreement escalates + pov required for “should we” |
| lfg never-pause rubber stamp                           | Escalation list is hard. Charter is not editable mid-run             |
| 9-hour stall on a naming question                      | Naming is in budget. Record ruling, continue                         |
| Scope creep via “while we’re here”                     | Rule 5. New goal = new autopilot run or escalate                     |
| Jev used as a judge of truth                           | Jev only classifies the *card*. Pair still needs to agree            |
| Cheap model starts autopilot                           | disable-model-invocation                                             |
| Merge because CI is green                              | Merge is a grant, not a default                                      |
| Compound slop                                          | One lesson, only if a named failure happened                         |

**svg**

## What we refuse from lfg

- “Never pauses for approval”
- Same session planning *and* implementing *and* reviewing with one brain
- Autofix of ineligible findings
- Browser-video-DONE theatre as a success definition
- Starting from a vibes prompt with no work-source gate

Success is: **an open PR whose ledger shows every proxy-user ruling, or a single clean escalation.** Not “the agent finished.”

**One line:** Autopilot is a dual-frontier user with a spending cap. The SDLC does not change. Who is allowed to press the user-invoked buttons does — and the charter is the only reason that is safe.

[image](https://www.google.com/s2/favicons?domain=github.com\&sz=256)

[image](https://www.google.com/s2/favicons?domain=claudemarket.ai\&sz=256)

[image](https://www.google.com/s2/favicons?domain=eliteai.tools\&sz=256)

76 sources

**svg**

iframe

Hand GPT Luna to Astra - Grok