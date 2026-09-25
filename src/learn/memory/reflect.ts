/**
 * The reflector: the previous `memory.md` plus new claude-mem observations
 * become a rewritten `memory.md`. One judge call (role `reflector`), then
 * deterministic gates: provenance (every bullet cites an input id), the
 * degenerate-output guards, and the token cap.
 *
 * The first reflect on a cold ledger reads the newest observations that fit
 * and sets the watermark past everything older, so memory starts from the
 * present rather than replaying history. A rejected or failed attempt still
 * sets `last_reflect`, so one bad reply cannot re-fire on every tick.
 */
import { existsSync, writeFileSync } from "node:fs";
import type { LearnContext } from "../core/context.ts";
import type { Ledger } from "../core/ledger.ts";
import { buildPrompt } from "../core/roles.ts";
import { nowMs, readText, todayLocal, tokens } from "../core/store.ts";
import type { ClaudeMemSource, ObservationRow, SummaryRow } from "../sources/claude-mem.ts";
import { appendRun, citedIds, logLine, provenanceGate, readState, saveState, SECTIONS, sid8, splitLines } from "./ledger.ts";

export const INPUT_CHARS = 60_000;

/** Observation id, time, type, session, title, subtitle, and facts cut at 600 characters. */
export function formatObservation(row: ObservationRow): string {
  const facts = (row.facts ?? "").trim();
  const bits = [`obs:${row.id} ${row.created_at.slice(0, 16)} [${row.type}] ${sid8(row.memory_session_id)}`, `  ${row.title ?? ""}`];
  if (row.subtitle) bits.push(`  ${row.subtitle}`);
  if (facts !== "") bits.push(`  facts: ${facts.slice(0, 600)}`);
  return `${bits.join("\n")}\n`;
}

/** Observations after the watermark, under the input cap. A zero watermark fills from the newest. Returned oldest first. */
export function fetchNew(source: ClaudeMemSource, memProject: string, watermark: number, inputChars = INPUT_CHARS): ObservationRow[] {
  const rows = source.observationsSince(memProject, watermark, { newestFirst: watermark === 0 });
  const out: ObservationRow[] = [];
  let used = 0;
  for (const row of rows) {
    const line = formatObservation(row);
    if (used + line.length > inputChars && out.length > 0) break;
    used += line.length;
    out.push(row);
  }
  return out.sort((a, b) => a.id - b.id);
}

export function formatSummaries(rows: readonly SummaryRow[]): string {
  if (rows.length === 0) return "(none)";
  return rows
    .map(
      (row) =>
        `${sid8(row.memory_session_id)}\n  request: ${row.request ?? ""}\n  completed: ${row.completed ?? ""}\n  next: ${row.next_steps ?? ""}`,
    )
    .join("\n");
}

export function outputContract(cap: number, today: string): string {
  return [
    'Reply with `{"memory": "<the full markdown>"}`.',
    `The markdown has exactly these sections, in this order, each a header followed by "- " bullets (a section may be empty):`,
    SECTIONS.join("\n"),
    "Every bullet ends with its evidence ids in brackets, copied verbatim from the inputs: [obs:123, obs:456] or [S1a2b3c4d].",
    "Any other line is deleted, as is a bullet citing no id or any id not in the inputs or the previous memory; a reply that loses more than half its lines that way is rejected.",
    `Today is ${today}. Total output at most ${cap} tokens (about ${cap * 4} characters); a reply over ${Math.floor(cap * 1.3)} tokens is rejected.`,
  ].join("\n");
}

export function reflectPrompt(
  ctx: LearnContext,
  previous: string,
  observations: readonly ObservationRow[],
  summaries: readonly SummaryRow[],
  today = todayLocal(),
): string {
  return buildPrompt(
    "reflector",
    outputContract(ctx.config.memoryTokens, today),
    [
      { title: "Previous memory", body: previous.trim() || "(empty)" },
      { title: "New session summaries", body: formatSummaries(summaries) },
      { title: "New observations (oldest first)", body: observations.map(formatObservation).join("") || "(none)" },
    ],
    ctx.env,
  );
}

