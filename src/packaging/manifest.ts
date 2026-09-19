import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { readTextIfPresent } from "../util/fs.ts";

export interface SkillManifest {
  id?: string;
  invocation?: "U" | "M";
  argumentHint?: string;
  allowedTools?: string[];
  autonomyModes: string[];
  requiresEnforced: string[];
  /** Skills and phase operations this skill declares it may start. */
  calls: string[];
  raw: Record<string, unknown>;
  parseError?: string;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function pick(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (raw[key] !== undefined) return raw[key];
  return undefined;
}

export const EMPTY_MANIFEST: SkillManifest = {
  autonomyModes: [],
  requiresEnforced: [],
  calls: [],
  raw: {},
};

/** Read skills/<id>/skill.yaml, accepting both snake_case and kebab-case keys. */
export function loadSkillManifest(root: string, skillId: string): SkillManifest {
  const text = readTextIfPresent(join(root, "skills", skillId, "skill.yaml"));
  if (text === null) return { ...EMPTY_MANIFEST };

  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (cause) {
    return { ...EMPTY_MANIFEST, parseError: cause instanceof Error ? cause.message : String(cause) };
  }

  const raw = record(parsed);
  const autonomy = record(pick(raw, "autonomy"));
  const manifest: SkillManifest = {
    autonomyModes: strings(pick(autonomy, "modes")),
    requiresEnforced: strings(pick(autonomy, "requires_enforced", "requires-enforced")),
    calls: [
      ...strings(pick(raw, "calls")),
      ...strings(pick(raw, "child_operations", "child-operations")),
      ...strings(pick(raw, "invokes")),
    ],
    raw,
  };

  if (typeof raw["id"] === "string") manifest.id = raw["id"];
  if (raw["invocation"] === "U" || raw["invocation"] === "M") manifest.invocation = raw["invocation"];
  const hint = pick(raw, "argument_hint", "argument-hint");
  if (typeof hint === "string") manifest.argumentHint = hint;
  const tools = strings(pick(raw, "allowed_tools", "allowed-tools"));
  if (tools.length > 0) manifest.allowedTools = tools;

  return manifest;
}
