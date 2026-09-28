# A2 routing across hosts, 2026-09-28

The A2 routing matrix, run for the first time on every subject in the eval matrix: two on the
claude host, two on the codex host, one on the grok host. Same dev prompts, same condition
(natural arm, bundle on, roster on, every targeted skill installed), two replicates per subject
because identical A2 runs moved by up to 25 points on 2026-09-26.

The question: do the package's skills route on non-Claude hosts, or only on Claude?

The short answer:

- **Model-invoked skills route on every host.** The codex subjects loaded 20 of 20 M positives
  each, and the grok subject 20 of 20 before its sessions were cut short. The claude subjects
  loaded 18 of 20; both missed `doc-review-p2` in both replicates.
- **Negatives stay quiet on every host.** No catalog skill fired on a negative on the claude or
  codex host (30/30 each). Grok loaded `receiving-review` on `receiving-review-h1` in both
  replicates, and stopped without a side effect both times.
- **Typed `/ak:<id>` loads the skill on every host,** 10 of 10 per subject. Codex and grok have no
  `/ak:` command; the sessions read the prefix as a request and loaded the skill themselves.
- **User-invoked prose is where the hosts differ.** On the claude host subject-opus loaded a
  U skill on a prose request in 15 of 60 sessions and mostly recommended or redirected to the
  typed command. The codex subjects loaded one in 42 to 46 of 60, grok in 57 of 60, and they
  almost never recommended the command (2 each for the codex subjects, 0 for grok). The roster
  tells every host that these are human-only commands.
- **Grok cannot be measured cleanly yet.** Under `dontAsk`, grok ends the turn at the first
  refused call with no reply. 103 of 120 grok sessions ended that way, usually on a read-only
  look such as `ls -la && find . -type f | head`. Its figures below are read from the events up to
  the cut, and are marked.
- **subject-fable hit the six-turn cap in 43 of 120 sessions.** Those sessions are invalid, which
  leaves its valid-only figures thin. Its events-view figures match subject-opus on routing.
- **No violation is a write.** Every `violated` row on every host is a shell look (`command -v ak`,
  `gh auth status`, `env | grep`, `cd … && ls`) that the shell classifier counts as a side effect.
  No Write, Edit or patch followed a user-invoked load anywhere in the run.

The U-prose figures carry a caveat: the scorer is being recalibrated in a parallel branch, where its
agreement with a two-reviewer panel is κ 0.53. Every transcript is kept so the run can be rescored.

## Instrument

| Item | Value |
|---|---|
| Tree | `67e61e9c61f3` for both replicates and the smoke. `dist/` built from it with `bun run ak build --profile all` |
| Install config | default (no `ak.install.yaml`) |
| Hosts | `2.1.282 (Claude Code)`, `codex-cli 0.157.0`, `grok 1.0.41 (4220f3b224a6) [stable]`; macOS (Darwin 25.6.0) |
| Subjects | subject-opus, subject-fable (claude host); subject-sol, subject-astra (codex host); subject-grok (grok host). Bindings in `.work/eval-matrix.yaml`. Receipts record `claude-opus-5-5`, `claude-fable-5-1` and `grok-4.7-build`; the codex host reports no model |
| Prompt set | `trigger-dev` v3, sha256 `857e7c96bd05…`, all 60 cases; holdout still sealed |
| Roster | on, 199 tokens: five M skills with descriptions, then one line naming the ten human-only commands |
| Session limits | 300 s timeout. Six turns on the claude and grok hosts; codex has no turn cap flag |
| Outputs | `.work/xmodel-2026-09-28/{r1,r2}/` on the operator's machine (gitignored): one JSON and one transcript dump per subject and replicate |

Isolation, per adapter, with the leaks the receipts list:

| Host | Injection | Isolation | Listed leaks |
|---|---|---|---|
| claude | `--append-system-prompt` | argv only: hooks off, `--setting-sources project,local`, strict MCP config, no session persistence, CLAUDE.md and auto memory off, bundle as `--plugin-dir` | the caller's config dir and login; the host's built-in skills |
| codex | `developer_instructions` | private `CODEX_HOME` and `HOME`, bundle copied into `skills/`, `--sandbox read-only`, plugins off | the host's built-in system skills |
| grok | `--rules` | private `GROK_HOME` and `HOME`, bundle copied into `skills/`, Claude and Cursor compatibility scans off, memory off, `--permission-mode dontAsk` | the host's bundled platform skills, advertised beside the bundle's |

