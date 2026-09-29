/**
 * The lint ratchet and the two tool configs, run for real on temp trees.
 *
 * The ratchet cases drive `tools/oxlint/ratchet.ts` as a CLI against a tree with its own one-rule
 * config, so each assertion is about what the command does to a baseline, not about the repo's
 * current findings. The config cases copy the repository's `.oxfmtrc.json` and `.oxlintrc.json` into a
 * temp root and run the real binaries: the formatter case pins the failure that shaped the ignore
 * list (oxfmt read `__MARKER__` in a Markdown fixture as bold and rewrote it), and the linter case
 * pins that the vendored anti-slop plugin actually loads.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const REPO = resolve(import.meta.dir, "..");
const RATCHET = join(REPO, "tools", "oxlint", "ratchet.ts");
const BIN = join(REPO, "node_modules", ".bin");

function tree(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ak-lint-")));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const ONE_RULE = JSON.stringify({ plugins: ["eslint"], categories: {}, rules: { "eslint/no-debugger": "error" } });

function ratchet(root: string, ...flags: string[]) {
  const run = spawnSync("bun", [RATCHET, "--root", root, ...flags, "src"], { encoding: "utf8" });
  return { status: run.status, out: `${run.stdout}${run.stderr}` };
}

const baseline = (root: string) => JSON.parse(readFileSync(join(root, "tools/oxlint/baseline.json"), "utf8"));

describe("lint ratchet", () => {
  test("a violation the baseline does not record fails, naming the file and line", () => {
    const root = tree({ ".oxlintrc.json": ONE_RULE, "src/a.ts": "export const f = () => {\n  debugger;\n};\n" });
    const run = ratchet(root);
    expect(run.status).toBe(1);
    expect(run.out).toContain("src/a.ts:2:");
    expect(run.out).toContain("eslint(no-debugger)");
  });

  test("--update refuses to record growth; --allow-growth records it and the next check passes", () => {
    const root = tree({ ".oxlintrc.json": ONE_RULE, "src/a.ts": "debugger;\ndebugger;\n" });
    expect(ratchet(root, "--update").status).toBe(1);
    expect(ratchet(root, "--update", "--allow-growth").status).toBe(0);
    expect(baseline(root)).toEqual({ "src/a.ts": { "eslint(no-debugger)": 2 } });
    expect(ratchet(root).status).toBe(0);
  });

  test("one more violation in a recorded file fails even though the pair is in the baseline", () => {
    const root = tree({ ".oxlintrc.json": ONE_RULE, "src/a.ts": "debugger;\n" });
    ratchet(root, "--update", "--allow-growth");
    writeFileSync(join(root, "src/a.ts"), "debugger;\ndebugger;\n");
    const run = ratchet(root);
    expect(run.status).toBe(1);
    expect(run.out).toContain("baseline allows 1");
  });

  test("a fixed violation leaves the baseline stale until it is recorded, and recording needs no growth flag", () => {
    const root = tree({ ".oxlintrc.json": ONE_RULE, "src/a.ts": "debugger;\ndebugger;\n", "src/b.ts": "debugger;\n" });
    ratchet(root, "--update", "--allow-growth");
    writeFileSync(join(root, "src/a.ts"), "debugger;\n");
    writeFileSync(join(root, "src/b.ts"), "export {};\n");
    const stale = ratchet(root);
    expect(stale.status).toBe(1);
    expect(stale.out).toContain("down to 1 from 2");
    expect(ratchet(root, "--update").status).toBe(0);
    expect(baseline(root)).toEqual({ "src/a.ts": { "eslint(no-debugger)": 1 } });
    expect(ratchet(root).status).toBe(0);
  });

  test("a malformed baseline is an error, not an empty one", () => {
    const root = tree({
      ".oxlintrc.json": ONE_RULE,
      "src/a.ts": "export {};\n",
      "tools/oxlint/baseline.json": JSON.stringify({ "src/a.ts": { "eslint(no-debugger)": "many" } }),
    });
    const run = ratchet(root);
    expect(run.status).not.toBe(0);
    expect(run.out).toContain("baseline.json is malformed");
  });
});

describe("the repository's tool configs", () => {
  test("oxfmt formats code and leaves fixtures, donor material, Markdown and YAML byte-for-byte alone", () => {
    const unformatted = "export const x   =  { a:1 }\n";
    const root = tree({
      "src/a.ts": unformatted,
      "schemas/a.schema.json": '{"a":1}',
      "tests/fixtures/invalid/skills/alpha/SKILL.md": "Uses __DENY_MODEL_TERM__ here.\n",
      "tests/fixtures/valid/src/b.ts": unformatted,
      "provenance/donor-snapshots/x/c.ts": unformatted,
      "research/sources/d.json": '{"a":1}',
      "evals/demo/_fixtures/repo/e.js": unformatted,
      "skills/alpha/SKILL.md": "*   item\n",
      "catalog.yaml": "a:   1\n",
    });
    copyFileSync(join(REPO, ".oxfmtrc.json"), join(root, ".oxfmtrc.json"));
    const run = spawnSync(join(BIN, "oxfmt"), ["--list-different", "."], { cwd: root, encoding: "utf8" });
    const listed = run.stdout.split("\n").filter(Boolean).toSorted();
    expect(listed).toEqual(["schemas/a.schema.json", "src/a.ts"]);
  });

  test("oxlint loads the vendored anti-slop plugin and rejects a laundered type", () => {
    const root = tree({ "src/a.ts": "export const read = (body: string) => body as unknown as number;\n" });
    copyFileSync(join(REPO, ".oxlintrc.json"), join(root, ".oxlintrc.json"));
    mkdirSync(join(root, "tools", "oxlint"), { recursive: true });
    symlinkSync(join(REPO, "tools", "oxlint", "anti-slop"), join(root, "tools", "oxlint", "anti-slop"));
    // Type-aware rules look for tsgolint under the linted tree's own node_modules.
    symlinkSync(join(REPO, "node_modules"), join(root, "node_modules"));
    const run = spawnSync(join(BIN, "oxlint"), ["--format=json", "src"], { cwd: root, encoding: "utf8" });
    const codes = JSON.parse(run.stdout).diagnostics.map((d: { code: string }) => d.code);
    expect(codes).toContain("anti-slop(no-chained-type-assertions)");
  });
});
