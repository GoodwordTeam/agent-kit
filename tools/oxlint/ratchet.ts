/**
 * The lint ratchet: every rule in `.oxlintrc.json` is an error, and the violations that predate a rule
 * are recorded per file and rule in `tools/oxlint/baseline.json`. A run fails when any file holds more
 * violations of a rule than the baseline records, and when it holds fewer, because a count that went
 * down has to be written down or the room it leaves could be spent again. The baseline only shrinks:
 * `--update` refuses to record growth unless `--allow-growth` says a new rule is being adopted.
 *
 *   bun tools/oxlint/ratchet.ts [--root <dir>] [--update [--allow-growth]] <path>...
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import Ajv2020, { type JSONSchemaType } from "ajv/dist/2020.js";

/** file -> rule -> violations. */
type Counts = Map<string, Map<string, number>>;

interface Diagnostic {
  file: string;
  rule: string;
  line: number;
  column: number;
  message: string;
}

export interface RatchetResult {
  /** Violations in a file and rule beyond what the baseline records, with every diagnostic of that pair. */
  over: { file: string; rule: string; recorded: number; actual: number; diagnostics: Diagnostic[] }[];
  /** Pairs the baseline records more of than the tree holds. */
  stale: { file: string; rule: string; recorded: number; actual: number }[];
  actual: Counts;
}

/** The part of oxlint's `--format=json` report the ratchet reads. */
interface Report {
  diagnostics: {
    filename: string;
    code: string;
    message: string;
    labels: { span: { line: number; column: number } }[];
  }[];
}

type BaselineFile = Record<string, Record<string, number>>;

const REPORT_SCHEMA: JSONSchemaType<Report> = {
  type: "object",
  required: ["diagnostics"],
  properties: {
    diagnostics: {
      type: "array",
      items: {
        type: "object",
        required: ["filename", "code", "message", "labels"],
        properties: {
          filename: { type: "string" },
          code: { type: "string" },
          message: { type: "string" },
          labels: {
            type: "array",
            items: {
              type: "object",
              required: ["span"],
              properties: {
                span: {
                  type: "object",
                  required: ["line", "column"],
                  properties: { line: { type: "integer" }, column: { type: "integer" } },
                },
              },
            },
          },
        },
      },
    },
  },
};

const BASELINE_SCHEMA: JSONSchemaType<BaselineFile> = {
  type: "object",
  required: [],
  additionalProperties: {
    type: "object",
    required: [],
    additionalProperties: { type: "integer", minimum: 1 },
  },
};

const ajv = new Ajv2020({ strict: false, allErrors: true });
const validReport = ajv.compile(REPORT_SCHEMA);
const validBaseline = ajv.compile(BASELINE_SCHEMA);

const OXLINT = join(import.meta.dir, "..", "..", "node_modules", ".bin", "oxlint");
const BASELINE = join("tools", "oxlint", "baseline.json");

/** Run oxlint with the root's own config and return its diagnostics. A run that produced no report throws. */
export function lint(root: string, paths: readonly string[]): Diagnostic[] {
  const run = spawnSync(OXLINT, ["--format=json", ...paths], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
  let report: Report | undefined;
  try {
    const parsed: unknown = JSON.parse(run.stdout);
    if (validReport(parsed)) report = parsed;
  } catch {
    report = undefined;
  }
  if (report === undefined) throw new Error(`oxlint produced no report (exit ${run.status}):\n${run.stderr}`);
  return report.diagnostics.map((d) => ({
    file: d.filename,
    rule: d.code,
    line: d.labels[0]?.span.line ?? 0,
    column: d.labels[0]?.span.column ?? 0,
    message: d.message,
  }));
}

export function count(diagnostics: readonly Diagnostic[]): Counts {
  const counts: Counts = new Map();
  for (const d of diagnostics) {
    const rules = counts.get(d.file) ?? new Map<string, number>();
    rules.set(d.rule, (rules.get(d.rule) ?? 0) + 1);
    counts.set(d.file, rules);
  }
  return counts;
}

export function readBaseline(root: string): Counts {
  const file = join(root, BASELINE);
  if (!existsSync(file)) return new Map();
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!validBaseline(parsed)) {
    const detail = (validBaseline.errors ?? []).map((e) => `${e.instancePath || "(root)"} ${e.message ?? ""}`);
    throw new Error(`${BASELINE} is malformed: ${detail.join("; ")}`);
  }
  return new Map(Object.entries(parsed).map(([path, rules]) => [path, new Map(Object.entries(rules))]));
}

