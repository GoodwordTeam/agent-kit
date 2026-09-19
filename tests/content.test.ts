import { describe, expect, test } from "bun:test";

import { checkContent, DENYLIST_EXEMPT_PREFIXES, contentScanRoots } from "../src/validation/content.ts";
import { loadCatalog } from "../src/catalog/load.ts";
import { DENY_TERMS, SCANNER_DEFINITION_FILE } from "../src/denylist.ts";
import { makeTree } from "./helpers/tree.ts";
import { sampleModelTerm } from "./helpers/tree.ts";

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
skills:
  - id: alpha
    status: authored
    invocation: U
`;

function ctxFor(files: Record<string, string>) {
  const root = makeTree({ "catalog.yaml": CATALOG, ...files });
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

const HEAD = "---\nname: alpha\ndescription: d\n---\n";

describe("model and pricing denylist", () => {
  test("a model name in a skill body is an error naming the file, line and rule", () => {
    const ctx = ctxFor({ "skills/alpha/SKILL.md": `${HEAD}\nRoute the work to ${sampleModelTerm()} first.\n` });
    const issue = checkContent(ctx).find((i) => i.rule === "content.denylist");
    expect(issue?.severity).toBe("error");
    expect(issue?.file).toBe("skills/alpha/SKILL.md");
    expect(issue?.line).toBe(6);
  });

  test("provenance/ and research/sources/ quote the sources verbatim and are exempt", () => {
    const term = sampleModelTerm();
    const ctx = ctxFor({
      "skills/alpha/SKILL.md": HEAD,
      "provenance/conversation-map.yaml": `note: ${term}\n`,
      "research/sources/grok-transcript.md": `the ${term} option\n`,
    });
    expect(checkContent(ctx).filter((i) => i.rule === "content.denylist")).toEqual([]);
  });

  test("the exempt prefixes are exactly provenance/, research/ and the scanner's own definition", () => {
    expect([...DENYLIST_EXEMPT_PREFIXES].sort()).toEqual([
      "provenance/",
      "research/",
      SCANNER_DEFINITION_FILE,
      "tests/",
    ].sort());
  });

  test("ordinary English in a skill body is not flagged", () => {
    const ctx = ctxFor({
      "skills/alpha/SKILL.md": `${HEAD}\nThe solution is solid; consolidate the terrain and resolve it on the console.\n`,
    });
    expect(checkContent(ctx).filter((i) => i.rule === "content.denylist")).toEqual([]);
  });

  test("the scan covers src/ and tests/ so the tool cannot exempt itself", () => {
    expect(contentScanRoots()).toContain("src");
    expect(contentScanRoots()).toContain("tests");
    const ctx = ctxFor({ "skills/alpha/SKILL.md": HEAD, "src/thing.ts": `const m = "${sampleModelTerm()}";\n` });
    expect(checkContent(ctx).some((i) => i.rule === "content.denylist" && i.file === "src/thing.ts")).toBe(true);
  });

  test("the scanner's own definition file is not flagged by its own terms", () => {
    const body = DENY_TERMS.map((t) => t.probe).join("\n");
    const ctx = ctxFor({ "skills/alpha/SKILL.md": HEAD, [SCANNER_DEFINITION_FILE]: body });
    expect(checkContent(ctx).filter((i) => i.file === SCANNER_DEFINITION_FILE)).toEqual([]);
  });

  test("pricing shapes are flagged wherever they appear in the catalog", () => {
    const ctx = ctxFor({ "skills/alpha/SKILL.md": `${HEAD}\nBudget line: $/1M tokens\n` });
    expect(checkContent(ctx).some((i) => i.rule === "content.denylist")).toBe(true);
  });

  test("the exemption boundary: a denied term is evidence under tests/ and a defect under src/", () => {
    const term = sampleModelTerm();
    const ctx = ctxFor({
      "skills/alpha/SKILL.md": HEAD,
      "tests/anything.test.ts": `const sample = "${term}";\n`,
      "src/thing.ts": `const m = "${term}";\n`,
    });
    const flagged = checkContent(ctx)
      .filter((i) => i.rule === "content.denylist")
      .map((i) => i.file);
    expect(flagged).toEqual(["src/thing.ts"]);
  });
});

describe("placeholder scan", () => {
  test.each(["TODO: write this", "TBD", "lorem ipsum dolor", "a placeholder here"])(
    "%s in an authored body is an error",
    (line) => {
      const ctx = ctxFor({ "skills/alpha/SKILL.md": `${HEAD}\n${line}\n` });
      const issue = checkContent(ctx).find((i) => i.rule === "content.placeholder");
      expect(issue?.severity).toBe("error");
    },
  );

  test("the placeholder scan is scoped to authored bodies, so meta-docs may name the rule", () => {
    const ctx = ctxFor({
      "skills/alpha/SKILL.md": HEAD,
      "AGENTS.md": "No placeholders. TODO, TBD, lorem and placeholder fail validation.\n",
    });
    expect(checkContent(ctx).filter((i) => i.rule === "content.placeholder")).toEqual([]);
  });

  test("a clean authored body produces nothing", () => {
    const ctx = ctxFor({ "skills/alpha/SKILL.md": `${HEAD}\nRun the checks and report evidence.\n` });
    expect(checkContent(ctx)).toEqual([]);
  });
});

describe("application-local documentation write targets", () => {
  test.each(["Write findings to CONTEXT.md.", "Store it under docs/solutions/ for later.", "Add docs/adr/0001.md."])(
    "%s in a skill body is an error citing ADR-0001",
    (line) => {
      const ctx = ctxFor({ "skills/alpha/SKILL.md": `${HEAD}\n${line}\n` });
      const issue = checkContent(ctx).find((i) => i.rule === "content.local-doc-target");
      expect(issue?.severity).toBe("error");
      expect(issue?.message).toContain("ADR-0001");
    },
  );

  test("the ADR itself may name the paths it replaces", () => {
    const ctx = ctxFor({
      "skills/alpha/SKILL.md": HEAD,
      "docs/decisions/0001-kb-document-vocabulary.md": "CONTEXT.md and docs/solutions/ are replaced.\n",
    });
    expect(checkContent(ctx).filter((i) => i.rule === "content.local-doc-target")).toEqual([]);
  });

  test("a KB adapter call is the accepted form and passes", () => {
    const ctx = ctxFor({ "skills/alpha/SKILL.md": `${HEAD}\nPublish through the KB adapter as a gotcha page.\n` });
    expect(checkContent(ctx)).toEqual([]);
  });
});
