import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { artifactHash } from "../util/hash.ts";
import { readTextIfPresent, walkFiles } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { error, type Issue } from "./types.ts";

/** Where example artifacts live (plan §4: "templates/ — KB documents and example artifacts"). */
const ARTIFACT_DIRS = ["templates"];

export interface LoadedArtifact {
  file: string;
  schema: string;
  value: Record<string, unknown>;
}

export interface ArtifactSet {
  artifacts: LoadedArtifact[];
  issues: Issue[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function loadArtifacts(ctx: CheckContext): ArtifactSet {
  const artifacts: LoadedArtifact[] = [];
  const issues: Issue[] = [];

  for (const dir of ARTIFACT_DIRS) {
    for (const file of walkFiles(ctx.root, dir)) {
      if (!/\.(json|ya?ml)$/.test(file)) continue;
      const text = readTextIfPresent(join(ctx.root, file));
      if (text === null) continue;
      let parsed: unknown;
      try {
        parsed = file.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
      } catch {
        continue; // checkSchemas owns unparseable documents.
      }
      const value = record(parsed);
      if (value === null) continue;
      const schema = value["schema"];
      if (typeof schema !== "string") continue;
      artifacts.push({ file, schema, value });
    }
  }

  return { artifacts, issues };
}

/** Walk every nested object, so a grant buried in an approval is still checked. */
function* walkObjects(value: unknown, path: string): Generator<{ node: Record<string, unknown>; path: string }> {
  const node = record(value);
  if (node !== null) {
    yield { node, path };
    for (const [key, child] of Object.entries(node)) yield* walkObjects(child, `${path}/${key}`);
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) yield* walkObjects(value[i], `${path}/${i}`);
  }
}

export function checkArtifacts(ctx: CheckContext): Issue[] {
  const { artifacts, issues } = loadArtifacts(ctx);
  const out = [...issues];

  const charterHashes = new Set(artifacts.filter((a) => a.schema === "charter").map((a) => artifactHash(a.value)));

  for (const artifact of artifacts) {
    out.push(...checkApprovals(artifact));
    out.push(...checkGrants(artifact, charterHashes));
    out.push(...checkEscalations(artifact));
    if (artifact.schema === "finding") out.push(...checkFinding(artifact));
    if (artifact.schema === "ticket") out.push(...checkTicket(artifact));
  }

  return out;
}

/** An approval binds to the artifact hash it approved; a changed artifact does not inherit it. */
function checkApprovals(artifact: LoadedArtifact): Issue[] {
  const approvals = artifact.value["approvals"];
  if (!Array.isArray(approvals)) return [];
  const current = artifactHash(artifact.value);
  const out: Issue[] = [];

  for (let i = 0; i < approvals.length; i += 1) {
    const approval = record(approvals[i]);
    if (approval === null) continue;
    const declared = approval["artifact_hash"];
    if (typeof declared !== "string") continue;
    if (declared === current) continue;
    out.push(
      error(
        "approval.stale",
        artifact.file,
        `approvals[${i}].artifact_hash is ${declared} but the artifact now hashes to ${current}. A changed artifact does not inherit the previous approval.`,
      ),
    );
  }
  return out;
}

/** A grant is issued by the runner against a charter. A charter_hash naming no charter is forged. */
function checkGrants(artifact: LoadedArtifact, charterHashes: ReadonlySet<string>): Issue[] {
  const out: Issue[] = [];
  for (const { node, path } of walkObjects(artifact.value, "")) {
    const declared = node["charter_hash"];
    if (typeof declared !== "string") continue;
    if (charterHashes.has(declared)) continue;
    out.push(
      error(
        "grant.charter-hash-unknown",
        artifact.file,
        `Grant at ${path === "" ? "(root)" : path} names charter_hash ${declared}, which matches no charter artifact. Skills never issue their own grants.`,
      ),
    );
  }
  return out;
}

function checkEscalations(artifact: LoadedArtifact): Issue[] {
  const out: Issue[] = [];
  for (const { node, path } of walkObjects(artifact.value, "")) {
    const options = node["options"];
    const fallback = node["default"];
    if (!Array.isArray(options) || typeof fallback !== "string") continue;
    if (node["need"] === undefined) continue;
    const ids = options.map((o) => record(o)?.["id"]).filter((id): id is string => typeof id === "string");
    if (ids.includes(fallback)) continue;
    out.push(
      error(
        "escalation.default-not-an-option",
        artifact.file,
        `Escalation at ${path === "" ? "(root)" : path} has default '${fallback}', which names none of its options (${ids.join(", ") || "none"}).`,
      ),
    );
  }
  return out;
}

/** Difficulty is not assessed before a solution class is known; a smell is never auto-fixable. */
const AUTOMATIC_FIX_CLASSES = new Set(["safe_auto", "gated_auto"]);

function checkFinding(artifact: LoadedArtifact): Issue[] {
  const out: Issue[] = [];
  const value = artifact.value;

  if (value["spec_quality"] === "smell") {
    if (value["difficulty"] !== undefined && value["difficulty"] !== null) {
      out.push(
        error(
          "finding.difficulty-on-open-solution-space",
          artifact.file,
          `spec_quality is 'smell' (the solution space is still open) but difficulty is '${String(value["difficulty"])}'. Difficulty is null until a solution class is known.`,
        ),
      );
    }
    const autofix = value["autofix_class"];
    if (typeof autofix === "string" && AUTOMATIC_FIX_CLASSES.has(autofix)) {
      out.push(
        error(
          "finding.smell-is-not-autofixable",
          artifact.file,
          `spec_quality is 'smell' but autofix_class is '${autofix}'. A smell is never an automatic fixer ticket: sharpen it, diagnose, or escalate.`,
        ),
      );
    }
  }

  if (value["status"] !== "resolved") return out;

  const receipt = record(value["closure_receipt"]);
  if (receipt === null) {
    out.push(
      error(
        "finding.closed-without-receipt",
        artifact.file,
        "status is 'resolved' with no closure_receipt. Only independent verification evidence closes a finding.",
      ),
    );
    return out;
  }

  const closer = typeof receipt["by"] === "string" ? receipt["by"] : typeof receipt["verified_by"] === "string" ? receipt["verified_by"] : null;
  if (closer === null) return out;

  const author = record(value["created_by"])?.["role"];
  const fixAuthor = typeof value["fix_author"] === "string" ? value["fix_author"] : record(value["fix"])?.["author"];

  for (const [label, who] of [["its own author", author], ["the fix author", fixAuthor]] as const) {
    if (typeof who === "string" && who === closer) {
      out.push(
        error(
          "finding.self-closed",
          artifact.file,
          `closure_receipt.by is '${closer}', which is ${label}. An author may never close their own finding; closure needs an independent verifier.`,
        ),
      );
    }
  }

  return out;
}

/** Release scenario 11: a decision ticket cannot execute as an implementation task. */
const IMPLEMENTATION_ONLY_FIELDS = ["allowed_changes", "write_ownership", "integration_owner"];
const EXECUTING_STATUSES = new Set(["in-progress", "done"]);

function checkTicket(artifact: LoadedArtifact): Issue[] {
  if (artifact.value["type"] !== "decision") return [];
  const out: Issue[] = [];
  const value = artifact.value;

  const carried = IMPLEMENTATION_ONLY_FIELDS.filter((field) => value[field] !== undefined);
  if (carried.length > 0) {
    out.push(
      error(
        "ticket.decision-dispatched-as-implementation",
        artifact.file,
        `A type: decision ticket carries implementation field(s) ${carried.join(", ")}. A decision ticket resolves a question and is never executable.`,
      ),
    );
  }

  const status = value["status"];
  if (typeof status === "string" && EXECUTING_STATUSES.has(status)) {
    const answer = record(value["decision"])?.["answer"];
    if (answer === undefined || answer === null || answer === "") {
      out.push(
        error(
          "ticket.decision-dispatched-as-implementation",
          artifact.file,
          `A type: decision ticket is in status '${status}' with no recorded decision.answer. It is being worked as implementation rather than resolved as a question.`,
        ),
      );
    }
  }

  return out;
}
