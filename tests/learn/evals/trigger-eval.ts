/**
 * Skill-routing eval: does a fresh session load the right skill for a task?
 * Manual, and it spends: every case is one host session. Not part of `bun test`.
 *
 *   bun tests/learn/evals/trigger-eval.ts [--set dev|holdout] [--arm catalog|candidate] [--jobs 6] [--json OUT] [--quiet]
 *
 * Two arms share one prompts file:
 *   catalog    the expected skill ships in this package and is installed through the host's plugin
 *   candidate  the expected skill is an unreviewed draft, reachable only through the roster block
 *
 * Candidate cases carry a `draft`. The eval renders each draft into a skills
 * ledger under a scratch config dir, builds the roster for a scratch
 * repository, and passes it to the session the way the session-start hook
 * would. The session itself runs with hooks off, so eval runs never reach
 * claude-mem or the ledgers, and it keeps the caller's own config dir.
 *
 * The session command is `AK_LEARN_EVAL_SESSION` (split like `AK_LEARN_JUDGE`), by
 * default the Claude Code CLI in print mode. Which model answers is that
 * command's binding. The command must accept `--append-system-prompt TEXT`
 * followed by the prompt as its last argument, and print stream-json.
 *
 * Scored from tool calls, never from the reply alone:
 *   loaded      the Skill tool was called with an expected name, or an expected SKILL.md / draft was read
 *   named_only  the reply names the skill without having read it (counted as a hit, reported apart)
 * The last stdout line is one JSON object: hit_rate, per-arm rates, counts.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, splitCommand } from "../../../src/learn/core/config.ts";
import type { LearnContext } from "../../../src/learn/core/context.ts";
import { renderDraft, type SkillRegistry, skillsLedger } from "../../../src/learn/skills/learn.ts";
import { rosterSection } from "../../../src/learn/skills/roster.ts";
import { cleanEnv, option, runAsync, scratchRepo } from "./session.ts";

interface Case {
  arm: "catalog" | "candidate";
  prompt: string;
  expected: string[];
  draft?: { name: string; description: string; steps: string[] };
}

interface Result extends Case {
  hit: boolean;
  loaded: boolean;
  named_only: boolean;
  skills: string[];
  reads: string[];
  reply: string;
}

const SUFFIX =
  " Do not carry out the task yet. First identify and read the skill instructions you would follow for it " +
  "(installed or otherwise), then reply with ONLY the skill name you loaded, or 'none'.";
const DEFAULT_SESSION = ["claude", "-p", "--settings", '{"disableAllHooks":true}', "--output-format", "stream-json", "--verbose", "--max-turns", "6"];

/** Seed every candidate draft into a scratch ledger and return the roster a session would see. */
function candidateRoster(cases: readonly Case[]): { roster: string; cwd: string; paths: Map<string, string> } {
  const repo = scratchRepo();
  const env = { CLAUDE_CONFIG_DIR: join(repo, "..", "config"), PATH: process.env.PATH ?? "" };
  const ctx: LearnContext = { cwd: repo, io: { out: () => {}, err: () => {} }, config: loadConfig(env), judge: () => null, env };
  const ledger = skillsLedger(ctx, repo);
  const registry: SkillRegistry = { next: 1, candidates: {}, rejected: [], seen_sessions: {} };
  const paths = new Map<string, string>();
  mkdirSync(ledger.path("candidates"), { recursive: true });
  for (const c of cases) {
    if (c.draft === undefined || paths.has(c.draft.name)) continue;
    const id = `sk-${String(registry.next).padStart(3, "0")}`;
    registry.next += 1;
    const draft = { ...c.draft, scope: "global", intent: c.draft.description, guardrails: [], evidence: [], confidence: "medium" };
    writeFileSync(ledger.path("candidates", `${id}.md`), renderDraft(draft, id, "2026-01-01"));
    registry.candidates[id] = { name: c.draft.name, description: c.draft.description, scope: "global", status: "candidate", created: "2026-01-01", evidence: 0, confidence: "medium", uses: 0 };
    paths.set(c.draft.name, ledger.path("candidates", `${id}.md`));
  }
  writeFileSync(ledger.path("registry.json"), JSON.stringify(registry, null, 1));
  return { roster: rosterSection(ctx, repo), cwd: repo, paths };
}

