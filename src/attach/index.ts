import { readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { parse as parseYaml } from "yaml";

import type { CheckContext } from "../validation/context.ts";
import { toPosix } from "../util/fs.ts";
import { builtinSignalsFor, type Signal, type SignalKind, type SignalWeight } from "./signals.ts";

const MAX_CONTENT_BYTES = 512 * 1024;
const MAX_MATCH_CHARS = 120;

export type SubjectKind = "artifact" | "file" | "directory" | "path";

export interface AttachSubject {
  /** What the caller asked for, verbatim. */
  readonly input: string;
  /** Repository-relative POSIX path. */
  readonly path: string;
  readonly kind: SubjectKind;
  readonly contentsAvailable: boolean;
  /** The artifact's declared schema id, when the subject parsed as one. */
  readonly schema: string | null;
}

export interface Evidence {
  readonly kind: SignalKind;
  readonly pattern: string;
  readonly weight: SignalWeight;
  readonly matched: string;
  readonly note: string;
  /** The pack's `activation.rules[].id` the signal implements. */
  readonly rule: string;
  readonly line?: number;
}

export interface PackSelection {
  readonly pack: string;
  /** The activation rules a sufficient signal matched, sorted: what an attachment_record cites. */
  readonly matchedRules: readonly string[];
  readonly evidence: readonly Evidence[];
  readonly rationale: string;
}

export interface PackSkipped {
  readonly pack: string;
  readonly reason: string;
  readonly supporting: readonly Evidence[];
}

export interface AttachResult {
  readonly subject: AttachSubject;
  readonly selections: readonly PackSelection[];
  readonly skipped: readonly PackSkipped[];
}

interface LoadedSubject {
  readonly subject: AttachSubject;
  readonly contents: string | null;
  readonly document: unknown;
}

function truncate(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_MATCH_CHARS ? `${flat.slice(0, MAX_MATCH_CHARS - 1)}…` : flat;
}

function compile(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

function lineOf(contents: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (contents.charCodeAt(i) === 10) line += 1;
  return line;
}

/** Resolves a dotted field path; `[]` spreads an array. Returns every value found. */
export function resolveField(document: unknown, path: string): unknown[] {
  let current: unknown[] = [document];
  for (const rawSegment of path.split(".")) {
    if (rawSegment.length === 0) continue;
    const spread = rawSegment.endsWith("[]");
    const key = spread ? rawSegment.slice(0, -2) : rawSegment;
    const next: unknown[] = [];
    for (const value of current) {
      if (value === null || typeof value !== "object") continue;
      const held = (value as Record<string, unknown>)[key];
      if (held === undefined) continue;
      if (spread && Array.isArray(held)) next.push(...held);
      else next.push(held);
    }
    current = next;
    if (current.length === 0) return [];
  }
  return current;
}

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

function describeValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function loadSubject(root: string, input: string): LoadedSubject {
  const absolute = isAbsolute(input) ? input : resolve(root, input);
  const rel = toPosix(relative(root, absolute));
  const path = rel.length === 0 ? "." : rel;

  let kind: SubjectKind = "path";
  let contents: string | null = null;
  try {
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      kind = "directory";
    } else {
      kind = "file";
      if (stats.size <= MAX_CONTENT_BYTES) contents = readFileSync(absolute, "utf8");
    }
  } catch {
    kind = "path";
  }

  let document: unknown = null;
  let schema: string | null = null;
  if (contents !== null) {
    try {
      document = path.endsWith(".json") ? JSON.parse(contents) : parseYaml(contents);
    } catch {
      document = null;
    }
    if (document !== null && typeof document === "object" && !Array.isArray(document)) {
      const declared = (document as Record<string, unknown>)["schema"];
      if (typeof declared === "string" && declared.length > 0) {
        schema = declared;
        kind = "artifact";
      }
    }
  }

  return {
    subject: { input, path, kind, contentsAvailable: contents !== null, schema },
    contents,
    document,
  };
}

function evaluate(signal: Signal, loaded: LoadedSubject): Evidence | null {
  const base = {
    kind: signal.kind,
    pattern: signal.pattern,
    weight: signal.weight,
    note: signal.note,
    rule: signal.rule,
  };

  if (signal.kind === "path-regex") {
    const re = compile(signal.pattern);
    const hit = re?.exec(loaded.subject.path);
    return hit ? { ...base, matched: truncate(hit[0].length > 0 ? hit[0] : loaded.subject.path) } : null;
  }

  if (signal.kind === "content-regex") {
    if (loaded.contents === null) return null;
    const re = compile(signal.pattern);
    const hit = re?.exec(loaded.contents);
    if (!hit) return null;
    const line = lineOf(loaded.contents, hit.index);
    const lineText = loaded.contents.split("\n")[line - 1] ?? hit[0];
    return { ...base, matched: truncate(lineText), line };
  }

  if (loaded.document === null) return null;

  const values = resolveField(loaded.document, signal.pattern);
  if (signal.kind === "field-present") {
    const found = values.find(isMeaningful);
    return found === undefined ? null : { ...base, matched: truncate(`${signal.pattern} = ${describeValue(found)}`) };
  }

  const re = signal.value === undefined ? null : compile(signal.value);
  if (re === null) return null;
  for (const value of values) {
    const text = describeValue(value);
    if (re.test(text)) return { ...base, matched: truncate(`${signal.pattern} = ${text}`) };
  }
  return null;
}

export function attach(ctx: CheckContext, input: string): AttachResult {
  const loaded = loadSubject(ctx.root, input);

  const packs = ctx.catalog.bySection("packs").map((entry) => entry.id);
  const selections: PackSelection[] = [];
  const skipped: PackSkipped[] = [];

  for (const pack of [...packs].sort()) {
    const signals = builtinSignalsFor(pack);
    if (signals.length === 0) {
      skipped.push({ pack, reason: "no built-in activation signals", supporting: [] });
      continue;
    }

    const sufficient: Evidence[] = [];
    const supporting: Evidence[] = [];
    for (const signal of signals) {
      const hit = evaluate(signal, loaded);
      if (hit === null) continue;
      if (hit.weight === "sufficient") sufficient.push(hit);
      else supporting.push(hit);
    }

    if (sufficient.length === 0) {
      const detail = loaded.subject.contentsAvailable ? "" : "; file contents unavailable";
      const near = supporting.length > 0 ? `; ${supporting.length} supporting signal(s) matched but never select alone` : "";
      skipped.push({
        pack,
        reason: `no sufficient signal matched (${signals.length} evaluated${detail}${near})`,
        supporting,
      });
      continue;
    }

    const evidence = [...sufficient, ...supporting];
    const matchedRules = [...new Set(sufficient.map((e) => e.rule))].sort();
    const reasons = sufficient.map((e) => e.note).join("; ");
    selections.push({
      pack,
      matchedRules,
      evidence,
      rationale: `${pack} selected on ${loaded.subject.kind} ${loaded.subject.path} by rule ${matchedRules.join(", ")}: ${reasons}`,
    });
  }

  return { subject: loaded.subject, selections, skipped };
}

export function formatAttachResult(result: AttachResult): string[] {
  const lines: string[] = [];
  const { subject } = result;
  const schema = subject.schema === null ? "" : ` (schema: ${subject.schema})`;
  lines.push(`subject: ${subject.path} [${subject.kind}]${schema}`);
  if (result.selections.length === 0) {
    lines.push("  no packs attached");
  }
  for (const selection of result.selections) {
    lines.push(`  ${selection.pack}`);
    lines.push(`    rules: ${selection.matchedRules.join(", ")}`);
    lines.push(`    why: ${selection.rationale}`);
    for (const e of selection.evidence) {
      const where = e.line === undefined ? "" : `:${e.line}`;
      lines.push(`    - ${e.weight} ${e.kind}${where} [${e.rule}] ${e.note} -- matched ${JSON.stringify(e.matched)}`);
    }
  }
  for (const entry of result.skipped) {
    lines.push(`  (not attached) ${entry.pack}: ${entry.reason}`);
  }
  return lines;
}
