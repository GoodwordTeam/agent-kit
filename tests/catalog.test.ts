import { describe, expect, test } from "bun:test";

import { loadCatalog } from "../src/catalog/load.ts";
import {
  DIRECTORY_SECTIONS,
  MANDATORY_BODY_SECTIONS,
  entryDir,
  preferredBodyFile,
  entryFilePath,
} from "../src/catalog/layout.ts";
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

  test("reports an id declared in two addressable sections", () => {
    // AGENTS.md rests its whole reclassification argument on this holding:
    // `tdd` and `attach-pack` are protocols "not skills", `standards-review`
    // and `spec-review` became roles, and the invocation law's mapping table is
    // only true because "no id is both a skill and a protocol". Nothing checked
    // it. An id in two of these sections makes the table false and leaves the
    // U/M partition undecidable for that id -- a body citing it by name no
    // longer names one thing.
    // Both reclassification directions the table actually uses are covered, so
    // dropping either `protocols` or `roles` from the rule fails here rather
    // than passing on the half that remains.
    const both = MINIMAL.replace(
      "protocols: []",
      "protocols:\n  - id: alpha\n    status: contract\n    summary: Also a protocol.",
    ).replace("roles: []", "roles:\n  - id: beta\n    status: contract\n    summary: Also a role.");
    const { issues } = loadCatalog(makeTree({ "catalog.yaml": both }));
    const hits = issues.filter((i) => i.rule === "catalog.id-in-two-addressable-sections");
    expect(hits.length).toBe(2);
    expect(hits.every((i) => i.severity === "error")).toBe(true);
    const alpha = hits.find((i) => i.message.includes("alpha"));
    expect(alpha?.message).toContain("skills");
    expect(alpha?.message).toContain("protocols");
    const beta = hits.find((i) => i.message.includes("beta"));
    expect(beta?.message).toContain("skills");
    expect(beta?.message).toContain("roles");
  });

  test("does not report an id shared by two sections that address different things", () => {
    // The rule has to stay narrow, and this is the case that keeps it narrow:
    // the real catalog declares `review` as both a schema and a policy, which
    // is `schemas/review.schema.json` and `policies/review.yaml` -- different
    // kinds of artifact that no citation confuses. Only the three sections a
    // skill id can be reclassified between are addressable in this sense.
    const shared = MINIMAL.replace(
      "schemas: []",
      "schemas:\n  - id: review\n    status: contract\n    summary: A schema.",
    ).replace("policies: []", "policies:\n  - id: review\n    status: contract\n    summary: A policy.");
    const { issues } = loadCatalog(makeTree({ "catalog.yaml": shared }));
    expect(issues.filter((i) => i.rule === "catalog.id-in-two-addressable-sections")).toEqual([]);
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

  test("the sections whose body file name is mandatory are all five directory sections", () => {
    // Membership in this list is what makes `catalog.unexpected-body-name` an
    // error rather than a warning, and bodies.test.ts covers each of the five
    // directory sections by that consequence, so dropping any one fails a
    // behavioural test there.
    //
    // The pin stays for the direction no behavioural test reaches: a sixth
    // directory section added to DIRECTORY_SECTIONS would be absent here with
    // nothing failing, and its body name would silently be only preferred.
    // This pin failed when `references` and then `packs` were promoted, which
    // is the pin working: the list cannot change without someone deciding,
    // here, that it should.
    expect([...MANDATORY_BODY_SECTIONS]).toEqual(["skills", "packs", "protocols", "roles", "references"]);
    expect([...MANDATORY_BODY_SECTIONS].sort()).toEqual([...DIRECTORY_SECTIONS].sort());
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
