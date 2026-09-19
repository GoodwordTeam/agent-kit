import { describe, expect, test } from "bun:test";

import { attach } from "../src/attach/index.ts";
import { BUILTIN_SIGNALS, NEVER_DROPPED_PACKS } from "../src/attach/signals.ts";
import { loadCatalog } from "../src/catalog/load.ts";
import { makeTree } from "./helpers/tree.ts";

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
packs:
  - id: pack-api
    status: contract
    activation: Public interfaces, protocol/OpenAPI definitions, observable response shapes
  - id: pack-delete
    status: contract
  - id: pack-test
    status: contract
  - id: pack-secure
    status: contract
  - id: pack-frontend
    status: contract
  - id: pack-data
    status: contract
  - id: pack-perf
    status: contract
  - id: pack-deps
    status: contract
`;

function ctxFor(files: Record<string, string> = {}) {
  const root = makeTree({ "catalog.yaml": CATALOG, ...files });
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

function packs(result: { selections: ReadonlyArray<{ pack: string }> }): string[] {
  return result.selections.map((s) => s.pack);
}

describe("built-in signals", () => {
  test("every catalog pack has a built-in signal set so selection works with no manifests", () => {
    const ids = BUILTIN_SIGNALS.map((p) => p.pack).sort();
    expect(ids).toEqual([
      "pack-api",
      "pack-data",
      "pack-delete",
      "pack-deps",
      "pack-frontend",
      "pack-perf",
      "pack-secure",
      "pack-test",
    ]);
  });

  test("security, API and data are the packs a manifest may extend but never remove", () => {
    expect([...NEVER_DROPPED_PACKS].sort()).toEqual(["pack-api", "pack-data", "pack-secure"]);
  });
});

describe("selection by artifact and semantics", () => {
  test("an auth path selects pack-secure even with no pack manifests on disk", () => {
    const result = attach(ctxFor(), "src/auth/session.ts");
    expect(packs(result)).toContain("pack-secure");
  });

  test("security content selects pack-secure even when the path says nothing", () => {
    const ctx = ctxFor({ "src/util/thing.ts": 'const h = { Authorization: `Bearer ${token}` };\n' });
    expect(packs(attach(ctx, "src/util/thing.ts"))).toContain("pack-secure");
  });

  test("a plain source file with no security semantics does not select pack-secure", () => {
    const ctx = ctxFor({ "src/util/format.ts": "export const pad = (s: string) => s.padStart(2);\n" });
    expect(packs(attach(ctx, "src/util/format.ts"))).not.toContain("pack-secure");
  });

  test("extension alone never selects a pack: two .ts files select differently", () => {
    const ctx = ctxFor({
      "src/util/format.ts": "export const pad = (s: string) => s.padStart(2);\n",
      "src/auth/session.ts": "export const login = () => null;\n",
    });
    expect(packs(attach(ctx, "src/auth/session.ts"))).toContain("pack-secure");
    expect(packs(attach(ctx, "src/util/format.ts"))).not.toContain("pack-secure");
  });

  test("an OpenAPI document selects pack-api", () => {
    const ctx = ctxFor({ "contracts/service.yaml": "openapi: 3.1.0\npaths: {}\n" });
    expect(packs(attach(ctx, "contracts/service.yaml"))).toContain("pack-api");
  });

  test("a migration path selects pack-data", () => {
    expect(packs(attach(ctxFor(), "db/migrations/20260919_add_column.sql"))).toContain("pack-data");
  });

  test("a ticket artifact claiming a migration sequence selects pack-data although it is a .json file", () => {
    const ticket = JSON.stringify({
      schema: "ticket",
      type: "implementation",
      goal: "add a column",
      write_ownership: { paths: [], generated_artifacts: [], migration_sequence: "20260919", interfaces: [] },
    });
    const ctx = ctxFor({ "templates/ticket.json": ticket });
    const result = attach(ctx, "templates/ticket.json");
    expect(packs(result)).toContain("pack-data");
    expect(result.subject.kind).toBe("artifact");
  });

  test("a lockfile selects pack-deps", () => {
    expect(packs(attach(ctxFor(), "bun.lock"))).toEqual(expect.arrayContaining(["pack-deps"]));
  });

  test("a component file selects pack-frontend and pack-test, not pack-data", () => {
    const ctx = ctxFor({ "app/components/Button.tsx": "export const Button = () => <button aria-label='x' />;\n" });
    const selected = packs(attach(ctx, "app/components/Button.tsx"));
    expect(selected).toContain("pack-frontend");
    expect(selected).toContain("pack-test");
    expect(selected).not.toContain("pack-data");
  });

  test("pack-perf does not attach on a hunch; it needs a stated budget or measurement", () => {
    const ctx = ctxFor({ "src/loop.ts": "for (const x of xs) work(x);\n" });
    expect(packs(attach(ctx, "src/loop.ts"))).not.toContain("pack-perf");
    const withBudget = ctxFor({ "src/loop.ts": "// p99 latency budget: 200ms\nfor (const x of xs) work(x);\n" });
    expect(packs(attach(withBudget, "src/loop.ts"))).toContain("pack-perf");
  });
});

describe("selection is recorded and deterministic", () => {
  test("each selection records why it was made", () => {
    const result = attach(ctxFor(), "src/auth/session.ts");
    const secure = result.selections.find((s) => s.pack === "pack-secure");
    expect(secure?.evidence.length).toBeGreaterThan(0);
    expect(secure?.evidence[0]?.kind).toBeDefined();
    expect(secure?.evidence[0]?.matched.length).toBeGreaterThan(0);
    expect(secure?.rationale).toContain("pack-secure");
  });

  test("selections are sorted by pack id and repeat runs agree exactly", () => {
    const ctx = ctxFor({ "app/api/auth/route.ts": "export async function POST() { return authorize(); }\n" });
    const a = attach(ctx, "app/api/auth/route.ts");
    const b = attach(ctx, "app/api/auth/route.ts");
    expect(packs(a)).toEqual([...packs(a)].sort());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("packs not selected are reported with a reason, not silently dropped", () => {
    const result = attach(ctxFor(), "src/auth/session.ts");
    expect(result.skipped.some((s) => s.pack === "pack-perf" && s.reason.length > 0)).toBe(true);
  });

  test("a supporting signal is recorded but never selects on its own", () => {
    const ctx = ctxFor({ "notes/readme.md": "nothing here\n" });
    const result = attach(ctx, "notes/readme.md");
    expect(packs(result)).toEqual([]);
    const deleteEntry = result.skipped.find((s) => s.pack === "pack-delete");
    expect(deleteEntry?.supporting.length).toBeGreaterThan(0);
  });
});

describe("pack manifests extend the lookup, never weaken it", () => {
  test("a manifest signal adds a selection path", () => {
    const ctx = ctxFor({
      "packs/pack-secure/pack.yaml":
        "id: pack-secure\nactivation:\n  signals:\n    - kind: path-regex\n      pattern: \"(^|/)vault/\"\n      weight: sufficient\n      note: project vault directory\n",
    });
    const result = attach(ctx, "infra/vault/config.hcl");
    expect(packs(result)).toContain("pack-secure");
    expect(result.selections.find((s) => s.pack === "pack-secure")?.evidence[0]?.note).toContain("vault");
  });

  test("an empty manifest cannot switch off the built-in security lookup", () => {
    const ctx = ctxFor({ "packs/pack-secure/pack.yaml": "id: pack-secure\nactivation:\n  signals: []\n" });
    expect(packs(attach(ctx, "src/auth/session.ts"))).toContain("pack-secure");
  });

  test("an unparseable manifest is reported and the built-in lookup still runs", () => {
    const ctx = ctxFor({ "packs/pack-secure/pack.yaml": "id: [unclosed\n" });
    const result = attach(ctx, "src/auth/session.ts");
    expect(result.issues.some((i) => i.rule === "attach.manifest-unparseable")).toBe(true);
    expect(packs(result)).toContain("pack-secure");
  });

  test("a manifest cannot switch off a never-dropped pack", () => {
    const ctx = ctxFor({ "packs/pack-data/pack.yaml": "id: pack-data\nenabled: false\n" });
    const result = attach(ctx, "db/migrations/001_add_column.sql");
    expect(result.issues.some((i) => i.rule === "attach.protected-pack-disabled")).toBe(true);
    expect(packs(result)).toContain("pack-data");
  });

  test("a manifest may switch off a pack that is not protected", () => {
    const ctx = ctxFor({ "packs/pack-deps/pack.yaml": "id: pack-deps\nenabled: false\n" });
    const result = attach(ctx, "bun.lock");
    expect(packs(result)).not.toContain("pack-deps");
    expect(result.skipped.some((s) => s.pack === "pack-deps" && s.reason.includes("disabled"))).toBe(true);
  });

  test("an unknown signal kind is reported rather than silently ignored", () => {
    const ctx = ctxFor({
      "packs/pack-api/pack.yaml": "id: pack-api\nactivation:\n  signals:\n    - kind: vibes\n      pattern: x\n",
    });
    expect(attach(ctx, "src/x.ts").issues.some((i) => i.rule === "attach.unknown-signal-kind")).toBe(true);
  });
});

describe("subjects the selector must still handle", () => {
  test("a path that does not exist still selects on path semantics", () => {
    const result = attach(ctxFor(), "src/auth/absent.ts");
    expect(packs(result)).toContain("pack-secure");
    expect(result.subject.contentsAvailable).toBe(false);
  });

  test("an absolute path inside the repository is accepted", () => {
    const ctx = ctxFor({ "src/auth/session.ts": "x\n" });
    expect(packs(attach(ctx, `${ctx.root}/src/auth/session.ts`))).toContain("pack-secure");
  });

  test("a directory subject selects on its path semantics", () => {
    const ctx = ctxFor({ "db/migrations/001.sql": "CREATE TABLE t (id int);\n" });
    expect(packs(attach(ctx, "db/migrations"))).toContain("pack-data");
  });
});
