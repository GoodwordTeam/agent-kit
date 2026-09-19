import { stringify as stringifyYaml } from "yaml";

import type { CatalogEntry } from "../catalog/load.ts";
import type { Frontmatter } from "../util/frontmatter.ts";
import type { SkillManifest } from "./manifest.ts";

export type SkillMode = "manual" | "guided" | "autonomous";

export interface GeneratedFrontmatter {
  keys: Record<string, unknown>;
  text: string;
}

/**
 * Host frontmatter is generated, never copied: the canonical file carries only
 * Agent Skills spec keys. `disable-model-invocation: true` is emitted for every
 * U skill because only a human may start one.
 */
export function generateHostFrontmatter(
  entry: CatalogEntry,
  canonical: Frontmatter,
  manifest: SkillManifest,
  mode: SkillMode,
  unenforceable: ReadonlyArray<string>,
): GeneratedFrontmatter {
  const keys: Record<string, unknown> = {};
  keys["name"] = entry.id;
  if (typeof canonical.data["description"] === "string") keys["description"] = canonical.data["description"];
  if (canonical.data["license"] !== undefined) keys["license"] = canonical.data["license"];

  if (entry.invocation === "U" || manifest.invocation === "U") keys["disable-model-invocation"] = true;
  if (manifest.argumentHint !== undefined) keys["argument-hint"] = manifest.argumentHint;
  if (manifest.allowedTools !== undefined) keys["allowed-tools"] = manifest.allowedTools;

  const inherited =
    canonical.data["metadata"] !== null &&
    typeof canonical.data["metadata"] === "object" &&
    !Array.isArray(canonical.data["metadata"])
      ? (canonical.data["metadata"] as Record<string, unknown>)
      : {};
  const ak: Record<string, unknown> = { mode };
  if (unenforceable.length > 0) ak["autonomy_unenforceable"] = [...unenforceable];
  keys["metadata"] = { ...inherited, ak };

  const text = `---\n${stringifyYaml(keys, { lineWidth: 0 })}---\n`;
  return { keys, text };
}