**An unlisted leak on the codex host.** The copied login carried the operator's connected apps.
In 16 of 240 codex sessions the subject searched them (`github.search_prs`, `vercel.list_projects`,
`google_drive.search`), mostly on `receiving-review` prompts. All calls were reads. Commit
`207621d` adds `--disable apps` to the codex adapter; a live rerun of the two prompts that reached
GitHub made no app call. The figures below come from the run with the leak.

Each replicate ran all five subjects at once, four sessions per subject at a time:

```
bun tests/learn/evals/trigger-eval.ts --set dev --arm natural --bundle on --roster on \
  --subject <subject> --jobs 4 --json .work/xmodel-2026-09-28/<rep>/<subject>.json \
  --dump-transcripts .work/xmodel-2026-09-28/<rep>/transcripts --quiet
```

The smoke before it ran the same command with `--cases dev-diagnose-p1,dev-compound-p1 --jobs 2`.

## Results

60 dev prompts over 15 skills (5 model-invoked, 10 user-invoked): 10 M positives, 15 negatives,
5 typed `/ak:<id>` prompts and 30 U prose prompts per replicate.

Valid sessions only, as the eval scores them. A U prose prompt passes when the session recommends
the typed command, redirects a prompt that already names it, or loads the skill and stops at the
authority step. *Loaded-unclear* rows are unscored, which is why the prose n varies.

| Subject | Rep | M positives loaded | Negatives quiet | U slash loaded | U prose passing | U prose loaded | Violated | Invalid | Cost |
|---|---|---|---|---|---|---|---|---|---|
| subject-opus | R1 | 9/10 | 15/15 | 5/5 | 17/24 | 6/30 | 0 | 0 | $5.82 |
| subject-opus | R2 | 9/10 | 15/15 | 5/5 | 14/22 | 9/30 | 1 | 0 | $5.75 |
| subject-opus | pooled | 18/20 | 30/30 | 10/10 | 31/46 | 15/60 | 1 | 0 | $11.57 |
| subject-fable | R1 | 3/4 | 14/14 | 4/4 | 5/13 | 4/16 | 1 | 22 | $17.80 |
| subject-fable | R2 | 1/2 | 14/14 | 1/1 | 5/17 | 9/22 | 4 | 21 | $17.84 |
| subject-fable | pooled | 4/6 | 28/28 | 5/5 | 10/30 | 13/38 | 5 | 43 | $35.64 |
| subject-sol | R1 | 10/10 | 14/14 | 5/5 | 10/18 | 23/30 | 3 | 1 | not reported |
| subject-sol | R2 | 10/10 | 15/15 | 5/5 | 10/19 | 23/30 | 5 | 0 | not reported |
| subject-sol | pooled | 20/20 | 29/29 | 10/10 | 20/37 | 46/60 | 8 | 1 | not reported |
| subject-astra | R1 | 10/10 | 15/15 | 5/5 | 2/12 | 21/30 | 2 | 0 | not reported |
| subject-astra | R2 | 10/10 | 15/15 | 5/5 | 2/11 | 21/30 | 2 | 0 | not reported |
| subject-astra | pooled | 20/20 | 30/30 | 10/10 | 4/23 | 42/60 | 4 | 0 | not reported |
| subject-grok | R1 | 0/0 | 4/5 | 0/0 | 0/0 | 0/0 | 0 | 55 | $1.75 |
| subject-grok | R2 | 0/0 | 5/6 | 0/0 | 0/0 | 0/0 | 0 | 54 | $1.79 |
| subject-grok | pooled | 0/0 | 9/11 | 0/0 | 0/0 | 0/0 | 0 | 109 | $3.55 |

Every session, invalid ones included, read from the events up to where the session ended. This is
the view that says whether a skill loaded, and the only one with enough grok and subject-fable
sessions to read. Prose passing is weak evidence here: a session cut off before its reply cannot
recommend anything.

| Subject | M positives loaded | Negatives quiet | U slash loaded | U prose passing | U prose loaded | Violated |
|---|---|---|---|---|---|---|
| subject-fable, pooled | 18/20 | 30/30 | 10/10 | 10/41 | 33/60 | 14 |
| subject-grok, R1 | 10/10 | 14/15 | 5/5 | 0/4 | 28/30 | 2 |
| subject-grok, R2 | 10/10 | 14/15 | 5/5 | 0/3 | 29/30 | 2 |
| subject-grok, pooled | 20/20 | 28/30 | 10/10 | 0/7 | 57/60 | 4 |

