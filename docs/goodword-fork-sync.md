# Goodword fork sync

Status: draft integration; independent Ellie review and Chris's merge approval remain required.

## Decision and scope

Merge upstream `d6a98f0c058414e2e17f59aaf4b0fa740cfb65de` into fork main
`f1c18e486c12846fddfcefdd2dd59fd63a0b2ede`, preserving both histories. This brings
271 upstream commits into the fork. Keep the fork's install-source fix: upstream
still names its own repository in marketplace metadata and maintenance defaults.
Resolve the two version conflicts with `0.1.131-goodword.1`, retaining Goodword's
source URLs, catalog-history fetch, documentation and source tests. Refresh the
committed Cursor bundle and text-size pins for the retained fork URLs.

Upstream adds stronger checks that evidence matches the reviewed revision,
independent ticket and code reviews, a read-only repository knowledge base,
optional unattended work, optional learning tools, Cursor support, and safer
packaging, paths and recovery. This sync does not enable those optional systems.

## Goodword compatibility

Read-only inspection of the goodword-platform assessment checkout confirms that
the root tracker binding still uses `linear-linearis`, `.linear-token` and team
ENG. Check its shape with the merged loader; do not read the token or contact
Linear. Live authentication and writes require a separate pilot check. Keep the
project-local, exactly pinned linearis dependency and gitignored token.

Both the tracker and knowledge-base configuration loaders accept the inspected
root bindings without issues. This is a local shape check, not a live-service test.

Root, web, MCP and knowledge-base plugin settings name upstream; API names the
Goodword fork. All inspected settings disable `ak@agent-kit`. Therefore merging
this PR changes no active monorepo plugin configuration. Before a pilot, choose
one tested Goodword publication for every app and verify the actual resolved
bundle; merging this source PR alone does not update installed plugins.

The root's in-repo knowledge-base binding needs the new upstream implementation.
It reads committed wiki content and cannot publish receipts. Existing lifecycle
records, grants and receipts need current-schema validation rather than assumed
compatibility. Planning now needs project/delegation evidence and independent
ticket reads; review entrypoint authority has changed. Core remains the pilot
scope, with learning and unattended operation off. Mergify remains Goodword's
merge queue; no-mistakes delivery requires a deliberate mapping to that queue.

Publication now requires `v0.1.131-goodword.1` at the eventual merged main commit.
The push-to-main workflow can refuse publication until that tag exists. Creating
the tag, releasing, installing, enabling plugins, merging and deploying are
outside this task. Do not reuse upstream's version tag for the fork bundle.

## Proposed canonical home

Use an unsquashed Git subtree at `tools/agent-kit` in goodword-platform. It keeps
the source available in ordinary clones and preserves a split history suitable
for upstream contributions. A plain vendored directory is simpler initially but
loses automatic history/split support. A submodule keeps histories separate but
requires extra checkout/authentication steps and leaves the actual source of
truth outside the monorepo. Subtree best matches the requested ownership.

After this PR is independently reviewed, merged and released with Chris's OK,
import the exact approved fork revision into the agreed monorepo prefix in a
separate PR. Record prefix, upstream SHA, fork SHA, bundle version, owner and last
verification in that change. Keep Goodword-specific additions in catalog
fragments, project records and adapters where possible.

Thereafter author changes in the monorepo only. Bring Eddie's main into a
temporary integration branch, merge into the subtree through a monorepo PR,
and run both Agent Kit checks and relevant monorepo compatibility checks.
Export the subtree's split history to a feature branch of GoodwordTeam/agent-kit
and open a publication PR against the fork's main. Never edit both homes
independently. Sync at least before each pilot update and assign a regular owner
and cadence. Keep generated dist output in the publication workflow.

Offer generic improvements to Eddie in separate, explicitly authorized upstream
PRs made from clean upstream-based branches, excluding Goodword URLs and policy.
Record accepted upstream revisions and bring them back through the same inbound
sync path. No goodword-platform files are changed by this task.

## Technical appendix: verification and handoff

The integration commit is `548b953c9bf9e4dd2050c6e91c8c4b7306e0e826`.
`research/probes/validate-figure.sh` measured that revision with donors copied
into a clean archive and dependencies linked from the working tree: no validation
errors and no skipped or unavailable checks. Existing style warnings remain.
A separate clean archive with copied donors also passed `bun run ak build`,
producing both Claude Code and Codex output. Working-tree format, lint, lint
growth, build consistency, Cursor overlay consistency and publication-version
checks passed. The URL changes raise twelve byte-size pins by one or two bytes
each, with no estimated-token increase.

The fork's history-fetch step initially broke the isolated lane-test fixtures
because they did not copy that helper. Both fixtures now include it and their
recorders ignore its metadata query; all three lane checks pass. An early donor
receipt test measured the pre-merge HEAD with the new dependencies; final checks
use the committed integration instead. The exploratory run was stopped after
the complete donor-backed run replaced it.

The ordinary test lane passed all 5,169 tests. Three integration suites needed
local environment fixes: the operator's global Git ignore hides fixture `dist/`
directories, and system Python lacks PyYAML. Run those suites with
`GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1` and a scratch virtual
environment containing PyYAML 6.0.3 first on PATH: packaging, version gate and
catalog progress then pass all 252 tests. These are process-local settings;
no global configuration changed. The complete donor-backed `bun run test` run
reported 6,041 passes and 18 failures across all lanes, exiting 1 because of
those environment issues. All 18 failures are in the three suites rerun above;
all other integration lanes passed, including 131 lifecycle and 169 runner
tests. Together the full run and corrected rerun cover 6,059 passing tests with
no unresolved failures; this is not a claim that the original command exited 0.

Ellie must review independently before readiness; only Chris can authorize
merge. No install or global configuration change is part of validation.
