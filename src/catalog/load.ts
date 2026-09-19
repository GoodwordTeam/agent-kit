import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { readTextIfPresent } from "../util/fs.ts";
import { error, warning, type Issue } from "../validation/types.ts";
import { ALL_SECTIONS, type Section } from "./layout.ts";

export type EntryStatus = "contract" | "authored";
export type Invocation = "U" | "M";

export interface Entrypoint {
  authority?: string;
  invocation?: Invocation;
}

export interface CatalogEntry {
  section: Section;
  id: string;
  status: EntryStatus;
  invocation?: Invocation;
  profiles: string[];
  provenanceOrigin?: "donor" | "conversation";
  entrypoints?: Record<string, Entrypoint>;
  batch?: number;
  summary?: string;
  activation?: string;
  loadedBy: string[];
  raw: Record<string, unknown>;
}

export interface PackageInfo {
  id: string;
  name: string;
  version: string;
  namespace: string;
  defaultProfile: string;
}

export class Catalog {
  constructor(
    readonly package_: PackageInfo,
    readonly entries: ReadonlyArray<CatalogEntry>,
    readonly raw: Record<string, unknown>,
  ) {}

  get package(): PackageInfo {
    return this.package_;
  }

  bySection(section: Section): CatalogEntry[] {
    return this.entries.filter((e) => e.section === section);
  }

  get(section: Section, id: string): CatalogEntry | undefined {
    return this.entries.find((e) => e.section === section && e.id === id);
  }

  /** Every skill id, for invocation-graph reference resolution. */
  skillIds(): Set<string> {
    return new Set(this.bySection("skills").map((e) => e.id));
  }
}