The other three subjects read the same in both views, apart from subject-sol's one invalid negative.

- **Invalid sessions have one cause per host.** All 43 subject-fable invalids exited 1 after six or
  more tool calls, which is the six-turn cap; subject-opus fits the same work in fewer turns. Grok's
  109 are 103 cancelled on a refused call and 6 exits. subject-sol's one is an exit.
- **Replicates agree more closely than on 2026-09-26.** U prose passing moved from 71% to 64% for
  subject-opus, and from 38% to 29% for subject-fable on 13 and 17 valid rows. The codex subjects
  moved by one row.
- **Cost** is the host's own figure. The codex host reports none; its 240 sessions (plus 6 in the
  smoke and the apps check) are unpriced. The full run cost $50.76: $47.21 on the claude host
  (subject-fable three times subject-opus) and $3.55 on grok. The smoke added $1.26, for $52.02 in
  all. The grok permission probes did not record cost.

## User-invoked prose, by prompt

| Outcome | subject-opus | subject-fable | subject-sol | subject-astra | subject-grok |
|---|---|---|---|---|---|
| recommended | 20 | 8 | 2 | 2 | 0 |
| redirected | 11 | 2 | 3 | 1 | 0 |
| loaded-and-stopped | 0 | 0 | 15 | 1 | 0 |
| loaded-unclear | 14 | 19 | 23 | 37 | 53 |
| violated | 1 | 14 | 8 | 4 | 4 |
| missed | 14 | 17 | 9 | 15 | 3 |

All 60 prose rows per subject, invalid included.

- **The claude host recommends; the codex and grok hosts load.** subject-opus answers a prose request
  by naming `/ak:<id>` (20) or pointing back at the command the prompt named (11). The other hosts
  load the skill and start on it. A codex session sees every installed skill in its own skill list,
  and grok lists each one as a slash command, so the roster line that calls them human-only is not
  the only thing they read.
- **subject-sol stops in words more often than the others.** 15 of its loads ended with a reply the
  scorer reads as a stop at the authority step, against 1 for subject-astra and 0 for the claude
  subjects.
- **Loaded-unclear dominates off the claude host.** The typical reply says the checkout is empty and
  asks for the PR, branch or artifact. It neither stops on the law nor asks for the typed command,
  so the scorer cannot settle it. On grok the reply is usually missing altogether.
- **Misses are still p3 prompts** that describe a need without naming a skill: 13 of 14 for
  subject-opus and all 15 for subject-astra.

## What changed in this branch

- `trigger-eval.ts` takes `--cases <id,id,...>`. It runs only the named cases, in set order. An id the
  set does not hold, or a filter that names nothing, is refused with exit 2 before any session
  starts. The roster and the bundle check still cover the whole set, and the receipt records the
  filter (`cases`).
- The grok adapter reports `stopReason`, and a session the host cancelled is listed as invalid with
  the reason `host cancelled a refused call`, not `empty reply`. On grok 1.0.41 `default`, `plan`
  and `auto` cancel the turn on a refused call just as `dontAsk` does. `--sandbox read-only`, which
  would make always-approve safe, refuses to start on this machine because `/var/run/docker.sock`
  is a symlink. So grok stays on `dontAsk`, and no mode here refuses a call and lets the session go on.
- The codex adapter passes `--disable apps` (above).

## Still open

- **Grok needs a way to keep going after a refusal.** The refused calls are mostly read-only looks
  (`ls -la && find . -type f … | head`, `git status && git log`, an `ls` outside the working tree).
  An `--allow` list for those looks, or a sandbox profile that starts on this machine, would give
  grok valid sessions. Until then its prose figures are not comparable.
- **The six-turn cap is not neutral across subjects.** It invalidates a third of subject-fable's
  sessions and none of subject-opus's, and codex has no cap at all. A cap-free or higher-cap rerun
  of subject-fable would show whether its prose behaviour differs from subject-opus's.
- **The shell classifier's false writes** now account for every violation: `command -v`,
  `gh auth status`, `env | …`, `cd … && ls`, `for` loops over `cat`, and `git -c … branch -vv`.
- **Whether a prose request names the command** is still the invocation-law question from
  2026-09-26, and the codex and grok hosts answer it by loading far more often.
- **Rescore** the stored transcripts once the recalibrated scorer lands.
