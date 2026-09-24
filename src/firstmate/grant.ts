/**
 * `ak firstmate grant`: the Firstmate binding as the delegated grant (ADR-0004).
 *
 * super-review full/readiness and super-ship are `explicit-or-delegated`: a
 * delegated controller may start them under a validated grant. Under Firstmate
 * the controller is Firstmate, and the grant is the binding it wrote before the
 * task, outside anything the worker can write. This checks that it still is that
 * binding and that it covers the operation asked for. It grants nothing the
 * binding does not name; merge and scope changes are never on it.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import { treeHash } from "./pin.ts";
import { git } from "./proc.ts";
import { validateBinding, type Binding } from "./schema.ts";

/** Each grantable phase operation and the required gate that puts it on the slip. */
export const GRANT_OPERATIONS = {
  "review.full": "review-full",
  "review.readiness": "review-readiness",
  "ship.prepare": "ship-preflight",
} as const;
export type GrantOperation = keyof typeof GRANT_OPERATIONS;

export interface GrantArgs {
  binding: string;
  operation: string;
  /** The directory the worker asks from; its git worktree must not hold the binding. */
  cwd: string;
}

export interface GrantRecord {
  operation: GrantOperation;
  binding: string;
  binding_sha256: string;
  task_id: string;
  run_id: string;
  granted_by: "firstmate-binding";
}

export type GrantResult = { ok: true; record: GrantRecord } | { ok: false; reason: string };

const no = (reason: string): GrantResult => ({ ok: false, reason });

function inside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

const real = (path: string): string => (existsSync(path) ? realpathSync(path) : resolve(path));

export function grant(args: GrantArgs, akRoot: string): GrantResult {
  if (!Object.hasOwn(GRANT_OPERATIONS, args.operation)) {
    return no(`${args.operation} is not an operation a Firstmate binding grants; only ${Object.keys(GRANT_OPERATIONS).join(", ")} are`);
  }
  const operation = args.operation as GrantOperation;

  const path = resolve(args.binding);
  if (!existsSync(path)) return no(`binding ${path} does not exist`);
  const bytes = readFileSync(path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (e) {
    return no(`binding ${path} is not JSON: ${(e as Error).message}`);
  }
  const invalid = validateBinding(akRoot, parsed);
  if (invalid.length > 0) return no(`binding ${path} does not validate: ${invalid.join("; ")}`);
  const binding = parsed as Binding;

  // A binding the worker could have written is one it could have widened (CONTRACT.md §5).
  const at = realpathSync(path);
  const top = git(args.cwd, ["rev-parse", "--show-toplevel"]);
  const worktree = top.code === 0 && top.text !== "" ? real(top.text) : real(args.cwd);
  if (inside(at, worktree)) return no(`binding ${path} is inside the worktree ${worktree}, which the worker can write`);
  for (const dir of [binding.project.path, binding.project.workspace]) {
    if (dir !== undefined && inside(at, real(dir))) return no(`binding ${path} is inside the project ${dir}, which the worker can write`);
  }

  const gate = GRANT_OPERATIONS[operation];
  if (!binding.required_gates.includes(gate)) {
    return no(`${operation} needs gate ${gate}, and the binding requires only ${binding.required_gates.join(", ")}`);
  }

  const pin = binding.skill_bundle.path;
  if (!existsSync(pin) || !statSync(pin).isDirectory()) return no(`the pinned bundle ${pin} does not exist`);
  const found = `sha256:${treeHash(pin)}`;
  if (found !== binding.skill_bundle.hash) {
    return no(`the pinned bundle ${pin} hashes to ${found}, not the bound ${binding.skill_bundle.hash}`);
  }

  return {
    ok: true,
    record: {
      operation,
      binding: path,
      binding_sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      task_id: binding.task_id,
      run_id: binding.run_id,
      granted_by: "firstmate-binding",
    },
  };
}
