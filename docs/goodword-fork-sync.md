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

## Verification and handoff

Results and the reviewed revision will be recorded here before the draft PR is
handed back. Ellie must review independently before readiness; only Chris can
authorize merge. No install or global configuration change is part of validation.
