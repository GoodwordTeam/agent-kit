/**
 * The typechecker and the packager, wired into the thing that already runs.
 *
 * `bun test` transpiles and does not typecheck, so until this file existed a
 * type error reached a commit and was found by whoever next ran `tsc` by hand.
 * The gate was deferred once, correctly, because `tsc` was exiting 1 over an
 * in-flight file and a gate that starts red is a gate people learn to skip. It
 * exits 0 over the whole tree now, so the reason has expired.
 *
 * It lives in a test rather than in `package.json`'s `test` script so that it
 * runs however the suite is invoked, and only when the whole suite is invoked --
 * a single-file `bun test tests/foo.test.ts` does not pay for it.
 *
 * Three assertions and not one. "`tsc` exits 0" is true of a tree that
 * typechecks and equally true of a `tsc` that checked nothing, so the exit code
 * is paired with a population check (every file in `src/` and `tests/` is in the
 * checked set) and a positive control (the binary still reports a planted
 * error). Each answers a different way the first one can be a lie.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

const REPO = resolve(import.meta.dir, "..");
const TSC = join(REPO, "node_modules", ".bin", "tsc");

function tsc(args: string[], cwd = REPO) {
  return spawnSync(TSC, args, { cwd, encoding: "utf8" });
}

/**
 * Every `.ts` file under a directory, repo-relative, in no particular order.
 *
 * `tests/fixtures/` is left out to match `tsconfig.json`'s `exclude`, and for
 * the same reason: a fixture repository is test input that exists to be broken,
 * so its files are not this project's source. The exclusion is spelled here as
 * one directory name rather than read from the config, so that widening the
 * config's `exclude` fails this test instead of silently agreeing with it.
 */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.isDirectory() && relative(REPO, join(at, entry.name)) === join("tests", "fixtures")) continue;
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".ts")) out.push(relative(REPO, path));
    }
  };
  walk(join(REPO, dir));
  return out;
}

describe("the tree typechecks, and the typechecker is doing work", () => {
  test("tsc --noEmit reports nothing", () => {
    const run = tsc(["--noEmit"]);
    expect(`${run.stdout}${run.stderr}`.trim()).toBe("");
    expect(run.status).toBe(0);
  });

  test("every file in src/ and tests/ is in the checked set", () => {
    // The population check. A clean typecheck over zero files is byte-identical
    // to a clean typecheck over the whole tree, and `include` is a glob that can
    // silently stop matching a new directory.
    const run = tsc(["--noEmit", "--listFiles"]);
    expect(run.status).toBe(0);
    const checked = new Set(
      run.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith(REPO))
        .map((line) => relative(REPO, line)),
    );

    const owned = [...sourcesUnder("src"), ...sourcesUnder("tests")];
    expect(owned.length).toBeGreaterThan(30);
    expect(owned.filter((file) => !checked.has(file))).toEqual([]);

    // And the exclusion is the one documented in `tsconfig.json`, not a wider
    // one that happens to still satisfy the line above. Every checked file that
    // this repository owns must be under `src/` or `tests/`; anything the
    // config started excluding beyond fixtures would drop out of `owned` and
    // pass silently without this.
    expect(owned.filter((file) => file.startsWith("tests/fixtures"))).toEqual([]);
    expect(owned.some((file) => file.startsWith("src/"))).toBe(true);
    expect(owned.some((file) => file.startsWith("tests/"))).toBe(true);
  });

  test("a planted error is still reported, so exit 0 means something", () => {
    // The positive control, run against a scratch file so the repository is
    // never mutated -- three lanes are in this tree and a test that writes into
    // it would race them.
    const dir = mkdtempSync(join(tmpdir(), "ak-tsc-"));
    const file = join(dir, "planted.ts");
    writeFileSync(file, "export const x: number = \"not a number\";\n");
    const run = tsc(["--noEmit", "--strict", "--types", "", file], dir);
    expect(run.status).not.toBe(0);
    expect(`${run.stdout}${run.stderr}`).toContain("TS2322");
  });
});

/**
 * `ak build --check` is deliberately NOT gated here, and the reason is a finding.
 *
 * It was gated, briefly, and it passed -- because this working tree happened to
 * carry a `dist/` from an earlier build. In a clean `git archive` extract the
 * same command emits 22 `packaging.dist-missing` errors, because `dist/` is
 * generated and `.gitignore`d and therefore absent from every fresh checkout.
 *
 * So it is not a gate. It is a post-build verification whose result is decided
 * by uncommitted local state: green for a developer who has built, red for one
 * who has not, and neither answer is about the tree. AGENTS.md lists it in the
 * pre-commit block beside `bun test` without saying that `ak build` has to
 * precede it, which is the same trap one level up.
 *
 * Gating it properly means building to a scratch directory and checking there,
 * and `ak build` has no output-directory flag today. That is a packaging change
 * and it is reported rather than bodged in here -- a test that ran `ak build`
 * into the repository would write `dist/` during the suite and race the other
 * lanes working in this tree.
 */
