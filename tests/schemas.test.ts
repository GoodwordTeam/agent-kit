import { describe, expect, test } from "bun:test";

import { compileSchemas, checkSchemas } from "../src/validation/schemas.ts";
import { loadCatalog } from "../src/catalog/load.ts";
import { makeTree } from "./helpers/tree.ts";

const COMMON = JSON.stringify({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://agent-kit.local/schemas/common.schema.json",
  $defs: {
    nonempty_string: { type: "string", minLength: 1 },
    timestamp: { type: "string", format: "date-time" },
    envelope: {
      type: "object",
      required: ["schema", "created_at"],
      properties: { schema: { type: "string" }, created_at: { $ref: "#/$defs/timestamp" } },
    },
  },
});

const TICKET = JSON.stringify({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://agent-kit.local/schemas/ticket.schema.json",
  type: "object",
  allOf: [{ $ref: "common.schema.json#/$defs/envelope" }],
  properties: { schema: { const: "ticket" }, goal: { $ref: "common.schema.json#/$defs/nonempty_string" } },
  required: ["goal"],
});

const CATALOG_SCHEMA = JSON.stringify({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://agent-kit.local/schemas/catalog.schema.json",
  type: "object",
  required: ["schema_version", "package"],
  properties: { schema_version: { const: 1 }, package: { type: "object", required: ["id"] } },
});

const CATALOG_YAML = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
schemas:
  - id: common
    status: authored
  - id: ticket
    status: authored
  - id: catalog
    status: authored
