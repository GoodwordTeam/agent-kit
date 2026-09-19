import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { entryBodyPath } from "../catalog/layout.ts";
import { generateHostFrontmatter } from "../packaging/frontmatter.ts";
import { loadSkillManifest } from "../packaging/manifest.ts";
import { readTextIfPresent } from "../util/fs.ts";
import { parseFrontmatter } from "../util/frontmatter.ts";
import type { CheckContext } from "./context.ts";
import { error, note, type Issue } from "./types.ts";

export interface SkillReference {
  /** A catalog skill id, or a `<domain>.<action>` phase operation id. */
  target: string;
  line: number;
  kind: "skill" | "operation";
}

/** Extensions that make a dotted token a filename rather than a phase operation. */
const FILE_SUFFIXES = new Set(["md", "json", "yaml", "yml", "ts", "js", "txt", "lock", "toml", "sh", "schema"]);

const OPERATION_IN_CODE = /`([a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*)`/g;

export function extractSkillReferences(text: string, namespace: string): SkillReference[] {
  const lines = text.split("\n");
  const out: SkillReference[] = [];
  const seen = new Set<string>();
  const slash = new RegExp(`${namespace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([a-z0-9]+(?:-[a-z0-9]+)*)`, "g");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";

    slash.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = slash.exec(line)) !== null) {
      const target = m[1];
      if (target === undefined) continue;
      const key = `${i}:${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ target, line: i + 1, kind: "skill" });
    }

    OPERATION_IN_CODE.lastIndex = 0;
    while ((m = OPERATION_IN_CODE.exec(line)) !== null) {
      const target = m[1];
      if (target === undefined) continue;
      const suffix = target.slice(target.lastIndexOf(".") + 1);
      if (FILE_SUFFIXES.has(suffix)) continue;
      const key = `${i}:${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ target, line: i + 1, kind: "operation" });
    }
  }

  return out;
}

interface PhaseOperation {
  id: string;
  behind?: string;
  authority: string;
}

interface InvocationPolicy {
  available: boolean;
  operations: Map<string, PhaseOperation>;
}

/** Authorities under which a delegated controller may start a phase operation. */
const DELEGATED_AUTHORITIES = new Set(["delegated-grant", "explicit-or-delegated", "active-review-run"]);

function loadInvocationPolicy(root: string): InvocationPolicy {
  const text = readTextIfPresent(join(root, "policies/invocation.yaml"));
  if (text === null) return { available: false, operations: new Map() };

  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch {
    return { available: false, operations: new Map() };
  }

  const record =
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  const raw = record["phase_operations"] ?? record["phase-operations"];
  const operations = new Map<string, PhaseOperation>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
      const entry = item as Record<string, unknown>;
      if (typeof entry["id"] !== "string") continue;
      const op: PhaseOperation = {
        id: entry["id"],
        authority: typeof entry["authority"] === "string" ? entry["authority"] : "",
      };
      if (typeof entry["behind"] === "string") op.behind = entry["behind"];
      operations.set(op.id, op);
    }
  }
  return { available: true, operations };
}

interface SkillNode {
  id: string;
  invocation: "U" | "M";
  refs: Array<SkillReference & { file: string }>;
}

