import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import type { Catalog } from "../catalog/load.ts";
import { readTextIfPresent } from "../util/fs.ts";
import { error, note, type Issue } from "../validation/types.ts";

export interface ProfileMembership {
  skills: string[];
  issues: Issue[];
}

/**
 * A profile's member list. profiles/<id>.yaml is authoritative; when it is not
 * authored yet the catalog's per-skill `profiles:` field answers the same
 * question, and the substitution is reported.
 */
export function resolveProfile(root: string, catalog: Catalog, profileId: string | undefined): ProfileMembership {
  const all = catalog.bySection("skills").map((e) => e.id);
  if (profileId === undefined) return { skills: all, issues: [] };

  if (catalog.get("profiles", profileId) === undefined) {
    return {
      skills: [],
      issues: [error("packaging.unknown-profile", "catalog.yaml", `Profile '${profileId}' is not declared in catalog.yaml.`)],
    };
  }

  const file = `profiles/${profileId}.yaml`;
  const text = readTextIfPresent(join(root, file));
  if (text !== null) {
    try {
      const parsed = parseYaml(text) as unknown;
      const record =
        parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
      const declared = Array.isArray(record["skills"])
        ? (record["skills"] as unknown[]).filter((s): s is string => typeof s === "string")
        : null;
      if (declared !== null) {
        const issues: Issue[] = [];
        const known = new Set(all);
        for (const id of declared) {
          if (!known.has(id)) {
            issues.push(error("packaging.profile-unknown-member", file, `Profile '${profileId}' lists skill '${id}', which catalog.yaml does not declare.`));
          }
        }
        return { skills: declared.filter((id) => known.has(id)), issues };
      }
    } catch (cause) {
      return {
        skills: [],
        issues: [error("packaging.profile-unparseable", file, cause instanceof Error ? cause.message : String(cause))],
      };
    }
  }

  const fromCatalog = catalog.bySection("skills").filter((e) => e.profiles.includes(profileId)).map((e) => e.id);
  return {
    skills: fromCatalog,
    issues: [
      note(
        "packaging.profile-from-catalog",
        file,
        `${file} has no 'skills:' list; membership was taken from catalog.yaml's per-skill profiles field.`,
      ),
    ],
  };
}