export interface LoadResult {
  catalog: Catalog | null;
  issues: Issue[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function readEntrypoints(value: unknown): Record<string, Entrypoint> | undefined {
  const record = asRecord(value);
  const keys = Object.keys(record);
  if (keys.length === 0) return undefined;
  const out: Record<string, Entrypoint> = {};
  for (const key of keys) {
    const raw = asRecord(record[key]);
    const entrypoint: Entrypoint = {};
    if (typeof raw["authority"] === "string") entrypoint.authority = raw["authority"];
    if (raw["invocation"] === "U" || raw["invocation"] === "M") entrypoint.invocation = raw["invocation"];
    out[key] = entrypoint;
  }
  return out;
}

export function loadCatalog(root: string): LoadResult {
  const path = join(root, "catalog.yaml");
  const text = readTextIfPresent(path);
  if (text === null) {
    return { catalog: null, issues: [error("catalog.missing", "catalog.yaml", "catalog.yaml not found; it is the source of truth for what must exist.")] };
  }

  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return { catalog: null, issues: [error("catalog.unparseable", "catalog.yaml", `catalog.yaml is not valid YAML: ${reason}`)] };
  }

  const root_ = asRecord(doc);
  if (Object.keys(root_).length === 0) {
    return { catalog: null, issues: [error("catalog.unparseable", "catalog.yaml", "catalog.yaml is not a mapping.")] };
  }

  const issues: Issue[] = [];
  const pkg = asRecord(root_["package"]);
  const packageInfo: PackageInfo = {
    id: typeof pkg["id"] === "string" ? pkg["id"] : "",
    name: typeof pkg["name"] === "string" ? pkg["name"] : "",
    version: typeof pkg["version"] === "string" ? pkg["version"] : "",
    namespace: typeof pkg["namespace"] === "string" ? pkg["namespace"] : "",
    defaultProfile: typeof pkg["default_profile"] === "string" ? pkg["default_profile"] : "",
  };

  const entries: CatalogEntry[] = [];
  for (const section of ALL_SECTIONS) {
    const list = root_[section];
    if (list === undefined || list === null) continue;
    if (!Array.isArray(list)) {
      issues.push(error("catalog.section-not-a-list", "catalog.yaml", `Section '${section}' must be a list.`));
      continue;
    }
    const seen = new Set<string>();
    for (const item of list) {
      const raw = asRecord(item);
      const id = raw["id"];
      if (typeof id !== "string" || id.length === 0) {
        issues.push(error("catalog.entry-without-id", "catalog.yaml", `An entry in section '${section}' has no id.`));
        continue;
      }
      if (seen.has(id)) {
        issues.push(error("catalog.duplicate-id", "catalog.yaml", `Section '${section}' declares id '${id}' more than once.`));
        continue;
      }
      seen.add(id);

      const statusRaw = raw["status"];
      let status: EntryStatus = "contract";
      if (statusRaw === "authored") status = "authored";
      else if (statusRaw !== "contract" && statusRaw !== undefined) {
        issues.push(
          warning("catalog.unknown-status", "catalog.yaml", `Entry '${section}/${id}' has status '${String(statusRaw)}'; expected 'contract' or 'authored'.`),
        );
      }

      const entry: CatalogEntry = {
        section,
        id,
        status,
        profiles: asStringList(raw["profiles"]),
        loadedBy: asStringList(raw["loaded_by"]),
        raw,
      };
      if (raw["invocation"] === "U" || raw["invocation"] === "M") entry.invocation = raw["invocation"];
      if (raw["provenance_origin"] === "donor" || raw["provenance_origin"] === "conversation") {
        entry.provenanceOrigin = raw["provenance_origin"];
      }
      const entrypoints = readEntrypoints(raw["entrypoints"]);
      if (entrypoints !== undefined) entry.entrypoints = entrypoints;
      if (typeof raw["batch"] === "number") entry.batch = raw["batch"];
      if (typeof raw["summary"] === "string") entry.summary = raw["summary"];
      if (typeof raw["activation"] === "string") entry.activation = raw["activation"];
      entries.push(entry);
    }
  }

  issues.push(...idsInTwoAddressableSections(entries));

  return { catalog: new Catalog(packageInfo, entries, root_), issues };
}

/**
 * The three sections an id can be reclassified between, and the reason the rule
 * stops at three.
 *
 * `AGENTS.md` maps the invocation law's vocabulary onto this package: `tdd` and
 * `attach-pack` became protocols "not skills", `standards-review` and
 * `spec-review` became the roles `reviewer-standards` and `reviewer-spec`. The
 * mapping table is defensible only because of the sentence that follows it --
 * "No id is both a skill and a protocol, so this is reclassification, not a
 * contradiction" -- and nothing verified that sentence.
 *
 * These three are addressable in the sense that matters: a body cites `tdd` and
 * the reader has to land on exactly one artifact, and the U/M partition has to
 * have exactly one answer for it. An id in two of them makes both undecidable.
 *
 * Deliberately not every section. The authored catalog declares `review` in
 * both `schemas` and `policies` -- `schemas/review.schema.json` and
 * `policies/review.yaml` -- which is correct and which a blanket uniqueness
 * rule would report. Those are addressed by path, never by bare id.
 */
const ADDRESSABLE_SECTIONS = ["skills", "protocols", "roles"] as const;

function idsInTwoAddressableSections(entries: ReadonlyArray<CatalogEntry>): Issue[] {
  const sectionsById = new Map<string, string[]>();
  for (const entry of entries) {
    if (!(ADDRESSABLE_SECTIONS as ReadonlyArray<string>).includes(entry.section)) continue;
    const seen = sectionsById.get(entry.id);
    if (seen === undefined) sectionsById.set(entry.id, [entry.section]);
    else if (!seen.includes(entry.section)) seen.push(entry.section);
  }

  const issues: Issue[] = [];
  for (const [id, sections] of sectionsById) {
    if (sections.length < 2) continue;
    issues.push(
      error(
        "catalog.id-in-two-addressable-sections",
        "catalog.yaml",
        `Id '${id}' is declared in ${sections.join(" and ")}. A body citing '${id}' by name must reach exactly one artifact, and its invocation class must have one answer; declared twice it has neither. AGENTS.md's reclassification table holds only while no id is in two of these sections.`,
      ),
    );
  }
  return issues;
}
