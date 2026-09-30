/**
 * The half of "the baseline only shrinks" that `--update` cannot enforce: a hand-edited
 * `tools/oxlint/baseline.json`, or one written with `--allow-growth`, passes the ratchet because the
 * ratchet only compares the tree against whatever baseline it finds. This compares that baseline with
 * the one at the merge base of <base-ref> and fails when any file and rule recorded more.
 *
 * Growth passes in the two cases `--allow-growth` exists for, and only those. A renamed file may carry
 * its old path's counts to the new path. "Renamed" is what `git diff -M` pairs between the merge base
 * and the tree, which takes at least 50% similar content; a file rewritten past that in the same branch
 * reads as new, so land the move on main before the rewrite. A change to `.oxlintrc.json` means a rule
 * is being adopted, so growth passes and the baseline diff is what the reviewer reads.
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
  const rootArg = rootAt >= 0 ? args.splice(rootAt, 2)[1] : ".";
  const [ref] = args;
  if (rootArg === undefined || ref === undefined || args.length !== 1) {
    console.error("usage: growth.ts [--root <dir>] <base-ref>");
    return 2;
  }

  const top = git(resolve(rootArg), ["rev-parse", "--show-toplevel"]);
  if (top.status !== 0) {
    console.error(`lint:growth: ${resolve(rootArg)} is not inside a git repository.`);
    return 2;
  }
  const root = top.stdout.trim();
  const found = git(root, ["merge-base", ref, "HEAD"]);
  const mergeBase = found.stdout.trim();
  if (found.status !== 0 || mergeBase === "") {
    console.error(`lint:growth: no merge base between ${ref} and HEAD; fetch ${ref} with full history.`);
    return 2;
  }
  const short = mergeBase.slice(0, 8);
  const recordedAtBase = git(root, ["cat-file", "-e", `${mergeBase}:${BASELINE}`]).status === 0;
  let base: Counts = new Map();
  if (recordedAtBase) {
    const shown = git(root, ["show", `${mergeBase}:${BASELINE}`]);
    if (shown.status !== 0) throw new Error(`git show ${short}:${BASELINE} failed`);
    base = parseBaseline(shown.stdout, `${BASELINE} at ${short}`);
  } else {
    console.log(`lint:growth: ${short} has no ${BASELINE}; every recorded count is growth.`);
  }
  const grown = growth(base, readBaseline(root), renamesSince(root, mergeBase));
  if (grown.length === 0) {
    console.log(`lint:growth: the baseline records nothing beyond ${short}.`);
    return 0;
  }

  for (const g of grown) console.log(`${g.file}: ${g.rule} ${g.allowed} -> ${g.actual} since ${short}`);
  const configDiff = git(root, ["diff", "--quiet", mergeBase, "--", CONFIG]).status;
  if (configDiff !== 0 && configDiff !== 1) throw new Error(`git diff ${short} -- ${CONFIG} failed`);
  const adopting = configDiff === 1;
  if (adopting) {
    console.log(`lint:growth: ${CONFIG} changed since ${short}, so a rule is being adopted; the growth above passes.`);
    return 0;
  }
  console.log(
    `lint:growth: the baseline grew since ${short} beyond what renamed files carry, and ${CONFIG} is unchanged. Fix the violations; the baseline only shrinks. A moved file counts as renamed once it is staged or committed and git pairs it with its old path.`,
  );
  return 1;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
