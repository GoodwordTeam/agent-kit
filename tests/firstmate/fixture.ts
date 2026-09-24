/**
 * Throwaway Firstmate homes and projects for the firstmate CLI tests.
 *
 * Every home here is a temp git repository standing in for a Firstmate
 * checkout: one commit plays the upstream commit, and a synthetic patch plays
 * 0001-agent-kit-mode. No test reads, writes or even resolves the live
 * Firstmate home; the real-upstream check is recorded separately, against a
 * scratch clone, and says so.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Upstream } from "../../src/firstmate/constants.ts";
import { makeTree } from "../helpers/tree.ts";

export const REPO = join(import.meta.dir, "..", "..");

export function gitIn(cwd: string, ...args: string[]): string {
  const proc = Bun.spawnSync(["git", ...args], {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.invalid",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.invalid",
    },
  });
  if (proc.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${proc.stderr.toString()}`);
  return proc.stdout.toString().trim();
}

const ORIGINAL = "fm_dod_block() {\n  echo default\n}\n";
const PATCHED = "fm_dod_block() {\n  echo default\n}\n# agent-kit mode\n";

export interface Home {
  home: string;
  upstream: Upstream;
}

/**
 * A home at a synthetic upstream commit. `patched` applies the synthetic patch
 * to the working tree, which is what a maintainer applying 0001 does.
 */
export function makeHome(opts: { patched: boolean }): Home {
  const home = makeTree({ "bin/fm-dod-lib.sh": ORIGINAL, "config/.keep": "" });
  gitIn(home, "init", "-q", "-b", "main");
  gitIn(home, "add", "-A");
  gitIn(home, "commit", "-q", "-m", "upstream");
  const commit = gitIn(home, "rev-parse", "HEAD");

  // The patch is produced by git itself, so the reverse check below is testing
  // a real patch rather than a hand-written one that happens to parse.
  writeFileSync(join(home, "bin/fm-dod-lib.sh"), PATCHED);
  const diff = gitIn(home, "diff", "--no-ext-diff", "--binary");
  const patchDir = mkdtempSync(join(tmpdir(), "ak-fm-patch-"));
  const patchFile = join(patchDir, "0001-agent-kit-mode.patch");
  writeFileSync(patchFile, `${diff}\n`);
  if (!opts.patched) writeFileSync(join(home, "bin/fm-dod-lib.sh"), ORIGINAL);

  return { home, upstream: { commit, patch: "0001-agent-kit-mode", patchFile } };
}

/** A project checkout with a trusted no-mistakes config, as preflight requires. */
export function makeProject(noMistakes?: string): string {
  const project = makeTree({
    "src/a.ts": "export const a = 1;\n",
    ".no-mistakes.yaml":
      noMistakes ?? "commands:\n  test: bun test\nauto_fix:\n  test: 0\n  lint: 0\n  ci: 0\n",
  });
  gitIn(project, "init", "-q", "-b", "main");
  gitIn(project, "add", "-A");
  gitIn(project, "commit", "-q", "-m", "init");
  return project;
}

export const LIFECYCLE = [
  "super-scout",
  "super-bound",
  "super-align",
  "super-build",
  "super-verify",
  "super-review",
  "super-ship",
] as const;

/** A built bundle with the lifecycle in it, as `ak build` would leave dist/<host>. */
export function makeBundle(extra: Record<string, string> = {}): string {
  const files: Record<string, string> = {
    "skills/super-ship/references/transport-no-mistakes.md": "# Transport\n",
    "bin/ak-gate.mjs": "// gate\n",
    ...extra,
  };
  for (const id of LIFECYCLE) files[`skills/${id}/SKILL.md`] = `---\nname: ${id}\n---\n`;
  return makeTree(files);
}

export function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "ak-fm-dir-"));
  mkdirSync(dir, { recursive: true });
  return dir;
}

export const FIXED_NOW = () => new Date("2026-09-24T12:00:00.000Z");
