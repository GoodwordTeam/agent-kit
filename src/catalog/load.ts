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

  return { catalog: new Catalog(packageInfo, entries, root_), issues };
}
