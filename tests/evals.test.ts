import { describe, expect, test } from "bun:test";

import { loadCatalog } from "../src/catalog/load.ts";
import { EVALS_DIR, REQUIRED_CASE_KINDS, RELEASE_SCENARIOS, checkEvals } from "../src/validation/evals.ts";
import { makeTree } from "./helpers/tree.ts";

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
skills:
  - id: alpha
    status: authored
    invocation: U
`;

const CASE = (name: string, tags = "[scenario-01]") =>
  `schema_version: "1.1"\nname: ${name}\ntags: ${tags}\nexecution:\n  prompt: "do the thing"\ngraders:\n  - name: fired\n    type: tool_used\n    tool: Skill\n`;

/** A declaration block for skill.yaml's tests[]. */
function declare(cases: ReadonlyArray<{ id: string; kind: string; fixture?: string }>): string {
  return `id: alpha\ntests:\n${cases
    .map(
      (c) =>
        `  - id: ${c.id}\n    kind: ${c.kind}\n    given: a prompt\n    expect: an outcome\n${c.fixture === undefined ? "" : `    fixture: ${c.fixture}\n`}`,
    )
    .join("")}`;
}

const THREE = [
  { id: "fires-on-trigger", kind: "positive" },
  { id: "ignores-near-miss", kind: "negative" },
  { id: "holds-under-pressure", kind: "adversarial" },
];

function ctxFor(files: Record<string, string>) {
  const root = makeTree({ "catalog.yaml": CATALOG, "skills/alpha/SKILL.md": "# Alpha\n", ...files });
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

function complete(extra: Record<string, string> = {}, cases = THREE) {
  const files: Record<string, string> = { "skills/alpha/skill.yaml": declare(cases) };
  for (const c of cases) files[`${EVALS_DIR}/alpha/${c.id}/case.yaml`] = CASE(c.id);
  return ctxFor({ ...files, ...extra });
}

const errors = (issues: ReturnType<typeof checkEvals>) => issues.filter((i) => i.severity === "error");

describe("the three-way split (AUTHORING 9)", () => {
  test("three declared cases, three executable cases, all kinds present passes", () => {
    expect(errors(checkEvals(complete()))).toEqual([]);
  });

  test("a declared case with no executable counterpart is an error naming the expected path", () => {
    const files: Record<string, string> = { "skills/alpha/skill.yaml": declare(THREE) };
    for (const c of THREE.slice(0, 2)) files[`${EVALS_DIR}/alpha/${c.id}/case.yaml`] = CASE(c.id);
    const issue = errors(checkEvals(ctxFor(files))).find((i) => i.rule === "evals.declaration-without-case");
    expect(issue?.file).toBe(`${EVALS_DIR}/alpha/holds-under-pressure/case.yaml`);
    expect(issue?.message).toContain("holds-under-pressure");
  });

  test("an executable case nothing declares is an error naming the skill manifest", () => {
    const issue = errors(
      checkEvals(complete({ [`${EVALS_DIR}/alpha/orphan-case/case.yaml`]: CASE("orphan-case") })),
    ).find((i) => i.rule === "evals.case-without-declaration");
    expect(issue?.file).toBe(`${EVALS_DIR}/alpha/orphan-case/case.yaml`);
    expect(issue?.message).toContain("skills/alpha/skill.yaml");
  });

  test("the case directory name is the join: a renamed directory breaks both directions", () => {
    const files: Record<string, string> = { "skills/alpha/skill.yaml": declare(THREE) };
    for (const c of THREE.slice(0, 2)) files[`${EVALS_DIR}/alpha/${c.id}/case.yaml`] = CASE(c.id);
    files[`${EVALS_DIR}/alpha/holds-under-presure/case.yaml`] = CASE("holds-under-pressure");
    const rules = errors(checkEvals(ctxFor(files))).map((i) => i.rule);
    expect(rules).toContain("evals.declaration-without-case");
    expect(rules).toContain("evals.case-without-declaration");
  });

  test("a case directory with no case.yaml in it is an error", () => {
    const ctx = complete({ [`${EVALS_DIR}/alpha/fires-on-trigger/README.md`]: "notes\n" });
    // A directory alongside the case file changes nothing; a directory *instead of*
    // the case file is still no executable case.
    const withoutCaseFile = ctxFor({
      "skills/alpha/skill.yaml": declare(THREE),
      [`${EVALS_DIR}/alpha/fires-on-trigger/notes.md`]: "x\n",
      [`${EVALS_DIR}/alpha/ignores-near-miss/case.yaml`]: CASE("ignores-near-miss"),
      [`${EVALS_DIR}/alpha/holds-under-pressure/case.yaml`]: CASE("holds-under-pressure"),
    });
    expect(errors(checkEvals(ctx)).filter((i) => i.rule === "evals.declaration-without-case")).toEqual([]);
    const issue = errors(checkEvals(withoutCaseFile)).find((i) => i.rule === "evals.declaration-without-case");
    expect(issue?.message).toContain("fires-on-trigger");
  });

  test("an evals directory for a skill the catalog does not declare is an error", () => {
    const issue = errors(checkEvals(complete({ [`${EVALS_DIR}/ghost/a-case/case.yaml`]: CASE("a-case") }))).find(
      (i) => i.rule === "evals.unknown-skill-directory",
    );
    expect(issue?.message).toContain("ghost");
  });
});

describe("the floor is three cases with all three kinds", () => {
  test("two cases is a failure even though the schema floors tests[] at two", () => {
    const ctx = complete({}, THREE.slice(0, 2));
    const issue = errors(checkEvals(ctx)).find((i) => i.rule === "evals.too-few-cases");
    expect(issue?.file).toBe("skills/alpha/skill.yaml");
    expect(issue?.message).toContain("3");
  });

  test("three cases missing the adversarial kind fails naming that kind", () => {
    const ctx = complete({}, [
      { id: "fires-on-trigger", kind: "positive" },
      { id: "ignores-near-miss", kind: "negative" },
      { id: "also-fires", kind: "positive" },
    ]);
    const issue = errors(checkEvals(ctx)).find((i) => i.rule === "evals.missing-case-kind");
    expect(issue?.message).toContain("adversarial");
    expect(issue?.message).not.toContain("positive");
  });

  test("each required kind is named when it is the one missing", () => {
    for (const missing of REQUIRED_CASE_KINDS) {
      const kinds = REQUIRED_CASE_KINDS.filter((k) => k !== missing);
      const cases = [...kinds.map((k, i) => ({ id: `case-${i}`, kind: k })), { id: "case-filler", kind: kinds[0] as string }];
      const issue = errors(checkEvals(complete({}, cases))).find((i) => i.rule === "evals.missing-case-kind");
      expect(issue?.message).toContain(missing);
    }
  });

  test("a skill declaring no tests at all is a failure, not an exemption", () => {
    const ctx = ctxFor({ "skills/alpha/skill.yaml": "id: alpha\n" });
    expect(errors(checkEvals(ctx)).some((i) => i.rule === "evals.too-few-cases")).toBe(true);
  });

  test("two declarations sharing an id is an error: the id is the join", () => {
    const ctx = complete({}, [
      { id: "same-id", kind: "positive" },
      { id: "same-id", kind: "negative" },
      { id: "third", kind: "adversarial" },
    ]);
    expect(errors(checkEvals(ctx)).some((i) => i.rule === "evals.duplicate-case-id")).toBe(true);
  });
});

describe("fixtures the cases point at", () => {
  test("a fixture path that resolves passes", () => {
    const cases = [{ ...THREE[0]!, fixture: "skills/alpha/tests/patch.diff" }, THREE[1]!, THREE[2]!];
    const ctx = complete({ "skills/alpha/tests/patch.diff": "diff\n" }, cases);
    expect(errors(checkEvals(ctx))).toEqual([]);
  });

  test("a fixture path that resolves to nothing is an error naming the declaring case", () => {
    const cases = [{ ...THREE[0]!, fixture: "skills/alpha/tests/absent.diff" }, THREE[1]!, THREE[2]!];
    const issue = errors(checkEvals(complete({}, cases))).find((i) => i.rule === "evals.fixture-not-found");
    expect(issue?.file).toBe("skills/alpha/tests/absent.diff");
    expect(issue?.message).toContain("fires-on-trigger");
  });

  test("a fixture outside the skill's own tests/ is a warning, not a silent pass", () => {
    const cases = [{ ...THREE[0]!, fixture: "shared/patch.diff" }, THREE[1]!, THREE[2]!];
    const ctx = complete({ "shared/patch.diff": "diff\n" }, cases);
    const issue = checkEvals(ctx).find((i) => i.rule === "evals.fixture-outside-skill");
    expect(issue?.severity).toBe("warning");
    expect(issue?.message).toContain("skills/alpha/tests/");
  });
});

describe("release scenario coverage", () => {
  test("uncovered scenario numbers are reported", () => {
    const note = checkEvals(complete()).find((i) => i.rule === "evals.uncovered-scenarios");
    expect(note?.severity).toBe("note");
    expect(note?.message).toContain("2");
    expect(note?.message).not.toMatch(/(^|\D)1(\D|$)/); // scenario 1 is tagged by every case here
  });

  test("a case tagging every scenario leaves none uncovered", () => {
    const tags = `[${RELEASE_SCENARIOS.map((n) => `scenario-${String(n).padStart(2, "0")}`).join(", ")}]`;
    const files: Record<string, string> = { "skills/alpha/skill.yaml": declare(THREE) };
    for (const c of THREE) files[`${EVALS_DIR}/alpha/${c.id}/case.yaml`] = CASE(c.id, tags);
    const issues = checkEvals(ctxFor(files));
    expect(issues.filter((i) => i.rule === "evals.uncovered-scenarios")).toEqual([]);
  });
});

describe("absent trees", () => {
  test("no evals directory and no authored skills reports a note, not a crash", () => {
    const ctx = ctxFor({});
    const issues = checkEvals(ctx);
    expect(issues.every((i) => i.severity !== "error" || i.rule === "evals.too-few-cases")).toBe(true);
    expect(issues.some((i) => i.rule === "evals.directory-unavailable")).toBe(true);
  });

  test("a skill with no skill.yaml is not judged here", () => {
    const ctx = ctxFor({ [`${EVALS_DIR}/README.md`]: "cases live here\n" });
    expect(errors(checkEvals(ctx)).filter((i) => i.file === "skills/alpha/skill.yaml")).toEqual([]);
  });
});
