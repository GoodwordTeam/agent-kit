/**
 * Does each artifact rule actually compare anything against the shipped
 * example documents, or does it stand behind a guard those documents never
 * satisfy?
 *
 * `artifact-rule-reach.py` answers the prior question -- how many rules are
 * reachable only through `loadArtifacts`, and whether any schema owes a
 * document and has none. It is a static walk, so it stops at "the function
 * runs". This probe runs the three gated check groups for real and, for each
 * of those rule ids, applies one mutation to a copy of `templates/` and asks
 * whether that rule reports.
 *
 * Every rule is classified by which kind of mutation was needed:
 *
 *   exercised   The shipped document already satisfies the rule's guard. The
 *               rule compares a real value on every run and finds nothing
 *               wrong; changing that value makes it report.
 *   inert       The function runs, but the guard is false in the shipped set,
 *               so nothing is compared. Only a mutation that flips the guard
 *               makes it report. The rule is installed, not tested.
 *   unreached   No document carries a node of the shape the rule looks for at
 *               all, so no single-field mutation reaches it.
 *
 * WHAT A CLEAN RUN IS EVIDENCE OF
 *   - The unmutated example set raises nothing from `checkArtifacts`,
 *     `checkDocumentRules` or `checkPackManifests`. Silence with the guards
 *     satisfied is a result; silence behind a false guard is not, which is the
 *     distinction the three classes exist to keep visible.
 *   - Every rule counted `exercised` reported when its compared value changed,
 *     under the rule id its schema declares -- so the rule is wired to the
 *     documents, not merely present in the tree.
 *   - Every rule counted `inert` or `unreached` names, in `note`, what a
 *     document would have to carry for it to compare anything.
 *
 * WHAT A CLEAN RUN IS NOT EVIDENCE OF
 *   - That the rules are correct. A mutation firing the expected id shows the
 *     rule is connected and discriminating on that one axis. It says nothing
 *     about the axes no mutation here touches.
 *   - That `exercised` means fully exercised. Several rules hold more than one
 *     clause; a rule is counted exercised when any clause compares a shipped
 *     value. Where a second clause stays inert, `note` says so.
 *   - That the example set is the right set. It is ten documents, one per
 *     schema with a runtime shape. Rules that compare two documents of the
 *     same schema cannot be satisfied by one of each, and that shows up here
 *     as `inert` rather than as an argument for a larger set.
 *   - That anything outside these three modules ran. `checkSchemas` validates
 *     the same documents and is not gated on `templates/` having content.
 *
 * Nothing is written inside the repository. The documents are copied to a
 * temporary root and mutated there, because a mutation loop in the working
 * tree is visible to everyone else working in it.
 *
 * Usage: bun run research/probes/artifact-rule-firing.ts
 * Exits 0 when the baseline is silent and every mutation reported its own
 * rule id; 1 otherwise.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadCatalog } from "../../src/catalog/load.ts";
import { checkArtifacts } from "../../src/validation/artifacts.ts";
import { checkPackManifests } from "../../src/validation/configrules.ts";
import { checkDocumentRules } from "../../src/validation/docrules.ts";
import type { CheckContext } from "../../src/validation/context.ts";
import type { Issue } from "../../src/validation/types.ts";

const REPO = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

/** What the three gated check groups need in a root of their own. */
const COPIED = ["catalog.yaml", "schemas", "templates", "AUTHORING.md"];

type Kind = "value" | "guard" | "absent";

interface Mutation {
  /** The rule id expected to report. */
  readonly rule: string;
  /** Template basename under templates/, or null when no mutation reaches it. */
  readonly file: string | null;
  /** Dotted path, with integer segments indexing arrays. */
  readonly path?: string;
  /** New value, or the DELETE sentinel. */
  readonly to?: unknown;
  /** Further edits applied with the first, for rules holding several clauses. */
  readonly also?: ReadonlyArray<{ path: string; to: unknown }>;
  readonly kind: Kind;
  readonly note?: string;
}

