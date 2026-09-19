import { describe, expect, test } from "bun:test";

import { extractRelativeLinks, resolveFromFile } from "../src/util/links.ts";
import { checkSourceLinks } from "../src/validation/links.ts";
import { loadCatalog } from "../src/catalog/load.ts";
import { makeTree } from "./helpers/tree.ts";

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
protocols:
  - id: tdd
    status: authored
`;

function ctxFor(files: Record<string, string>) {
  const root = makeTree({ "catalog.yaml": CATALOG, ...files });
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

const HEAD = "---\nname: alpha\ndescription: d\n---\n";

describe("relative link extraction", () => {
  test("finds markdown link targets", () => {
    const links = extractRelativeLinks("See [the protocol](../../protocols/tdd/PROTOCOL.md) first.\n");
    expect(links.map((l) => l.target)).toEqual(["../../protocols/tdd/PROTOCOL.md"]);
    expect(links[0]?.line).toBe(1);
  });

  test("finds bare relative paths written in inline code", () => {
    const links = extractRelativeLinks("Read `../../protocols/tdd/PROTOCOL.md` before starting.\n");
    expect(links.map((l) => l.target)).toEqual(["../../protocols/tdd/PROTOCOL.md"]);
  });

  test("finds ./ prefixed targets and records column-free line numbers", () => {
    const links = extractRelativeLinks("a\nb\n[x](./references/detail.md)\n");
    expect(links[0]).toMatchObject({ target: "./references/detail.md", line: 3 });
  });

  test("ignores absolute URLs, anchors and mail links", () => {
    const text = "[a](https://example.com/x.md) [b](#section) [c](mailto:x@y.z) [d](/abs/path.md)\n";
    expect(extractRelativeLinks(text)).toEqual([]);
  });

  test("strips a trailing anchor from the target", () => {
    const links = extractRelativeLinks("[a](../x/PROTOCOL.md#step-2)\n");
    expect(links[0]?.target).toBe("../x/PROTOCOL.md");
    expect(links[0]?.anchor).toBe("step-2");
  });

  test("deduplicates the same target on the same line", () => {
    const links = extractRelativeLinks("[a](../x.md) and `../x.md`\n");
    expect(links.length).toBe(1);
  });

  test("resolveFromFile normalizes against the referencing file's directory", () => {
    expect(resolveFromFile("skills/alpha/SKILL.md", "../../protocols/tdd/PROTOCOL.md")).toBe("protocols/tdd/PROTOCOL.md");
    expect(resolveFromFile("skills/alpha/SKILL.md", "./references/d.md")).toBe("skills/alpha/references/d.md");
  });

  test("resolveFromFile returns null for a target that escapes the tree", () => {
    expect(resolveFromFile("skills/alpha/SKILL.md", "../../../outside.md")).toBeNull();
  });
});

describe("source-tree link closure", () => {
  test("a resolvable relative reference passes", () => {
    const ctx = ctxFor({
      "skills/alpha/SKILL.md": `${HEAD}\nSee [tdd](../../protocols/tdd/PROTOCOL.md).\n`,
      "protocols/tdd/PROTOCOL.md": "# TDD\n",
    });
    expect(checkSourceLinks(ctx)).toEqual([]);
  });

  test("a dangling relative reference is an error naming the file, line and target", () => {
    const ctx = ctxFor({ "skills/alpha/SKILL.md": `${HEAD}\nSee [tdd](../../protocols/tdd/PROTOCOL.md).\n` });
    const issue = checkSourceLinks(ctx).find((i) => i.rule === "links.broken-source");
    expect(issue?.severity).toBe("error");
    expect(issue?.file).toBe("skills/alpha/SKILL.md");
    expect(issue?.line).toBe(6);
    expect(issue?.message).toContain("protocols/tdd/PROTOCOL.md");
  });

  test("a reference escaping the repository root is an error", () => {
    const ctx = ctxFor({ "skills/alpha/SKILL.md": `${HEAD}\n[x](../../../etc/passwd)\n` });
    expect(checkSourceLinks(ctx).some((i) => i.rule === "links.escapes-tree")).toBe(true);
  });

  test("links inside shared resources are checked too, not only skill bodies", () => {
    const ctx = ctxFor({
      "skills/alpha/SKILL.md": HEAD,
      "protocols/tdd/PROTOCOL.md": "See [role](../../roles/implementer/ROLE.md).\n",
    });
    const issue = checkSourceLinks(ctx).find((i) => i.rule === "links.broken-source");
    expect(issue?.file).toBe("protocols/tdd/PROTOCOL.md");
  });

  test("a link to a directory that exists is accepted", () => {
    const ctx = ctxFor({
      "skills/alpha/SKILL.md": `${HEAD}\n[dir](../../protocols/tdd/)\n`,
      "protocols/tdd/PROTOCOL.md": "# TDD\n",
    });
    expect(checkSourceLinks(ctx)).toEqual([]);
  });
});

describe("link closure after packaging", () => {
  const PKG_CATALOG = `schema_version: 1
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
    profiles: [core]
  - id: beta
    status: authored
    invocation: M
    profiles: [autonomy]
