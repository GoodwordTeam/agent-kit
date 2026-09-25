/**
 * The review loop's share of the session-start block: deployed guardrail
 * bullets plus one trend line. Reads files only; never creates a ledger and
 * never spawns git, because it runs on every session start.
 */
import { existsSync } from "node:fs";
import type { LearnContext } from "../core/context.ts";
import { Ledger } from "../core/ledger.ts";
import { readText } from "../core/store.ts";
import { reviewLedgerDir } from "./ledger.ts";
import { loadPatterns, num, runRows, str } from "./patterns.ts";

/** Bullets shown at most, unless `AK_LEARN_GUARDRAILS_SHOWN` says otherwise. The rest stay in `guardrails.md`. */
export const DEFAULT_SHOWN = 10;

const BULLET_ID = /^- \[(rp-\d+)\]/;

/** Keep the `cap` bullets whose pattern recurred most recently, then most often; the survivors keep file order. */
export function topRecent(bullets: readonly string[], ledger: Ledger, cap: number): string[] {
  if (bullets.length <= cap) return [...bullets];
  const rank = new Map<string, [string, number]>();
  for (const pattern of loadPatterns(ledger).values()) rank.set(pattern.id, [str(pattern.meta, "last_seen"), num(pattern.meta, "count")]);
  const key = (bullet: string): [string, number] => rank.get(BULLET_ID.exec(bullet)?.[1] ?? "") ?? ["", 0];
  const ranked = [...bullets].sort((a, b) => {
    const [ka, kb] = [key(a), key(b)];
    if (ka[0] !== kb[0]) return ka[0] < kb[0] ? 1 : -1;
    return kb[1] - ka[1];
  });
  const keep = new Set(ranked.slice(0, cap));
  return bullets.filter((bullet) => keep.has(bullet));
}

/** The guardrails block for a project root, or an empty string when the ledger has no guardrail. */
export function guardrailsSection(ctx: LearnContext, root: string): string {
  const ledger = new Ledger(reviewLedgerDir(ctx.config, root));
  if (!existsSync(ledger.path("index.md"))) return "";
  const bullets = readText(ledger.path("guardrails.md"))
    .split("\n")
    .filter((line) => line.startsWith("- ["));
  if (bullets.length === 0) return "";

  const parsed = Number.parseInt(ctx.env.AK_LEARN_GUARDRAILS_SHOWN ?? "", 10);
  const cap = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SHOWN;
  const shown = topRecent(bullets, ledger, cap);
  const lines = ["Review guardrails (recurring review findings in this repo; check the diff against these before asking for review):", ...shown];
  if (bullets.length > shown.length) {
    lines.push(`(+${bullets.length - shown.length} more in ${ledger.path("guardrails.md")}; full pattern list in ${ledger.path("index.md")})`);
  }

  const index = readText(ledger.path("index.md"));
  const rates = runRows(ledger)
    .slice(-5)
    .map((row) => {
      const cells = row.split("|");
      return (cells[cells.length - 2] ?? "").trim();
    });
  const patternCount = (index.match(/^\| rp-\d+ \|/gm) ?? []).length;
  const pending = (readText(ledger.path("pending-team-promotions.md")).match(/^applied: *$/gm) ?? []).length;
  const trend = rates.length > 1 ? `${rates[0]}→${rates[rates.length - 1]}` : (rates[0] ?? "n/a");
  lines.push(
    `Review patterns: ${patternCount} · repeat rate over the last ${rates.length} runs ${trend} · ` +
      `${pending} team promotions pending (\`ak learn review promote\`)`,
  );
  return `${lines.join("\n")}\n`;
}
