/**
 * The Firstmate this adapter was made against, and the names it shares with the
 * patch. adapters/firstmate/CONTRACT.md §3 is the authority; these are the
 * values it names.
 */
import { homedir, userInfo } from "node:os";
import { join } from "node:path";

export interface Upstream {
  /** The upstream commit the patches were made against. */
  commit: string;
  /** The delivery-mode patch id, as the binding and `AK_FIRSTMATE_PATCH` record it. */
  patch: string;
  /** Every patch a home must carry, in the order a maintainer applies them. Absolute files. */
  stack: { id: string; file: string }[];
}

export const UPSTREAM_COMMIT = "a5d78f8";
export const PATCH_ID = "0001-agent-kit-mode";
/** 0002 adds the dry-run definition of done, the `status --verify` audit of a worker's done, and the worker budget. */
export const PATCH_STACK = [PATCH_ID, "0002-agent-kit-audit"] as const;

export function defaultUpstream(akRoot: string): Upstream {
  return {
    commit: UPSTREAM_COMMIT,
    patch: PATCH_ID,
    stack: PATCH_STACK.map((id) => ({
      id,
      file: join(akRoot, "adapters/firstmate/upstream", UPSTREAM_COMMIT, `${id}.patch`),
    })),
  };
}

export type Host = "claude-code" | "codex";
export const HOSTS: readonly Host[] = ["claude-code", "codex"];

export type EvidenceStore = "kb" | "mock";
export interface Evidence {
  store: EvidenceStore;
  location: string;
}

export const MOCK_LABEL = "mock evidence store: fixture demonstration, not a knowledgebase";

/**
 * The files `ak firstmate install` writes, relative to the home. Nothing else. ENV_FILE holds only
 * the three keys patch 0001 requires (0002's optional budget key is maintainer-added); the evidence
 * store, which only `ak` reads, is kept apart.
 */
export const ENV_FILE = "config/agent-kit.env";
export const EVIDENCE_FILE = "config/agent-kit/evidence.env";
export const SETTINGS_FILE = "config/agent-kit/worker-settings.json";
export const ENV_HEADER = "# Written by ak firstmate install. Parsed by Firstmate, never sourced.";

/**
 * The token fm-spawn replaces with the task's binding path in the per-task settings file. Patch 0001
 * inserts the bare absolute path and refuses one containing a single quote, so the token is written
 * inside single quotes here.
 */
export const BINDING_TOKEN = "__AK_FIRSTMATE_BINDING__";

export const CHILD_GUARD = "adapters/firstmate/hooks/child-guard.sh";

/** The lifecycle skills a bound worker runs, which the pinned bundle must carry. */
export const LIFECYCLE_SKILLS = [
  "super-scout",
  "super-bound",
  "super-align",
  "super-build",
  "super-verify",
  "super-review",
  "super-ship",
] as const;
export const TRANSPORT_REFERENCE = "skills/super-ship/references/transport-no-mistakes.md";

/**
 * The child roles adapters/firstmate/CHILD-ROLES.md permits: these three, plus
 * every seat under roles/code-review/. The supervisor role is never a child
 * (ruling `missing-supervisor-never-implementer`).
 */
export const CHILD_ROLES = ["implementer", "reviewer-spec", "reviewer-standards"] as const;
export const CHILD_ROLE_FAMILY = "code-review";

export const DEFAULT_GATES = ["build-checks", "verify", "review-full", "review-readiness", "ship-preflight"] as const;

export const DEFAULT_CHILD_BUDGET = { max_children: 6, max_concurrent: 3 } as const;

export function defaultPinsDir(): string {
  return process.env.AK_PINS_DIR ?? join(homedir(), ".agent-kit", "pins");
}

/**
 * agent-kit's ledger of the bindings `ak firstmate bind` wrote, one `<run_id>.json` each, which
 * `ak firstmate grant` checks. Resolved from the account's home directory, not from `HOME` or any
 * other variable a worker could set for the grant it asks for.
 */
export function defaultLedgerDir(): string {
  return join(userInfo().homedir, ".agent-kit", "firstmate", "bindings");
}

/** One ledger record: the binding bind wrote, where it wrote it, and its hash. */
export interface LedgerRecord {
  run_id: string;
  task_id: string;
  binding_path: string;
  binding_sha256: string;
}

export interface FirstmateOptions {
  /** The agent-kit checkout: schemas/, adapters/, catalog.yaml. */
  akRoot: string;
  /** The built bundle for the host, normally <akRoot>/dist/<host>. */
  bundleDir: string;
  /** Where pinned bundles live, content-addressed. */
  pinsDir: string;
  /** The binding ledger bind writes and grant reads (defaultLedgerDir). */
  ledgerDir: string;
  upstream: Upstream;
  now: () => Date;
}
