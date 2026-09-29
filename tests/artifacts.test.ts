import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { checkArtifacts, loadArtifacts } from "../src/validation/artifacts.ts";
import { checkTemplateDocuments } from "../src/validation/documents.ts";
import { artifactHash, canonicalJson, sha256Hex } from "../src/util/hash.ts";
import { loadCatalog } from "../src/catalog/load.ts";
import { makeTree } from "./helpers/tree.ts";

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
`;

function ctxFor(files: Record<string, string>) {
  const root = makeTree({ "catalog.yaml": CATALOG, ...files });
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

const envelope = (schema: string, extra: Record<string, unknown> = {}) => ({
  schema,
  schema_version: 1,
  id: `${schema}-1`,
  project: { id: "demo" },
  run_id: null,
  created_by: { role: "implementer" },
  inputs: [],
  source_revision: null,
  created_at: "2026-09-19T10:00:00Z",
  status: "draft",
  ...extra,
});

describe("artifact loading", () => {
  test("loads example artifacts under templates/ and keys them by declared schema", () => {
    const ctx = ctxFor({ "templates/t.json": JSON.stringify(envelope("ticket")) });
    const loaded = loadArtifacts(ctx);
    expect(loaded.map((a) => a.schema)).toEqual(["ticket"]);
    expect(loaded[0]?.file).toBe("templates/t.json");
  });

  test("YAML artifacts are loaded too", () => {
    const ctx = ctxFor({ "templates/t.yaml": "schema: ticket\nid: t-1\n" });
    expect(loadArtifacts(ctx).length).toBe(1);
  });

  test("a file without a schema field is dropped here and reported by its owner", () => {
    // The loader stays silent because it has three callers and only two would
    // propagate what it said. Silence here is only correct while the drop is
    // reported somewhere, so the two halves are asserted together.
    const ctx = ctxFor({ "templates/notes.yaml": "hello: world\n" });
    expect(loadArtifacts(ctx)).toEqual([]);
    expect(checkTemplateDocuments(ctx).map((i) => i.rule)).toEqual(["schemas.document-no-schema-member"]);
  });
});

describe("finding axes stay separate", () => {
  test("spec_quality smell with a non-null difficulty is an error", () => {
    const ctx = ctxFor({
      "templates/f.json": JSON.stringify(envelope("finding", { spec_quality: "smell", difficulty: "mechanical" })),
    });
    const issue = checkArtifacts(ctx).find((i) => i.rule === "finding.difficulty-on-open-solution-space");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("smell");
  });

  test("spec_quality smell with a null difficulty passes", () => {
    const ctx = ctxFor({
      "templates/f.json": JSON.stringify(envelope("finding", { spec_quality: "smell", difficulty: null })),
    });
    expect(checkArtifacts(ctx).filter((i) => i.rule === "finding.difficulty-on-open-solution-space")).toEqual([]);
  });

  test("spec_quality patch with a difficulty passes", () => {
    const ctx = ctxFor({
      "templates/f.json": JSON.stringify(envelope("finding", { spec_quality: "patch", difficulty: "mechanical" })),
    });
    expect(checkArtifacts(ctx).filter((i) => i.rule === "finding.difficulty-on-open-solution-space")).toEqual([]);
  });

  test("a smell routed to an automatic fixer class is an error", () => {
    const ctx = ctxFor({
      "templates/f.json": JSON.stringify(
        envelope("finding", { spec_quality: "smell", difficulty: null, autofix_class: "safe_auto" }),
      ),
    });
    expect(checkArtifacts(ctx).some((i) => i.rule === "finding.smell-is-not-autofixable")).toBe(true);
  });
});

describe("the plan record's specification approval binds to the specification", () => {
  const spec = { problem: "Nested run artifacts are not loaded." };
  const specHash = `sha256:${sha256Hex(canonicalJson(spec))}`;
  const approval = (hash: string) => ({
    artifact_hash: hash,
    by: "human",
    authority: "explicit",
    at: "2026-09-19T11:00:00Z",
  });
  const plan = (extra: Record<string, unknown>) =>
    envelope("plan-record", {
      specification: spec,
      specification_hash: specHash,
      specification_approval: approval(specHash),
      ...extra,
    });
  const rules = (value: unknown) =>
    checkArtifacts(ctxFor({ "templates/p.json": JSON.stringify(value) }))
      .filter((i) => i.rule === "approval.stale" || i.rule === "plan-record.specification-hash-mismatch")
      .map((i) => i.rule);

  test("an approval of the specification survives re-slicing", () => {
    expect(rules(plan({ slices: [{ type: "implementation" }] }))).toEqual([]);
    expect(rules(plan({ slices: [{ type: "decision" }, { type: "implementation" }] }))).toEqual([]);
  });

  test("an edited specification does not inherit the approval, and its declared hash is caught", () => {
    const edited = { ...spec, non_goals: ["Added after approval."] };
    expect(rules(plan({ specification: edited }))).toEqual([
      "plan-record.specification-hash-mismatch",
      "approval.stale",
    ]);
  });

  test("an approval bound to the whole record rather than the specification is stale", () => {
    const record = plan({});
    expect(rules({ ...record, specification_approval: approval(artifactHash(record)) })).toEqual(["approval.stale"]);
  });
});

describe("approvals bind to content", () => {
  test("an approval whose artifact_hash matches the artifact passes", () => {
    const artifact = envelope("ticket", { type: "decision" });
    const approved = {
      ...artifact,
      approvals: [
        { artifact_hash: artifactHash(artifact), by: "human", authority: "explicit", at: "2026-09-19T11:00:00Z" },
      ],
    };
    const ctx = ctxFor({ "templates/t.json": JSON.stringify(approved) });
    expect(checkArtifacts(ctx).filter((i) => i.rule === "approval.stale")).toEqual([]);
  });

  test("an approval whose artifact_hash no longer matches is a stale approval", () => {
    const artifact = envelope("ticket", { type: "decision", goal: "the goal it was approved with" });
    const approvals = [
      { artifact_hash: artifactHash(artifact), by: "human", authority: "explicit", at: "2026-09-19T11:00:00Z" },
    ];
    const changed = { ...artifact, goal: "a different goal added after approval", approvals };
    const ctx = ctxFor({ "templates/t.json": JSON.stringify(changed) });
    const issue = checkArtifacts(ctx).find((i) => i.rule === "approval.stale");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("does not inherit");
  });

  test("adding an approval does not itself invalidate the hash", () => {
    const artifact = envelope("verification");
    const hash = artifactHash(artifact);
    const one = {
      ...artifact,
      approvals: [{ artifact_hash: hash, by: "human", authority: "explicit", at: "2026-09-19T11:00:00Z" }],
    };
    const two = {
      ...artifact,
      approvals: [
        ...one.approvals,
        { artifact_hash: hash, by: "supervisor", authority: "explicit", at: "2026-09-19T12:00:00Z" },
      ],
    };
    const ctx = ctxFor({ "templates/v.json": JSON.stringify(two) });
    expect(checkArtifacts(ctx).filter((i) => i.rule === "approval.stale")).toEqual([]);
  });
});

describe("a decision ticket is never executable", () => {
  test("a decision ticket carrying implementation fields is an error", () => {
    const ctx = ctxFor({
      "templates/t.json": JSON.stringify(
        envelope("ticket", {
          type: "decision",
          decision: { question: "q", subtype: "task", mode: "hitl" },
          allowed_changes: { files: ["src/**"] },
        }),
      ),
    });
    const issue = checkArtifacts(ctx).find((i) => i.rule === "ticket.decision-dispatched-as-implementation");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("allowed_changes");
  });

  test("a decision ticket in progress with no recorded answer is an error", () => {
    const ctx = ctxFor({
      "templates/t.json": JSON.stringify(
        envelope("ticket", {
          type: "decision",
          status: "in-progress",
          created_by: { role: "implementer" },
          decision: { question: "q", subtype: "task", mode: "hitl", answer: null },
        }),
      ),
    });
    expect(checkArtifacts(ctx).some((i) => i.rule === "ticket.decision-dispatched-as-implementation")).toBe(true);
  });

  test("an implementation ticket with the same fields is fine", () => {
    const ctx = ctxFor({
      "templates/t.json": JSON.stringify(
        envelope("ticket", { type: "implementation", status: "in-progress", allowed_changes: { files: ["src/**"] } }),
      ),
    });
    expect(checkArtifacts(ctx).filter((i) => i.rule === "ticket.decision-dispatched-as-implementation")).toEqual([]);
  });

  test("a resolved decision ticket with an answer is fine", () => {
    const ctx = ctxFor({
      "templates/t.json": JSON.stringify(
        envelope("ticket", {
          type: "decision",
          status: "done",
          decision: { question: "q", subtype: "task", mode: "hitl", answer: "we chose B" },
        }),
      ),
    });
    expect(checkArtifacts(ctx).filter((i) => i.rule === "ticket.decision-dispatched-as-implementation")).toEqual([]);
  });
});

describe("no author closes their own finding", () => {
  test("a self-closure inside an already malformed receipt is still caught", () => {
    // `by` is not a spelling finding.schema.json permits, so this document is
    // separately reported as schemas.document-invalid. It is covered here on
    // purpose: a receipt that fails its schema is the case where a self-closure
    // is most likely to be hand-written, and it should not also go unreported.
    const ctx = ctxFor({
      "templates/f.json": JSON.stringify(
        envelope("finding", {
          status: "resolved",
          created_by: { role: "code-review/security" },
          closure_receipt: { by: "code-review/security", ref: "receipt-1" },
        }),
      ),
    });
    const issue = checkArtifacts(ctx).find((i) => i.rule === "finding.self-closed");
    expect(issue?.severity).toBe("error");
  });

  test("a fix author who is not the finding's author does not close it here", () => {
    // The scope boundary, kept as a test because the old behaviour looked like
    // coverage. `fix_author` is declared nowhere in finding.schema.json, and
    // the arm that read it could not fire on a conforming document. Separating
    // the fix author from the closer is real, and it is enforced by the
    // `apply-findings` protocol, which knows who applied a patch; this check
    // answers the narrower question the finding can actually answer.
    const ctx = ctxFor({
      "templates/f.json": JSON.stringify(
        envelope("finding", {
          status: "resolved",
          created_by: { role: "code-review/security" },
          fix_author: "implementer",
          closure_receipt: { closed_by: "implementer", ref: "receipt-1" },
        }),
      ),
    });
    expect(checkArtifacts(ctx).some((i) => i.rule === "finding.self-closed")).toBe(false);
  });

  test("an independent closure receipt passes", () => {
    const ctx = ctxFor({
      "templates/f.json": JSON.stringify(
        envelope("finding", {
          status: "resolved",
          created_by: { role: "code-review/security" },
          closure_receipt: { closed_by: "reviewer-spec", ref: "receipt-1" },
        }),
      ),
    });
    expect(checkArtifacts(ctx).filter((i) => i.rule.startsWith("finding."))).toEqual([]);
  });

  test("a resolved finding with no closure receipt at all is an error", () => {
    const ctx = ctxFor({
      "templates/f.json": JSON.stringify(
        envelope("finding", { status: "resolved", created_by: { role: "code-review/security" } }),
      ),
    });
    expect(checkArtifacts(ctx).some((i) => i.rule === "finding.closed-without-receipt")).toBe(true);
  });

  test("a receipt spelled the way the shipped schema declares it is read", () => {
    // The case this block was missing. Every other receipt here says `by`, and
    // `schemas/finding.schema.json` forbids that spelling outright -- so the
    // rule was only ever exercised against receipts no conforming finding can
    // produce, and the one shape it will actually meet went unchecked.
    const ctx = ctxFor({
      "templates/f.json": JSON.stringify(
        envelope("finding", {
          status: "resolved",
          created_by: { role: "code-review/security" },
          closure_receipt: {
            verification: { id: "verification-1", schema: "verification", hash: `sha256:${"f".repeat(64)}` },
            closed_by: "code-review/security",
            independent: true,
            at: "2026-09-19T10:00:00Z",
          },
        }),
      ),
    });
    const issue = checkArtifacts(ctx).find((i) => i.rule === "finding.self-closed");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("code-review/security");
  });

  test("the schema leaves the checker exactly one spelling to read", () => {
    // Coupled to `schemas/finding.schema.json` on purpose, because the failure
    // this guards is silent: `closure_receipt` sets additionalProperties: false,
    // which makes every undeclared spelling unreachable rather than merely
    // unusual. A checker reading only undeclared keys finds nothing, reports
    // nothing, and passes its own tests. If the schema renames this key, this
    // test fails and the checker has to be updated in the same commit.
    const schema = JSON.parse(readFileSync(join(import.meta.dir, "..", "schemas", "finding.schema.json"), "utf8"));
    const receipt = schema.properties.closure_receipt;
    expect(receipt.additionalProperties).toBe(false);
    expect(receipt.required).toContain("closed_by");
    expect(Object.keys(receipt.properties)).not.toContain("by");
    expect(Object.keys(receipt.properties)).not.toContain("verified_by");
  });
});

describe("grants are issued by the runner, never forged", () => {
  test("a grant_ref whose charter_hash matches a charter passes", () => {
    const charter = envelope("charter", { immutable: true });
    const ctx = ctxFor({
      "templates/charter.json": JSON.stringify(charter),
      "templates/d.json": JSON.stringify(
        envelope("decision", { grant: { charter_hash: artifactHash(charter), covers: "spec-approval" } }),
      ),
    });
    expect(checkArtifacts(ctx).filter((i) => i.rule === "grant.charter-hash-unknown")).toEqual([]);
  });

  test("a grant_ref whose charter_hash matches no charter is a forged grant", () => {
    const ctx = ctxFor({
      "templates/charter.json": JSON.stringify(envelope("charter", { immutable: true })),
      "templates/d.json": JSON.stringify(
        envelope("decision", { grant: { charter_hash: `sha256:${"0".repeat(64)}`, covers: "spec-approval" } }),
      ),
    });
    const issue = checkArtifacts(ctx).find((i) => i.rule === "grant.charter-hash-unknown");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("no charter");
  });

  test("a nested grant inside an approval is checked too", () => {
    const ctx = ctxFor({
      "templates/charter.json": JSON.stringify(envelope("charter")),
      "templates/t.json": JSON.stringify(
        envelope("ticket", {
          type: "implementation",
          approvals: [
            {
              artifact_hash: `sha256:${"1".repeat(64)}`,
              by: "supervisor",
              authority: "delegated-grant",
              at: "2026-09-19T11:00:00Z",
              grant: { charter_hash: `sha256:${"2".repeat(64)}`, covers: "ticket-approval" },
            },
          ],
        }),
      ),
    });
    expect(checkArtifacts(ctx).some((i) => i.rule === "grant.charter-hash-unknown")).toBe(true);
  });

  test("with no charter present at all the check reports it as unverifiable, not clean", () => {
    const ctx = ctxFor({
      "templates/d.json": JSON.stringify(
        envelope("decision", { grant: { charter_hash: `sha256:${"0".repeat(64)}`, covers: "x" } }),
      ),
    });
    expect(checkArtifacts(ctx).some((i) => i.rule === "grant.charter-hash-unknown")).toBe(true);
  });
});

describe("escalation defaults", () => {
  test("an escalation whose default names one of its options passes", () => {
    const ctx = ctxFor({
      "templates/r.json": JSON.stringify(
        envelope("review", {
          escalation: {
            need: "n",
            options: [
              { id: "a", summary: "A" },
              { id: "b", summary: "B" },
            ],
            tried: [{ ref: "x" }],
            default: "b",
            charter_rule: "policy:limits/fix_cycles",
            blocked: ["T-1"],
          },
        }),
      ),
    });
    expect(checkArtifacts(ctx).filter((i) => i.rule === "escalation.default-not-an-option")).toEqual([]);
  });

  test("an escalation whose default names no option is an error", () => {
    const ctx = ctxFor({
      "templates/r.json": JSON.stringify(
        envelope("review", {
          escalation: {
            need: "n",
            options: [{ id: "a", summary: "A" }],
            tried: [{ ref: "x" }],
            default: "zzz",
            charter_rule: "r",
            blocked: ["T-1"],
          },
        }),
      ),
    });
    const issue = checkArtifacts(ctx).find((i) => i.rule === "escalation.default-not-an-option");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("zzz");
  });
});
