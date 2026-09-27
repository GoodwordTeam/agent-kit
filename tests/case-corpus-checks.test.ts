import { describe, expect, test } from "bun:test";

import {
  checkCaseNames,
  checkFiredIndicators,
  isFiredIndicator,
  isSlashInvocation,
  missingFiredIndicator,
} from "../src/validation/graders.ts";
import { makeTree } from "./helpers/tree.ts";

const fired = (skill: string, extra: Record<string, unknown> = {}) => ({
  name: "skill-fired",
  type: "tool_used",
  tool: "Skill",
  input_match: `"skill"\\s*:\\s*"(?:[^"]*:)?${skill}"`,
  arm: "with-only",
  ...extra,
});

const caseDoc = (tags: string[], graders: unknown[]) => ({ tags, graders });

describe("isFiredIndicator", () => {
  test("the §9 grader is an indicator for its own skill", () => {
    expect(isFiredIndicator(fired("diagnose"), "diagnose")).toBe(true);
  });

  test("a must-not-load grader is not an indicator", () => {
    expect(isFiredIndicator(fired("diagnose", { min: 0, max: 0 }), "diagnose")).toBe(false);
  });

  test("a Skill grader scored on both arms is not an indicator", () => {
    expect(isFiredIndicator(fired("diagnose", { arm: "both" }), "diagnose")).toBe(false);
  });

  test("an input_match anchored on another skill's id does not count, even when that id is a prefix", () => {
    expect(isFiredIndicator(fired("compound"), "compound-refresh")).toBe(false);
    expect(isFiredIndicator(fired("compound-refresh"), "compound")).toBe(false);
  });

  test("an indicator with no input_match counts: the schema does not require one", () => {
    const { input_match: _, ...bare } = fired("diagnose");
    expect(isFiredIndicator(bare, "diagnose")).toBe(true);
  });
});

describe("missingFiredIndicator", () => {
  test("positive and adversarial cases without one are reported by kind", () => {
    expect(missingFiredIndicator(caseDoc(["positive"], []), "alpha")).toEqual(["positive"]);
    expect(missingFiredIndicator(caseDoc(["adversarial", "scenario-3"], []), "alpha")).toEqual(["adversarial"]);
  });

  test("negative, resumability and missing-tools cases are not asked for one", () => {
    for (const kind of ["negative", "resumability", "missing-tools"]) {
      expect(missingFiredIndicator(caseDoc([kind], []), "alpha")).toEqual([]);
    }
  });

  test("a case carrying the indicator passes", () => {
    expect(missingFiredIndicator(caseDoc(["positive"], [fired("alpha")]), "alpha")).toEqual([]);
  });
});

describe("a typed slash invocation is exempt from the indicator", () => {
  // claude 2.1.282 expands `/ak:<id>` on the client: no Skill tool call, so a
  // Skill indicator on such a case could never pass.
  const slash = (prompt: string) => ({ tags: ["positive"], graders: [], execution: { prompt } });

  test("a prompt beginning with the case's own /ak:<id> needs no indicator", () => {
    expect(isSlashInvocation(slash("/ak:alpha Chart the migration."), "alpha")).toBe(true);
    expect(missingFiredIndicator(slash("/ak:alpha Chart the migration."), "alpha")).toEqual([]);
    expect(missingFiredIndicator(slash("/ak:alpha"), "alpha")).toEqual([]);
  });

  test("another skill's command, a longer id, or the command mid-prompt is not exempt", () => {
    expect(missingFiredIndicator(slash("/ak:beta Chart the migration."), "alpha")).toEqual(["positive"]);
    expect(missingFiredIndicator(slash("/ak:compound-refresh Refresh them."), "compound")).toEqual(["positive"]);
    expect(missingFiredIndicator(slash("Please run /ak:alpha on this."), "alpha")).toEqual(["positive"]);
    expect(missingFiredIndicator(slash("Run alpha on this."), "alpha")).toEqual(["positive"]);
  });
});

const CASE = (name: string, tags: string, graders = "") =>
  `schema_version: "1.1"\nname: ${name}\ntags: ${tags}\nexecution:\n  prompt: "do it"\n  max_turns: 4\n  allowed_tools: [Skill]\ngraders:\n  - name: said-so\n    type: llm\n    criteria: "It says so."\n${graders}`;

const FIRED_YAML = (skill: string) =>
  `  - name: skill-fired\n    type: tool_used\n    tool: Skill\n    input_match: '"skill"\\s*:\\s*"(?:[^"]*:)?${skill}"'\n    arm: with-only\n`;

describe("checkFiredIndicators over a tree", () => {
  test("reports the case file and names the skill in the remedy", () => {
    const root = makeTree({
      "evals/alpha/fires/case.yaml": CASE("alpha-fires", "[positive]"),
      "evals/alpha/holds/case.yaml": CASE("alpha-holds", "[adversarial]", FIRED_YAML("alpha")),
      "evals/alpha/ignores/case.yaml": CASE("alpha-ignores", "[negative]"),
    });
    const issues = checkFiredIndicators({ root } as never);
    expect(issues.map((i) => [i.rule, i.file, i.severity])).toEqual([
      ["evals.no-fired-indicator", "evals/alpha/fires/case.yaml", "error"],
    ]);
    expect(issues[0]?.message).toContain("?alpha");
  });
});

describe("checkCaseNames over a tree", () => {
  test("one name in two skills is reported on both cases", () => {
    const root = makeTree({
      "evals/alpha/resume/case.yaml": CASE("resumes-on-the-key", "[resumability]"),
      "evals/beta/resume/case.yaml": CASE("resumes-on-the-key", "[resumability]"),
      "evals/beta/other/case.yaml": CASE("beta-other", "[negative]"),
    });
    const issues = checkCaseNames({ root } as never);
    expect(issues.map((i) => i.file).sort()).toEqual(["evals/alpha/resume/case.yaml", "evals/beta/resume/case.yaml"]);
    expect(issues.every((i) => i.rule === "evals.duplicate-case-name" && i.severity === "error")).toBe(true);
  });

  test("the same directory name under two skills is fine when the names differ", () => {
    const root = makeTree({
      "evals/alpha/resume/case.yaml": CASE("alpha-resumes-on-the-key", "[resumability]"),
      "evals/beta/resume/case.yaml": CASE("beta-resumes-on-the-key", "[resumability]"),
    });
    expect(checkCaseNames({ root } as never)).toEqual([]);
  });
});
