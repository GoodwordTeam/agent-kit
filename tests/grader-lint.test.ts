/**
 * Eval graders that cannot fail (AUTHORING.md §9).
 *
 * Two halves, one per kind of grader:
 *
 * - `llm` graders are judged by a model, so no local transcript can score
 *   them. They are covered by the surface lint (`graders.ts`, check
 *   `evals.llm-file-claim-without-focus`), NOT by the mutation test below: the
 *   lint fails a file claim that the host would score against the last message.
 * - Deterministic graders (`tool_used`, `tool_order`, `file_exists`, `regex`)
 *   are mutation-tested: for every one in the corpus the test builds a
 *   transcript the grader must fail, and a transcript it must pass where one
 *   can be built, and scores both with the local evaluator in `grader-eval.ts`.
 *   A grader that passes its own failing transcript measures nothing.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";
import { parse as parseYaml } from "yaml";

import type { Catalog } from "../src/catalog/load.ts";
import { DETERMINISTIC_TYPES, callMatches, evaluate, globToRegExp, type Grader, type ToolCall, type Transcript } from "../src/validation/grader-eval.ts";
import { checkGraderSurfaces, fileClaim, unaimedClaims } from "../src/validation/graders.ts";
import { makeTree } from "./helpers/tree.ts";

const ROOT = join(import.meta.dir, "..");

/** The surface check reads only the tree, so the catalog is not consulted. */
const at = (root: string) => ({ root, catalog: {} as Catalog });

const EMPTY: Transcript = { toolCalls: [], lastMessage: "", filesCreated: [] };

describe("fileClaim", () => {
  test.each([
    "No file is created in the working repository.",
    "The run does not edit any file under src/.",
    "Nothing is written to disk.",
    "It stages only the paths it owns; the unrelated file is not staged.",
    "No directory is removed.",
  ])("finds the claim in %p", (criteria) => {
    expect(fileClaim(criteria)).not.toBeNull();
  });

  test.each([
    "The reply names the file extensions it would accept.",
    "The response covers the happy path and one failure.",
    "The run creates one ticket and records its id.",
    "It names the missing knowledgebase adapter.",
  ])("does not flag %p", (criteria) => {
    expect(fileClaim(criteria)).toBeNull();
  });

  test("needs both halves in one sentence", () => {
    expect(fileClaim("The reply names the file. It creates a ticket.")).toBeNull();
  });
});

describe("unaimedClaims", () => {
  const grader = (extra: Record<string, unknown>) => ({
    graders: [{ name: "g", type: "llm", criteria: "No file is created in the repository.", ...extra }],
  });

  test("an llm file claim with no focus is reported", () => {
    expect(unaimedClaims(grader({}))).toEqual([{ grader: "g", sentence: "No file is created in the repository." }]);
  });

  test("any explicit focus clears it, including last_message", () => {
    for (const focus of ["trace", "files", "last_message", { source: "file", path: "out.md" }]) {
      expect(unaimedClaims(grader({ focus }))).toEqual([]);
    }
  });

  test("a deterministic grader is not the lint's business", () => {
    expect(unaimedClaims({ graders: [{ name: "g", type: "regex", pattern: "file created" }] })).toEqual([]);
  });
});

