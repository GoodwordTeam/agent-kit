/**
 * Small file helpers for ledger state: JSON, JSON Lines, timestamps, token estimate.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function nowIso(date: Date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** UTC calendar date, `YYYY-MM-DD`. */
export function todayUtc(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Local calendar date, `YYYY-MM-DD`. The nightly job keys on the machine's own day. */
export function todayLocal(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function nowMs(): number {
  return Date.now();
}

/** Coarse token estimate: four characters per token. Good enough for a cap, never for billing. */
export function tokens(text: string): number {
  return Math.floor(text.length / 4);
}

export function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 1));
}

export function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.trim() !== "") out.push(JSON.parse(line) as T);
  }
  return out;
}

export function writeJsonl(path: string, rows: readonly unknown[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, rows.map((row) => `${JSON.stringify(row)}\n`).join(""));
}

export function appendJsonl(path: string, rows: readonly unknown[]): void {
  if (rows.length === 0) return;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, rows.map((row) => `${JSON.stringify(row)}\n`).join(""));
}

export function readText(path: string, fallback = ""): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return fallback;
  }
}
