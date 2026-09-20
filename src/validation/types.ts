export type Severity = "error" | "warning" | "note";

export interface Issue {
  severity: Severity;
  /** Stable rule id, e.g. "catalog.directory-without-entry". Read by other agents. */
  rule: string;
  /** Repo-relative path the issue is about. "-" when no single file applies. */
  file: string;
  /** 1-based line, when known. */
  line?: number;
  message: string;
  /**
   * Short name of a check that did not run. Set by `skipped()` and by
   * `unavailable()`; absent on every finding. Carried in --json as well as the
   * summary, because a machine reading `ok: true` has the same problem a human
   * reading a clean summary has.
   */
  skipped?: string;
  /**
   * Set only by `unavailable()`: the check's subject was present and its
   * authority was not, so the run does not pass. Absent on a `skipped()` issue,
   * whose subject was the thing missing.
   */
  blocking?: true;
}

export function error(rule: string, file: string, message: string, line?: number): Issue {
  return line === undefined ? { severity: "error", rule, file, message } : { severity: "error", rule, file, message, line };
}

export function warning(rule: string, file: string, message: string, line?: number): Issue {
  return line === undefined
    ? { severity: "warning", rule, file, message }
    : { severity: "warning", rule, file, message, line };
}

export function note(rule: string, file: string, message: string, line?: number): Issue {
  return line === undefined ? { severity: "note", rule, file, message } : { severity: "note", rule, file, message, line };
}

/**
 * A check that could not run, as distinct from a check that ran and found nothing.
 *
 * Severity grades a finding. A skipped check has no finding to grade, so every rung
 * of the ladder misreports it: `note` reads as "looked, nothing serious", and a
 * `warning` reads as "looked, found something" and invites being silenced. Neither
 * says "did not look", which is the only true thing about it. Hence a second axis.
 *
 * The line for using this rather than `note()`: **material this check is responsible
 * for exists in the tree, and the check did not examine it.** Absent `.donors/` with
 * adaptation rows present is the case that forced it -- a clean summary on a machine
 * without the clones was byte-identical to a verified one, and donor-path-at-pin is
 * the check the whole provenance story rests on. An instrument that returns the same
 * answer under both hypotheses is not evidence.
 *
 * Three neighbouring shapes are notes and not skips, and the difference is the
 * subject, not the wording:
 *   - an empty subject (`evals/` absent, so there are no cases) hides nothing,
 *     because nothing that exists went unexamined;
 *   - a fail-closed fallback (no invocation policy, so every cross-entrypoint
 *     reference is judged a direct call) ran, under a stricter rule;
 *   - a stated limit (the counterpart census, the restatement calibration) is a
 *     check reporting what it cannot see, which is the opposite of not reporting.
 *
 * `check` is a short noun phrase for the summary line -- "donor paths at pin", not a
 * sentence and not the rule id. Several skips of the same check collapse to one term.
 *
 * **Use this only when the missing thing is the check's subject.** Where the subject
 * is present and what went missing is the authority the check measures it against,
 * use `unavailable()` instead: that case blocks and this one does not. The two are
 * one decision apart and the wrong one is silent, so `tests/unavailable.test.ts`
 * holds a table of every call site and fails on an unclassified new one.
 */
export function skipped(rule: string, file: string, check: string, message: string, line?: number): Issue {
  return { ...note(rule, file, message, line), skipped: check };
}

/**
 * A check whose subject is present and whose authority is absent. Blocks the run.
 *
 * The distinction `skipped()` could not make. `.donors/` absent is a check with
 * nothing to judge -- empty is the correct answer, and `validate-figure.sh` depends
 * on that run still passing. §12.2's anchors reworded is the opposite: 29 role
 * bodies are sitting in the tree unexamined, and what went missing is the contract
 * to examine them against. Reporting both as "skipped" made those two runs
 * indistinguishable at the exit code, so rewording an anchor disarmed the gate and
 * turned exit 1 into exit 0 with a defective row still in the tree.
 *
 * This is `required-lane-failure-is-unavailable` applied to the validator itself: a
 * required lane that could not be given its context returns `unavailable`, and an
 * `unavailable` required lane blocks approval. The gate enforcing that row was the
 * one row it did not apply to itself.
 *
 * Severity stays `note` on purpose. An error grades a finding, and a check that did
 * not run has no finding to grade -- the same argument that gave skips their own
 * axis rather than a rung on the severity ladder. The blocking lives on the axis.
 */
export function unavailable(rule: string, file: string, check: string, message: string, line?: number): Issue {
  return { ...note(rule, file, message, line), skipped: check, blocking: true };
}

export function hasErrors(issues: ReadonlyArray<Issue>): boolean {
  return issues.some((i) => i.severity === "error");
}

/** Whether any check reported itself unavailable, which fails the run. */
export function hasBlockingSkips(issues: ReadonlyArray<Issue>): boolean {
  return issues.some((i) => i.blocking === true);
}

function terms(issues: ReadonlyArray<Issue>, blocking: boolean): string[] {
  const out: string[] = [];
  for (const issue of issues) {
    if (issue.skipped === undefined || (issue.blocking === true) !== blocking) continue;
    if (!out.includes(issue.skipped)) out.push(issue.skipped);
  }
  return out;
}

/**
 * The distinct non-blocking checks that did not run, first-seen order.
 *
 * Disjoint from `blockingSkips` rather than a superset of it: a reader told the
 * same term under both headings learns nothing from either.
 */
export function skippedChecks(issues: ReadonlyArray<Issue>): string[] {
  return terms(issues, false);
}

/** The distinct checks that reported themselves unavailable, first-seen order. */
export function blockingSkips(issues: ReadonlyArray<Issue>): string[] {
  return terms(issues, true);
}

/** One line per issue: severity, rule, file[:line], message. */
export function formatIssue(issue: Issue): string {
  const where = issue.line === undefined ? issue.file : `${issue.file}:${issue.line}`;
  return `${issue.severity.toUpperCase().padEnd(7)} ${issue.rule.padEnd(38)} ${where}  ${issue.message}`;
}

/**
 * File first, so an author sees every issue with their file together; severity
 * is carried in each line's prefix rather than in the ordering.
 */
export function sortIssues(issues: ReadonlyArray<Issue>): Issue[] {
  const rank: Record<Severity, number> = { error: 0, warning: 1, note: 2 };
  return [...issues].sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      rank[a.severity] - rank[b.severity] ||
      a.rule.localeCompare(b.rule) ||
      a.message.localeCompare(b.message),
  );
}