describe("checkGraderSurfaces", () => {
  test("errors on an unaimed claim in a case file", () => {
    const root = makeTree({
      "evals/alpha/writes-nothing/case.yaml":
        "graders:\n  - name: no-file\n    type: llm\n    criteria: No file is written to the repository.\n",
    });
    const issues = checkGraderSurfaces(at(root));
    expect(issues.map((i) => [i.rule, i.file])).toEqual([
      ["evals.llm-file-claim-without-focus", "evals/alpha/writes-nothing/case.yaml"],
    ]);
    expect(issues[0]?.severity).toBe("error");
  });

  test("the corpus has no unaimed file claim", () => {
    expect(checkGraderSurfaces(at(ROOT))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mutation: every deterministic corpus grader can fail.

interface CorpusGrader {
  readonly where: string;
  readonly grader: Grader;
}

function corpusGraders(): CorpusGrader[] {
  const out: CorpusGrader[] = [];
  for (const path of [...new Glob("evals/*/*/case.yaml").scanSync(ROOT)].sort()) {
    const doc = parseYaml(readFileSync(join(ROOT, path), "utf8")) as { graders?: Grader[] };
    for (const grader of doc.graders ?? []) {
      if (DETERMINISTIC_TYPES.has(String(grader["type"]))) out.push({ where: `${path} :: ${String(grader["name"])}`, grader });
    }
  }
  return out;
}

/** Inputs a real run could send, tried in order until one satisfies an `input_match`. */
function candidateInputs(): unknown[] {
  const skills = [...new Glob("*").scanSync({ cwd: join(ROOT, "evals"), onlyFiles: false })];
  return [
    {},
    ...skills.flatMap((s) => [{ skill: `ak:${s}` }, { skill: s }]),
    { command: "git push origin HEAD" },
    { command: "gh pr create --fill" },
    { command: "gh pr merge 1" },
    { command: "gh api graphql -f query='mutation { resolveReviewThread }'" },
    { command: "no-mistakes status" },
    { file_path: "src/cookie.ts", content: "x" },
  ];
}

const INPUTS = candidateInputs();

/** A call that `ref` matches, or null when no candidate input does. */
function witnessCall(ref: unknown): ToolCall | null {
  const r = typeof ref === "string" ? { tool: ref } : (ref as { tool: string; input_match?: string });
  for (const input of INPUTS) {
    const call: ToolCall = { name: r.tool, input };
    if (callMatches(call, r)) return call;
  }
  return null;
}

/** A string `pattern` matches, by naive unescaping; checked by the caller. */
function witnessText(pattern: string, flags: string): string | null {
  const text = pattern
    .replace(/^\^/, "")
    .replace(/\$$/, "")
    .replace(/\\s[*+]?/g, " ")
    .replace(/\\(.)/g, "$1");
  return new RegExp(pattern, flags).test(text) ? text : null;
}

/** A path the glob matches. */
function witnessPath(glob: string): string | null {
  const path = glob.replace(/\*\*\//g, "a/").replace(/\*\*/g, "a").replace(/\*/g, "a").replace(/\?/g, "a");
  return globToRegExp(glob).test(path) ? path : null;
}

function times(call: ToolCall, n: number): ToolCall[] {
  return Array.from({ length: n }, () => call);
}

/** A transcript the grader must fail and, where one exists, one it must pass. */
function mutants(g: Grader): { failing: Transcript; passing: Transcript | null } | string {
  switch (g["type"]) {
    case "tool_used": {
      const call = witnessCall({ tool: g["tool"], input_match: g["input_match"] });
      if (call === null) return `no candidate input matches input_match ${String(g["input_match"])}`;
      const min = typeof g["min"] === "number" ? g["min"] : 1;
      const max = typeof g["max"] === "number" ? g["max"] : null;
      if (min === 0 && max === null) return "min 0 with no max passes every transcript";
      const failing = max === null ? times(call, min - 1) : times(call, max + 1);
      return { failing: { ...EMPTY, toolCalls: failing }, passing: { ...EMPTY, toolCalls: times(call, min) } };
    }
    case "tool_order": {
      const before = witnessCall(g["before"]);
      const after = witnessCall(g["after"]);
      if (before === null || after === null) return "no candidate input matches one side";
      return { failing: { ...EMPTY, toolCalls: [after, before] }, passing: { ...EMPTY, toolCalls: [before, after] } };
    }
    case "file_exists": {
      const path = witnessPath(String(g["path"]));
      if (path === null) return `no witness path for ${String(g["path"])}`;
      const withFile = { ...EMPTY, filesCreated: [path] };
      return g["exists"] === false ? { failing: withFile, passing: EMPTY } : { failing: EMPTY, passing: withFile };
    }
    case "regex": {
      const flags = typeof g["flags"] === "string" ? g["flags"] : "";
      const text = witnessText(String(g["pattern"]), flags);
      if (text === null) return `no witness text for ${String(g["pattern"])}`;
      const on = (s: string): Transcript =>
        g["target"] === "files" ? { ...EMPTY, filesCreated: s === "" ? [] : [s] } : { ...EMPTY, lastMessage: s };
      const match = typeof g["match"] === "string" ? g["match"] : "contains";
      if (match === "contains") return { failing: on(""), passing: on(text) };
      if (match === "not_contains") return { failing: on(text), passing: on("") };
      const n = Number(match.slice("count:".length));
      return { failing: on(Array(n + 1).fill(text).join("\n")), passing: on(Array(n).fill(text).join("\n")) };
    }
    default:
      return `unmodelled type ${String(g["type"])}`;
  }
}

describe("every deterministic corpus grader can fail", () => {
  const graders = corpusGraders();

  test("the corpus has deterministic graders to test", () => {
    expect(graders.length).toBeGreaterThan(0);
  });

  test.each(graders.map((g) => [g.where, g.grader] as const))("%s", (_where, grader) => {
    const m = mutants(grader);
    if (typeof m === "string") throw new Error(m);
    expect(evaluate(grader, m.failing)).toBe(false);
    if (m.passing !== null) expect(evaluate(grader, m.passing)).toBe(true);
  });
});

describe("evaluate", () => {
  test("tool_order fails when either side is never called", () => {
    const g = { type: "tool_order", before: "Skill", after: "Write" };
    expect(evaluate(g, { ...EMPTY, toolCalls: [{ name: "Skill", input: {} }] })).toBe(false);
    expect(evaluate(g, { ...EMPTY, toolCalls: [{ name: "Write", input: {} }] })).toBe(false);
  });

  test("file_exists sees created files only, and ** spans segments", () => {
    const g = { type: "file_exists", path: "docs/**/*.md" };
    expect(evaluate(g, { ...EMPTY, filesCreated: ["docs/a/b/c.md"] })).toBe(true);
    expect(evaluate(g, { ...EMPTY, filesCreated: ["docs/c.md"] })).toBe(true);
    expect(evaluate(g, { ...EMPTY, filesCreated: ["src/c.md"] })).toBe(false);
  });

  test("llm and baseline are not scored here", () => {
    expect(evaluate({ type: "llm", criteria: "x" }, EMPTY)).toBeNull();
    expect(evaluate({ type: "baseline" }, EMPTY)).toBeNull();
  });
});
