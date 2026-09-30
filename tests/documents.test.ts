import { describe, expect, test } from "bun:test";

import { loadArtifacts } from "../src/validation/artifacts.ts";
import { checkTemplateDocuments } from "../src/validation/documents.ts";
import { loadCatalog } from "../src/catalog/load.ts";
import { runValidation } from "../src/validation/run.ts";
import { makeTree } from "./helpers/tree.ts";

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
`;

function ctxFor(files: Record<string, string>) {
  const root = makeTree({ "catalog.yaml": CATALOG, ...files });
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

/** A well-formed document, used as the positive control for every case below. */
const DOCUMENT = JSON.stringify({ schema: "ticket", id: "ticket-1" }, null, 2);

/**
 * The three shapes both loaders drop with a bare `continue`, as the probe
 * research/probes/unowned-template-documents.ts names them. Each is what a
 * generator emits when it forgets a field or forgets to unwrap.
 */
const MALFORMED: ReadonlyArray<{ name: string; body: string; rule: string }> = [
  { name: "no schema member", body: JSON.stringify({ id: "ticket-1" }), rule: "schemas.document-no-schema-member" },
  {
    name: "schema is not a string",
    body: JSON.stringify({ schema: 7, id: "ticket-1" }),
    rule: "schemas.document-schema-not-a-string",
  },
  {
    name: "top-level array",
    body: JSON.stringify([{ schema: "ticket", id: "ticket-1" }]),
    rule: "schemas.document-not-a-mapping",
  },
];

describe("a file under templates/ that no loader accepts", () => {
  test("a document with no schema member is an error naming the file and the member", () => {
    const issues = checkTemplateDocuments(ctxFor({ "templates/t.json": JSON.stringify({ id: "ticket-1" }) }));
    expect(issues.map((i) => i.rule)).toEqual(["schemas.document-no-schema-member"]);
    expect(issues[0]?.severity).toBe("error");
    expect(issues[0]?.file).toBe("templates/t.json");
    expect(issues[0]?.message).toContain("schema");
  });

  test("a document whose schema member is not a string says what it found instead", () => {
    const issues = checkTemplateDocuments(ctxFor({ "templates/t.json": JSON.stringify({ schema: 7, id: "t" }) }));
    expect(issues.map((i) => i.rule)).toEqual(["schemas.document-schema-not-a-string"]);
    expect(issues[0]?.severity).toBe("error");
    // The type is the whole diagnosis here: `schema: 7` reads as a document to
    // a human, and the message has to say why it is not one to the tool.
    expect(issues[0]?.message).toContain("number");
  });

  test("a top-level array is an error, not a list of documents", () => {
    const issues = checkTemplateDocuments(ctxFor({ "templates/t.json": JSON.stringify([{ schema: "ticket" }]) }));
    expect(issues.map((i) => i.rule)).toEqual(["schemas.document-not-a-mapping"]);
    expect(issues[0]?.severity).toBe("error");
  });

  test("a well-formed document is not reported", () => {
    expect(checkTemplateDocuments(ctxFor({ "templates/t.json": DOCUMENT }))).toEqual([]);
  });

  test("a YAML document is accepted on the same terms as a JSON one", () => {
    expect(checkTemplateDocuments(ctxFor({ "templates/t.yaml": "schema: ticket\nid: ticket-1\n" }))).toEqual([]);
    const bare = checkTemplateDocuments(ctxFor({ "templates/t.yaml": "id: ticket-1\n" }));
    expect(bare.map((i) => i.rule)).toEqual(["schemas.document-no-schema-member"]);
  });

  test("an unparseable document is left to checkSchemas rather than reported twice", () => {
    // schemas.document-unparseable already owns this shape. Two rules for one
    // file would make the output say the same thing twice and neither owner
    // would be the one to remove.
    expect(checkTemplateDocuments(ctxFor({ "templates/t.json": "{ not json" }))).toEqual([]);
  });

  test("a file that is not a document at all is not a malformed document", () => {
    // templates/ is allowed to hold a README. The extension filter is what
    // distinguishes "not a document" from "a document that is broken".
    expect(checkTemplateDocuments(ctxFor({ "templates/README.md": "# Examples\n" }))).toEqual([]);
  });

  test("a document nested below templates/ is covered", () => {
    const issues = checkTemplateDocuments(ctxFor({ "templates/kb/t.json": JSON.stringify({ id: "t" }) }));
    expect(issues.map((i) => i.file)).toEqual(["templates/kb/t.json"]);
  });
});

describe("what the loaders drop is what this check reports", () => {
  // The defect being closed was not that the loaders skip these files -- a
  // loader should not guess what a malformed file meant. It was that the skip
  // was indistinguishable from the file not existing. These tests tie the two
  // together: for each shape, assert both that the loader yields nothing and
  // that the run says so. Either half alone would pass while the gap was open.
  for (const shape of MALFORMED) {
    test(`${shape.name}: the artifact loader drops it and the check names it`, () => {
      const ctx = ctxFor({ "templates/t.json": shape.body });
      expect(loadArtifacts(ctx)).toEqual([]);
      expect(checkTemplateDocuments(ctx).map((i) => i.rule)).toEqual([shape.rule]);
    });

    test(`${shape.name}: a full run names the file`, () => {
      const root = makeTree({ "catalog.yaml": CATALOG, "templates/t.json": shape.body });
      const run = runValidation(root);
      const mine = run.issues.filter((i) => i.file === "templates/t.json");
      // Exactly one rule, not merely at least one: the file is reported once,
      // by its single owner, and no other check is provoked into guessing at it.
      expect(mine.map((i) => i.rule)).toEqual([shape.rule]);
      expect(run.ok).toBe(false);
    });
  }

  test("a well-formed document is silent through the same run", () => {
    // The positive control for the two assertions above. Without it, a check
    // that reported every file in templates/ would pass all six.
    const root = makeTree({ "catalog.yaml": CATALOG, "templates/t.json": DOCUMENT });
    const named = runValidation(root).issues.filter((i) => i.file === "templates/t.json");
    expect(named.map((i) => i.rule)).not.toContain("schemas.document-no-schema-member");
    expect(named.map((i) => i.rule)).not.toContain("schemas.document-not-a-mapping");
    expect(named.map((i) => i.rule)).not.toContain("schemas.document-schema-not-a-string");
  });
});
