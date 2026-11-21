import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolvePolicy } from "../src/lifecycle/unattended.ts";
import { makeTree } from "./helpers/tree.ts";

test("Goodword does not ship a repository unattended-policy opt-in", () => {
  expect(existsSync(join(import.meta.dir, "../ak.lifecycle.json"))).toBe(false);
});

test("a supervisor name alone never selects unattended operation", () => {
  const project = makeTree({ "readme.txt": "manual project" });
  expect(resolvePolicy(project, { AK_LIFECYCLE_SUPERVISOR: "reviewer-1" })).toEqual({ ok: true });
});

test("the supervisor-name dependency rejects malformed names before a phase can use them", () => {
  const project = makeTree({ "readme.txt": "manual project" });
  for (const name of ["", "reviewer\nother", "-reviewer", "a".repeat(65)]) {
    expect(resolvePolicy(project, { AK_LIFECYCLE_POLICY: "unattended", AK_LIFECYCLE_SUPERVISOR: name })).toEqual({
      ok: false,
      reason: "AK_LIFECYCLE_SUPERVISOR must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
    });
  }
});
