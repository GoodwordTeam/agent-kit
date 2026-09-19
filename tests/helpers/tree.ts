import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DENY_TERMS } from "../../src/denylist.ts";

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
 * The single denied model name used by the invalid fixtures.
 *
 * Committed fixture files carry the marker `__DENY_MODEL_TERM__` instead of a
 * real model name, so no tracked file under tests/ contains one. The marker is
 * substituted from src/denylist.ts when the fixture is materialized, which also
 * means the fixture exercises whatever the current denylist actually says.
 */
export const DENY_MARKER = "__DENY_MODEL_TERM__";

export function sampleModelTerm(): string {
  const term = DENY_TERMS.find((t) => t.kind === "model-name");
  if (term === undefined) throw new Error("denylist has no model-name term");
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

/** Copy a committed fixture tree to a temp root, substituting the deny marker. */
export function materializeFixture(relPath: string): string {
  const source = join(import.meta.dir, "..", "fixtures", relPath);
  const root = mkdtempSync(join(tmpdir(), "ak-fixture-"));
  cpSync(source, root, { recursive: true });
  substituteInPlace(root, DENY_MARKER, sampleModelTerm());
  return root;
}
