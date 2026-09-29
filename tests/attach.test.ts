import { describe, expect, test } from "bun:test";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import { attach, formatAttachResult } from "../src/attach/index.ts";
import { BUILTIN_SIGNALS, builtinSignalsFor, SEMANTIC_ONLY_RULES } from "../src/attach/signals.ts";
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
});

describe("selection by artifact and semantics", () => {
  test("an auth path selects pack-secure even with no pack manifests on disk", () => {
    const result = attach(ctxFor(), "src/auth/session.ts");
    expect(packs(result)).toContain("pack-secure");
  });

  test("security content selects pack-secure even when the path says nothing", () => {
    const ctx = ctxFor({ "src/util/thing.ts": "const h = { Authorization: `Bearer ${token}` };\n" });
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

describe("pack.yaml is not a signal source", () => {
  test("a manifest carrying the keys the schema forbids changes nothing", () => {
    // `enabled` and `activation.signals` fail schemas.document-invalid, and
    // the selector no longer reads either: the built-in table is the lookup.
    const ctx = ctxFor({
      "packs/pack-deps/pack.yaml": "id: pack-deps\nenabled: false\n",
      "packs/pack-secure/pack.yaml":
        'id: pack-secure\nactivation:\n  signals:\n    - kind: path-regex\n      pattern: "(^|/)vault/"\n      weight: sufficient\n      note: vault\n',
    });
    expect(packs(attach(ctx, "bun.lock"))).toContain("pack-deps");
    expect(packs(attach(ctx, "infra/vault/config.hcl"))).not.toContain("pack-secure");
  });
});

describe("every signal cites a rule its pack states", () => {
  const PACKS_DIR = join(import.meta.dir, "..", "packs");

  function ruleIdsOf(pack: string): string[] {
    const doc = parseYaml(readFileSync(join(PACKS_DIR, pack, "pack.yaml"), "utf8")) as {
      activation: { rules: Array<{ id: string }> };
    };
    return doc.activation.rules.map((r) => r.id);
  }

  const packIds = readdirSync(PACKS_DIR).filter((name) => existsSync(join(PACKS_DIR, name, "pack.yaml")));

  test("the signal table and the packs on disk name the same packs", () => {
    expect(BUILTIN_SIGNALS.map((p) => p.pack).sort()).toEqual([...packIds].sort());
    expect(Object.keys(SEMANTIC_ONLY_RULES).every((pack) => packIds.includes(pack))).toBe(true);
  });

  for (const pack of packIds) {
    test(`${pack}: each signal's rule exists, and each rule has a signal or a stated exemption`, () => {
      const rules = ruleIdsOf(pack);
      const signals = builtinSignalsFor(pack);
      const named = signals.flatMap((s) => s.rules);
      // matchedRules counts sufficient evidence only, so a rule reached only by
      // a supporting signal can never be cited by a selection.
      const cited = signals.filter((s) => s.weight === "sufficient").flatMap((s) => s.rules);
      const exempt = Object.keys(SEMANTIC_ONLY_RULES[pack] ?? {});
      expect(named.filter((rule) => !rules.includes(rule))).toEqual([]);
      expect(exempt.filter((rule) => !rules.includes(rule))).toEqual([]);
      // An exemption is for a rule no signal can reach; one that any signal
      // names is a stale exemption.
      expect(exempt.filter((rule) => named.includes(rule))).toEqual([]);
      expect(rules.filter((rule) => !cited.includes(rule) && !exempt.includes(rule))).toEqual([]);
    });
  }

  test("a selection cites the rules its sufficient evidence matched", () => {
    const ctx = ctxFor({ "db/migrations/002_drop.sql": "ALTER TABLE t DROP COLUMN legacy;\n" });
    const data = attach(ctx, "db/migrations/002_drop.sql").selections.find((s) => s.pack === "pack-data");
    expect(data?.matchedRules).toEqual(["data-transform-script", "destructive-schema-step", "migration-artifact"]);
    expect(data?.rationale).toContain("destructive-schema-step");
    const sufficient = data?.evidence.filter((e) => e.weight === "sufficient") ?? [];
    expect([...new Set(sufficient.flatMap((e) => e.rules))].sort()).toEqual([...(data?.matchedRules ?? [])]);
  });

  test("an observation consistent with several rules cites each of them", () => {
    const deps = attach(ctxFor(), "package.json").selections.find((s) => s.pack === "pack-deps");
    expect(deps?.matchedRules).toEqual(["install-policy-change", "new-dependency", "version-bump"]);
  });

  test("supporting evidence alone adds no rule to a selection", () => {
    const ctx = ctxFor({ "notes/plan.md": "We will retire the v1 client.\n" });
    const del = attach(ctx, "notes/plan.md").selections.find((s) => s.pack === "pack-delete");
    // The prose-file signal names deprecation-or-replacement too, but is only supporting.
    expect(del?.matchedRules).toEqual(["removal"]);
    expect(del?.evidence.some((e) => e.weight === "supporting")).toBe(true);
  });

  test("a goal that says fix does not select pack-test by itself", () => {
    const ticket = JSON.stringify({
      schema: "ticket",
      type: "implementation",
      goal: "fix typo in README",
      write_ownership: { paths: [], interfaces: [] },
    });
    const ctx = ctxFor({ "work/typo.json": ticket });
    expect(packs(attach(ctx, "work/typo.json"))).not.toContain("pack-test");
  });

  test("the printed result names the matched rules", () => {
    const lines = formatAttachResult(attach(ctxFor(), "src/auth/session.ts"));
    expect(lines).toContain("    rules: authn-authz-change");
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
