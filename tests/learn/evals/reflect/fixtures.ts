/**
 * The capture eval's fixture databases, generated from `fixtures.json`: per
 * fixture two completed claude-mem sessions carrying five planted facts, the
 * shared routine distractors and one injection. Deterministic: the same JSON
 * builds the same rows, and session ids are derived from the fixture id.
 * Not a test file.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sid8 } from "../../../../src/learn/memory/ledger.ts";
import { MemFixture } from "../../helpers.ts";

export const FIXTURES_FILE = join(import.meta.dir, "fixtures.json");

export interface ObsSpec {
  type: string;
  title: string;
  facts?: string[];
}

export interface FactSpec extends ObsSpec {
  key: string;
  /** Literal text a bullet must carry for the fact to count as recalled. */
  needle: string;
}

export interface FixtureSpec {
  id: string;
  project: string;
  facts: FactSpec[];
  injection: { title: string; facts: string[]; canary: string };
}

export interface FixtureSet {
  id: string;
  version: number;
  sha256: string;
  distractors: ObsSpec[];
  fixtures: FixtureSpec[];
}

export function loadFixtureSet(file = FIXTURES_FILE): FixtureSet {
  const text = readFileSync(file, "utf8");
  const raw = JSON.parse(text) as Omit<FixtureSet, "sha256">;
  return { ...raw, sha256: createHash("sha256").update(text).digest("hex") };
}

/** A uuid-shaped session id derived from the fixture id, so `sid8` is stable across runs. */
export function sessionId(fixture: string, n: number): string {
  const h = createHash("sha256").update(`${fixture}#${n}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export interface BuiltFixture {
  spec: FixtureSpec;
  dbPath: string;
  /** Per fact key, every id a bullet may cite for it: its observation and its session. */
  factIds: Map<string, string[]>;
  injectionId: string;
}

/** Write the fixture's database at `dbPath`. Facts alternate between the two sessions; the injection lands in the second. */
export function buildFixture(spec: FixtureSpec, distractors: readonly ObsSpec[], dbPath: string, now = Date.now()): BuiltFixture {
  const mem = new MemFixture(dbPath);
  const sids = [sessionId(spec.id, 1), sessionId(spec.id, 2)] as const;
  mem.session({ sid: sids[0], project: spec.project, started: now - 7_200_000, completed: now - 6_000_000 });
  mem.session({ sid: sids[1], project: spec.project, started: now - 3_600_000, completed: now - 3_000_000 });
  let at = now - 5_500_000;
  const add = (sid: string, o: ObsSpec) => mem.observation({ sid, project: spec.project, type: o.type, title: o.title, facts: o.facts ?? [], at: (at += 1000) });
  const factIds = new Map<string, string[]>();
  spec.facts.forEach((fact, i) => {
    const sid = sids[i % 2]!;
    factIds.set(fact.key, [`obs:${add(sid, fact)}`, sid8(sid)]);
    const noise = distractors[i % distractors.length];
    if (noise !== undefined) add(sids[(i + 1) % 2]!, noise);
  });
  for (const noise of distractors.slice(spec.facts.length)) add(sids[1], noise);
  const injectionId = `obs:${add(sids[1], { type: "discovery", title: spec.injection.title, facts: spec.injection.facts })}`;
  mem.summary({ sid: sids[0], project: spec.project, request: `work on ${spec.project}`, completed: "see observations" });
  mem.close();
  return { spec, dbPath, factIds, injectionId };
}
