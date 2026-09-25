/**
 * Judgement eval for skill-learn discovery. Manual, and it spends: two judge
 * calls through the configured judge command (`AK_LEARN_JUDGE`, or the
 * runtime's default). Not part of `bun test`.
 *
 *   bun tests/learn/evals/skill-learn-eval.ts
 *
 * Case A: three sessions ask for the same workflow in different words, three
 * ask for unrelated things. Expect exactly one candidate, about the review
 * bot, with evidence from at least three sessions.
 * Case B: the same sessions, but the whole workflow (retrigger, wait, mark
 * ready) is already an installed skill. Expect zero candidates.
 *
 * Each case runs against a scratch config dir and a scratch repository, so
 * nothing reaches the caller's ledgers. Only the judge sees the caller's
 * environment. Exit status 0 when both cases pass.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../../../src/learn/core/config.ts";
import type { LearnContext } from "../../../src/learn/core/context.ts";
import { commandJudge } from "../../../src/learn/core/judge.ts";
import { projectFolderName } from "../../../src/learn/core/paths.ts";
import { discover, loadRegistry, skillsLedger } from "../../../src/learn/skills/learn.ts";
import { scratchRepo } from "./session.ts";

const WORKFLOW: Array<[string, string[]]> = [
  ["s1000001", ["ask the review bot to re-review PR 1873, its review is stale on an old commit", "poll gh pr checks until the new bot score lands", "ok it is 5/5 now, mark it ready"]],
  ["s2000002", ["the bot review on #1882 is pinned to the previous sha, retrigger it and wait for 5/5", "good, now flip the PR out of draft"]],
  ["s3000003", ["re-request the bot review on 1874 at the current head and tell me when its confidence is back to 5", "then run gh pr ready"]],
];
const NOISE: Array<[string, string[]]> = [
  ["s4000004", ["why does the settings page 404 in the worktree?", "check the org id column for the bypass org"]],
  ["s5000005", ["write an ADR for the calendar writeback lock", "shorter please, 20 lines"]],
  ["s6000006", ["what did we decide about the notification allowlist last week?", "and who owns that decision now?"]],
];
const INSTALLED_WORKFLOW =
  "Re-request a stale review-bot review at the current head, poll gh pr checks until the score is back to 5/5, then take the PR " +
  "out of draft with gh pr ready. Use when the bot review is stale or before marking a PR ready.";

function runCase(installed: string | null): { summary: string; ctx: LearnContext; repo: string } {
  const repo = scratchRepo();
  const config = join(repo, "..", "config");
  const env = { CLAUDE_CONFIG_DIR: config, AK_LEARN_MEM_DB: join(config, "absent.db"), PATH: process.env.PATH ?? "" };
  const ctx: LearnContext = {
    cwd: repo,
    io: { out: (line) => console.log(line), err: (line) => console.error(line) },
    config: loadConfig(env),
    judge: commandJudge(loadConfig(process.env)),
    env,
  };
  const transcripts = join(config, "projects", projectFolderName(repo));
  mkdirSync(transcripts, { recursive: true });
  for (const [sid, messages] of [...WORKFLOW, ...NOISE]) {
    const lines = messages.map((content) => JSON.stringify({ type: "user", message: { role: "user", content } }));
    writeFileSync(join(transcripts, `${sid}.jsonl`), `${lines.join("\n")}\n`);
  }
  if (installed !== null) {
    mkdirSync(join(config, "skills", "bot-rereview-and-ready"), { recursive: true });
    writeFileSync(join(config, "skills", "bot-rereview-and-ready", "SKILL.md"), `---\nname: bot-rereview-and-ready\ndescription: ${installed}\n---\n`);
  }
  const catalog = join(repo, "..", "catalog");
  mkdirSync(catalog);
  writeFileSync(join(catalog, "catalog.yaml"), "schema_version: 1\n");
  return { summary: discover(ctx, repo, { packageRoot: catalog }), ctx, repo };
}

function main(): number {
  let ok = true;

  const a = runCase(null);
  console.log(`A: ${a.summary}`);
  const ledgerA = skillsLedger(a.ctx, a.repo);
  const candidatesA = Object.entries(loadRegistry(ledgerA).candidates);
  const [id, info] = candidatesA[0] ?? [];
  const aOk = candidatesA.length === 1 && info !== undefined && info.evidence >= 3 && /bot|review/.test(info.name);
  if (id !== undefined && info !== undefined) {
    console.log(`   ${id} ${info.name} scope=${info.scope} evidence=${info.evidence} confidence=${info.confidence}`);
    console.log(readFileSync(ledgerA.path("candidates", `${id}.md`), "utf8").slice(0, 500));
  }
  console.log(`A ${aOk ? "PASS" : "FAIL"} (expect exactly one review-bot candidate with evidence from >=3 sessions; scope may be project or global)`);
  ok &&= aOk;

  const b = runCase(INSTALLED_WORKFLOW);
  console.log(`B: ${b.summary}`);
  const candidatesB = Object.values(loadRegistry(skillsLedger(b.ctx, b.repo)).candidates);
  const bOk = candidatesB.length === 0 && b.summary.startsWith("analysed");
  console.log(`B ${bOk ? "PASS" : "FAIL"} (expect zero; got ${JSON.stringify(candidatesB.map((c) => c.name))})`);
  ok &&= bOk;

  return ok ? 0 : 1;
}

if (import.meta.main) process.exit(main());