/** Sorted by file, then rule, so a shrink shows in review as removed or lowered lines and nothing else. */
function serialize(counts: Counts): string {
  const out: BaselineFile = {};
  for (const file of [...counts.keys()].toSorted()) {
    const rules = counts.get(file) ?? new Map<string, number>();
    out[file] = Object.fromEntries([...rules.entries()].toSorted(([a], [b]) => a.localeCompare(b)));
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}

export function compare(baseline: Counts, diagnostics: readonly Diagnostic[]): RatchetResult {
  const actual = count(diagnostics);
  const over: RatchetResult["over"] = [];
  const stale: RatchetResult["stale"] = [];
  for (const [file, rules] of actual) {
    for (const [rule, n] of rules) {
      const recorded = baseline.get(file)?.get(rule) ?? 0;
      if (n > recorded) {
        const matching = diagnostics.filter((d) => d.file === file && d.rule === rule);
        over.push({ file, rule, recorded, actual: n, diagnostics: matching });
      }
    }
  }
  for (const [file, rules] of baseline) {
    for (const [rule, recorded] of rules) {
      const n = actual.get(file)?.get(rule) ?? 0;
      if (n < recorded) stale.push({ file, rule, recorded, actual: n });
    }
  }
  return { over, stale, actual };
}

export function main(argv: readonly string[]): number {
  const args = [...argv];
  const take = (flag: string): boolean => {
    const at = args.indexOf(flag);
    if (at >= 0) args.splice(at, 1);
    return at >= 0;
  };
  const rootAt = args.indexOf("--root");
  const root = rootAt >= 0 ? resolve(args.splice(rootAt, 2)[1] ?? ".") : process.cwd();
  const update = take("--update");
  const allowGrowth = take("--allow-growth");
  if (args.length === 0) {
    console.error("usage: ratchet.ts [--root <dir>] [--update [--allow-growth]] <path>...");
    return 2;
  }

  const baseline = readBaseline(root);
  const result = compare(baseline, lint(root, args));

  if (update) {
    if (result.over.length > 0 && !allowGrowth) {
      for (const o of result.over) console.error(`${o.file}: ${o.rule} ${o.recorded} -> ${o.actual}`);
      console.error("The baseline only shrinks. Fix the violations above; --allow-growth is for adopting a new rule.");
      return 1;
    }
    mkdirSync(dirname(join(root, BASELINE)), { recursive: true });
    writeFileSync(join(root, BASELINE), serialize(result.actual));
    console.log(`${BASELINE} written: ${result.stale.length} pair(s) lowered, ${result.over.length} raised.`);
    return 0;
  }

  for (const o of result.over) {
    for (const d of o.diagnostics) console.log(`${d.file}:${d.line}:${d.column} ${d.rule} ${d.message}`);
    console.log(`  ${o.file}: ${o.actual} ${o.rule}, baseline allows ${o.recorded}.`);
  }
  for (const s of result.stale) {
    console.log(`${s.file}: ${s.rule} is down to ${s.actual} from ${s.recorded}. Record it: bun run lint:baseline`);
  }
  if (result.over.length > 0 || result.stale.length > 0) return 1;
  let held = 0;
  for (const rules of result.actual.values()) for (const n of rules.values()) held += n;
  console.log(`lint: no new violations; ${held} recorded in the baseline.`);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