export function checkInvocation(ctx: CheckContext): Issue[] {
  const { root, catalog } = ctx;
  const issues: Issue[] = [];
  const namespace = catalog.package.namespace === "" ? "/ak:" : catalog.package.namespace;
  const policy = loadInvocationPolicy(root);

  if (!policy.available) {
    issues.push(
      note(
        "invocation.policy-unavailable",
        "policies/invocation.yaml",
        "No readable invocation policy; no phase operation counts as grant-validated, so every cross-entrypoint reference is judged as a direct call.",
      ),
    );
  }

  const skills = catalog.bySection("skills");
  const invocationOf = new Map<string, "U" | "M">();
  for (const entry of skills) invocationOf.set(entry.id, entry.invocation ?? "M");

  const nodes: SkillNode[] = [];
  for (const entry of skills) {
    const bodyPath = entryBodyPath("skills", entry.id);
    const body = readTextIfPresent(join(root, bodyPath));
    const manifest = loadSkillManifest(root, entry.id);

    if (manifest.invocation !== undefined && entry.invocation !== undefined && manifest.invocation !== entry.invocation) {
      issues.push(
        error(
          "invocation.declaration-conflict",
          `skills/${entry.id}/skill.yaml`,
          `skill.yaml says invocation: ${manifest.invocation} but catalog.yaml says ${entry.invocation}. The catalog is the source of truth; a skill may not downgrade its own invocation class.`,
        ),
      );
    }

    const refs: Array<SkillReference & { file: string }> = [];
    if (body !== null) {
      const parsed = parseFrontmatter(body);
      // Body line numbers are relative to the body; report them against the file.
      const offset = parsed.bodyStartLine - 1;
      for (const ref of extractSkillReferences(parsed.body, namespace)) {
        refs.push({ ...ref, line: ref.line + offset, file: bodyPath });
      }
    }
    for (const call of manifest.calls) {
      refs.push({
        target: call,
        line: 0,
        kind: call.includes(".") ? "operation" : "skill",
        file: `skills/${entry.id}/skill.yaml`,
      });
    }

    nodes.push({ id: entry.id, invocation: entry.invocation ?? "M", refs });
  }

  for (const node of nodes) {
    for (const ref of node.refs) {
      const line = ref.line === 0 ? undefined : ref.line;

      if (ref.kind === "operation") {
        const op = policy.operations.get(ref.target);
        if (op === undefined) {
          issues.push(
            error(
              "invocation.undeclared-operation",
              ref.file,
              `Phase operation '${ref.target}' is not declared in policies/invocation.yaml. A controller may start only declared operations.`,
              line,
            ),
          );
          continue;
        }
        if (!DELEGATED_AUTHORITIES.has(op.authority)) {
          issues.push(
            error(
              "invocation.operation-not-delegated",
              ref.file,
              `Phase operation '${ref.target}' has authority '${op.authority}', which is not runner-delegable. Starting it from '${node.id}' would reproduce a forbidden call through a side door.`,
              line,
            ),
          );
        }
        continue;
      }

      if (ref.target === node.id) continue;
      const targetInvocation = invocationOf.get(ref.target);
      if (targetInvocation === undefined) {
        issues.push(
          error("invocation.unknown-target", ref.file, `'${ref.target}' is not a skill declared in catalog.yaml.`, line),
        );
        continue;
      }
      if (targetInvocation !== "U") continue;

      if (node.invocation === "U") {
        issues.push(
          error(
            "invocation.u-calls-u",
            ref.file,
            `User-invoked skill '${node.id}' starts user-invoked skill '${ref.target}' directly. Split it: a public entrypoint a human starts, and a phase operation declared in policies/invocation.yaml that a controller starts under a runner-validated grant.`,
            line,
          ),
        );
      } else {
        issues.push(
          error(
            "invocation.model-starts-user-skill",
            ref.file,
            `Model-invoked skill '${node.id}' starts user-invoked skill '${ref.target}'. Only a human starts a user-invoked skill.`,
            line,
          ),
        );
      }
    }
  }

  issues.push(...checkGeneratedInvocationKey(ctx));
  return issues;
}

/** The packager must emit disable-model-invocation: true for every U skill. */
function checkGeneratedInvocationKey(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  for (const entry of ctx.catalog.bySection("skills")) {
    if (entry.invocation !== "U") continue;
    const bodyPath = entryBodyPath("skills", entry.id);
    const body = readTextIfPresent(join(ctx.root, bodyPath));
    if (body === null) continue;
    const generated = generateHostFrontmatter(
      entry,
      parseFrontmatter(body),
      loadSkillManifest(ctx.root, entry.id),
      "manual",
      [],
    );
    if (generated.keys["disable-model-invocation"] !== true) {
      issues.push(
        error(
          "invocation.missing-disable-model-invocation",
          bodyPath,
          `The packager would not emit disable-model-invocation: true for user-invoked skill '${entry.id}'.`,
        ),
      );
    }
  }
  return issues;
}
