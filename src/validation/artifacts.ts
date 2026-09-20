import { artifactHash } from "../util/hash.ts";
import { loadTemplateDocuments, type TemplateDocument } from "./documents.ts";
import type { CheckContext } from "./context.ts";
import { error, type Issue } from "./types.ts";

export type LoadedArtifact = TemplateDocument;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * The example artifacts under templates/.
 *
 * This returns artifacts and nothing else, deliberately. It has three callers
 * and only two of them propagate issues, so a defect reported from here would
 * be printed twice or not at all depending on which caller ran. What counts as
 * a document, and every reason a file is not one, belongs to documents.ts --
 * `checkTemplateDocuments` is the single owner and reports each reason once.
 */
export function loadArtifacts(ctx: CheckContext): LoadedArtifact[] {
  return loadTemplateDocuments(ctx.root);
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
  const artifacts = loadArtifacts(ctx);
  const out: Issue[] = [];

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

  // `closed_by` is what schemas/finding.schema.json declares and requires, and
  // `closure_receipt` sets additionalProperties: false, so it is the only
  // spelling a conforming receipt can carry. This read used to start at `by`
  // and fall back to `verified_by` -- two keys that schema forbids -- so the
  // closer came back null for every valid finding and the whole rule below
  // returned early without reporting. The fallbacks are kept only to catch a
  // self-closure inside an already schema-invalid document, which is reported
  // separately as `schemas.document-invalid`; they are not the contract.
  const closer =
    typeof receipt["closed_by"] === "string"
      ? receipt["closed_by"]
      : typeof receipt["by"] === "string"
        ? receipt["by"]
        : typeof receipt["verified_by"] === "string"
          ? receipt["verified_by"]
          : null;
  if (closer === null) return out;

  // Deliberately narrowed to one half of the schema tag
  // `finding.closer-is-not-the-author-of-the-change`: the closer is not the
  // author of the *finding*. The other half -- not the author of the fix --
  // used to be implemented here against `fix_author` and `fix.author`, two
  // keys finding.schema.json declares nowhere, so it could never fire on a
  // conforming document while reading exactly like a check that could.
  //
  // It is relocated, not dropped. A finding records a defect and its closure;
  // the patch's authorship belongs with the patch, and giving the finding a
  // fix-author field would add one that is empty until some other process
  // backfills it -- an always-empty field is how a check comes to read green
  // because nothing populates it, which is the bug this narrowing exists to
  // stop repeating. The `apply-findings` protocol owns the eligibility gate
  // and already selects who applies a fix (policies/review.yaml), so it holds
  // both identities at the moment the separation can be enforced.
  const author = record(value["created_by"])?.["role"];
  if (typeof author === "string" && author === closer) {
    out.push(
      error(
        "finding.self-closed",
        artifact.file,
        `closure_receipt names '${closer}' as the closer, which is the finding's own author. An author may never close their own finding; closure needs an independent verifier.`,
      ),
    );
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
