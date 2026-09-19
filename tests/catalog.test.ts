import { describe, expect, test } from "bun:test";

import { loadCatalog } from "../src/catalog/load.ts";
import { DIRECTORY_SECTIONS, entryDir, preferredBodyFile, entryFilePath } from "../src/catalog/layout.ts";
import { makeTree } from "./helpers/tree.ts";

const MINIMAL = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0-dev
  namespace: "/ak:"
  default_profile: core
skills:
  - id: alpha
    invocation: U
    profiles: [core]
    status: contract
    provenance_origin: donor
    summary: One.
  - id: beta
    invocation: M
    profiles: [core]
    status: authored
    provenance_origin: conversation
    summary: Two.
packs: []
protocols: []
roles: []
references: []
schemas: []
policies: []
profiles: []
adapters: []
`;

describe("catalog loading", () => {
  test("parses package metadata and entries with their section", () => {
    const { catalog, issues } = loadCatalog(makeTree({ "catalog.yaml": MINIMAL }));
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(catalog?.package.id).toBe("ak");
    expect(catalog?.package.defaultProfile).toBe("core");
    expect(catalog?.bySection("skills").map((e) => e.id)).toEqual(["alpha", "beta"]);
    expect(catalog?.get("skills", "beta")?.status).toBe("authored");
    expect(catalog?.get("skills", "alpha")?.invocation).toBe("U");
    expect(catalog?.get("skills", "beta")?.provenanceOrigin).toBe("conversation");
  });

  test("reports a missing catalog.yaml as an error rather than throwing", () => {
    const { catalog, issues } = loadCatalog(makeTree({}));
    expect(catalog).toBeNull();
    expect(issues.some((i) => i.rule === "catalog.missing" && i.severity === "error")).toBe(true);
  });

  test("reports unparseable YAML as an error rather than throwing", () => {
    const { catalog, issues } = loadCatalog(makeTree({ "catalog.yaml": "skills: [unclosed\n" }));
    expect(catalog).toBeNull();
    expect(issues.some((i) => i.rule === "catalog.unparseable")).toBe(true);
  });

  test("reports a duplicate id within a section", () => {
    const dup = MINIMAL.replace("  - id: beta", "  - id: alpha");
    const { issues } = loadCatalog(makeTree({ "catalog.yaml": dup }));
    expect(issues.some((i) => i.rule === "catalog.duplicate-id" && i.message.includes("alpha"))).toBe(true);
  });

  test("keeps per-entrypoint invocation for skills that declare entrypoints", () => {
    const withEntrypoints = MINIMAL.replace(
      "    summary: One.",
      `    entrypoints:
      full:
        authority: explicit-or-delegated
        invocation: U
      delta:
        authority: active-review-run
        invocation: M
    summary: One.`,
    );
    const { catalog } = loadCatalog(makeTree({ "catalog.yaml": withEntrypoints }));
    const alpha = catalog?.get("skills", "alpha");
    expect(alpha?.entrypoints?.delta?.invocation).toBe("M");
    expect(alpha?.entrypoints?.full?.authority).toBe("explicit-or-delegated");
  });

  test("a section absent from catalog.yaml yields no entries and no crash", () => {
    const { catalog, issues } = loadCatalog(makeTree({ "catalog.yaml": "schema_version: 1\npackage:\n  id: ak\n" }));
    expect(issues.some((i) => i.severity === "error")).toBe(false);
    expect(catalog?.bySection("skills")).toEqual([]);
  });
});

describe("catalog layout", () => {
  test("directory-backed sections are the five with both-direction completeness", () => {
    expect([...DIRECTORY_SECTIONS]).toEqual(["skills", "packs", "protocols", "roles", "references"]);
  });

  test("entryDir joins the section root and the id, including nested role ids", () => {
    expect(entryDir("skills", "super-align")).toBe("skills/super-align");
    expect(entryDir("roles", "code-review/security")).toBe("roles/code-review/security");
  });

  test("each directory section has a preferred canonical body file name", () => {
    expect(preferredBodyFile("skills")).toBe("SKILL.md");
    expect(preferredBodyFile("protocols")).toBe("PROTOCOL.md");
    expect(preferredBodyFile("packs")).toBe("PACK.md");
    expect(preferredBodyFile("roles")).toBe("ROLE.md");
    expect(preferredBodyFile("references")).toBe("REFERENCE.md");
  });

  test("file-backed sections map an id to a single path", () => {
    expect(entryFilePath("schemas", "ticket")).toBe("schemas/ticket.schema.json");
    expect(entryFilePath("policies", "invocation")).toBe("policies/invocation.yaml");
    expect(entryFilePath("profiles", "core")).toBe("profiles/core.yaml");
    expect(entryFilePath("adapters", "codex")).toBe("adapters/codex/CONTRACT.md");
  });
});