/** Why a reflected memory is unusable, or null. */
export function degenerate(text: string, previous: string, inputTokens: number, cap: number): string | null {
  if (tokens(text) > 1.3 * cap) return "over cap";
  const lines = splitLines(text)
    .filter((line) => line.trim() !== "" && !line.startsWith("#"))
    .map((line) => line.trim());
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
  if ([...counts.values()].some((count) => count >= 3)) return "repeated lines";
  if (previous.trim() !== "" && text.length < 0.3 * previous.length && inputTokens < 5000) return "collapsed";
  const missing = SECTIONS.filter((section) => !text.includes(section));
  if (missing.length > 0) return `missing sections [${missing.map((section) => `'${section}'`).join(", ")}]`;
  return null;
}

/** Record an attempt for scheduling without advancing the observation watermark. */
function markAttempt(ledger: Ledger): void {
  saveState(ledger, { ...readState(ledger), last_reflect: nowMs() });
}

export interface ReflectResult {
  ok: boolean;
  reason: string | null;
  dropped: number;
}

/** Gate, guard, then write `memory.md`, bump the watermark and commit. */
export function applyReflection(
  ledger: Ledger,
  newText: string,
  valid: ReadonlySet<string>,
  inputTokens: number,
  maxObsId: number,
  cap: number,
  meta: Record<string, unknown> = {},
): ReflectResult {
  const memoryPath = ledger.path("memory.md");
  const previous = existsSync(memoryPath) ? readText(memoryPath) : "";
  const allowed = new Set([...valid, ...citedIds(previous)]);
  const { kept, dropped, candidates } = provenanceGate(splitLines(newText), allowed);
  const text = `${kept.join("\n").trim()}\n`;
  let reason = degenerate(text, previous, inputTokens, cap);
  // A gutted memory is worse than a stale one.
  if (reason === null && candidates > 0 && dropped > candidates / 2) reason = `provenance dropped ${dropped}/${candidates} lines`;
  if (reason !== null) {
    markAttempt(ledger);
    appendRun(ledger, { job: "reflect", status: "rejected", reason, dropped_by_provenance: dropped, ...meta });
    logLine(ledger, `reflect rejected: ${reason}`);
    ledger.commit(`reflect rejected: ${reason}`);
    return { ok: false, reason, dropped };
  }
  writeFileSync(memoryPath, text);
  const state = readState(ledger);
  saveState(ledger, { ...state, last_obs_id_reflected: Math.max(state.last_obs_id_reflected ?? 0, maxObsId), last_reflect: nowMs() });
  appendRun(ledger, {
    job: "reflect",
    status: "ok",
    dropped_by_provenance: dropped,
    tokens_out: tokens(text),
    tokens_in: inputTokens,
    max_obs_id: maxObsId,
    ...meta,
  });
  logLine(ledger, `reflect ok: ${tokens(text)} tokens, ${dropped} bullets dropped by provenance, watermark obs:${maxObsId}`);
  ledger.commit(`reflect: watermark obs:${maxObsId}`);
  return { ok: true, reason: null, dropped };
}

export function reflect(ctx: LearnContext, source: ClaudeMemSource, ledger: Ledger, memProject: string, trigger = "tick"): string {
  const watermark = readState(ledger).last_obs_id_reflected ?? 0;
  const observations = fetchNew(source, memProject, watermark);
  if (observations.length === 0) return "reflect: nothing new";
  const sids = [...new Set(observations.map((row) => row.memory_session_id))].sort();
  const previous = readText(ledger.path("memory.md"));
  const prompt = reflectPrompt(ctx, previous, observations, source.summaries(sids));
  if (ctx.config.dryRun) {
    ctx.io.out(prompt);
    return `reflect: dry run (${observations.length} observations, ${tokens(prompt)} prompt tokens)`;
  }
  const reply = ctx.judge(prompt);
  const text = reply?.memory;
  if (typeof text !== "string" || text.trim() === "") {
    markAttempt(ledger);
    appendRun(ledger, { job: "reflect", status: "failed", reason: "no judge output", trigger });
    logLine(ledger, "reflect failed: no judge output");
    ledger.commit("reflect failed: no judge output");
    return "reflect: judge call failed";
  }
  const valid = new Set([...observations.map((row) => `obs:${row.id}`), ...sids.map(sid8)]);
  const inputTokens = tokens(observations.map(formatObservation).join(""));
  const maxObsId = Math.max(...observations.map((row) => row.id));
  const result = applyReflection(ledger, text, valid, inputTokens, maxObsId, ctx.config.memoryTokens, {
    trigger,
    observations: observations.length,
    sessions: sids.length,
  });
  return `reflect: ${result.ok ? "ok" : `rejected: ${result.reason}`} (${observations.length} obs, ${result.dropped} dropped)`;
}
