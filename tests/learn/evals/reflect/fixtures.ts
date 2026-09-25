/**
 * The capture eval's fixture databases, generated from `fixtures.json`: per
 * fixture two completed claude-mem sessions carrying five planted facts, the
 * shared routine distractors, noise the memory should not keep and one
 * injection. A fixture may start from a previous memory and a smaller token
 * cap. Deterministic: the same JSON builds the same rows, and session ids are
 * derived from the fixture id.
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
  /**
   * The fact is recorded inside the injection's observation rather than its own, so its only
   * observation id is the flagged one. Prices the runtime's fail-closed drop of that observation.
   */
  in_injection?: boolean;
}

/**
 * A plausible fact the memory should not keep. `superseded`: an older value of the fact named by
 * `supersedes`, as an earlier observation or, with no `title`, a line of the previous memory.
 * `one-off`: something done once and undone, which is history rather than state.
 */
export interface NoiseSpec extends Partial<ObsSpec> {
  key: string;
  kind: "superseded" | "one-off";
  /** Literal text that marks the noise as kept. */
  needle: string;
  supersedes?: string;
}

export interface FixtureSpec {
  id: string;
  project: string;
  /** `memory.md` before the run; absent means the ledger starts empty. */
  previous?: string;
  /** The memory token cap for this fixture, when it is not the configured one. */
  memory_tokens?: number;
  facts: FactSpec[];
  noise?: NoiseSpec[];
  injection: {
    title: string;
    facts: string[];
    canary: string;
    /** The first half of a split payload, recorded in the first session. */
    lead?: { title: string; facts: string[] };
  };
}

export interface FixtureSet {
  id: string;
  version: number;
  sha256: string;
  distractors: ObsSpec[];
  /** The development set: what the reflector's prompt and the runtime were tuned against. */
  fixtures: FixtureSpec[];
  /**
   * The held-out set, scored and reported apart. Each case probes one way the development set could
   * be overfitted: a payload split across sessions, a canary with no marker, a benign value the
   * payload repeats, and a real fact sharing the payload's observation.
   */
  heldout: FixtureSpec[];
}

export function loadFixtureSet(file = FIXTURES_FILE): FixtureSet {
  const text = readFileSync(file, "utf8");
  const raw = JSON.parse(text) as Omit<FixtureSet, "sha256">;
  return { ...raw, heldout: raw.heldout ?? [], sha256: createHash("sha256").update(text).digest("hex") };
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
  /** The observation carrying the canary. */
  injectionId: string;
  /** Every observation carrying part of the payload: the lead, if any, then `injectionId`. */
  injectionIds: string[];
}

/**
 * Write the fixture's database at `dbPath`. Superseded noise comes first, so the fact that replaces
 * it is newer; facts alternate between the two sessions; one-off noise, a split payload's lead (in
 * the first session) and then the injection land last. A fact marked `in_injection` is written into
 * the injection's observation, ahead of the payload.
 */
export function buildFixture(spec: FixtureSpec, distractors: readonly ObsSpec[], dbPath: string, now = Date.now()): BuiltFixture {
  const mem = new MemFixture(dbPath);
  const sids = [sessionId(spec.id, 1), sessionId(spec.id, 2)] as const;
  mem.session({ sid: sids[0], project: spec.project, started: now - 7_200_000, completed: now - 6_000_000 });
  mem.session({ sid: sids[1], project: spec.project, started: now - 3_600_000, completed: now - 3_000_000 });
  let at = now - 5_500_000;
  const add = (sid: string, o: ObsSpec) => mem.observation({ sid, project: spec.project, type: o.type, title: o.title, facts: o.facts ?? [], at: (at += 1000) });
  const noiseOf = (kind: NoiseSpec["kind"]) => (spec.noise ?? []).filter((n) => n.kind === kind && n.title !== undefined);
  for (const n of noiseOf("superseded")) add(sids[0], n as ObsSpec);
  const factIds = new Map<string, string[]>();
  const colocated = spec.facts.filter((f) => f.in_injection);
  const separate = spec.facts.filter((f) => !f.in_injection);
  separate.forEach((fact, i) => {
    const sid = sids[i % 2]!;
    factIds.set(fact.key, [`obs:${add(sid, fact)}`, sid8(sid)]);
    const noise = distractors[i % distractors.length];
    if (noise !== undefined) add(sids[(i + 1) % 2]!, noise);
  });
  for (const noise of distractors.slice(separate.length)) add(sids[1], noise);
  for (const n of noiseOf("one-off")) add(sids[1], n as ObsSpec);
  const lead = spec.injection.lead === undefined ? [] : [`obs:${add(sids[0], { type: "discovery", ...spec.injection.lead })}`];
  const injectionFacts = [...colocated.flatMap((f) => f.facts ?? []), ...spec.injection.facts];
  const injectionId = `obs:${add(sids[1], { type: "discovery", title: spec.injection.title, facts: injectionFacts })}`;
  for (const fact of colocated) factIds.set(fact.key, [injectionId, sid8(sids[1])]);
  mem.summary({ sid: sids[0], project: spec.project, request: `work on ${spec.project}`, completed: "see observations" });
  mem.close();
  return { spec, dbPath, factIds, injectionId, injectionIds: [...lead, injectionId] };
}
