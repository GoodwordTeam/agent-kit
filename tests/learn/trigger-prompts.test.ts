/**
 * The skill-routing prompt sets: shape, split and a leakage guard.
 *
 * A routing prompt that repeats its skill's description measures string matching, not routing.
 * The guard rejects any prompt sharing a word 4-gram with its skill's SKILL.md description or its
 * catalog summary (the text the roster shows). The threshold is zero shared 4-grams, not a
 * Jaccard cut: prompts run 10 to 40 words, so one shared 4-gram is already a lifted phrase, and a
 * ratio over sets that small moves more with prompt length than with copying. Shorter n-grams
 * are too strict to hold: "the pull request" or "a human" are ordinary English, and a user asking
 * for a skill's work will use its nouns.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadCatalog } from "../../src/catalog/load.ts";
import { frontmatter, oneLine } from "../../src/learn/skills/roster.ts";
import { type Case, parsePromptSet } from "./evals/trigger-eval.ts";

const REPO = resolve(import.meta.dir, "..", "..");
const PROMPTS = join(import.meta.dir, "evals", "prompts");
const load = (set: string) => parsePromptSet(readFileSync(join(PROMPTS, `${set}.json`), "utf8"), `trigger-${set}`);
const dev = load("dev");
const holdout = load("holdout");
const all: Case[] = [...dev.cases, ...holdout.cases];

const { catalog } = loadCatalog(REPO);
const entries = new Map((catalog?.bySection("skills") ?? []).map((e) => [e.id, e]));

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? [];
}

function ngrams(text: string, n = 4): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

function shared(a: string, b: string, n = 4): string[] {
  const right = ngrams(b, n);
  return [...ngrams(a, n)].filter((g) => right.has(g));
}

function skillTexts(id: string): string[] {
  const description = oneLine(frontmatter(readFileSync(join(REPO, "skills", id, "SKILL.md"), "utf8")).description ?? "");
  const summary = entries.get(id)?.raw.summary;
  return [description, typeof summary === "string" ? oneLine(summary) : ""];
}

describe("trigger prompt sets", () => {
  test("both sets are versioned and carry an id", () => {
    for (const set of [dev, holdout]) {
      expect(set.version).toBeGreaterThanOrEqual(2);
      expect(set.id).toMatch(/^trigger-/);
      expect(set.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("75 prompts, 45 dev and 30 holdout", () => {
    expect(dev.cases).toHaveLength(45);
    expect(holdout.cases).toHaveLength(30);
    expect(all).toHaveLength(75);
  });

  test("ids and prompts are unique across both sets", () => {
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    expect(new Set(all.map((c) => c.prompt.toLowerCase())).size).toBe(all.length);
  });

  test("15 skills, each 3 positive and 2 negative, split 2+1 dev and 1+1 holdout", () => {
    const skills = [...new Set(all.map((c) => c.skill))];
    expect(skills).toHaveLength(15);
    for (const skill of skills) {
      const count = (cases: Case[], polarity: string) => cases.filter((c) => c.skill === skill && c.polarity === polarity).length;
      expect([skill, count(dev.cases, "positive"), count(dev.cases, "negative")]).toEqual([skill, 2, 1]);
      expect([skill, count(holdout.cases, "positive"), count(holdout.cases, "negative")]).toEqual([skill, 1, 1]);
    }
  });

  test("every skill is an authored catalog skill, with its class recorded correctly", () => {
    const classes = new Set<string>();
    for (const c of all) {
      const entry = entries.get(c.skill);
      expect(entry, c.id).toBeDefined();
      expect([c.id, entry!.status]).toEqual([c.id, "authored"]);
      expect([c.id, c.invocation]).toEqual([c.id, entry!.invocation!]);
      classes.add(c.invocation);
    }
    expect([...classes].sort()).toEqual(["M", "U"]);
  });

  test("positives expect their own skill; negatives expect nothing and forbid only known skills", () => {
    for (const c of all) {
      if (c.polarity === "positive") {
        expect([c.id, c.expected]).toEqual([c.id, [c.skill]]);
        expect(c.forbidden).toBeUndefined();
      } else {
        expect([c.id, c.expected]).toEqual([c.id, []]);
        for (const f of c.forbidden ?? []) expect(entries.has(f)).toBe(true);
      }
    }
  });

  test("a user-invoked negative never names its skill; a user-invoked positive does", () => {
    for (const c of all.filter((x) => x.invocation === "U")) {
      const named = new RegExp(`\\b${c.skill}\\b`).test(c.prompt);
      expect([c.id, named]).toEqual([c.id, c.polarity === "positive"]);
    }
  });

  test("a model-invoked prompt never names any skill", () => {
    for (const c of all.filter((x) => x.invocation === "M")) {
      for (const id of entries.keys()) expect([c.id, new RegExp(`\\b${id}\\b`).test(c.prompt)]).toEqual([c.id, false]);
    }
  });

  test("leakage guard: no prompt shares a word 4-gram with its skill's description or summary", () => {
    const leaks: string[] = [];
    for (const c of all) {
      for (const text of skillTexts(c.skill)) {
        const hit = shared(c.prompt, text);
        if (hit.length > 0) leaks.push(`${c.id}: ${hit.join(" | ")}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  test("the guard catches a lifted phrase (positive control)", () => {
    const [description] = skillTexts("diagnose");
    const lifted = `Please ${words(description!).slice(10, 16).join(" ")} for the export job.`;
    expect(shared(lifted, description!).length).toBeGreaterThan(0);
  });

  test("the candidate set still loads, every case with its draft", () => {
    const candidate = load("candidate");
    expect(candidate.cases.length).toBeGreaterThan(0);
    for (const c of candidate.cases) expect(c.draft?.name).toBe(c.skill);
  });

  test("a legacy bare-array file still parses", () => {
    const legacy = parsePromptSet(JSON.stringify([{ arm: "catalog", prompt: "p", expected: ["diagnose"] }]), "old");
    expect(legacy.version).toBe(1);
    expect(legacy.cases[0]).toMatchObject({ id: "old-1", skill: "diagnose", polarity: "positive", expected: ["diagnose"] });
  });
});
