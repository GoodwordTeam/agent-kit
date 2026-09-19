/**
 * Ruling citations (AUTHORING.md §6).
 *
 * `policies/resolved-conflicts.yaml` is the only authority for ruling ids. A
 * body that cites an id the policy does not define reads as settled and is not,
 * which is the exact failure the rulings exist to prevent, so a dangling id is
 * an error rather than a broken link.
 *
 * Each row's `binds` block is the inverse: it names the entries the row already
 * decided are governed by it, so an authored body named there that cites nothing
 * is a gap the row itself identified. Only authored bodies are owed a citation —
 * an entry with no file yet is reported by the completeness check, not here.
 *
 * A row without `overrides` is complete. Absence means the sources were
 * reconciled rather than one being overruled, and nothing here treats it as
 * missing data.
 *
 * `universal` is the third direction. A row that governs a whole kind says so
 * once instead of hiding the completeness of a 29-item list, and this file makes
 * the claim binding: the enumeration under `binds` must be exactly that section.
 */

import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { ALL_SECTIONS, entryBodyPath, entryFilePath, isDirectorySection, type Section } from "../catalog/layout.ts";
import { readTextIfPresent, walkFiles } from "../util/fs.ts";
import { citedRulings } from "./bodies.ts";
import type { CheckContext } from "./context.ts";
import { error, note, warning, type Issue } from "./types.ts";

export const RULINGS_FILE = "policies/resolved-conflicts.yaml";

/** The numbered release scenarios in plan §10. */
export const RELEASE_SCENARIO_COUNT = 24;

/** Markdown trees whose bodies carry §6's inline citations. */
const MARKDOWN_ROOTS = ["skills", "packs", "protocols", "roles", "references", "adapters", "templates", "docs"];
const MARKDOWN_FILES = ["AGENTS.md", "AUTHORING.md", "README.md"];

/** YAML trees whose files carry §6's `ruling:` / `rulings:` keys. */
const YAML_ROOTS = ["policies", "profiles", "skills", "packs"];

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface RulingRow {
  readonly id: string;
  /** catalog kind -> entry ids this row governs. */
  readonly binds: Readonly<Record<string, ReadonlyArray<string>>>;
  /**
   * The kinds this row governs *entirely*. `binds` still enumerates them; this
   * says the enumeration is the whole section rather than a selection from it.
   */
  readonly universal: ReadonlyArray<string>;
  readonly scenario: number | null;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Every ruling id cited by a YAML document: `ruling: <id>`, `rulings: [<id>]`,
 * and `provenance.resolved_conflicts[]`, wherever they appear in the tree.
 *
 * Parsed rather than matched by regex, so a `ruling:` key whose value is a
 * mapping — an artifact recording a decision, not citing one — is not mistaken
 * for a citation.
 */
export function citedRulingsInYaml(text: string): string[] {
  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch {
    return [];
  }
  const out: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node === null || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "ruling" && typeof value === "string" && KEBAB.test(value.trim())) out.push(value.trim());
      if (key === "rulings" || key === "resolved_conflicts") {
        for (const item of Array.isArray(value) ? value : []) {
          if (typeof item === "string" && KEBAB.test(item.trim())) out.push(item.trim());
        }
      }
      visit(value);
    }
  };
  visit(parsed);
  return out;
}

