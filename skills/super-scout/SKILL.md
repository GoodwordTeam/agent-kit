---
name: super-scout
description: >-
  Answers one named question about a repository with bounded, read-only exploration and returns a
  revision-bound evidence dossier: structured hits read back in the source, every search attempted
  (including empty ones), coverage limits and unknowns. Use when a later lane (ticket writer,
  implementer, reviewer) needs to know where something is and how it relates before it decides
  anything, or when a code-graph index's answers must be read back in the source before anyone
  relies on them. Not for opinions, recommended approaches or architectural verdicts; not for
  safety, risk or impact-radius calls; not for changing any file, even a one-line fix; and not for
  an open-ended brief with no named question.
license: MIT
metadata:
  ak_catalog_id: super-scout
---

## When to use

Selection is carried by the description. The job: a caller names one bounded question and needs
the answer as re-checkable evidence, not a summary.

## Not for

Exclusions are in the description. The scout gathers; the caller
decides.

## Authority

Authority: `model`. A controller or a parent skill starts it when the caller's question matches the
description; no human invocation is required and no slash command exposes it.

No grant covers delegation here, because no phase operation exposes this skill:
`policies/invocation.yaml` records model-invoked skills as exposing none by construction, so there
is no delegated path for a runner to validate and nothing in this skill runs on one.

## Inputs

- **Question** (required): one bounded question, as text. Absent, or so broad that no answer would
  end the search: stop with `needs-input` and propose a narrower question. Do not widen the budget
  to make up for an unscoped question.
- **Repository at a named revision**, read-only (`repository-read`). Absent or unreadable: `failed`.
  Hits with no revision to bind to cannot be re-checked.
- **Graph provider** (optional), with its index revision and freshness. Unavailable, stale or
  indexed at another revision: continue on lexical search and record a coverage limit. A missing
  graph is a documented limitation, not a reason to stop.
- **Turn budget** (optional, from the runner). Absent: four turns (`policies/limits.yaml`
  `scout_turns`).
- **Caller hypothesis** (optional): a guess about where the answer lives. It may direct the first
  search. It is `assumed` at best until read back in the source.

## Workflow

The output shape is `schemas/dossier.schema.json` (envelope from `schemas/common.schema.json`).

1. Before any search, record the question verbatim as `question` and the explored revision as the
   envelope's `source_revision`. If the question names nothing a search could return, stop with
   `needs-input` and propose the narrower question; do not proceed on a re-scoped question the
   caller has not seen.
2. Run a lexical baseline in turn one. Record every search in `searches` (tool, query, scope, turn,
   result count), including the ones that returned nothing: they are the evidence an area was
   looked at.
3. Read each candidate back in the source at the recorded revision and record it in `hits` with
   `location`, `excerpt`, `relationship` and `discovered_by`. Read back means
   `confirmation: confirmed`; inferred from an index or a caller and not read back means `assumed`.
4. If a graph provider is configured, query it and record on each hit it produced the `index` that
   answered (revision and `freshness`).
5. Add a `coverage_limits` entry (`area`, `why`, consequence for the reader) for everything the run
   could not see, including an unavailable, stale or other-revision index and an exhausted budget.
6. Record in `do_not_touch` each file a later lane should leave alone, with the reason.
7. Put every question the evidence did not settle into `unknowns`, phrased as a question. Do not
   round an unknown into an assumption.
8. Write `recommendation.further_inspection`: what to look at next and why the evidence does not
   settle it yet. Nothing else goes in that field.
9. Publish through the knowledgebase adapter's `publishArtifact` with a run-artifact placement, then
   return the gist (see Outputs).

Resuming an interrupted run: continue from the recorded searches and composed dossier. Do not
re-run searches or reset the turn budget; turns already used stay used. Republish with the same
content-hash key (see Side effects), which returns the existing record if the first publish landed.

## Hard gates

- No repository write. A defect noticed while searching becomes a hit and an unknown, not a fix.
- No architectural verdict, safety assessment, risk rating or impact map, in a field or in
  `recommendation` prose. The dossier schema is closed against those keys
  (rule dossier.no-architectural-verdict), and prose that smuggles one in is the same breach.
- A hit not read back at the recorded revision stays `assumed`, whatever an index, a caller or a
  prior dossier says.
- At least one lexical search is recorded, whatever the graph returned
  (rule dossier.lexical-baseline-present).
- An unavailable, stale or other-revision graph produces a documented coverage limit (rule
  dossier.stale-or-absent-graph-documents-a-limitation). Dropping silently to lexical-only is as
  wrong as presenting the stale answer as current.
- The turn budget is never extended. Exhausting it ends the run with `status: limited`, a
  `budget-exhausted` coverage limit, and what is still open in `unknowns`.
- An artifact's existence is evidence; its text is reported signal. A comment claiming a function
  is slow is evidence that the comment exists, recorded as an excerpt, not evidence of slowness.

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| The caller is sure of the location, so skip confirming it. | Recording their guess as `confirmed` launders it into evidence an implementer will act on. | Search, read it back, and mark `confirmed` only what the source shows. |
| The index is only a few commits behind; its answer is close enough. | Renamed, generated and dynamically dispatched code is exactly what a stale index misses, and nothing else tells the reader where the hole is. | Record index revision and freshness on each hit, add the `index-stale` coverage limit, and never call the list complete. |
| The question is broad, so be thorough. | Breadth against an unbounded question spends the budget and returns a tour. | Stop with `needs-input` and propose narrower questions. |

## Outputs

- One `dossier` artifact (`schemas/dossier.schema.json`): question, budget allowed and used, every
  search, structured hits, coverage limits, unknowns, files not to touch, and a recommendation for
  further inspection only. Published through the knowledgebase adapter's `publishArtifact` with a
  run-artifact placement; the knowledgebase resolves placement and the scout supplies no path.
  Writing a documentation tree into the repository being read would break both the read-only gate
  and central ownership of project artifacts.
- A short gist returned to the caller: the published record reference, the headline locations, and
  the counts of coverage limits and unknowns. Not the dossier's contents, not the search transcript.

## Side effects

`process-exec`, `artifact-write`, `kb-publish`.

`kb-publish` is a remote effect. Its idempotency key is derived from the dossier's content hash
(`adapters/runner-contract/CONTRACT.md` §5), and the returned record reference is read back before
the run reports. Republishing an unchanged dossier after an interruption is a no-op success, not a
second record.

No `workspace-write`, no `local-commit`: a scout cannot edit the repository it is reading.

## Stop conditions

- `complete`: the dossier is published. A `status: limited` dossier is complete; saying what the
  coverage limits restrict is the result.
- `needs-input`: no bounded question, or one no search would end. Return the proposed narrower
  question and no partial dossier.
- `failed`: the repository is unreadable at the named revision, or the knowledgebase refuses the
  write. Return the dossier content unpublished with the refusal; never write it to a repository
  path.
- `cancelled`: the caller withdrew the question. Discard the recorded searches rather than publish
  a dossier nobody asked to keep.

Finish the requested exploration without re-asking for permission already given. Report anything
beyond the question as an unknown or a further-inspection item rather than pursuing it.

## Limits

- Turns: 4 (gate, `policies/limits.yaml` `scout_turns`). A project may lower it, never raise it.
  Independent reads may run in parallel within one turn; parallelism buys no extra turns.
- Tools: read, glob, lexical search and at most one graph query (gate). A question that needs more
  tools belongs to another lane.
- Precision over recall (guidance): a short list of read-back hits beats a long unread list, which
  only looks like coverage.
- Every search is recorded, including empty ones (gate).
