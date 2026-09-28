import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { parse } from "yaml";

import { compileSchemas } from "../src/validation/schemas.ts";

/**
 * The three run records that ADR-0001 §3 assigned without a schema: the
 * handoff record, the evaluation record `bakeoff` and `prototype` share, and
 * the `wayfind` map. Without an id in `common#/$defs/schema_id` none of them
 * could pass `publishArtifact`, which refuses an artifact that fails its own
 * schema before any write, so a skill that published one could never reach
 * `complete`. Each case below is a shipped example under templates/ plus the
 * one thing under test, exercised against the shipped schema rather than a
 * synthetic stand-in, so a rejection names the branch and not the fixture.
 *
 * The last block holds the lists that must name the same ids: the enum, the
 * publishArtifact contract, the catalog and the schema files themselves. That
 * disagreement is how the defect stayed invisible.
 */

const REPO = resolve(import.meta.dir, "..");
const schemas = compileSchemas(REPO);

function example(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(REPO, "templates", name), "utf8"));
}

function validatorFor(id: string) {
  const validate = schemas.validatorFor(id);
  if (validate === undefined) throw new Error(`no compiled validator for '${id}'`);
  return validate;
}

describe("the map", () => {
  const validate = validatorFor("map");
  const base = example("map.example.json");

  test("the shipped example is valid", () => {
    expect(validate(base)).toBe(true);
  });

  test("a map missing one of its five sections is refused", () => {
    const { not_yet_specified: _, ...rest } = base;
    expect(validate(rest)).toBe(false);
  });

  test("ruling work out of scope without a reason is refused", () => {
    expect(validate({ ...base, out_of_scope: [{ gist: "Replacing the cache for rate limiting." }] })).toBe(false);
  });

  test("a complete map with fog left in Not yet specified is refused", () => {
    expect(validate({ ...base, status: "complete" })).toBe(false);
    expect(validate({ ...base, status: "complete", not_yet_specified: [] })).toBe(true);
  });
});

describe("the handoff record", () => {
  const validate = validatorFor("handoff-record");
  const base = example("handoff-record.example.json");

  test("the shipped example is valid", () => {
    expect(validate(base)).toBe(true);
  });

  test("a decision without its source marked is refused", () => {
    expect(validate({ ...base, decisions: [{ text: "Keep the public signature unchanged." }] })).toBe(false);
  });

  test("evidence not re-verified at the anchor carries a stale marker", () => {
    const unmarked = { claim: "The integration suite was green yesterday.", kind: "statement", reverified: false };
    expect(validate({ ...base, evidence: [unmarked] })).toBe(false);
  });

  test("re-verified evidence is not marked stale", () => {
    const marked = { claim: "The loader suite passed.", kind: "statement", reverified: true, stale: { bound_to: "yesterday" } };
    expect(validate({ ...base, evidence: [marked] })).toBe(false);
  });

  test("a statement that tests passed is not a receipt", () => {
    const receipt = { id: "example-verification-1", schema: "verification", hash: `sha256:${"7".repeat(64)}` };
    expect(validate({ ...base, evidence: [{ claim: "Green.", kind: "statement", receipt, reverified: true }] })).toBe(false);
    expect(validate({ ...base, evidence: [{ claim: "Green.", kind: "receipt", reverified: true }] })).toBe(false);
  });

  test("a readable anchor names a revision", () => {
    expect(validate({ ...base, source_revision: null })).toBe(false);
  });

  test("an unreadable anchor makes every reference machine-local", () => {
    const anchor = { readable: false, reason: "The repository could not be read." };
    expect(validate({ ...base, anchor })).toBe(false);
    const references = [{ what: "The scratch notes.", machine_local: "/tmp/notes.md" }];
    expect(validate({ ...base, anchor, references })).toBe(true);
  });

  test("a heading with nothing under it is left out, not written empty", () => {
    expect(validate({ ...base, failed_approaches: [] })).toBe(false);
  });
});

