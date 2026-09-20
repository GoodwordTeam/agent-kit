import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { readTextIfPresent, walkFiles } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { error, type Issue } from "./types.ts";

/**
 * What counts as a document under templates/, decided once.
 *
 * Two loaders walk this directory -- `loadArtifacts` (artifacts.ts), which
 * gates the artifact and document rules, and `templateTargets` (schemas.ts),
 * which gates ajv. Each used to decide for itself what a document was, with a
 * bare `continue` on a file that was not one. Three shapes tripped both and
 * were reported by neither: a file with no `schema` member, a file whose
 * `schema` is not a string, and a top-level array. A document in that state is
 * present, looks validated, and the run says nothing about it either way --
 * indistinguishable from the file not existing. `templates/` was populated to
 * end exactly that failure at directory granularity; this closes it at file
 * granularity.
 *
 * So the classification lives here and both loaders branch on it, rather than
 * each restating it. A future loader that wants a fourth reason to skip a file
 * adds it to `documentShape`, where `checkTemplateDocuments` reports it in the
 * same edit; a skip added anywhere else is a skip that had to be written past
 * this comment.
 *
 * `schema` is the one member an author has no schema to check, because which
 * schema applies is the thing it names. There is no layer underneath it, which
 * is why these are errors and not warnings.
 *
 * The rules keep the `schemas.document-` prefix that `schemas.document-
 * unparseable` and `schemas.document-unreadable` already use, so grepping that
 * prefix finds every reason a file under templates/ is not a document, whoever
 * reports it.
 */

/** Where example artifacts live (plan §4: "templates/ — KB documents and example artifacts"). */
export const DOCUMENT_DIRS = ["templates"] as const;

/** A README beside the examples is not a malformed document; it is not a document. */
const DOCUMENT_EXTENSION = /\.(json|ya?ml)$/;

export interface TemplateDocument {
  file: string;
  schema: string;
  value: Record<string, unknown>;
}

/**
 * Either a document, or the reason a parsed file is not one. Unparseable and
 * unreadable files never reach here: they are reported by `checkSchemas` under
 * `schemas.document-unparseable` and `schemas.document-unreadable`, and are the
 * two shapes of this family that were owned before the rest.
 */
export type DocumentShape =
  | { kind: "document"; schema: string; value: Record<string, unknown> }
  | { kind: "not-a-mapping"; found: string }
  | { kind: "no-schema-member" }
  | { kind: "schema-not-a-string"; found: string };

function describeType(value: unknown): string {
  if (value === null) return "empty";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "object") return "an object";
  return `a ${typeof value}`;
}

export function documentShape(parsed: unknown): DocumentShape {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { kind: "not-a-mapping", found: describeType(parsed) };
  }
  const value = parsed as Record<string, unknown>;
  if (!("schema" in value)) return { kind: "no-schema-member" };
  const schema = value["schema"];
  if (typeof schema !== "string") return { kind: "schema-not-a-string", found: describeType(schema) };
  return { kind: "document", schema, value };
}

/** The files under templates/ that are candidates to be documents at all. */
export function documentFiles(root: string): string[] {
  const out: string[] = [];
  for (const dir of DOCUMENT_DIRS) {
    for (const file of walkFiles(root, dir)) {
      if (DOCUMENT_EXTENSION.test(file)) out.push(file);
    }
  }
  return out;
}

/**
 * The documents under templates/, and nothing else.
 *
 * Every file this drops is a shape `checkTemplateDocuments` reports, so a
 * caller that ignores the drops loses no evidence. Deciding what a malformed
 * file meant is not a loader's job; saying it was dropped is, and that is done
 * once rather than by each caller.
 */
export function loadTemplateDocuments(root: string): TemplateDocument[] {
  const out: TemplateDocument[] = [];
  for (const file of documentFiles(root)) {
    const text = readTextIfPresent(join(root, file));
    if (text === null) continue; // checkSchemas owns unreadable documents.
    let parsed: unknown;
    try {
      parsed = file.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
    } catch {
      continue; // checkSchemas owns unparseable documents.
    }
    const shape = documentShape(parsed);
    if (shape.kind !== "document") continue; // checkTemplateDocuments owns every other shape.
    out.push({ file, schema: shape.schema, value: shape.value });
  }
  return out;
}

function shapeIssue(file: string, shape: DocumentShape): Issue | null {
  switch (shape.kind) {
    case "document":
      return null;
    case "not-a-mapping":
      return error(
        "schemas.document-not-a-mapping",
        file,
        `${file} is ${shape.found} at the top level, not a document. A document is a mapping whose 'schema' member names the schema it validates against; a list of documents is not one. Unwrap it, split it into one file per document, or move it out of templates/.`,
      );
    case "no-schema-member":
      return error(
        "schemas.document-no-schema-member",
        file,
        `${file} has no 'schema' member, so nothing can tell which schema it should validate against, and every check under templates/ skips it. Add a 'schema' member naming a catalog schema, or move the file out of templates/.`,
      );
    case "schema-not-a-string":
      return error(
        "schemas.document-schema-not-a-string",
        file,
        `${file} has a 'schema' member that is ${shape.found}, not a string naming a catalog schema, so every check under templates/ skips it. A quoted schema id -- 'ticket', 'finding' -- is what makes this file a document.`,
      );
  }
}

/**
 * Report every file under templates/ that carries a document extension and is
 * not a document. This is the owner the two loaders' skips name.
 */
export function checkTemplateDocuments(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  for (const file of documentFiles(ctx.root)) {
    const text = readTextIfPresent(join(ctx.root, file));
    if (text === null) continue; // checkSchemas owns unreadable documents.
    let parsed: unknown;
    try {
      parsed = file.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
    } catch {
      continue; // checkSchemas owns unparseable documents; reporting here would say it twice.
    }
    const issue = shapeIssue(file, documentShape(parsed));
    if (issue !== null) issues.push(issue);
  }
  return issues;
}
