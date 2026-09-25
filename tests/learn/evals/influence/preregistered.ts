/**
 * The pre-registered kept set for the influence eval: scenario ids chosen before a run, so lift is
 * reported over a set fixed in advance rather than one the results shaped. When this list is
 * non-empty, `analyse` computes the kept lift and per-arm rates over it (intersected with the
 * scenarios that actually ran), and still reports the post-hoc discard alongside for comparison.
 * When it is empty, there is no pre-registration and the eval falls back to the post-hoc discard rule.
 * Either way the primary lift is `lift_all`; the kept lift is exploratory (LIFT_ROLES).
 *
 * Registered 2026-09-25, before the scenario set 2 rerun, from each fact and the scaffold the none
 * arm starts from, not from any control result. The test: could a competent engineer, given only
 * the prompt and the repository, arrive at the fact without memory? Kept only where the answer is no.
 *
 * Changing this list after seeing the run it judges is exactly what pre-registration exists to
 * prevent: amend it only before a new run, and say so in the commit.
 */
export const PREREGISTERED_KEPT: readonly string[] = [
  // The usage line shows --rebuild-index as optional; nothing says the build is wrong without it.
  "docs-rebuild-index",
  // A made-up subject suffix; the repository has no changelog tooling that hints at it.
  "commit-skip-changelog",
  // The script reads no variable and the value ci-local appears nowhere in the repository.
  "integration-env",
  // No existing file carries a license header, and MPL-2.0 is one choice among many.
  "spdx-header",
  // The neighbouring refund() logs with log.info, so imitation leads away from log.trace.
  "log-trace",
  // No existing tests; `.spec.ts` beside the source is one of several layouts, and not the host's default.
  "spec-beside-source",
  // server.js defaults to 3000 and 4100 appears nowhere.
  "dev-server-port",
];

/** Excluded, each with why it is guessable: kept so the choice is auditable, and checked to partition SCENARIOS with the kept set. */
export const PREREGISTERED_EXCLUDED: Readonly<Record<string, string>> = {
  "test-preload": "the test reads a global that tools/fake-db.ts sets, so the preload is deducible",
  "dist-hands-off": "not hand-editing generated output is convention, and the emitter is in the tree",
  "migration-stamp": "a migration generator in tools/ is where a careful engineer looks first",
  "lint-strict": "package.json lists lint:strict beside lint",
  "pnpm-only": "pnpm is a common default pick",
  "bump-no-tag": "tools/bump parses --no-tag in plain sight, and CI-owned tags are common practice",
  "api-base-url": 'src/region.ts says "eu", and api-<region>.example.com is the stock placeholder shape',
  "retry-budget": "5 is one of the two most common retry defaults",
};
