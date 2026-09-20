/** The ticket's own acceptance tests. AC-1 is red before the change and green after. */
import { expect, test, beforeEach } from "bun:test";
import { record, consumed, remaining, reset } from "../src/quota.ts";

beforeEach(() => reset());

test("AC-1: consumed counts only the tenant asked for", () => {
  record("acme", 10);
  record("globex", 30);
  expect(consumed("acme")).toBe(10);
  expect(consumed("globex")).toBe(30);
});

test("AC-2: remaining subtracts that tenant's usage from that tenant's limit", () => {
  record("acme", 10);
  record("globex", 30);
  expect(remaining("acme")).toBe(90);
  expect(remaining("globex")).toBe(220);
});
