/**
 * research/probes/catalog-progress.sh against fixture trees.
 *
 * The probe compares each catalog section with the plan's count plus the ids
 * recorded in research/probes/catalog-expansions.yaml. These trees check that a
 * recorded expansion reads clean and that every way of leaving one unexplained
 * still flags. Assertions read the probe's structured lines (`EXPANDED`,
 * `DISAGREEMENT`) and its exit status, never its prose.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { stringify } from "yaml";

import { makeTree } from "./helpers/tree.ts";

const ROOT = join(import.meta.dir, "..");
const PROBE = join(ROOT, "research/probes/catalog-progress.sh");

const PLAN: Record<string, number> = {
  skills: 33, packs: 8, protocols: 7, roles: 29, references: 4,
  schemas: 14, policies: 5, profiles: 4, adapters: 4,
};

/** A catalog with the plan's count in every section, plus `extra` ids per section. */
function catalog(extra: Record<string, string[]> = {}): string {
  const doc: Record<string, unknown> = {};
  for (const [section, n] of Object.entries(PLAN)) {
    const ids = [...Array.from({ length: n }, (_, i) => `${section}-${i}`), ...(extra[section] ?? [])];
    doc[section] = ids.map((id) => ({ id, status: "authored" }));
  }
  return stringify(doc);
}

interface Run {
  readonly code: number;
  readonly expanded: string[];
  readonly disagreements: string[];
}

function probe(files: Record<string, string>): Run {
  const root = makeTree(files);
  for (const args of [["init", "-q"], ["add", "-A"]]) {
    Bun.spawnSync(["git", ...args], { cwd: root });
  }
  const run = Bun.spawnSync(["bash", PROBE], { cwd: root });
  const lines = (s: Uint8Array, tag: string) =>
    new TextDecoder().decode(s).split("\n").filter((l) => l.startsWith(`  ${tag}  `)).map((l) => l.slice(tag.length + 4));
  return { code: run.exitCode ?? -1, expanded: lines(run.stdout, "EXPANDED"), disagreements: lines(run.stderr, "DISAGREEMENT") };
}

const EXPANSIONS = "research/probes/catalog-expansions.yaml";

const record = (plan: number, catalogSize: number, ids: string[]) =>
  stringify({ adapters: { plan, catalog: catalogSize, expansions: [{ ids, reason: "r", commits: ["abc1234"] }] } });

describe("catalog-progress.sh", () => {
  test("a catalog at the plan's counts is clean with no expansions file", () => {
    expect(probe({ "catalog.yaml": catalog() })).toEqual({ code: 0, expanded: [], disagreements: [] });
  });

  test("a recorded expansion reads clean and is reported as one", () => {
    const run = probe({ "catalog.yaml": catalog({ adapters: ["extra"] }), [EXPANSIONS]: record(4, 5, ["extra"]) });
    expect(run).toEqual({ code: 0, expanded: ["adapters: plan 4 + 1 recorded = 5"], disagreements: [] });
  });

  test("an unrecorded entry still flags", () => {
    const run = probe({ "catalog.yaml": catalog({ adapters: ["extra"], roles: ["unrecorded"] }), [EXPANSIONS]: record(4, 5, ["extra"]) });
    expect(run.code).toBe(1);
    expect(run.disagreements).toEqual(["roles: catalog has 30, plan 29 plus recorded expansions says 29"]);
  });

  test("a recorded id that is not in the catalog flags", () => {
    const run = probe({ "catalog.yaml": catalog({ adapters: ["extra"] }), [EXPANSIONS]: record(4, 6, ["extra", "gone"]) });
    expect(run.code).toBe(1);
    expect(run.disagreements).toEqual([
      "adapters: recorded expansion gone is not in catalog.yaml",
      "adapters: catalog has 5, plan 4 plus recorded expansions says 6",
    ]);
  });

  test("a stale catalog figure or a moved plan figure in the record flags", () => {
    const run = probe({ "catalog.yaml": catalog({ adapters: ["extra"] }), [EXPANSIONS]: record(3, 4, ["extra"]) });
    expect(run.code).toBe(1);
    expect(run.disagreements).toEqual([
      "adapters: expansions record plan 3, the probe's plan says 4",
      "adapters: expansions record catalog 4, plan 4 plus 1 recorded is 5",
    ]);
  });

  test("this tree's catalog has no unexplained difference from the plan", () => {
    const run = Bun.spawnSync(["bash", PROBE], { cwd: ROOT });
    expect(new TextDecoder().decode(run.stderr)).not.toContain("DISAGREEMENT");
    expect(run.exitCode).toBe(0);
  });
});