protocols:
  - id: tdd
    status: authored
roles:
  - id: implementer
    status: authored
profiles:
  - id: core
    status: authored
  - id: autonomy
    status: authored
`;

  function pkgCtx(files: Record<string, string>) {
    const root = makeTree({ "catalog.yaml": PKG_CATALOG, ...files });
    const { catalog } = loadCatalog(root);
    if (catalog === null) throw new Error("fixture has no catalog");
    return { root, catalog };
  }

  test("a link into a shared protocol still resolves once the packager has copied it", async () => {
    const { checkBundleLinks } = await import("../src/validation/links.ts");
    const ctx = pkgCtx({
      "skills/alpha/SKILL.md": `${HEAD}\nSee [tdd](../../protocols/tdd/PROTOCOL.md).\n`,
      "skills/beta/SKILL.md": "---\nname: beta\ndescription: d\n---\nbody\n",
      "protocols/tdd/PROTOCOL.md": "# TDD\n\nSee [impl](../../roles/implementer/ROLE.md).\n",
      "roles/implementer/ROLE.md": "# Implementer\n",
    });
    expect(checkBundleLinks(ctx, {})).toEqual([]);
  });

  test("a link that resolves in the source tree but dangles in the bundle is an error", async () => {
    const { checkBundleLinks } = await import("../src/validation/links.ts");
    const ctx = pkgCtx({
      "skills/alpha/SKILL.md": `${HEAD}\nSee [notes](../../research/sources/notes.md).\n`,
      "skills/beta/SKILL.md": "---\nname: beta\ndescription: d\n---\nbody\n",
      "research/sources/notes.md": "# Notes\n",
    });
    expect(checkSourceLinks(ctx)).toEqual([]);
    const issue = checkBundleLinks(ctx, {}).find((i) => i.rule === "links.broken-bundle");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("research/sources/notes.md");
    expect(issue?.file).toContain("dist/claude-code/skills/alpha/SKILL.md");
  });

  test("a cross-skill link dangles when the profile excludes the target skill", async () => {
    const { checkBundleLinks } = await import("../src/validation/links.ts");
    const ctx = pkgCtx({
      "skills/alpha/SKILL.md": `${HEAD}\nSee [beta](../beta/SKILL.md).\n`,
      "skills/beta/SKILL.md": "---\nname: beta\ndescription: d\n---\nbody\n",
      "profiles/core.yaml": "id: core\nskills: [alpha]\n",
    });
    expect(checkSourceLinks(ctx)).toEqual([]);
    expect(checkBundleLinks(ctx, { profile: "core" }).some((i) => i.rule === "links.broken-bundle")).toBe(true);
  });

  test("closure is verified for every host bundle, not only the first", async () => {
    const { checkBundleLinks } = await import("../src/validation/links.ts");
    const ctx = pkgCtx({
      "skills/alpha/SKILL.md": `${HEAD}\nSee [notes](../../research/sources/notes.md).\n`,
      "skills/beta/SKILL.md": "---\nname: beta\ndescription: d\n---\nbody\n",
      "research/sources/notes.md": "# Notes\n",
    });
    const files = new Set(checkBundleLinks(ctx, {}).map((i) => i.file.split("/").slice(0, 2).join("/")));
    expect([...files].sort()).toEqual(["dist/claude-code", "dist/codex"]);
  });
});