const DELETE = Symbol("delete");

function put(doc: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let node: any = doc;
  for (const key of keys.slice(0, -1)) node = node[key];
  const last = keys[keys.length - 1]!;
  if (value === DELETE) {
    if (Array.isArray(node)) node.splice(Number(last), 1);
    else delete node[last];
    return;
  }
  node[last] = value;
}

const SYN = `sha256:${"a".repeat(64)}`;
const OTHER_REVISION = "2".repeat(40);

const MUTATIONS: ReadonlyArray<Mutation> = [
  // ------------------------------------------------------------ artifacts.ts
  {
    rule: "approval.stale",
    file: "charter.example.json",
    path: "approvals.0.artifact_hash",
    to: SYN,
    kind: "value",
  },
  {
    rule: "escalation.default-not-an-option",
    file: null,
    kind: "absent",
    note: "The rule looks for a node carrying need, options and default. No example carries an escalation: the decision was decided and the review was approved, and an escalation belongs to the blocked forms of both.",
  },
  {
    rule: "finding.closed-without-receipt",
    file: "finding.example.json",
    path: "closure_receipt",
    to: DELETE,
    kind: "value",
  },
  {
    rule: "finding.difficulty-on-open-solution-space",
    file: "finding.example.json",
    path: "spec_quality",
    to: "smell",
    kind: "guard",
    note: "Guarded on spec_quality === 'smell'. The example is a patch, so the difficulty comparison never runs.",
  },
  {
    rule: "finding.self-closed",
    file: "finding.example.json",
    path: "closure_receipt.closed_by",
    to: "code-review/security",
    kind: "value",
  },
  {
    rule: "finding.smell-is-not-autofixable",
    file: "finding.example.json",
    path: "spec_quality",
    to: "smell",
    also: [{ path: "difficulty", to: null }],
    kind: "guard",
    note: "Guarded on spec_quality === 'smell', same gate as the difficulty rule above.",
  },
  {
    rule: "grant.charter-hash-unknown",
    file: "decision.example.json",
    path: "grants_issued.0.charter_hash",
    to: SYN,
    kind: "value",
  },
  {
    rule: "ticket.decision-dispatched-as-implementation",
    file: "ticket.example.json",
    path: "type",
    to: "decision",
    kind: "guard",
    note: "Guarded on type === 'decision'. The example is an implementation ticket, which is the shape the rest of the worked example needs.",
  },

  // ---------------------------------------------------------- configrules.ts
  {
    rule: "pack.attachment-records-rationale-and-matched-rule",
    file: "review.example.json",
    path: "packs_attached.0.rationale",
    to: DELETE,
    kind: "value",
  },

  // ------------------------------------------------------- docrules.ts: charter
  {
    rule: "charter.hash-matches-content-and-location-is-not-worker-writable",
    file: "charter.example.json",
    path: "work_source.summary",
    to: "A different summary, which changes the content the hash is taken over.",
    kind: "value",
    note: "The hash clause is exercised. The worker-writable clause is inert: it needs immutability.worker_writable === true, which the schema pins to false.",
  },
  {
    rule: "charter.sensitive-grant-requires-explicit-human-approval-bound-to-this-hash",
    file: "charter.example.json",
    path: "sensitive_grants",
    to: [
      {
        action: "merge",
        scope: "Merging the one pull request this run opens, after every required lane is covered.",
        approval: { artifact_hash: SYN, by: "human", authority: "explicit", at: "2026-09-19T09:00:00Z" },
        single_use: true,
      },
    ],
    kind: "guard",
    note: "Guarded on a non-empty sensitive_grants. It is also unsatisfiable once entered: the rule wants approval.artifact_hash to equal immutability.hash, and that value is part of the content immutability.hash is taken over, so no assignment is a fixed point.",
  },
  {
    rule: "charter.supervisor-seats-independent-and-not-the-implementer",
    file: "charter.example.json",
    path: "supervisors.seats.1.filled_by",
    to: "supervisor",
    kind: "value",
  },
  {
    rule: "charter.amendment-creates-a-new-hash-and-invalidates-old-grants",
    file: "charter.example.json",
    path: "supersedes",
    to: { id: "example-charter-0", schema: "charter", hash: SYN },
    also: [{ path: "immutability.hash", to: SYN }],
    kind: "guard",
    note: "Guarded on the envelope's supersedes. The example is a first charter, so no amendment is compared.",
  },

  // ------------------------------------------------------ docrules.ts: decision
  {
    rule: "decision.seats-declared-independent-and-not-the-implementer",
    file: "decision.example.json",
    path: "seats.1.filled_by",
    to: "supervisor",
    kind: "value",
  },
  {
    rule: "decision.judgment-choice-names-a-declared-option",
    file: "decision.example.json",
    path: "judgments.0.choice",
    to: "neither-option",
    kind: "value",
  },
  {
    rule: "decision.agreement-matches-the-recorded-judgments",
    file: "decision.example.json",
    path: "agreement",
    to: false,
    kind: "value",
  },
  {
    rule: "decision.authority-check-recomputed-from-charter-and-evidence",
    file: "decision.example.json",
    path: "required_evidence.0",
    to: "projects/example-project/runs/example-run-1/absent.json",
    kind: "value",
  },
  {
    rule: "decision.ruling-requires-a-passed-authority-check-not-mere-agreement",
    file: "decision.example.json",
    path: "authority_check.result",
    to: "fail",
    kind: "value",
  },

  // ------------------------------------------------------- docrules.ts: dossier
  { rule: "dossier.turns-used-within-turns-allowed", file: "dossier.example.json", path: "budget.turns_used", to: 9, kind: "value" },
  {
    rule: "dossier.lexical-baseline-present",
    file: "dossier.example.json",
    path: "searches.0.tool",
    to: "path",
    also: [{ path: "searches.3.tool", to: "path" }],
    kind: "value",
    note: "Both lexical searches have to change: the rule asks whether any search is lexical, so mutating one of two leaves it satisfied. A mutation that reaches the rule only because the document happens to hold one node of its kind is a weaker measurement than it looks.",
  },
  { rule: "dossier.stale-or-absent-graph-documents-a-limitation", file: "dossier.example.json", path: "coverage_limits", to: [], kind: "value" },
  {
    rule: "dossier.no-architectural-verdict",
    file: "dossier.example.json",
    path: "recommendation.assessment",
    to: "The loader should be rewritten.",
    kind: "value",
    note: "The scan walks every key of the shipped document on every run and finds none refused; the mutation adds one.",
  },
  {
    rule: "dossier.index-revision-compared-to-source-revision",
    file: "dossier.example.json",
    path: "graph_providers.0.index.index_revision",
    to: OTHER_REVISION,
    kind: "value",
  },

  // --------------------------------------------------------- docrules.ts: event
  { rule: "event.no-event-field-confers-authority", file: "event.example.json", path: "trust.grants_authority", to: true, kind: "value" },
  {
    rule: "event.remote-side-effect-key-is-unique-and-read-back",
    file: "event.example.json",
    path: "side_effects_performed.0.read_back.confirmed",
    to: false,
    kind: "value",
  },

  // ------------------------------------------------------- docrules.ts: finding
  {
    rule: "finding.fingerprint-stable-across-line-moves",
    file: "finding.example.json",
    path: "fingerprint.inputs.symbol_or_path",
    to: "src/loader/artifacts.ts:24",
    kind: "value",
    note: "The line-bearing-input clause is exercised. The cross-document clause, which compares two findings' inputs and values, is inert: there is one finding.",
  },
  {
    rule: "finding.presentation-label-never-substitutes-for-severity",
    file: "finding.example.json",
    path: "severity",
    to: "P3",
    kind: "value",
  },
  {
    rule: "finding.synthesis-may-only-worsen-a-grade",
    file: "finding.example.json",
    path: "synthesis",
    to: {
      of: { id: "example-finding-0", schema: "finding", hash: SYN },
      changes: [{ field: "severity", from: "P2", to: "P3" }],
      rationale: "Recorded to show the direction the validator enforces.",
    },
    kind: "guard",
    note: "Guarded on a synthesis member. The example is a specialist's own finding, not a regraded one.",
  },
  {
    rule: "finding.low-confidence-security-is-adjudicated-not-filtered",
    file: "finding.example.json",
    path: "status",
    to: "deferred",
    also: [
      { path: "adjudication", to: DELETE },
      { path: "dispatch", to: DELETE },
      { path: "closure_receipt", to: DELETE },
      { path: "conflicting_evidence", to: [] },
    ],
    kind: "value",
    note: "The outer guard -- a security lane at an anchor of 50 or below -- is satisfied by the shipped finding. Firing it takes both the status and the adjudication evidence, because the rule accepts any of four records as adjudication.",
  },

  // -------------------------------------------------------- docrules.ts: lesson
  {
    rule: "lesson.duplicate-of-an-existing-lesson-is-refused",
    file: null,
    kind: "absent",
    note: "The rule compares this lesson's statement against every other lesson document. One lesson exists, so the loop body never runs; a second lesson is what reaches it, not a changed field.",
  },
  {
    rule: "lesson.skill-rollback-preserves-lesson-and-evidence-history",
    file: "lesson.example.json",
    path: "evidence",
    to: [],
    kind: "value",
  },

  // ------------------------------------------------------- docrules.ts: project
  { rule: "project.kb-root-is-not-an-application-local-docs-tree", file: "project.example.json", path: "kb.ownership", to: "local", kind: "value" },
  { rule: "project.standards-path-resolves-or-lane-returns-empty", file: "project.example.json", path: "standards.0.path", to: "AUTHORING-that-does-not-exist.md", kind: "value" },
  { rule: "project.test-pyramid-percentages-sum-to-100", file: "project.example.json", path: "guidance.test_pyramid.unit_percent", to: 70, kind: "value" },
  { rule: "project.numeric-guidance-never-becomes-a-gate", file: "project.example.json", path: "guidance.pr_size.enforcement", to: "blocking", kind: "value" },
  { rule: "project.single-tracker-system-of-record", file: "project.example.json", path: "tracker_policy.mirrors.0.role", to: "authoritative", kind: "value" },

  // -------------------------------------------------------- docrules.ts: review
  { rule: "review.seat-filled-by-someone-other-than-the-author", file: "review.example.json", path: "lanes.0.seat.independent_of_author", to: false, kind: "value" },
  { rule: "review.security-seat-not-filled-by-implementer-or-spec-approver", file: "review.example.json", path: "lanes.1.seat.filled_by", to: "implementer", kind: "value" },
  {
    rule: "review.unavailable-required-lane-blocks-approval",
    file: "review.example.json",
    path: "lanes.0.state",
    to: "unavailable",
    kind: "guard",
    note: "Guarded on a required lane in the unavailable state. Every required lane in the example is covered, so the comparison against the verdict never runs.",
  },
  { rule: "review.third-fix-cycle-stops", file: "review.example.json", path: "fix_cycles.allowed", to: 3, kind: "value" },
  { rule: "review.delta-scope-bounded-by-affected-behavior", file: "review.example.json", path: "delta_scope.boundary", to: "changed-lines", kind: "value" },
  {
    rule: "review.material-change-establishes-a-new-baseline",
    file: "review.example.json",
    path: "baseline_reset",
    to: { reason: "requirements-changed", invalidated_approvals: [], new_scope: true },
    kind: "guard",
    note: "Guarded on a baseline_reset member. A delta pass that also resets its baseline is contradictory, so the example carries one or the other.",
  },

  // -------------------------------------------------- docrules.ts: verification
  { rule: "verification.prose-never-substitutes-for-exit-status-and-digest", file: "verification.example.json", path: "exit_status", to: 1, kind: "value" },
  {
    rule: "verification.weakened-check-requires-its-own-decision",
    file: "verification.example.json",
    path: "weakened_checks",
    to: [{ what: "assertion-weakened", detail: "Recorded to reach the rule; a real entry carries the decision that authorized it." }],
    kind: "guard",
    note: "Guarded on a non-empty weakened_checks. Nothing was weakened, which is the state the rule exists to protect.",
  },
  {
    rule: "verification.receipt-stale-when-revision-differs-from-head",
    file: "review.example.json",
    path: "reviewed_head.revision",
    to: OTHER_REVISION,
    kind: "value",
    note: "Mutated on the review, which is the document the receipt is compared against. The receipt is cited in packet.verification_receipts on every run.",
  },
];

function newRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "ak-rule-firing-"));
  for (const entry of COPIED) cpSync(join(REPO, entry), join(root, entry), { recursive: true });
  return root;
}

function issuesFor(root: string): Issue[] {
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error(`no catalog under ${root}`);
  const ctx: CheckContext = { root, catalog };
  return [...checkArtifacts(ctx), ...checkDocumentRules(ctx), ...checkPackManifests(ctx)];
}

function main(): number {
  const root = newRoot();
  const pristine = new Map<string, string>();
  for (const m of MUTATIONS) {
    if (m.file !== null && !pristine.has(m.file)) {
      pristine.set(m.file, readFileSync(join(root, "templates", m.file), "utf8"));
    }
  }

  // Every issue, not only the errors. A rule already reporting at warning
  // severity before any mutation would make every "did it fire" answer trivially
  // yes, and the counts would describe the harness rather than the documents.
  const baseline = issuesFor(root);
  const counts: Record<Kind, number> = { value: 0, guard: 0, absent: 0 };
  const wrong: string[] = [];
  const lines: string[] = [];

  for (const m of MUTATIONS) {
    if (m.file === null) {
      counts.absent += 1;
      lines.push(`  unreached  ${m.rule}`);
      continue;
    }
    const original = pristine.get(m.file)!;
    const doc = JSON.parse(original) as Record<string, unknown>;
    put(doc, m.path!, m.to);
    for (const extra of m.also ?? []) put(doc, extra.path, extra.to);
    writeFileSync(join(root, "templates", m.file), JSON.stringify(doc, null, 2));

    const fired = issuesFor(root).some((i) => i.rule === m.rule);
    writeFileSync(join(root, "templates", m.file), original);

    if (!fired) wrong.push(`${m.rule} did not report under its own id after its mutation`);
    counts[m.kind] += 1;
    lines.push(`  ${m.kind === "value" ? "exercised" : "inert    "}  ${m.rule}`);
  }

  rmSync(root, { recursive: true, force: true });

  console.log(`rules measured: ${MUTATIONS.length}`);
  console.log(`baseline issues of any severity from the three gated check groups: ${baseline.length}`);
  for (const issue of baseline) console.log(`  ${issue.severity} ${issue.rule} ${issue.file}`);
  console.log();
  console.log(`exercised (guard satisfied, value compared, nothing found): ${counts.value}`);
  console.log(`inert     (function runs, guard false, nothing compared):   ${counts.guard}`);
  console.log(`unreached (no node of the shape the rule looks for):        ${counts.absent}`);
  console.log();
  for (const line of lines.sort()) console.log(line);
  console.log();
  for (const m of MUTATIONS) if (m.note !== undefined) console.log(`  ${m.rule}\n    ${m.note}`);

  if (wrong.length > 0) {
    console.error();
    for (const line of wrong) console.error(`MUTATION DID NOT REPORT: ${line}`);
    console.error("A mutation that does not report means the mapping here no longer matches the rule. Fix this file, not the count.");
    return 1;
  }
  if (baseline.length > 0) {
    console.error("\nThe unmutated example set is not silent; the counts above describe a tree that already fails.");
    return 1;
  }
  return 0;
}

process.exit(main());