`;

function ctxFor(files: Record<string, string>) {
  const root = makeTree(files);
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

describe("schema compilation", () => {
  test("compiles every schema and resolves cross-file $defs refs", () => {
    const root = makeTree({ "schemas/common.schema.json": COMMON, "schemas/ticket.schema.json": TICKET });
    const set = compileSchemas(root);
    expect(set.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(set.validatorFor("ticket")).toBeDefined();
    const validate = set.validatorFor("ticket")!;
    expect(validate({ schema: "ticket", created_at: "2026-09-19T10:00:00Z", goal: "ship" })).toBe(true);
    expect(validate({ schema: "ticket", created_at: "2026-09-19T10:00:00Z" })).toBe(false);
  });

  test("date-time and date formats are enforced via ajv-formats", () => {
    const root = makeTree({ "schemas/common.schema.json": COMMON, "schemas/ticket.schema.json": TICKET });
    const validate = compileSchemas(root).validatorFor("ticket")!;
    expect(validate({ schema: "ticket", created_at: "not-a-timestamp", goal: "ship" })).toBe(false);
  });

  test("an unparseable schema is an error naming the file, not a crash", () => {
    const set = compileSchemas(makeTree({ "schemas/broken.schema.json": "{ not json" }));
    const issue = set.issues.find((i) => i.rule === "schemas.unparseable");
    expect(issue?.severity).toBe("error");
    expect(issue?.file).toBe("schemas/broken.schema.json");
  });

  test("a duplicate JSON key in a schema is reported with its line", () => {
    const dup = '{\n  "$id": "https://agent-kit.local/schemas/dup.schema.json",\n  "type": "object",\n  "type": "string"\n}\n';
    const set = compileSchemas(makeTree({ "schemas/dup.schema.json": dup }));
    const issue = set.issues.find((i) => i.rule === "schemas.duplicate-json-key");
    expect(issue?.severity).toBe("error");
    expect(issue?.line).toBe(4);
  });

  test("a missing schemas directory yields no validators and no crash", () => {
    const set = compileSchemas(makeTree({}));
    expect(set.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(set.validatorFor("ticket")).toBeUndefined();
  });

  test("an unresolvable $ref is reported against the referencing schema", () => {
    const bad = JSON.stringify({
      $id: "https://agent-kit.local/schemas/bad.schema.json",
      $ref: "missing.schema.json#/$defs/nope",
    });
    const set = compileSchemas(makeTree({ "schemas/bad.schema.json": bad }));
    expect(set.issues.some((i) => i.rule === "schemas.uncompilable" && i.file === "schemas/bad.schema.json")).toBe(true);
  });
});

describe("document validation against schemas", () => {
  test("validates catalog.yaml against catalog.schema.json", () => {
    const ctx = ctxFor({
      "catalog.yaml": CATALOG_YAML.replace("schema_version: 1", "schema_version: 2"),
      "schemas/catalog.schema.json": CATALOG_SCHEMA,
      "schemas/common.schema.json": COMMON,
      "schemas/ticket.schema.json": TICKET,
    });
    const issues = checkSchemas(ctx);
    const issue = issues.find((i) => i.rule === "schemas.document-invalid" && i.file === "catalog.yaml");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("schema_version");
  });

  test("validates each skill.yaml against skill.schema.json", () => {
    const skillSchema = JSON.stringify({
      $id: "https://agent-kit.local/schemas/skill.schema.json",
      type: "object",
      required: ["id", "version"],
      properties: { id: { type: "string" }, version: { type: "string" } },
    });
    const ctx = ctxFor({
      "catalog.yaml": `${CATALOG_YAML}  - id: skill\n    status: authored\nskills:\n  - id: alpha\n    status: authored\n`,
      "schemas/common.schema.json": COMMON,
      "schemas/ticket.schema.json": TICKET,
      "schemas/catalog.schema.json": CATALOG_SCHEMA,
      "schemas/skill.schema.json": skillSchema,
      "skills/alpha/SKILL.md": "---\nname: alpha\ndescription: d\n---\nbody\n",
      "skills/alpha/skill.yaml": "id: alpha\n",
    });
    const issues = checkSchemas(ctx);
    expect(issues.some((i) => i.rule === "schemas.document-invalid" && i.file === "skills/alpha/skill.yaml")).toBe(true);
  });

  test("validates a templates artifact against the schema its envelope names", () => {
    const ctx = ctxFor({
      "catalog.yaml": CATALOG_YAML,
      "schemas/common.schema.json": COMMON,
      "schemas/ticket.schema.json": TICKET,
      "schemas/catalog.schema.json": CATALOG_SCHEMA,
      "templates/example-ticket.json": JSON.stringify({ schema: "ticket", created_at: "2026-09-19T10:00:00Z" }),
    });
    const issues = checkSchemas(ctx);
    const issue = issues.find((i) => i.file === "templates/example-ticket.json");
    expect(issue?.rule).toBe("schemas.document-invalid");
    expect(issue?.message).toContain("goal");
  });

  test("a valid templates artifact produces no issue", () => {
    const ctx = ctxFor({
      "catalog.yaml": CATALOG_YAML,
      "schemas/common.schema.json": COMMON,
      "schemas/ticket.schema.json": TICKET,
      "schemas/catalog.schema.json": CATALOG_SCHEMA,
      "templates/example-ticket.json": JSON.stringify({ schema: "ticket", created_at: "2026-09-19T10:00:00Z", goal: "ship" }),
    });
    expect(checkSchemas(ctx).filter((i) => i.file === "templates/example-ticket.json")).toEqual([]);
  });

  test("a templates artifact naming an unknown schema is an error", () => {
    const ctx = ctxFor({
      "catalog.yaml": CATALOG_YAML,
      "schemas/common.schema.json": COMMON,
      "schemas/ticket.schema.json": TICKET,
      "schemas/catalog.schema.json": CATALOG_SCHEMA,
      "templates/example.json": JSON.stringify({ schema: "nonesuch", created_at: "2026-09-19T10:00:00Z" }),
    });
    expect(checkSchemas(ctx).some((i) => i.rule === "schemas.unknown-schema-id")).toBe(true);
  });

  test("a missing schema file is reported once as unavailable, not as a document failure", () => {
    const ctx = ctxFor({ "catalog.yaml": CATALOG_YAML });
    const issues = checkSchemas(ctx);
    expect(issues.some((i) => i.rule === "schemas.validator-unavailable")).toBe(true);
    expect(issues.some((i) => i.rule === "schemas.document-invalid")).toBe(false);
  });
});
