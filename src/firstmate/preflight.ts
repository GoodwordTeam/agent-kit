/**
 * `ak firstmate preflight`: every precondition for binding a task, checked and
 * named. It fails clearly and never downgrades: a failed check is reported as
 * failed, and nothing is attempted in its place.
 */
import type { Evidence, FirstmateOptions, Host } from "./constants.ts";
import {
  checkBundle,
  checkEvidence,
  checkHost,
  checkNoMistakesConfig,
  checkPatchApplied,
  checkUpstreamCommit,
  type Check,
} from "./checks.ts";

export interface PreflightArgs {
  fmHome: string;
  project: string;
  host: Host;
  evidence: Evidence | undefined;
}

export interface PreflightResult {
  ok: boolean;
  checks: Check[];
}

export function preflight(args: PreflightArgs, opts: FirstmateOptions): PreflightResult {
  const upstream = checkUpstreamCommit(args.fmHome, opts.upstream);
  const checks = [
    upstream,
    // Without the upstream commit the reverse check would test the patches
    // against a tree they were never made for; its answer would mean nothing.
    upstream.ok
      ? checkPatchApplied(args.fmHome, opts.upstream)
      : { id: "patch-applied", ok: false, detail: "not checked: the home does not contain the upstream commit" },
    checkHost(opts.akRoot, args.host),
    checkBundle(opts.bundleDir),
    checkNoMistakesConfig(args.project),
    checkEvidence(args.evidence),
  ];
  return { ok: checks.every((c) => c.ok), checks };
}
