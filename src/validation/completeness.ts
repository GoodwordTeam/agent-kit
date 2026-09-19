import { join } from "node:path";

import type { CatalogEntry } from "../catalog/load.ts";
import {
  DIRECTORY_SECTIONS,
  FILE_SECTIONS,
  MANDATORY_BODY_SECTIONS,
  entryDir,
  entryFilePath,
  preferredBodyFile,
  type DirectorySection,
  type FileSection,
} from "../catalog/layout.ts";
import { exists, isDir, listDirs, listFiles } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { error, note, warning, type Issue } from "./types.ts";

function bodyFiles(root: string, dir: string): string[] {
  return listFiles(join(root, dir)).filter((n) => n.endsWith(".md"));
}

/** Directory ids actually present under a section root, including one level of nesting. */
function presentDirIds(root: string, section: DirectorySection, declared: ReadonlySet<string>): string[] {
  const sectionRoot = join(root, section);
  const out: string[] = [];
  for (const top of listDirs(sectionRoot)) {
    if (declared.has(top)) {
      out.push(top);
      continue;
    }
    const nested = listDirs(join(sectionRoot, top));
    const nestedIds = nested.map((n) => `${top}/${n}`);
    const anyNestedDeclared = nestedIds.some((id) => declared.has(id));
    if (nested.length > 0 && anyNestedDeclared) {
      // `top` is a group directory (e.g. roles/code-review); judge its children.
      out.push(...nestedIds);
      continue;
    }
    out.push(top);
  }
  return out;
}

/**
 * Both directions of catalog completeness.
 *
 * `status: contract` with no directory is "declared, not yet authored" — a note.
 * A directory with no entry is always an error: undeclared content is not
 * installable, packageable or referenceable (catalog.yaml header).
 */
export function checkCompleteness(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  const { root, catalog } = ctx;

  for (const section of DIRECTORY_SECTIONS) {
    const entries = catalog.bySection(section);
    const declared = new Set(entries.map((e) => e.id));

    for (const entry of entries) {
      const dir = entryDir(section, entry.id);
      if (!isDir(join(root, dir))) {
        if (entry.status === "authored") {
          issues.push(
            error(
              "catalog.entry-without-directory",
              dir,
              `catalog.yaml declares ${section}/${entry.id} as authored but ${dir}/ does not exist.`,
            ),
          );
        } else {
          issues.push(
            note("catalog.entry-not-authored", dir, `${section}/${entry.id} is declared with status: contract and has no body yet.`),
          );
        }
        continue;
      }

      const preferred = preferredBodyFile(section);
      const present = bodyFiles(root, dir);
      const hasPreferred = exists(join(root, dir, preferred));
      const mandatory = MANDATORY_BODY_SECTIONS.includes(section);

      if (!hasPreferred) {
        if (present.length === 0 || mandatory) {
          issues.push(
            error("catalog.entry-missing-body", dir, `${dir}/ exists but has no ${preferred}.`),
          );
        } else {
          issues.push(
            warning(
              "catalog.unexpected-body-name",
              `${dir}/${present[0]}`,
              `${dir}/ has no ${preferred}; found ${present.join(", ")}. The canonical body file name for ${section} is ${preferred}.`,
            ),
          );
        }
      } else if (entry.status === "contract") {
        issues.push(
          warning(
            "catalog.status-behind-body",
            `${dir}/${preferred}`,
            `${dir}/${preferred} exists but catalog.yaml still says status: contract. Set it to authored.`,
          ),
        );
      }
    }

    for (const id of presentDirIds(root, section, declared)) {
      if (declared.has(id)) continue;
      issues.push(
        error(
          "catalog.directory-without-entry",
          `${section}/${id}`,
          `${section}/${id}/ exists but catalog.yaml declares no ${section} entry '${id}'. Nothing is installable unless it is declared.`,
        ),
      );
    }
  }

  issues.push(...checkFileSections(ctx));
  return issues;
}

function declaredFilePaths(entries: ReadonlyArray<CatalogEntry>, section: FileSection): Set<string> {
  return new Set(entries.map((e) => entryFilePath(section, e.id)));
}

function checkFileSections(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  const { root, catalog } = ctx;

  for (const section of FILE_SECTIONS) {
    const entries = catalog.bySection(section);
    for (const entry of entries) {
      const path = entryFilePath(section, entry.id);
      if (exists(join(root, path))) {
        if (entry.status === "contract") {
          issues.push(
            warning("catalog.status-behind-body", path, `${path} exists but catalog.yaml still says status: contract. Set it to authored.`),
          );
        }
        continue;
      }
      if (entry.status === "authored") {
        issues.push(error("catalog.entry-without-file", path, `catalog.yaml declares ${section}/${entry.id} as authored but ${path} does not exist.`));
      } else {
        issues.push(note("catalog.entry-not-authored", path, `${section}/${entry.id} is declared with status: contract and has no file yet.`));
      }
    }

    const declared = declaredFilePaths(entries, section);
    if (section === "adapters") {
      for (const dir of listDirs(join(root, "adapters"))) {
        if (!declared.has(entryFilePath("adapters", dir))) {
          issues.push(
            error("catalog.file-without-entry", `adapters/${dir}`, `adapters/${dir}/ exists but catalog.yaml declares no adapters entry '${dir}'.`),
          );
        }
      }
      continue;
    }
    for (const name of listFiles(join(root, section))) {
      if (!name.endsWith(section === "schemas" ? ".schema.json" : ".yaml")) continue;
      const path = `${section}/${name}`;
      if (!declared.has(path)) {
        issues.push(error("catalog.file-without-entry", path, `${path} exists but catalog.yaml declares no ${section} entry for it.`));
      }
    }
  }

  return issues;
}
