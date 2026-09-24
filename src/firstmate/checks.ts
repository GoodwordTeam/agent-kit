/**
 * The checks preflight runs, one function per check, each returning a named
 * pass or fail with the reason. bind and install run the subset they depend on.
 */
import { accessSync, constants, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { loadCapabilityTable } from "../packaging/capability-table.ts";
import type { Evidence, Host, Upstream } from "./constants.ts";
import { LIFECYCLE_SKILLS, TRANSPORT_REFERENCE } from "./constants.ts";
import { git } from "./proc.ts";

export interface Check {
  id: string;
  ok: boolean;
  detail: string;
}

const pass = (id: string, detail: string): Check => ({ id, ok: true, detail });
const fail = (id: string, detail: string): Check => ({ id, ok: false, detail });

/** The home contains the upstream commit the patch was made against. */
export function checkUpstreamCommit(fmHome: string, upstream: Upstream): Check {
  const id = "upstream-commit";
  if (!existsSync(join(fmHome, ".git"))) return fail(id, `${fmHome} is not a Firstmate git checkout`);
  const known = git(fmHome, ["cat-file", "-e", `${upstream.commit}^{commit}`]);
  if (known.code !== 0) return fail(id, `${fmHome} does not contain upstream commit ${upstream.commit}`);
  const ancestor = git(fmHome, ["merge-base", "--is-ancestor", upstream.commit, "HEAD"]);
  if (ancestor.code !== 0) return fail(id, `HEAD of ${fmHome} does not descend from upstream commit ${upstream.commit}`);
  return pass(id, `HEAD descends from ${upstream.commit}`);
}

/**
 * The patch is already applied, which a reverse `git apply --check` proves: the
 * reverse applies cleanly only to a tree the forward patch is in. Nothing here
 * applies it.
 */
export function checkPatchApplied(fmHome: string, upstream: Upstream): Check {
  const id = "patch-applied";
  if (!existsSync(upstream.patchFile)) return fail(id, `patch file ${upstream.patchFile} is missing from agent-kit`);
  const reverse = git(fmHome, ["apply", "--reverse", "--check", upstream.patchFile]);
  if (reverse.code === 0) return pass(id, `${upstream.patch} is applied`);
  return fail(
    id,
    `${upstream.patch} is not applied to ${fmHome}. An unmodified Firstmate forbids the worker's delegation and gives no-mistakes sole ownership of review (adapters/firstmate/CONTRACT.md §3). A maintainer applies the patch; no ak command does`,
  );
}

/**
 * The project's trusted no-mistakes config parks a failing gate instead of
 * committing a fix. The repository's value overrides the global default, and the
 * global default commits, so the repository must say 0 for each.
 */
export function checkNoMistakesConfig(project: string): Check {
  const id = "no-mistakes-auto-fix";
  const file = join(project, ".no-mistakes.yaml");
  if (!existsSync(file)) return fail(id, `${file} is missing; the project must declare auto_fix.test, auto_fix.lint and auto_fix.ci as 0`);
  let doc: unknown;
  try {
    doc = parseYaml(readFileSync(file, "utf8"));
  } catch (e) {
    return fail(id, `${file} does not parse: ${(e as Error).message}`);
  }
  const autoFix = (doc as { auto_fix?: Record<string, unknown> } | null)?.auto_fix ?? {};
  const loose = ["test", "lint", "ci"].filter((step) => autoFix[step] !== 0);
  if (loose.length > 0) {
    return fail(
      id,
      `${file} must set auto_fix.${loose.join(", auto_fix.")} to 0, so a failing gate parks rather than committing a fix the lifecycle did not review (skills/super-ship/references/transport-no-mistakes.md)`,
    );
  }
  return pass(id, "auto_fix.test, auto_fix.lint and auto_fix.ci are 0");
}

/**
 * Where evidence goes. The knowledgebase fails closed: none exists, and this
 * adapter does not supply kb-write (CONTRACT.md §1). A mock store must be a
 * writable directory.
 */
export function checkEvidence(evidence: Evidence | undefined): Check {
  const id = "evidence";
  if (evidence === undefined || evidence.store === "kb") {
    return fail(
      id,
      "the knowledgebase evidence store fails closed: no knowledgebase is configured (adapters/knowledgebase/CONTRACT.md §1). A demonstration may name a labeled mock store, which forces dry-run",
    );
  }
  try {
    mkdirSync(evidence.location, { recursive: true });
    if (!statSync(evidence.location).isDirectory()) return fail(id, `${evidence.location} is not a directory`);
    accessSync(evidence.location, constants.W_OK);
  } catch (e) {
    return fail(id, `mock evidence store ${evidence.location} is not writable: ${(e as Error).message}`);
  }
  return pass(id, `labeled mock store at ${evidence.location}; delivery is forced to dry-run`);
}

/** The built bundle carries the lifecycle and the transport reference. */
export function checkBundle(bundleDir: string): Check {
  const id = "skill-bundle";
  const needed = [...LIFECYCLE_SKILLS.map((s) => `skills/${s}/SKILL.md`), TRANSPORT_REFERENCE];
  const missing = needed.filter((rel) => !existsSync(join(bundleDir, rel)));
  if (missing.length > 0) return fail(id, `${bundleDir} is missing ${missing.join(", ")}; run ak build`);
  return pass(id, `${bundleDir} carries the lifecycle and the no-mistakes transport`);
}

/**
 * The host supplies isolated review contexts and independent contexts at least
 * partially. Partial is reported as partial: it is a pass with a named limit,
 * never a silent one.
 */
export function checkHost(akRoot: string, host: Host): Check {
  const id = "host-capabilities";
  const table = loadCapabilityTable(akRoot);
  if (!table.available) return fail(id, "the host capability table is unavailable, so no host capability could be checked");
  const wanted = ["isolated-review-context", "independent-context"];
  const states = wanted.map((cap) => [cap, table.status.get(cap)] as const);
  const missing = states.filter(([, s]) => s === undefined || s === "not-provided");
  const summary = states.map(([cap, s]) => `${cap}=${s ?? "unstated"}`).join(", ");
  if (missing.length > 0) return fail(id, `${host}: ${summary}`);
  return pass(id, `${host}: ${summary}`);
}