export function loadRulings(root: string): { rows: RulingRow[]; issues: Issue[]; present: boolean } {
  const text = readTextIfPresent(join(root, RULINGS_FILE));
  if (text === null) {
    return {
      rows: [],
      issues: [
        note(
          "rulings.policy-unavailable",
          RULINGS_FILE,
          "the resolved-conflicts policy is not present; no ruling id can be resolved, so no citation is checked",
        ),
      ],
      present: false,
    };
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (cause) {
    return {
      rows: [],
      issues: [error("rulings.unparseable", RULINGS_FILE, `could not be parsed: ${(cause as Error).message}`)],
      present: true,
    };
  }

  const doc = record(parsed);
  const issues: Issue[] = [];
  const rows: RulingRow[] = [];
  const seen = new Set<string>();

  const conflicts = Array.isArray(doc["conflicts"]) ? doc["conflicts"] : [];
  for (const [i, entry] of conflicts.entries()) {
    const row = record(entry);
    const id = typeof row["id"] === "string" ? row["id"] : null;
    if (id === null || !KEBAB.test(id)) {
      issues.push(error("rulings.malformed-id", RULINGS_FILE, `conflicts[${i}] has id ${id ?? "(missing)"}, which is not a kebab-case id`));
      continue;
    }
    if (seen.has(id)) {
      issues.push(
        error("rulings.duplicate-id", RULINGS_FILE, `ruling id ${id} is declared more than once; the ids are what every body cites and must be unique`),
      );
      continue;
    }
    seen.add(id);

    const binds: Record<string, string[]> = {};
    for (const [kind, value] of Object.entries(record(row["binds"]))) {
      binds[kind] = (Array.isArray(value) ? value : []).filter((v): v is string => typeof v === "string");
    }

    // A kind listed here claims to cover a whole section, so the shape matters as
    // much as the contents: `universal: roles` would read as a claim and enumerate
    // one letter per kind, which is how a wildcard spelled as a bare string binds
    // nothing while looking bound. Refuse the shape rather than coercing it.
    const universalValue = row["universal"];
    let universal: string[] = [];
    if (universalValue !== undefined) {
      if (!Array.isArray(universalValue) || universalValue.some((k) => typeof k !== "string")) {
        issues.push(
          error(
            "rulings.malformed-universal",
            RULINGS_FILE,
            `${id} declares universal: ${JSON.stringify(universalValue)}, which is not a list of catalog kinds. Write universal: [roles]; a bare string reads as a claim and checks nothing.`,
          ),
        );
      } else {
        universal = universalValue.filter((k): k is string => typeof k === "string");
      }
    }

    const scenario = typeof row["scenario"] === "number" ? row["scenario"] : null;
    if (scenario !== null && (!Number.isInteger(scenario) || scenario < 1 || scenario > RELEASE_SCENARIO_COUNT)) {
      issues.push(
        error(
          "rulings.unknown-scenario",
          RULINGS_FILE,
          `${id} names scenario ${scenario}, which is not one of the ${RELEASE_SCENARIO_COUNT} numbered release scenarios in plan §10`,
        ),
      );
    }

    rows.push({ id, binds, universal, scenario });
  }

  const declared = doc["rows"];
  if (typeof declared === "number" && declared !== conflicts.length) {
    issues.push(
      error(
        "rulings.row-count-mismatch",
        RULINGS_FILE,
        `rows: ${declared} but ${conflicts.length} conflict row(s) are declared. The count is read by other agents; keep it equal or drop it.`,
      ),
    );
  }

  return { rows, issues, present: true };
}

function isSection(kind: string): kind is Section {
  return (ALL_SECTIONS as ReadonlyArray<string>).includes(kind);
}

/** The file that is the body of a catalog entry, by the kind a `binds` group names. */
function bodyPathFor(kind: Section, id: string): string {
  return isDirectorySection(kind) ? entryBodyPath(kind, id) : entryFilePath(kind, id);
}

function lineOf(text: string, needle: string): number | undefined {
  const lines = text.split("\n");
  for (const [i, line] of lines.entries()) if (line.includes(needle)) return i + 1;
  return undefined;
}

/**
 * §6's plural `rulings: [...]` is a YAML shape. A markdown body takes the
 * singular word and one bare id.
 *
 * This is refused rather than parsed, and the distinction is the whole point.
 * `citedRulings` looks for ``ruling `<id>` `` and "rulings `" does not match it,
 * so a plural citation in markdown does not read as a malformed citation -- it
 * reads as **no citation at all**. The body cites two rulings to a human and
 * zero to every tool, the forward check then reports the file as uncited, and
 * the author looks at a file that visibly cites the ruling and concludes the
 * checker is broken. Widening `citedRulings` to accept the plural would fix the
 * blindness by making an illegal shape legal; refusing it fixes the blindness
 * and keeps §6.
 *
 * Fenced blocks and frontmatter are skipped: both are YAML, where the plural is
 * the correct form, and AUTHORING.md §6 has to be able to print the YAML shape
 * in prose without flagging itself.
 */
function pluralCitations(text: string): { line: number; ids: string[]; text: string }[] {
  const out: { line: number; ids: string[]; text: string }[] = [];
  const lines = text.split("\n");
  let fenced = false;
  let frontmatter = lines[0]?.trim() === "---";

  for (const [i, raw] of lines.entries()) {
    const line = raw ?? "";
    if (frontmatter) {
      if (i > 0 && line.trim() === "---") frontmatter = false;
      continue;
    }
    if (/^\s*(?:```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;

    // Capture the whole run of ids after the plural word, not just the first:
    // the repair a writer needs is one singular clause per id they wrote.
    const runs = [...line.matchAll(/\brulings\s+((?:`[a-z0-9][a-z0-9-]*`(?:\s*(?:,|and|&)\s*)?)+)/g)];
    const cited = runs.flatMap((m) => [...(m[1] ?? "").matchAll(/`([a-z0-9][a-z0-9-]*)`/g)].map((one) => one[1] ?? ""));
    const key = /^\s*rulings:/.test(line);
    if (cited.length === 0 && !key) continue;
    out.push({ line: i + 1, ids: cited, text: line.trim() });
  }

  return out;
}

function checkCitations(ctx: CheckContext, known: ReadonlySet<string>): Issue[] {
  const issues: Issue[] = [];
  const { root } = ctx;

  const markdown = new Set<string>();
  for (const dir of MARKDOWN_ROOTS) for (const file of walkFiles(root, dir)) if (file.endsWith(".md")) markdown.add(file);
  for (const file of MARKDOWN_FILES) if (readTextIfPresent(join(root, file)) !== null) markdown.add(file);

  for (const file of [...markdown].sort()) {
    const text = readTextIfPresent(join(root, file));
    if (text === null) continue;

    for (const hit of pluralCitations(text)) {
      const singular =
        hit.ids.length > 0
          ? `Write one per clause: ${hit.ids.map((id) => `ruling \`${id}\``).join(", then ")}.`
          : "Write the singular `ruling` plus one bare id per clause.";
      issues.push(
        error(
          "rulings.plural-citation-in-markdown",
          file,
          `uses §6's plural \`rulings\` form in a markdown body: "${hit.text.slice(0, 90)}". The plural is the YAML shape; a markdown body takes the singular word and one bare id. Every tool built on §6 reads this as zero citations rather than as a malformed one. ${singular}`,
          hit.line,
        ),
      );
    }

    const reported = new Set<string>();
    for (const id of citedRulings(text)) {
      if (known.has(id) || reported.has(id)) continue;
      reported.add(id);
      issues.push(
        error(
          "rulings.unknown-citation",
          file,
          `cites ruling \`${id}\`, which ${RULINGS_FILE} does not define. Read the id out of the policy rather than reconstructing it from the tension it settles.`,
          lineOf(text, id),
        ),
      );
    }
  }

  const yamlFiles = new Set<string>();
  for (const dir of YAML_ROOTS) for (const file of walkFiles(root, dir)) if (/\.ya?ml$/.test(file)) yamlFiles.add(file);
  yamlFiles.delete(RULINGS_FILE); // the policy defines the ids; it does not cite them.

  for (const file of [...yamlFiles].sort()) {
    const text = readTextIfPresent(join(root, file));
    if (text === null) continue;
    const reported = new Set<string>();
    for (const id of citedRulingsInYaml(text)) {
      if (known.has(id) || reported.has(id)) continue;
      reported.add(id);
      issues.push(
        error(
          "rulings.unknown-citation",
          file,
          `cites ruling ${id}, which ${RULINGS_FILE} does not define.`,
          lineOf(text, id),
        ),
      );
    }
  }

  return issues;
}

