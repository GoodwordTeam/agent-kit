import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { readTextIfPresent } from "../util/fs.ts";
import { error, type Issue } from "../validation/types.ts";

export type HostId = "claude-code" | "codex";

export const HOST_IDS: ReadonlyArray<HostId> = ["claude-code", "codex"];

/**
 * Restrictions a skill may require a host to actually enforce.
 *
 * `tool-allowlist-enforced` is deliberately separate from "the host accepts an
 * allowed-tools key". In Claude Code `allowed-tools` is a pre-approval list: it
 * removes permission prompts, it does not confine the agent. Claiming it as a
 * sandbox would weaken every autonomy contract that depends on confinement.
 */
export const RESTRICTIONS: ReadonlyArray<string> = [
  "no-model-invocation",
  "tool-allowlist-enforced",
  "filesystem-sandbox",
  "network-block",
  "process-exec-block",
];

export interface HostCapabilities {
  id: HostId;
  enforces: Set<string>;
  notes: string[];
  issues: Issue[];
  /** True when the declaration came from adapters/<host>/, not from the built-in default. */
  declared: boolean;
}

const DEFAULTS: Record<HostId, { enforces: string[]; notes: string[] }> = {
  "claude-code": {
    enforces: ["no-model-invocation"],
    notes: [
      "disable-model-invocation is honored by the host, so no-model-invocation is enforced.",
      "allowed-tools is a pre-approval mechanism, not a sandbox; tool-allowlist-enforced is NOT claimed.",
      "No filesystem, network or process confinement is claimed.",
    ],
  },
  codex: {
    enforces: [],
    notes: [
      "No restriction is claimed by default. adapters/codex/CONTRACT.md must declare what the host really enforces.",
    ],
  },
};

function declarationFor(root: string, host: HostId): { value: unknown; file: string } | null {
  const yamlFile = `adapters/${host}/capabilities.yaml`;
  const yamlText = readTextIfPresent(join(root, yamlFile));
  if (yamlText !== null) {
    try {
      return { value: parseYaml(yamlText), file: yamlFile };
    } catch {
      return { value: null, file: yamlFile };
    }
  }

  const contractFile = `adapters/${host}/CONTRACT.md`;
  const contract = readTextIfPresent(join(root, contractFile));
  if (contract === null) return null;
  for (const match of contract.matchAll(/```ya?ml\n([\s\S]*?)```/g)) {
    const block = match[1];
    if (block === undefined || !/^\s*enforces\s*:/m.test(block)) continue;
    try {
      return { value: parseYaml(block), file: contractFile };
    } catch {
      return { value: null, file: contractFile };
    }
  }
  return null;
}

/**
 * What this host really enforces. Absent or unreadable declarations fall back to
 * the conservative built-in default rather than assuming enforcement.
 */
export function loadHostCapabilities(root: string, host: HostId): HostCapabilities {
  const fallback = DEFAULTS[host];
  const issues: Issue[] = [];
  const declaration = declarationFor(root, host);

  if (declaration === null) {
    return {
      id: host,
      enforces: new Set(fallback.enforces),
      notes: [...fallback.notes, "Source: built-in default; no adapter declaration found."],
      issues,
      declared: false,
    };
  }

  const record =
    declaration.value !== null && typeof declaration.value === "object" && !Array.isArray(declaration.value)
      ? (declaration.value as Record<string, unknown>)
      : {};
  const raw = Array.isArray(record["enforces"]) ? (record["enforces"] as unknown[]) : null;
  if (raw === null) {
    return {
      id: host,
      enforces: new Set(fallback.enforces),
      notes: [...fallback.notes, `Source: built-in default; ${declaration.file} declared no usable 'enforces' list.`],
      issues,
      declared: false,
    };
  }

  const enforces = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (!RESTRICTIONS.includes(item)) {
      issues.push(
        error(
          "packaging.unknown-restriction",
          declaration.file,
          `'${item}' is not a known restriction. Known: ${RESTRICTIONS.join(", ")}.`,
        ),
      );
      continue;
    }
    enforces.add(item);
  }

  const notes = Array.isArray(record["notes"])
    ? (record["notes"] as unknown[]).filter((n): n is string => typeof n === "string")
    : [];

  return {
    id: host,
    enforces,
    notes: [...notes, ...fallback.notes.filter((n) => n.includes("pre-approval")), `Source: ${declaration.file}.`],
    issues,
    declared: true,
  };
}
