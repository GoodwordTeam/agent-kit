import { describe, expect, test } from "bun:test";

import { CHECKS, runValidation } from "../src/validation/run.ts";
import { makeTree, DENY_MARKER, sampleModelTerm } from "./helpers/tree.ts";

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
skills:
  - id: triage
    invocation: U
    status: authored
    profiles: [core]
profiles:
  - id: core
    status: contract
    default: true
`;

const SKILL = `---
name: triage
description: Sort incoming work into the smallest next action.
---

# triage

Read the queue and pick one item.
`;

describe("the validation run", () => {
  test("every check is named and runs in a fixed order", () => {
    expect(CHECKS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(CHECKS.map((c) => c.name)).size).toBe(CHECKS.length);
  });

  test("a clean tree validates with no errors", () => {
    const root = makeTree({ "catalog.yaml": CATALOG, "skills/triage/SKILL.md": SKILL });
    const result = runValidation(root);
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors.map((e) => `${e.rule} ${e.file}`)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("a tree with no catalog reports the missing catalog and does not crash", () => {
    const result = runValidation(makeTree({ "README.md": "nothing here\n" }));
    expect(result.issues.some((i) => i.rule === "catalog.missing")).toBe(true);
    expect(result.ok).toBe(false);
  });

  test("failures from every layer are aggregated into one sorted list", () => {
    const root = makeTree({
      "catalog.yaml": `${CATALOG}  - id: ghost
    invocation: M
    status: contract
`,
      "skills/triage/SKILL.md": SKILL.replace("Read the queue", `Read the queue with ${DENY_MARKER}`).replace(
        DENY_MARKER,
        sampleModelTerm(),
      ),
      "skills/stray/SKILL.md": SKILL,
    });
    const result = runValidation(root);
    const rules = result.issues.map((i) => i.rule);
    expect(rules).toContain("content.denylist");
    expect(rules).toContain("catalog.directory-without-entry");
    expect(result.ok).toBe(false);
    const files = result.issues.map((i) => i.file);
    expect(files).toEqual([...files].sort());
  });

  test("one check throwing does not lose the others", () => {
    const root = makeTree({ "catalog.yaml": CATALOG, "skills/triage/SKILL.md": SKILL });
    const result = runValidation(root, {
      only: ["completeness", "explodes"],
      extraChecks: [
        {
          name: "explodes",
          run: () => {
            throw new Error("boom");
          },
        },
      ],
    });
    expect(result.issues.some((i) => i.rule === "check.threw" && i.message.includes("boom"))).toBe(true);
    expect(result.issues.some((i) => i.rule === "check.threw" && i.message.includes("explodes"))).toBe(true);
  });

  test("the run can be narrowed to named checks", () => {
    const root = makeTree({ "catalog.yaml": CATALOG, "skills/triage/SKILL.md": SKILL, "skills/stray/SKILL.md": SKILL });
    const all = runValidation(root);
    const narrowed = runValidation(root, { only: ["schemas"] });
    expect(all.issues.length).toBeGreaterThan(narrowed.issues.length);
    expect(narrowed.issues.some((i) => i.rule === "catalog.directory-without-entry")).toBe(false);
  });

  test("this repository's own source is not flagged by its own content scan", () => {
    const result = runValidation(process.cwd(), { only: ["content"] });
    const own = result.issues.filter((i) => i.file.startsWith("src/") || i.file.startsWith("tests/"));
    expect(own.map((i) => `${i.rule} ${i.file}:${i.line ?? 0}`)).toEqual([]);
  });
});
