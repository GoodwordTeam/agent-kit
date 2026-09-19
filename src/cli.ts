#!/usr/bin/env bun
/**
 * ak — validate, build and attach.
 *
 * Exit 0 when nothing failed, non-zero on any error. Every failure line names
 * the file and the rule that produced it.
 */

import { attach, formatAttachResult } from "./attach/index.ts";
import { loadCatalog } from "./catalog/load.ts";
import type { BuildOptions } from "./packaging/build.ts";
import { checkBundles, writeAdaptations, writeBundles } from "./packaging/build.ts";
import { ADAPTATIONS_FILE, checkAdaptationsSync } from "./validation/provenance.ts";
import type { CheckContext } from "./validation/context.ts";
import { runValidation } from "./validation/run.ts";
import { formatIssue, hasErrors, sortIssues, type Issue } from "./validation/types.ts";

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

export interface CliOptions {
  cwd: string;
  io: CliIo;
}

const USAGE = [
  "ak — the agent-kit contract tool",
  "",
  "  ak validate [--profile <id>] [--json]      check the tree against catalog.yaml",
  "  ak build [--check] [--profile <id>]        emit dist/claude-code and dist/codex",
  "  ak attach <path-or-artifact> [--json]      select the packs an artifact activates",
  "",
  "Exit 0 when nothing failed, non-zero on any error.",
];

interface Parsed {
  command: string | undefined;
  positional: string[];
  flags: Map<string, string | true>;
  unknown: string[];
}

const VALUE_FLAGS = new Set(["profile", "host"]);

function parse(argv: readonly string[]): Parsed {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  const unknown: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const [name, inline] = token.slice(2).split("=", 2) as [string, string | undefined];
    if (VALUE_FLAGS.has(name)) {
      const value = inline ?? argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        unknown.push(token);
        continue;
      }
      if (inline === undefined) i += 1;
      flags.set(name, value);
      continue;
    }
    flags.set(name, inline ?? true);
  }
  return { command: positional[0], positional: positional.slice(1), flags, unknown };
}

function report(io: CliIo, issues: readonly Issue[], label: string): number {
  const sorted = sortIssues(issues);
  for (const issue of sorted) io.out(formatIssue(issue));
  const counts = { error: 0, warning: 0, note: 0 };
  for (const issue of sorted) counts[issue.severity] += 1;
  io.out(
    `${label}: ${counts.error} error${counts.error === 1 ? "" : "s"}, ${counts.warning} warning${counts.warning === 1 ? "" : "s"}, ${counts.note} note${counts.note === 1 ? "" : "s"}`,
  );
  return hasErrors(sorted) ? 1 : 0;
}

function contextOf(cwd: string, io: CliIo): CheckContext | null {
  const { catalog, issues } = loadCatalog(cwd);
  if (catalog === null) {
    report(io, issues, "ak");
    return null;
  }
  return { root: cwd, catalog };
}

function buildOptions(parsed: Parsed): BuildOptions {
  const profile = parsed.flags.get("profile");
  return { profile: typeof profile === "string" ? profile : undefined };
}

function validate(parsed: Parsed, options: CliOptions): number {
  const result = runValidation(options.cwd, { build: buildOptions(parsed) });
  if (parsed.flags.get("json") === true) {
    options.io.out(JSON.stringify({ ok: result.ok, issues: result.issues }, null, 2));
    return result.ok ? 0 : 1;
  }
  return report(options.io, result.issues, "ak validate");
}

function build(parsed: Parsed, options: CliOptions): number {
  const ctx = contextOf(options.cwd, options.io);
  if (ctx === null) return 1;
  const opts = buildOptions(parsed);

  if (parsed.flags.get("check") === true) {
    return report(options.io, [...checkAdaptationsSync(ctx), ...checkBundles(ctx, opts)], "ak build --check");
  }

  // The merged provenance file is a source-tree artifact, not a bundle file:
  // NOTICE points a downstream consumer at it, so it is generated even when the
  // skills it will eventually record are not authored yet.
  const generated = writeAdaptations(ctx);
  if (generated.length > 0) {
    const code = report(options.io, generated, "ak build");
    options.io.err(`ak build: refusing to write ${ADAPTATIONS_FILE} from conflicting fragments`);
    return code === 0 ? 1 : code;
  }
  options.io.out(`ak build: wrote ${ADAPTATIONS_FILE}`);

  // A build that would ship a contract failure is not a build. Validate first,
  // write only when the tree is clean.
  const validation = runValidation(options.cwd, { build: opts });
  if (!validation.ok) {
    const code = report(options.io, validation.issues, "ak build");
    options.io.err("ak build: refusing to write dist/ while validation reports errors");
    return code === 0 ? 1 : code;
  }

  const issues = writeBundles(ctx, opts);
  const code = report(options.io, issues, "ak build");
  if (code === 0) options.io.out(`ak build: wrote dist/ for profile ${opts.profile ?? ctx.catalog.package.defaultProfile}`);
  return code;
}

function attachCommand(parsed: Parsed, options: CliOptions): number {
  const subject = parsed.positional[0];
  if (subject === undefined) {
    options.io.err("ak attach: needs a path or artifact to attach packs to");
    for (const line of USAGE) options.io.err(line);
    return 2;
  }
  const ctx = contextOf(options.cwd, options.io);
  if (ctx === null) return 1;

  const result = attach(ctx, subject);
  if (parsed.flags.get("json") === true) {
    options.io.out(JSON.stringify(result, null, 2));
  } else {
    for (const line of formatAttachResult(result)) options.io.out(line);
  }
  for (const issue of sortIssues(result.issues)) options.io.out(formatIssue(issue));
  return hasErrors(result.issues) ? 1 : 0;
}

export function runCli(argv: readonly string[], options: CliOptions): number {
  const parsed = parse(argv);
  for (const token of parsed.unknown) options.io.err(`ak: ${token} needs a value`);
  if (parsed.unknown.length > 0) return 2;

  switch (parsed.command) {
    case "validate":
      return validate(parsed, options);
    case "build":
      return build(parsed, options);
    case "attach":
      return attachCommand(parsed, options);
    case undefined:
      for (const line of USAGE) options.io.err(line);
      return 2;
    default:
      options.io.err(`ak: unknown command ${parsed.command}`);
      for (const line of USAGE) options.io.err(line);
      return 2;
  }
}

if (import.meta.main) {
  const code = runCli(process.argv.slice(2), {
    cwd: process.cwd(),
    io: { out: (line) => console.log(line), err: (line) => console.error(line) },
  });
  process.exit(code);
}
