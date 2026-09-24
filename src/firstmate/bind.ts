/**
 * `ak firstmate bind`: what a patched Firstmate's fm-brief calls when it
 * scaffolds a task in delivery mode agent-kit.
 *
 * It runs every preflight check first and writes nothing when one fails. On
 * success it pins the bundle, writes the binding JSON into the Firstmate home's
 * data/<task-id>/, and returns the brief section rendered from
 * adapters/firstmate/WORKER.md for fm-brief to insert.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import { canonicalJson, sha256Hex } from "../util/hash.ts";
import type { Check } from "./checks.ts";
import {
  CHILD_ROLE_FAMILY,
  CHILD_ROLES,
  DEFAULT_CHILD_BUDGET,
  DEFAULT_GATES,
  MOCK_LABEL,
  type Evidence,
  type FirstmateOptions,
  type Host,
} from "./constants.ts";
import { evidenceFromEnv, readHomeEnv } from "./envfile.ts";
import { pinBundle } from "./pin.ts";
import { preflight } from "./preflight.ts";
import { validateBinding, type Binding } from "./schema.ts";
import { takeSnapshot } from "./snapshot.ts";

export interface BindArgs {
  fmHome: string;
  taskId: string;
  project: string;
  mode: string;
  bindingOut: string;
  host: Host;
  /** Overrides the store named in the home's agent-kit.env. */
  evidence?: Evidence;
  charter?: string;
  /** Force dry-run on a store that could publish. */
  dryRun?: boolean;
}

export interface BindResult {
  ok: boolean;
  errors: string[];
  checks: Check[];
  binding?: Binding;
  markdown: string;
}

const refused = (errors: string[], checks: Check[] = []): BindResult => ({ ok: false, errors, checks, markdown: "" });

function inside(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

function kebab(text: string): string {
  const k = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64).replace(/-+$/, "");
  return k === "" ? "project" : k;
}

function packageVersion(akRoot: string): string {
  const catalog = parseYaml(readFileSync(join(akRoot, "catalog.yaml"), "utf8")) as { package?: { version?: string } };
  return catalog.package?.version ?? "unversioned";
}

function childRoles(akRoot: string): string[] {
  const family = join(akRoot, "roles", CHILD_ROLE_FAMILY);
  const seats = existsSync(family)
    ? readdirSync(family)
        .filter((name) => statSync(join(family, name)).isDirectory())
        .sort()
        .map((name) => `${CHILD_ROLE_FAMILY}/${name}`)
    : [];
  return [...CHILD_ROLES, ...seats];
}

function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (whole, key: string) => values[key] ?? whole);
}

