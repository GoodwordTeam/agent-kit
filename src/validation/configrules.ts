/**
 * `x-validator-rule` checks that bind configuration rather than run artifacts:
 * catalog.yaml, skills/<id>/skill.yaml and packs/<id>/pack.yaml.
 */

import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import type { CheckContext } from "./context.ts";
import { error, warning, type Issue } from "./types.ts";
import { loadArtifacts } from "./artifacts.ts";
import { readTextIfPresent } from "../util/fs.ts";

const RULE_CATALOG_IDS = "catalog.ids-unique-across-all-sections-and-every-entry-has-a-directory";
const RULE_REFERENCE_LOADER = "catalog.reference-loaded-by-names-a-declared-skill";
const RULE_DEFAULT_PROFILE = "catalog.exactly-one-default-profile-matching-package-default-profile";
const RULE_SKILL_INVOCATION = "skill.user-invoked-never-starts-user-invoked";
const RULE_SKILL_BUDGET = "skill.budget-enforces-only-declared-limits";
const RULE_PACK_ACTIVATION = "pack.activation-requires-artifact-and-semantics";
const RULE_PACK_ATTACHMENT = "pack.attachment-records-rationale-and-matched-rule";

function obj(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function checkCatalogRules(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  const { catalog } = ctx;

  /**
   * Uniqueness within a section is the gate, and `loadCatalog` reports it as
   * `catalog.duplicate-id`: a section is what resolves an id, so two entries
   * sharing one inside a section make the second unreachable.
   *
   * A collision across two sections is a warning instead. No reference form in
   * the package resolves a bare id: profiles list ids grouped by kind,
   * resolved-conflicts `binds` groups by kind, schemas `$ref` by filename, and
   * the packager emits per-section directories. Nothing is ambiguous today, so
   * an error here would be a false gate — but the warning is already in place
   * to promote the day a bare-id reference form is introduced.
   */
  const seen = new Map<string, string>();
  for (const entry of catalog.entries) {
    const previous = seen.get(entry.id);
    if (previous !== undefined && previous !== entry.section) {
      issues.push(
        warning(
          RULE_CATALOG_IDS,
          "catalog.yaml",
          `id ${entry.id} is declared in both ${previous} and ${entry.section}. No reference form in this package resolves a bare id across sections, so nothing is ambiguous today; a reference form that did would make this a collision`,
        ),
      );
    }
    seen.set(entry.id, entry.section);
  }

  const skillIds = catalog.skillIds();
  for (const reference of catalog.bySection("references")) {
    if (reference.loadedBy.length === 0) {
      issues.push(
        error(RULE_REFERENCE_LOADER, "catalog.yaml", `reference ${reference.id} declares no loaded_by; progressive disclosure is only checkable when the loaders are named`),
      );
      continue;
    }
    for (const loader of reference.loadedBy) {
      if (!skillIds.has(loader)) {
        issues.push(
          error(RULE_REFERENCE_LOADER, "catalog.yaml", `reference ${reference.id} is loaded_by ${loader}, which is not a declared skill`),
        );
      }
    }
  }

  const profiles = catalog.bySection("profiles");
  if (profiles.length > 0) {
    const defaults = profiles.filter((p) => p.raw["default"] === true);
    if (defaults.length !== 1) {
      issues.push(
        error(
          RULE_DEFAULT_PROFILE,
          "catalog.yaml",
          `${defaults.length} profile(s) carry default: true (${defaults.map((d) => d.id).join(", ") || "none"}); exactly one does`,
        ),
      );
    }
    const declared = catalog.package.defaultProfile;
    const first = defaults[0];
    if (first !== undefined && first.id !== declared) {
      issues.push(
        error(RULE_DEFAULT_PROFILE, "catalog.yaml", `profile ${first.id} is the default but package.default_profile is ${declared}`),
      );
    }
    if (declared.length > 0 && !profiles.some((p) => p.id === declared)) {
      issues.push(error(RULE_DEFAULT_PROFILE, "catalog.yaml", `package.default_profile is ${declared}, which is not a declared profile`));
    }
  }

  return issues;
}

interface ManifestFile {
  readonly file: string;
  readonly doc: Record<string, unknown>;
}

function readManifest(ctx: CheckContext, file: string, rule: string, issues: Issue[]): ManifestFile | null {
  const text = readTextIfPresent(join(ctx.root, file));
  if (text === null) return null;
  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (cause) {
    issues.push(error(rule, file, `manifest could not be parsed: ${(cause as Error).message}`));
    return null;
  }
  const doc = obj(parsed);
  return doc === null ? null : { file, doc };
}

export function checkSkillManifests(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  const { catalog } = ctx;

  const manifests = new Map<string, ManifestFile>();
  for (const skill of catalog.bySection("skills")) {
    const manifest = readManifest(ctx, `skills/${skill.id}/skill.yaml`, RULE_SKILL_INVOCATION, issues);
    if (manifest !== null) manifests.set(skill.id, manifest);
  }

  /** A child's invocation lives in the child's own file; the catalog is the fallback. */
  const invocationOf = (id: string): "U" | "M" | null => {
    const declared = str(manifests.get(id)?.doc["invocation"] ?? null);
    if (declared === "U" || declared === "M") return declared;
    const entry = catalog.get("skills", id);
    return entry?.invocation ?? null;
  };

  for (const [id, manifest] of manifests) {
    const invocation = invocationOf(id);
    if (invocation === "U") {
      for (const child of arr(manifest.doc["child_skills"])) {
        const childId = str(child);
        if (childId === null) continue;
        if (!catalog.skillIds().has(childId)) {
          issues.push(error(RULE_SKILL_INVOCATION, manifest.file, `child_skills names ${childId}, which is not a declared skill`));
          continue;
        }
        if (invocationOf(childId) === "U") {
          issues.push(
            error(
              RULE_SKILL_INVOCATION,
              manifest.file,
              `user-invoked ${id} lists user-invoked ${childId} in child_skills; the only permitted path between two U skills is a declared phase operation under a runner-validated grant`,
            ),
          );
        }
      }
    }

    const budget = obj(manifest.doc["budget"]);
    if (budget !== null) {
      const providedBy = str(budget["provided_by"]);
      if (providedBy !== "runner") {
        issues.push(
          error(RULE_SKILL_BUDGET, manifest.file, `budget.provided_by is ${providedBy ?? "unset"}; budgets are handed in by the runner and never computed here`),
        );
      }
      const limits = obj(manifest.doc["limits"]) ?? {};
      for (const enforced of arr(budget["enforces"])) {
        const name = str(enforced);
        if (name === null) continue;
        if (!(name in limits)) {
          issues.push(
            error(
              RULE_SKILL_BUDGET,
              manifest.file,
              `budget.enforces names ${name}, which is not one of this skill's declared limits (${Object.keys(limits).join(", ") || "none"}); this package enforces only the cap it was handed`,
            ),
          );
        }
      }
    }
  }

  return issues;
}

export function checkPackManifests(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];

  for (const pack of ctx.catalog.bySection("packs")) {
    const manifest = readManifest(ctx, `packs/${pack.id}/pack.yaml`, RULE_PACK_ACTIVATION, issues);
    if (manifest === null) continue;
    const activation = obj(manifest.doc["activation"]);
    if (activation === null) continue;

    const rules = arr(activation["rules"]);
    if (rules.length === 0) {
      issues.push(error(RULE_PACK_ACTIVATION, manifest.file, "activation declares no rules"));
    }
    for (const [i, rule] of rules.entries()) {
      const record = obj(rule);
      if (record === null) continue;
      const id = str(record["id"]) ?? `#${i}`;
      const kinds = arr(record["artifact_kinds"]).filter((k) => str(k) !== null);
      const semantics = arr(record["semantics"]).filter((s) => str(s) !== null);
      if (kinds.length === 0 || semantics.length === 0) {
        issues.push(
          error(
            RULE_PACK_ACTIVATION,
            manifest.file,
            `activation rule ${id} declares ${kinds.length} artifact kind(s) and ${semantics.length} semantic(s); both are required, so a rule that fires on a file extension alone is not expressible`,
          ),
        );
      }
    }

    const examples = arr(activation["examples"]).map(obj);
    if (examples.length < 2) {
      issues.push(error(RULE_PACK_ACTIVATION, manifest.file, `activation declares ${examples.length} example(s); at least two are required`));
    }
    if (examples.length > 0 && !examples.some((e) => e !== null && e["attaches"] === false)) {
      issues.push(
        error(RULE_PACK_ACTIVATION, manifest.file, "activation examples contain no negative case; a rule with no example that does not attach has no demonstrated boundary"),
      );
    }
  }

  const { artifacts } = loadArtifacts(ctx);
  for (const artifact of artifacts) {
    for (const [i, attachment] of arr(artifact.value["packs_attached"]).entries()) {
      const record = obj(attachment);
      if (record === null) continue;
      const pack = str(record["pack"]) ?? `#${i}`;
      if (arr(record["matched_rules"]).length === 0) {
        issues.push(
          error(RULE_PACK_ATTACHMENT, artifact.file, `packs_attached[${i}] (${pack}) names no matched rule; the reason a pack attached is recorded, never reconstructed`),
        );
      }
      if (str(record["rationale"]) === null) {
        issues.push(error(RULE_PACK_ATTACHMENT, artifact.file, `packs_attached[${i}] (${pack}) records no rationale`));
      }
      for (const key of ["grant", "grants", "approval", "approvals", "authority"]) {
        if (record[key] !== undefined) {
          issues.push(
            error(RULE_PACK_ATTACHMENT, artifact.file, `packs_attached[${i}] (${pack}) carries ${key}; attaching a pack authorizes nothing`),
          );
        }
      }
    }
  }

  return issues;
}