function checkBinds(ctx: CheckContext, rows: ReadonlyArray<RulingRow>): Issue[] {
  const issues: Issue[] = [];
  const { root, catalog } = ctx;

  for (const row of rows) {
    for (const [kind, ids] of Object.entries(row.binds)) {
      if (!isSection(kind)) {
        issues.push(error("rulings.unknown-binds-kind", RULINGS_FILE, `${row.id} binds a kind '${kind}', which is not a catalog section`));
        continue;
      }
      const declared = new Set(catalog.bySection(kind).map((e) => e.id));
      for (const id of ids) {
        if (!declared.has(id)) {
          issues.push(
            error(
              "rulings.binds-unknown-entry",
              RULINGS_FILE,
              `${row.id} binds ${kind}/${id}, which catalog.yaml does not declare. A binding to nothing cannot be checked in either direction.`,
            ),
          );
          continue;
        }
        const file = bodyPathFor(kind, id);
        const text = readTextIfPresent(join(root, file));
        if (text === null) continue; // not authored yet; completeness owns that.
        if (text.includes(row.id)) continue;

        // A JSON Schema has no §6 citation shape — the table gives one to markdown
        // bodies and one to YAML files, and neither fits a schema document — so the
        // binding is reported as a warning there and as an error everywhere the
        // shape exists.
        const report = kind === "schemas" ? warning : error;
        issues.push(
          report(
            "rulings.binding-not-cited",
            file,
            `ruling \`${row.id}\` binds ${kind}/${id} but this file cites it nowhere. The row already decided this entry touches the conflict (AUTHORING.md §6).`,
          ),
        );
      }
    }
  }

  return issues;
}