export function bind(args: BindArgs, opts: FirstmateOptions): BindResult {
  if (args.mode !== "agent-kit") {
    return refused([`mode ${args.mode} is not agent-kit; ak firstmate bind binds only delivery mode agent-kit`]);
  }
  if (inside(args.bindingOut, args.project)) {
    return refused([
      `binding path ${args.bindingOut} is inside the project; a binding the worker can write is one it can widen (CONTRACT.md §5). Write it under the Firstmate home's data/<task-id>/`,
    ]);
  }

  const evidence = args.evidence ?? evidenceFromEnv(readHomeEnv(args.fmHome));
  const checked = preflight({ fmHome: args.fmHome, project: args.project, host: args.host, evidence }, opts);
  if (!checked.ok) {
    return refused(
      checked.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`),
      checked.checks,
    );
  }
  // preflight passed, so the evidence store is a writable mock.
  const store = evidence as Evidence;

  const snapshot = takeSnapshot(args.project);
  if (typeof snapshot === "string") return refused([snapshot], checked.checks);

  const pin = pinBundle(opts.bundleDir, opts.pinsDir);
  if (typeof pin === "string") return refused([pin], checked.checks);

  let charter: Binding["charter"] = null;
  if (args.charter !== undefined) {
    const bytes = readFileSync(args.charter);
    charter = { ref: resolve(args.charter), hash: `sha256:${createHash("sha256").update(bytes).digest("hex")}` };
  }

  const action = store.store === "mock" || args.dryRun === true ? "dry-run" : "publish";
  const gates = [...DEFAULT_GATES];
  const upstream = { commit: opts.upstream.commit, patch: opts.upstream.patch };

  // Same task, same inputs, same run id: re-binding is idempotent, and any
  // moved input is a different run (adapters/runner-contract/CONTRACT.md §5).
  const inputs = canonicalJson({
    task: args.taskId,
    project: resolve(args.project),
    snapshot,
    bundle: pin.hash,
    host: args.host,
    charter,
    gates,
    evidence: store,
    action,
    upstream,
  });
  const safeTask = args.taskId.replace(/[^A-Za-z0-9._:-]/g, "-");
  const runId = `ak-${safeTask}-${sha256Hex(inputs).slice(0, 12)}`.slice(0, 128);

  const binding: Binding = {
    schema: "firstmate-binding",
    schema_version: 1,
    task_id: args.taskId,
    run_id: runId,
    project: { id: kebab(basename(resolve(args.project))), path: resolve(args.project) },
    work_source: { kind: "firstmate-brief", ref: join(resolve(args.fmHome), "data", args.taskId, "brief.md") },
    source_snapshot: snapshot,
    skill_bundle: { version: packageVersion(opts.akRoot), host: args.host, hash: pin.hash, path: pin.path },
    charter,
    required_gates: gates,
    child_budget: {
      ...DEFAULT_CHILD_BUDGET,
      max_depth: 1,
      charged_to: runId,
      roles: childRoles(opts.akRoot),
    },
    evidence: store.store === "mock" ? { ...store, label: MOCK_LABEL } : store,
    delivery: { action, transport: "no-mistakes", skip: ["review", "document", "rebase"], merge: false },
    upstream,
    created_at: opts.now().toISOString(),
  };

  const invalid = validateBinding(opts.akRoot, binding);
  if (invalid.length > 0) return refused(invalid.map((e) => `binding does not validate: ${e}`), checked.checks);

  const template = readFileSync(join(opts.akRoot, "adapters/firstmate/WORKER.md"), "utf8");
  const markdown = render(template, {
    task_id: binding.task_id,
    run_id: binding.run_id,
    binding_path: resolve(args.bindingOut),
    project_path: binding.project.path,
    revision: snapshot.revision,
    diff_hash: snapshot.diff_hash,
    bundle_version: binding.skill_bundle.version,
    bundle_hash: pin.hash,
    bundle_path: pin.path,
    host: args.host,
    charter: charter === null ? "none. This run holds no sensitive-action authority and acquires none by running" : `${charter.ref} (${charter.hash})`,
    gates: gates.join(", "),
    max_children: String(binding.child_budget.max_children),
    max_concurrent: String(binding.child_budget.max_concurrent),
    roles: binding.child_budget.roles.join(", "),
    evidence:
      store.store === "mock"
        ? `a labeled mock store at ${store.location}. It is a fixture demonstration, not a knowledgebase, and it cannot back a publish`
        : `the knowledgebase at ${store.location}`,
    action,
    brief_path: binding.work_source.ref ?? "",
    upstream_commit: upstream.commit,
  });
  if (/^Delivery contract: mode=/m.test(markdown)) {
    return refused(["the rendered worker section carries a 'Delivery contract: mode=' line, which only Firstmate may write"], checked.checks);
  }

  mkdirSync(dirname(resolve(args.bindingOut)), { recursive: true });
  const staging = `${resolve(args.bindingOut)}.partial-${process.pid}`;
  writeFileSync(staging, `${JSON.stringify(binding, null, 2)}\n`);
  renameSync(staging, resolve(args.bindingOut));

  return { ok: true, errors: [], checks: checked.checks, binding, markdown };
}
