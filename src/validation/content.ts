import { join } from "node:path";

import {
  DENY_TERMS,
  LOCAL_DOC_TARGET_TERMS,
  PLACEHOLDER_TERMS,
  SCANNER_DEFINITION_FILE,
  matchTerms,
  type ScanTerm,
} from "../denylist.ts";
import { readTextIfPresent, walkFiles } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { error, type Issue } from "./types.ts";

/**
 * Denylist scope: everything tracked except the two trees that quote the design
 * sources verbatim by design, the scanner's own term definitions, and the
 * deliberately-invalid validator fixtures.
 */
export const DENYLIST_EXEMPT_PREFIXES: ReadonlyArray<string> = [
  "provenance/",
  "research/",
  "tests/fixtures/",
  SCANNER_DEFINITION_FILE,
];

const SCAN_DIRS = [
  "skills",
  "packs",
  "protocols",
  "roles",
  "references",
  "policies",
  "profiles",
  "adapters",
  "schemas",
  "templates",
  "docs",
  "src",
  "tests",
];

const SCAN_FILES = ["catalog.yaml", "AGENTS.md", "AUTHORING.md", "README.md", "NOTICE"];

/** Authored bodies: where a placeholder means "this skill is not finished". */
const AUTHORED_BODY_DIRS = ["skills", "packs", "protocols", "roles", "references", "templates"];

/** Where an application-local documentation write target is a release-scenario-21 failure. */
const SKILL_BODY_DIRS = ["skills", "packs", "protocols", "roles", "references"];

const TEXT_FILE = /\.(md|ya?ml|json|ts|txt)$/;

export function contentScanRoots(): string[] {
  return [...SCAN_DIRS];
}

function isExempt(file: string): boolean {
  return DENYLIST_EXEMPT_PREFIXES.some((prefix) => (prefix.endsWith("/") ? file.startsWith(prefix) : file === prefix));
}

function collect(root: string, dirs: ReadonlyArray<string>, files: ReadonlyArray<string> = []): string[] {
  const out = new Set<string>();
  for (const dir of dirs) for (const file of walkFiles(root, dir)) if (TEXT_FILE.test(file)) out.add(file);
  for (const file of files) if (readTextIfPresent(join(root, file)) !== null) out.add(file);
  return [...out].sort();
}

function scan(
  root: string,
  files: ReadonlyArray<string>,
  terms: ReadonlyArray<ScanTerm>,
  rule: string,
  describe: (term: ScanTerm, text: string) => string,
): Issue[] {
  const issues: Issue[] = [];
  for (const file of files) {
    if (isExempt(file)) continue;
    const text = readTextIfPresent(join(root, file));
    if (text === null) continue;
    const seen = new Set<string>();
    for (const hit of matchTerms(text, terms)) {
      const key = `${hit.term.id}:${hit.line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push(error(rule, file, describe(hit.term, hit.text), hit.line));
    }
  }
  return issues;
}

export function checkContent(ctx: CheckContext): Issue[] {
  const { root } = ctx;

  const denyFiles = collect(root, SCAN_DIRS, SCAN_FILES);
  const bodyFiles = collect(root, AUTHORED_BODY_DIRS);
  const skillFiles = collect(root, SKILL_BODY_DIRS);

  return [
    ...scan(root, denyFiles, DENY_TERMS, "content.denylist", (term) => `Denied term (${term.id}). ${term.reason}`),
    ...scan(
      root,
      bodyFiles,
      PLACEHOLDER_TERMS,
      "content.placeholder",
      (term, text) => `Placeholder '${text}' in an authored body. ${term.reason} AUTHORING.md: no placeholders.`,
    ),
    ...scan(
      root,
      skillFiles,
      LOCAL_DOC_TARGET_TERMS,
      "content.local-doc-target",
      (term, text) =>
        `Application-local documentation target '${text}' is banned by ADR-0001 (release scenario 21). ${term.reason} Use a KB adapter call.`,
    ),
  ];
}
