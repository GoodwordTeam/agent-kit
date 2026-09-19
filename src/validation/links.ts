import { join } from "node:path";

import { exists, isDir, readTextIfPresent, walkFiles } from "../util/fs.ts";
import { extractRelativeLinks, resolveFromFile } from "../util/links.ts";
import { planAll, type BuildOptions } from "../packaging/build.ts";
import { SHARED_ROOT } from "../packaging/plan.ts";
import type { CheckContext } from "./context.ts";
import { error, type Issue } from "./types.ts";

/** Every tree whose markdown a bundle may need to carry. */
const LINKED_DIRS = ["skills", "packs", "protocols", "roles", "references", "adapters", "templates"];

export function linkedMarkdownFiles(root: string): string[] {
  const out: string[] = [];
  for (const dir of LINKED_DIRS) for (const file of walkFiles(root, dir)) if (file.endsWith(".md")) out.push(file);
  return out.sort();
}

/** Half one of link closure: every relative reference resolves in the source tree. */
export function checkSourceLinks(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];

  for (const file of linkedMarkdownFiles(ctx.root)) {
    const text = readTextIfPresent(join(ctx.root, file));
    if (text === null) continue;
    for (const link of extractRelativeLinks(text)) {
      const resolved = resolveFromFile(file, link.target);
      if (resolved === null) {
        issues.push(
          error("links.escapes-tree", file, `Reference '${link.target}' resolves outside the repository root.`, link.line),
        );
        continue;
      }
      const full = join(ctx.root, resolved);
      if (!exists(full) && !isDir(full)) {
        issues.push(
          error("links.broken-source", file, `Reference '${link.target}' does not resolve; '${resolved}' does not exist.`, link.line),
        );
      }
    }
  }

  return issues;
}

/**
 * Half two of link closure, and the half that actually breaks in installed
 * bundles: after the packager has copied transitive dependencies into
 * references/shared/ and rewritten the links, every relative reference must
 * still resolve inside the bundle.
 */
export function checkBundleLinks(ctx: CheckContext, options: BuildOptions): Issue[] {
  const issues: Issue[] = [];

  for (const plan of planAll(ctx, options)) {
    const present = new Set(plan.files.keys());
    const dirs = new Set<string>();
    for (const path of present) {
      const parts = path.split("/");
      for (let i = 1; i < parts.length; i += 1) dirs.add(parts.slice(0, i).join("/"));
    }

    for (const file of plan.files.values()) {
      if (!file.path.endsWith(".md")) continue;
      for (const link of extractRelativeLinks(file.contents)) {
        const resolved = resolveFromFile(file.path, link.target);
        const where = `dist/${plan.host}/${file.path}`;
        if (resolved === null) {
          issues.push(error("links.broken-bundle", where, `Reference '${link.target}' escapes the bundle root.`, link.line));
          continue;
        }
        if (present.has(resolved) || dirs.has(resolved)) continue;
        issues.push(
          error(
            "links.broken-bundle",
            where,
            `Reference '${link.target}' resolves in the source tree but '${resolved}' is not in the ${plan.host} bundle. The packager must copy it into ${SHARED_ROOT}/ or the reference must be removed.`,
            link.line,
          ),
        );
      }
    }
  }

  return issues;
}
