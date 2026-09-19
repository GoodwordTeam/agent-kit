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

export function hasErrors(issues: ReadonlyArray<Issue>): boolean {
  return issues.some((i) => i.severity === "error");
}

/** One line per issue: severity, rule, file[:line], message. */
export function formatIssue(issue: Issue): string {
  const where = issue.line === undefined ? issue.file : `${issue.file}:${issue.line}`;
  return `${issue.severity.toUpperCase().padEnd(7)} ${issue.rule.padEnd(38)} ${where}  ${issue.message}`;
}

export function sortIssues(issues: ReadonlyArray<Issue>): Issue[] {
  const rank: Record<Severity, number> = { error: 0, warning: 1, note: 2 };
  return [...issues].sort(
    (a, b) =>
      rank[a.severity] - rank[b.severity] ||
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.rule.localeCompare(b.rule),
  );
}
