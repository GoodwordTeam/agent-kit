/**
 * config/agent-kit.env: KEY=VALUE lines that Firstmate parses and never
 * sources, so no line in it is ever executed. The same reading applies here.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ENV_FILE, EVIDENCE_FILE, type Evidence } from "./constants.ts";

export function parseEnv(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    out.set(line.slice(0, eq), line.slice(eq + 1));
  }
  return out;
}

/** Both files install writes, merged; the evidence keys live only in EVIDENCE_FILE. */
export function readHomeEnv(fmHome: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const rel of [ENV_FILE, EVIDENCE_FILE]) {
    const file = join(fmHome, rel);
    if (existsSync(file)) for (const [k, v] of parseEnv(readFileSync(file, "utf8"))) out.set(k, v);
  }
  return out;
}

/** The evidence store the home was installed with, or undefined when it names none. */
export function evidenceFromEnv(env: Map<string, string>): Evidence | undefined {
  const store = env.get("AK_FIRSTMATE_EVIDENCE");
  const location = env.get("AK_FIRSTMATE_EVIDENCE_LOCATION");
  if ((store !== "mock" && store !== "kb") || location === undefined || location === "") return undefined;
  return { store, location };
}
