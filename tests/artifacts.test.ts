import { describe, expect, test } from "bun:test";

import { checkArtifacts, loadArtifacts } from "../src/validation/artifacts.ts";
import { artifactHash } from "../src/util/hash.ts";
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
    expect(loaded.artifacts.map((a) => a.schema)).toEqual(["ticket"]);
    expect(loaded.artifacts[0]?.file).toBe("templates/t.json");
  });

  test("YAML artifacts are loaded too", () => {
    const ctx = ctxFor({ "templates/t.yaml": "schema: ticket\nid: t-1\n" });
    expect(loadArtifacts(ctx).artifacts.length).toBe(1);
  });

  test("a file without a schema field is ignored, not an error", () => {
    const ctx = ctxFor({ "templates/notes.yaml": "hello: world\n" });
    expect(loadArtifacts(ctx).artifacts).toEqual([]);
    expect(loadArtifacts(ctx).issues).toEqual([]);
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
      "templates/f.json": JSON.stringify(envelope("finding", { spec_quality: "smell", difficulty: null, autofix_class: "safe_auto" })),
    });
    expect(checkArtifacts(ctx).some((i) => i.rule === "finding.smell-is-not-autofixable")).toBe(true);
  });
});

describe("approvals bind to content", () => {
  test("an approval whose artifact_hash matches the artifact passes", () => {
    const artifact = envelope("ticket", { type: "decision" });
    const approved = { ...artifact, approvals: [{ artifact_hash: artifactHash(artifact), by: "human", authority: "explicit", at: "2026-09-19T11:00:00Z" }] };
    const ctx = ctxFor({ "templates/t.json": JSON.stringify(approved) });
    expect(checkArtifacts(ctx).filter((i) => i.rule === "approval.stale")).toEqual([]);
  });

  test("an approval whose artifact_hash no longer matches is a stale approval", () => {
    const artifact = envelope("ticket", { type: "decision", goal: "the goal it was approved with" });
    const approvals = [{ artifact_hash: artifactHash(artifact), by: "human", authority: "explicit", at: "2026-09-19T11:00:00Z" }];
    const changed = { ...artifact, goal: "a different goal added after approval", approvals };
    const ctx = ctxFor({ "templates/t.json": JSON.stringify(changed) });
    const issue = checkArtifacts(ctx).find((i) => i.rule === "approval.stale");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("does not inherit");
  });

  test("adding an approval does not itself invalidate the hash", () => {
    const artifact = envelope("verification");
    const hash = artifactHash(artifact);
    const one = { ...artifact, approvals: [{ artifact_hash: hash, by: "human", authority: "explicit", at: "2026-09-19T11:00:00Z" }] };
    const two = { ...artifact, approvals: [...one.approvals, { artifact_hash: hash, by: "supervisor", authority: "explicit", at: "2026-09-19T12:00:00Z" }] };
    const ctx = ctxFor({ "templates/v.json": JSON.stringify(two) });
    expect(checkArtifacts(ctx).filter((i) => i.rule === "approval.stale")).toEqual([]);
  });
});

describe("a decision ticket is never executable", () => {
  test("a decision ticket carrying implementation fields is an error", () => {
    const ctx = ctxFor({
      "templates/t.json": JSON.stringify(
        envelope("ticket", { type: "decision", decision: { question: "q", subtype: "task", mode: "hitl" }, allowed_changes: { files: ["src/**"] } }),
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
        envelope("ticket", { type: "decision", status: "done", decision: { question: "q", subtype: "task", mode: "hitl", answer: "we chose B" } }),
      ),
    });
    expect(checkArtifacts(ctx).filter((i) => i.rule === "ticket.decision-dispatched-as-implementation")).toEqual([]);
  });
});

describe("no author closes their own finding", () => {
  test("a closure receipt signed by the finding's own author is an error", () => {
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

  test("a closure receipt signed by the fix author is an error", () => {
    const ctx = ctxFor({
      "templates/f.json": JSON.stringify(
        envelope("finding", {
          status: "resolved",
          created_by: { role: "code-review/security" },
          fix_author: "implementer",
          closure_receipt: { by: "implementer", ref: "receipt-1" },
        }),
      ),
    });
    expect(checkArtifacts(ctx).some((i) => i.rule === "finding.self-closed")).toBe(true);
  });

  test("an independent closure receipt passes", () => {
    const ctx = ctxFor({
      "templates/f.json": JSON.stringify(
        envelope("finding", {
          status: "resolved",
          created_by: { role: "code-review/security" },
          fix_author: "implementer",
          closure_receipt: { by: "reviewer-spec", ref: "receipt-1" },
        }),
      ),
    });
    expect(checkArtifacts(ctx).filter((i) => i.rule.startsWith("finding."))).toEqual([]);
  });

  test("a resolved finding with no closure receipt at all is an error", () => {
    const ctx = ctxFor({
      "templates/f.json": JSON.stringify(envelope("finding", { status: "resolved", created_by: { role: "code-review/security" } })),
    });
    expect(checkArtifacts(ctx).some((i) => i.rule === "finding.closed-without-receipt")).toBe(true);
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
      "templates/d.json": JSON.stringify(envelope("decision", { grant: { charter_hash: `sha256:${"0".repeat(64)}`, covers: "x" } })),
    });
    expect(checkArtifacts(ctx).some((i) => i.rule === "grant.charter-hash-unknown")).toBe(true);
  });
});

describe("escalation defaults", () => {
  test("an escalation whose default names one of its options passes", () => {
    const ctx = ctxFor({
      "templates/r.json": JSON.stringify(
        envelope("review", {
          escalation: { need: "n", options: [{ id: "a", summary: "A" }, { id: "b", summary: "B" }], tried: [{ ref: "x" }], default: "b", charter_rule: "policy:limits/fix_cycles", blocked: ["T-1"] },
        }),
      ),
    });
    expect(checkArtifacts(ctx).filter((i) => i.rule === "escalation.default-not-an-option")).toEqual([]);
  });

  test("an escalation whose default names no option is an error", () => {
    const ctx = ctxFor({
      "templates/r.json": JSON.stringify(
        envelope("review", {
          escalation: { need: "n", options: [{ id: "a", summary: "A" }], tried: [{ ref: "x" }], default: "zzz", charter_rule: "r", blocked: ["T-1"] },
        }),
      ),
    });
    const issue = checkArtifacts(ctx).find((i) => i.rule === "escalation.default-not-an-option");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("zzz");
  });
});
