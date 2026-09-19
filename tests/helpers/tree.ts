import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DENY_TERMS, PLACEHOLDER_TERMS } from "../../src/denylist.ts";

/** Build a throwaway repo root from a path -> contents map. */
export function makeTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ak-tree-"));
  for (const [rel, contents] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
}

/**
 * The denied strings used by the invalid fixtures.
 *
 * Committed fixture files carry the markers `__DENY_MODEL_TERM__` and
 * `__PLACEHOLDER_TERM__` instead of a real model name or a real unfinished
 * marker, so no tracked file under tests/ contains either. They are
 * substituted from src/denylist.ts when the fixture is materialized, which
 * also means the fixtures exercise whatever the current denylist actually
 * says rather than a copy of it that can drift.
 */
export const DENY_MARKER = "__DENY_MODEL_TERM__";
export const PLACEHOLDER_MARKER = "__PLACEHOLDER_TERM__";

export function sampleModelTerm(): string {
  const term = DENY_TERMS.find((t) => t.kind === "model-name");
  if (term === undefined) throw new Error("denylist has no model-name term");
  return term.probe;
}

export function samplePlaceholderTerm(): string {
  const term = PLACEHOLDER_TERMS[0];
  if (term === undefined) throw new Error("denylist has no placeholder term");
  return term.probe;
}

function substituteInPlace(dir: string, from: string, to: string): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      substituteInPlace(full, from, to);
      continue;
    }
    const text = readFileSync(full, "utf8");
    if (text.includes(from)) writeFileSync(full, text.split(from).join(to));
  }
}

/** Copy a committed fixture tree to a temp root, substituting the denied strings. */
export function materializeFixture(relPath: string): string {
  const source = join(import.meta.dir, "..", "fixtures", relPath);
  const root = mkdtempSync(join(tmpdir(), "ak-fixture-"));
  cpSync(source, root, { recursive: true });
  substituteInPlace(root, DENY_MARKER, sampleModelTerm());
  substituteInPlace(root, PLACEHOLDER_MARKER, samplePlaceholderTerm());
  return root;
}