function sectionIds(ctx: CheckContext, kind: Section): Set<string> {
  return new Set(ctx.catalog.bySection(kind).map((e) => e.id));
}

/**
 * `universal` is the claim; `binds` is the machine's copy of it. The pair is only
 * worth more than the enumeration it replaced if something checks that they agree,
 * so a kind declared universal must bind exactly that section in catalog.yaml.
 *
 * This is strictly stronger than spelling the claim as a wildcard: a wildcard
 * would cover a role added later by construction and could never catch a list
 * someone quietly trimmed. Set equality catches both, and it catches them at the
 * moment the section changes rather than whenever a reader next compares by eye.
 */
function checkUniversal(ctx: CheckContext, rows: ReadonlyArray<RulingRow>): Issue[] {
  const issues: Issue[] = [];

  for (const row of rows) {
    for (const kind of row.universal) {
      if (!isSection(kind)) {
        issues.push(
          error(
            "rulings.unknown-universal-kind",
            RULINGS_FILE,
            `${row.id} declares universal: [${kind}], which is not a catalog section. A claim over a kind that does not exist cannot be kept or broken.`,
          ),
        );
        continue;
      }

      const declared = sectionIds(ctx, kind);
      const bound = new Set(row.binds[kind] ?? []);
      const missing = [...declared].filter((id) => !bound.has(id)).sort();
      const extra = [...bound].filter((id) => !declared.has(id)).sort();
      if (missing.length === 0 && extra.length === 0) continue;

      const parts: string[] = [];
      if (missing.length > 0) parts.push(`missing ${missing.length}: ${missing.join(", ")}`);
      if (extra.length > 0) parts.push(`extra ${extra.length}: ${extra.join(", ")}`);
      issues.push(
        error(
          "rulings.universal-binds-mismatch",
          RULINGS_FILE,
          `${row.id} declares universal: [${kind}], so binds.${kind} must be every ${kind} entry in catalog.yaml (${declared.size} of them). It is not: ${parts.join("; ")}. Either bind the entry or drop the universal claim.`,
        ),
      );
    }
  }

  return issues;
}

export function checkRulings(ctx: CheckContext): Issue[] {
  const { rows, issues, present } = loadRulings(ctx.root);
  if (!present) return issues;

  const known = new Set(rows.map((r) => r.id));
  return [...issues, ...checkCitations(ctx, known), ...checkBinds(ctx, rows), ...checkUniversal(ctx, rows)];
}