async function runOne(c: Case, session: string[], roster: string, cwd: string, paths: Map<string, string>): Promise<Result> {
  const cmd = [...session, ...(roster === "" ? [] : ["--append-system-prompt", roster]), c.prompt + SUFFIX];
  const result = await runAsync(cmd, { cwd, env: cleanEnv(), timeoutMs: 300_000 });
  const skills: string[] = [];
  const reads: string[] = [];
  let reply = result.timedOut ? "TIMEOUT" : "";
  for (const line of result.stdout.split("\n")) {
    let event: { type?: string; message?: { content?: Array<{ type?: string; name?: string; input?: Record<string, unknown> }> }; result?: string };
    try {
      event = JSON.parse(line) as typeof event;
    } catch {
      continue;
    }
    if (event.type === "assistant") {
      for (const part of event.message?.content ?? []) {
        if (part.type !== "tool_use") continue;
        const input = part.input ?? {};
        if (part.name === "Skill" && typeof input.skill === "string") skills.push(input.skill);
        reads.push(...(JSON.stringify(input).match(/[\w./~-]*(?:SKILL\.md|candidates\/sk-\d+\.md)/g) ?? []));
      }
    } else if (event.type === "result") {
      reply = (event.result ?? "").trim();
    }
  }
  const expected = new Set(c.expected);
  const draftPaths = c.expected.map((name) => paths.get(name)).filter((p): p is string => p !== undefined);
  const loaded =
    skills.some((s) => expected.has(s.split(":").at(-1)!)) ||
    reads.some((p) => c.expected.some((e) => p.includes(`/${e}/SKILL.md`)) || draftPaths.some((d) => d.endsWith(p) || p.endsWith(d)));
  const answer = reply.replace(/^[`*.\s]+|[`*.\s]+$/g, "");
  const named = reply.length < 80 && c.expected.some((e) => new RegExp(`^[\\w:/-]*${e.replace(/[-]/g, "\\-")}\\b`).test(answer));
  return { ...c, hit: loaded || named, loaded, named_only: named && !loaded, skills, reads: [...new Set(reads)].sort(), reply: reply.slice(0, 140) };
}

async function main(argv: string[]): Promise<number> {
  const set = option(argv, "--set") ?? "dev";
  const arm = option(argv, "--arm");
  const jobs = Number.parseInt(option(argv, "--jobs") ?? "6", 10);
  const session = process.env.AK_LEARN_EVAL_SESSION ? splitCommand(process.env.AK_LEARN_EVAL_SESSION) : DEFAULT_SESSION;
  let cases = JSON.parse(readFileSync(join(import.meta.dir, "prompts", `${set}.json`), "utf8")) as Case[];
  if (arm !== undefined) cases = cases.filter((c) => c.arm === arm);
  const { roster, cwd, paths } = candidateRoster(cases);

  const results: Result[] = new Array(cases.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, jobs) }, async () => {
      while (next < cases.length) {
        const i = next++;
        results[i] = await runOne(cases[i]!, session, roster, cwd, paths);
      }
    }),
  );

  const rate = (hits: number, n: number) => (n === 0 ? 0 : Math.round((hits / n) * 10_000) / 10_000);
  const summary: Record<string, unknown> = {
    set,
    roster_tokens: Math.floor(roster.length / 4),
    n: results.length,
    hits: results.filter((r) => r.hit).length,
    loaded: results.filter((r) => r.loaded).length,
    named_only: results.filter((r) => r.named_only).length,
  };
  summary.hit_rate = rate(summary.hits as number, results.length);
  const armRates: number[] = [];
  for (const name of ["catalog", "candidate"] as const) {
    const sub = results.filter((r) => r.arm === name);
    const hits = sub.filter((r) => r.hit).length;
    summary[`${name}_n`] = sub.length;
    summary[`${name}_hits`] = hits;
    summary[`${name}_rate`] = rate(hits, sub.length);
    if (sub.length > 0) armRates.push(rate(hits, sub.length));
  }
  summary.worst_arm_rate = armRates.length === 0 ? 0 : Math.min(...armRates);
  summary.misses = results.filter((r) => !r.hit).map((r) => r.prompt.slice(0, 60));
  if (!argv.includes("--quiet")) {
    for (const r of results.filter((x) => !x.hit)) {
      console.log(`[MISS ${r.arm}] ${r.prompt.slice(0, 72)}`);
      console.log(`    expected=${JSON.stringify(r.expected)} skills=${JSON.stringify(r.skills)} reads=${JSON.stringify(r.reads)}`);
      console.log(`    reply=${JSON.stringify(r.reply)}`);
    }
  }
  const out = option(argv, "--json");
  if (out !== undefined) writeFileSync(out, JSON.stringify({ summary, results }, null, 1));
  console.log(JSON.stringify(summary));
  return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
