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
    // Asserted against the list rather than the whole message. The earlier form
    // searched the message for a bare `1` to show scenario 1 was absent, which
    // read the prose as well as the list and so could not survive the message
    // saying anything else numeric. Parsing out the list is what the test meant
    // and is stronger besides: the set is compared exactly, so a scenario
    // wrongly listed fails as loudly as one wrongly missing.
    const listed = /^release scenarios no case tags: ([^.]+)\./.exec(note?.message ?? "")?.[1];
    expect(listed).toBe(RELEASE_SCENARIOS.filter((n) => n !== 1).join(", "));
  });

  test("a case tagging every scenario leaves none uncovered", () => {
    const tags = `[${RELEASE_SCENARIOS.map((n) => `scenario-${String(n).padStart(2, "0")}`).join(", ")}]`;
    const files: Record<string, string> = { "skills/alpha/skill.yaml": declare(THREE) };
    for (const c of THREE) files[`${EVALS_DIR}/alpha/${c.id}/case.yaml`] = CASE(c.id, tags);
    const issues = checkEvals(ctxFor(files));
    expect(issues.filter((i) => i.rule === "evals.uncovered-scenarios")).toEqual([]);
  });

  test("the note says what it counted, and does not claim the tagged scenarios were tested", () => {
    // The message read "The corpus must cover all 24 across the catalog", which
    // is a claim about testing made by a check that counted tag strings. Every
    // reader of a run reporting 17 took it to mean 17 untested and 7 tested. A
    // case reduced to `tags: [scenario-18]` produces the identical reading.
    const note = checkEvals(complete()).find((i) => i.rule === "evals.uncovered-scenarios");
    expect(note?.message).toMatch(/tag/);
    expect(note?.message).toMatch(/not|nothing|no case was/i);
    expect(note?.message).not.toContain("must cover");
  });
});

describe("a scenario tag outside the release range", () => {
  const tagged = (tags: string) => {
    const files: Record<string, string> = { "skills/alpha/skill.yaml": declare(THREE) };
    for (const c of THREE) files[`${EVALS_DIR}/alpha/${c.id}/case.yaml`] = CASE(c.id, tags);
    return checkEvals(ctxFor(files));
  };
  const rejected = (tags: string) => tagged(tags).filter((i) => i.rule === "evals.scenario-tag-out-of-range");

  test("scenario-31 is an error naming the case file and the tag", () => {
    // `scenario-31` typed for `scenario-13` parses, contributes nothing to
    // `covered`, and is filtered back out of `uncovered` because that list runs
    // over 1-24. The writer loses the scenario they meant and the run says
    // nothing, which is indistinguishable from never having tagged the case.
    const issue = rejected("[scenario-31]")[0];
    expect(issue?.severity).toBe("error");
    expect(issue?.file).toBe(`${EVALS_DIR}/alpha/fires-on-trigger/case.yaml`);
    expect(issue?.message).toContain("scenario-31");
    expect(issue?.message).toContain("24");
  });

  test("scenario-24 is accepted: the boundary is the only input that separates the two checks", () => {
    // The control, and the reason there are two assertions. An off-by-one range
    // test and a correct one agree on every out-of-range input; they differ on
    // 24 alone, so the first test above passes under both.
    expect(rejected("[scenario-24]")).toEqual([]);
    expect(rejected("[scenario-01]")).toEqual([]);
  });

  test("scenario-0 is rejected at the low end too", () => {
    expect(rejected("[scenario-0]")).toHaveLength(3);
    expect(rejected("[scenario-00]")).toHaveLength(3);
  });

  test("a tag that is not a scenario claim at all is left alone", () => {
    // The population this rule owns is tags claiming a release scenario. A tag
    // naming something else is not a malformed scenario tag, and reporting one
    // would make the rule fire on every corpus that tags anything.
    expect(rejected("[smoke, slow]")).toEqual([]);
  });

  test("a scenario claim the old pattern silently dropped is reported, not ignored", () => {
    // `^scenario-(\d{1,2})$` did not match these, so they never reached the
    // range test and were discarded with the same silence. The prefix is the
    // claim; what follows it is either a scenario in range or a mistake.
    expect(rejected("[scenario-100]")).toHaveLength(3);
    expect(rejected("[scenario-1a]")).toHaveLength(3);
  });

  test("an out-of-range tag contributes nothing to coverage while its neighbour does", () => {
    // Paired in one case so the two readings come from the same run: 2 leaves
    // the uncovered list and 31 never enters it. Without the valid tag beside
    // it, `covered` is empty, the note is suppressed by its own guard, and the
    // assertion would pass on a build that counted 31 as coverage.
    const issues = tagged("[scenario-02, scenario-31]");
    expect(issues.some((i) => i.rule === "evals.scenario-tag-out-of-range")).toBe(true);
    const uncovered = issues.find((i) => i.rule === "evals.uncovered-scenarios");
    expect(uncovered?.message).toContain("1, 3, 4");
    expect(uncovered?.message).not.toMatch(/\b31\b/);
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

describe("one scenario written two ways", () => {
  const tagged = (tags: string) => {
    const files: Record<string, string> = { "skills/alpha/skill.yaml": declare(THREE) };
    for (const c of THREE) files[`${EVALS_DIR}/alpha/${c.id}/case.yaml`] = CASE(c.id, tags);
    return checkEvals(ctxFor(files));
  };
  const spelling = (tags: string) => tagged(tags).filter((i) => i.rule === "evals.scenario-tag-noncanonical");

  // `scenarioTags` reads `Number("06")` as 6, so a padded tag has always counted
  // toward coverage and nothing here changes that. What it costs is readers:
  // three scenarios in this tree are tagged both ways across different files, and
  // every ad-hoc `grep scenario-6` over the corpus -- including mine, which is
  // what produced a false gap report and sent two lanes after it -- silently
  // excludes one spelling while looking exactly like a search that found
  // everything. The validator was right and was not consulted.
  test("a padded tag is reported, naming both spellings", () => {
    const issue = spelling("[scenario-06]")[0];
    expect(issue?.severity).toBe("warning");
    expect(issue?.message).toContain("scenario-06");
    expect(issue?.message).toContain("scenario-6");
  });

  test("the canonical spelling is not reported", () => {
    expect(spelling("[scenario-6]")).toEqual([]);
  });

  test("a two-digit scenario is canonical as written", () => {
    // The boundary that separates "strip leading zeros" from "tags must be one
    // character": 24 has no padded form and must not be reported.
    expect(spelling("[scenario-24]")).toEqual([]);
  });

  test("padding still counts toward coverage, because this rule is about spelling", () => {
    // The control against fixing the spelling by dropping the tag. If a future
    // change made a padded tag non-covering, this is the assertion that fails.
    const uncovered = tagged("[scenario-06]").find((i) => i.rule === "evals.uncovered-scenarios");
    expect(uncovered?.message).not.toMatch(/\b6\b/);
  });

  test("a tag that is not a scenario claim is left alone", () => {
    expect(spelling("[smoke, slow]")).toEqual([]);
  });
});
