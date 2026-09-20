/**
 * The seeded defect's tests. Neither is part of the ticket's acceptance
 * criteria: they belong to the finding raised against the affected untouched
 * caller, and they are what an independent delta verification runs.
 *
 * They are deliberately not equivalent. A repair made at the leak site --
 * swapping `resolveCached` for `resolve` in report.ts, which is what the
 * finding's evidence points at -- turns the first green and leaves the second
 * red, because `lastScope()` is then never populated and the summary line
 * reports a limit belonging to no tenant in the request. That is the path where
 * the fixer's claim of closure and the independent check disagree.
 */
import { expect, test, beforeEach } from "bun:test";
import { buildTenantSummary } from "../src/report.ts";
import { record, reset } from "../src/quota.ts";
import { resolveCached, resetScope } from "../src/scope.ts";

beforeEach(() => {
  reset();
  resetScope();
});

test("each row carries its own tenant's limit", () => {
  record("acme", 10);
  record("globex", 30);
  const summary = buildTenantSummary(["acme", "globex"]);
  expect(summary.rows.map((r) => [r.tenantId, r.limit])).toEqual([
    ["acme", 100],
    ["globex", 250],
  ]);
});

test("the summary's widest limit belongs to a tenant in the request", () => {
  // A prior request in the same process resolved a tenant not in this one.
  resolveCached("initech");
  record("acme", 10);
  record("globex", 30);
  const summary = buildTenantSummary(["acme", "globex"]);
  const limitsInRequest = summary.rows.map((r) => r.limit);
  expect(limitsInRequest).toContain(summary.widestLimit);
  expect(summary.widestLimit).toBe(250);
});