describe("the evaluation record", () => {
  const validate = validatorFor("evaluation");
  const bakeoff = example("evaluation.bakeoff.example.json");
  const prototype = example("evaluation.prototype.example.json");
  const judge = bakeoff.judge as Record<string, unknown>;

  test("the shipped bake-off and prototype examples are valid", () => {
    expect(validate(bakeoff)).toBe(true);
    expect(validate(prototype)).toBe(true);
  });

  test("a bake-off whose judge could not attest independence is not selected or unresolved", () => {
    for (const independence of [false, "unverified"]) {
      expect(validate({ ...bakeoff, judge: { ...judge, independence } })).toBe(false);
      expect(validate({ ...bakeoff, status: "unresolved", judge: { ...judge, independence } })).toBe(false);
      expect(validate({ ...bakeoff, status: "incomplete", judge: { ...judge, independence } })).toBe(true);
    }
  });

  test("a Blocked judgment leaves the outcome unresolved", () => {
    const { position: _, ...rest } = judge;
    const blocked = { ...rest, blocked: { floor: "insufficient-project-grounding", needed: ["Name the incumbent parser."] } };
    expect(validate({ ...bakeoff, judge: blocked })).toBe(false);
    expect(validate({ ...bakeoff, status: "unresolved", judge: blocked })).toBe(true);
  });

  test("a judge returns a position or a Blocked result, not both", () => {
    const both = { ...judge, blocked: { floor: "external-evidence-unavailable", needed: ["A benchmark."] } };
    expect(validate({ ...bakeoff, status: "unresolved", judge: both })).toBe(false);
  });

  test("selected shows its counterexample check", () => {
    const { counterexample: _, ...rest } = bakeoff;
    expect(validate(rest)).toBe(false);
  });

  test("selected leaves no decision-critical premise without evidence", () => {
    expect(validate({ ...bakeoff, premises: [{ premise: "The parser exposes key positions.", evidence: [] }] })).toBe(false);
  });

  test("a human-experience question is evaluated by a named human", () => {
    const evaluator = { kind: "automated-criteria", criteria: ["The failing service is found in under ten seconds."] };
    expect(validate({ ...prototype, evaluator })).toBe(false);
  });

  test("a human-experience question is never settled by an automated verdict", () => {
    expect(validate({ ...prototype, settled_by: "automated-criteria" })).toBe(false);
  });

  test("a technical question settled by its criteria shows their results", () => {
    const technical = {
      ...prototype,
      question_kind: "technical",
      evaluator: { kind: "automated-criteria", criteria: ["Every awkward transition is handled."] },
      settled_by: "automated-criteria",
    };
    expect(validate(technical)).toBe(false);
    expect(validate({ ...technical, acceptance_results: [{ ref: "example-verification-3", kind: "receipt" }] })).toBe(true);
  });

  test("a prototype stopped without a human records why and claims no settlement", () => {
    const { settled_by: _, choice: __, answer: ___, ...rest } = prototype;
    const stop = { reason: "no-human-present", learned: "Nothing yet; no evaluator was present." };
    expect(validate({ ...rest, status: "stopped" })).toBe(false);
    expect(validate({ ...rest, status: "stopped", stop })).toBe(true);
    expect(validate({ ...rest, status: "stopped", stop, settled_by: "human" })).toBe(false);
  });

  test("each kind's members are refused on the other", () => {
    expect(validate({ ...prototype, judge })).toBe(false);
    expect(validate({ ...bakeoff, question: "Which layout reads best?" })).toBe(false);
    expect(validate({ ...prototype, status: "selected" })).toBe(false);
  });
});

describe("every list of artifact schema ids names the same ids", () => {
  const common = JSON.parse(readFileSync(join(REPO, "schemas", "common.schema.json"), "utf8"));
  const ids: string[] = common.$defs.schema_id.enum;

  test("each id has a schema file whose envelope pins that id", () => {
    for (const id of ids) {
      const file = join(REPO, "schemas", `${id}.schema.json`);
      expect(existsSync(file)).toBe(true);
      expect(JSON.parse(readFileSync(file, "utf8")).properties.schema).toEqual({ const: id });
    }
  });

  test("the catalog declares every id", () => {
    const catalog = parse(readFileSync(join(REPO, "catalog.yaml"), "utf8"));
    const declared = new Set((catalog.schemas as Array<{ id: string }>).map((s) => s.id));
    const catalogSchema = JSON.parse(readFileSync(join(REPO, "schemas", "catalog.schema.json"), "utf8"));
    const admitted = new Set(catalogSchema.properties.schemas.items.properties.id.enum);
    for (const id of ids) {
      expect(declared.has(id)).toBe(true);
      expect(admitted.has(id)).toBe(true);
    }
  });
});
