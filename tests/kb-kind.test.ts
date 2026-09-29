import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, test } from "bun:test";
import { parse } from "yaml";

import { compileSchemas } from "../src/validation/schemas.ts";

/**
 * A skill output that is a knowledgebase document page says so with
 * `placement: kb-document` and names its kind in `kb_kind`, one of the nine
 * the KB CLI has (docs/decisions/0001-kb-document-vocabulary.md §2). Each case
 * is super-bound's shipped manifest with its `prd` output changed in one way,
 * validated against the shipped skill schema.
 */

const REPO = resolve(import.meta.dir, "..");
const validate = (() => {
  const v = compileSchemas(REPO).validatorFor("skill");
  if (v === undefined) throw new Error("no compiled validator for 'skill'");
  return v;
})();
const manifest = parse(readFileSync(join(REPO, "skills", "super-bound", "skill.yaml"), "utf8"));
const outputs = manifest.outputs as Array<Record<string, unknown>>;
const prd = outputs.find((o) => o.id === "prd-page")!;

function withPrd(output: Record<string, unknown>) {
  return { ...manifest, outputs: outputs.map((o) => (o.id === "prd-page" ? output : o)) };
}

describe("a KB document output declares its kind", () => {
  test("the shipped manifest is valid", () => {
    expect(prd).toMatchObject({ placement: "kb-document", kb_kind: "prd" });
    expect(validate(manifest)).toBe(true);
  });

  test("a kb-document output without a kind is refused", () => {
    const { kb_kind: _, ...kindless } = prd;
    expect(validate(withPrd(kindless))).toBe(false);
  });

  test("a kind outside the nine is refused", () => {
    expect(validate(withPrd({ ...prd, kb_kind: "requirements" }))).toBe(false);
  });

  test("a kind on an output not marked as a KB document is refused", () => {
    const { placement: _, ...unmarked } = prd;
    expect(validate(withPrd(unmarked))).toBe(false);
  });

  test("a KB document is not also a schema-bound run artifact", () => {
    expect(validate(withPrd({ ...prd, schema: "plan-record" }))).toBe(false);
  });

  test("an output that is neither carries neither field", () => {
    const { placement: _, kb_kind: __, ...plain } = prd;
    expect(validate(withPrd(plain))).toBe(true);
  });
});
