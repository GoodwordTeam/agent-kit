/**
 * The half of "the baseline only shrinks" that `--update` cannot enforce: a hand-edited
 * `tools/oxlint/baseline.json`, or one written with `--allow-growth`, passes the ratchet because the
 * ratchet only compares the tree against whatever baseline it finds. This compares that baseline with
 * the one at the merge base of <base-ref> and fails when any file and rule recorded more.
 *
 * Growth passes in the two cases `--allow-growth` exists for, and only those. A renamed file may carry
 * its old path's counts to the new path. A change to `.oxlintrc.json` means a rule is being adopted, so
 * growth passes and the baseline diff is what the reviewer reads.
 *
 *   bun tools/oxlint/growth.ts [--root <dir>] <base-ref>
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { BASELINE, type Counts, parseBaseline, readBaseline } from "./ratchet.ts";

const CONFIG = ".oxlintrc.json";

export interface Growth {
  file: string;
  rule: string;
  allowed: number;
  actual: number;
}

/** Pairs recording more than the base allows. `renamed` maps each new path to the path it was moved from. */
export function growth(base: Counts, now: Counts, renamed: ReadonlyMap<string, string>): Growth[] {
  const grown: Growth[] = [];
  for (const [file, rules] of now) {
    const from = renamed.get(file);
    for (const [rule, actual] of rules) {
      const kept = base.get(file)?.get(rule) ?? 0;
      const moved = from === undefined ? 0 : (base.get(from)?.get(rule) ?? 0);
      if (actual > kept + moved) grown.push({ file, rule, allowed: kept + moved, actual });
    }
  }
  return grown;
}

interface GitRun {
  status: number | null;
  stdout: string;
}

function git(root: string, args: readonly string[]): GitRun {
  const run = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });
  if (run.error !== undefined) throw new Error(`git ${args.join(" ")} could not start: ${run.error.message}`);
  return { status: run.status, stdout: run.stdout };
}

/** Renames between the merge base and the working tree, as new path -> old path. */
function renamesSince(root: string, mergeBase: string): Map<string, string> {
  const run = git(root, ["diff", "-M", "--name-status", "-z", mergeBase]);
  if (run.status !== 0) throw new Error(`git diff against ${mergeBase} failed`);
  const fields = run.stdout.split("\0");
  const renamed = new Map<string, string>();
  let at = 0;
  while (at < fields.length) {
    const status = fields[at] ?? "";
    if (status.startsWith("R") || status.startsWith("C")) {
      const from = fields[at + 1] ?? "";
      const to = fields[at + 2] ?? "";
      if (status.startsWith("R")) renamed.set(to, from);
      at += 3;
    } else {
      at += 2;
    }
  }
  return renamed;
}

export function main(argv: readonly string[]): number {
  const args = [...argv];
  const rootAt = args.indexOf("--root");
  const root = rootAt >= 0 ? resolve(args.splice(rootAt, 2)[1] ?? ".") : process.cwd();
  const [ref] = args;
  if (ref === undefined || args.length !== 1) {
    console.error("usage: growth.ts [--root <dir>] <base-ref>");
    return 2;
  }

  const found = git(root, ["merge-base", ref, "HEAD"]);
  const mergeBase = found.stdout.trim();
  if (found.status !== 0 || mergeBase === "") {
    console.error(`lint:growth: no merge base between ${ref} and HEAD; fetch ${ref} with full history.`);
    return 2;
  }
  const short = mergeBase.slice(0, 8);
  const recorded = git(root, ["show", `${mergeBase}:${BASELINE}`]);
  const base = recorded.status === 0 ? parseBaseline(recorded.stdout, `${BASELINE} at ${short}`) : new Map();
  const grown = growth(base, readBaseline(root), renamesSince(root, mergeBase));
  if (grown.length === 0) {
    console.log(`lint:growth: the baseline records nothing beyond ${short}.`);
    return 0;
  }

  for (const g of grown) console.log(`${g.file}: ${g.rule} ${g.allowed} -> ${g.actual} since ${short}`);
  const adopting = git(root, ["diff", "--quiet", mergeBase, "--", CONFIG]).status === 1;
  if (adopting) {
    console.log(`lint:growth: ${CONFIG} changed since ${short}, so a rule is being adopted; the growth above passes.`);
    return 0;
  }
  console.log(
    `lint:growth: the baseline grew since ${short} with no rule adopted and no file moved. Fix the violations; the baseline only shrinks.`,
  );
  return 1;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
