/**
 * The reflector's security channel and the taint-scoped redaction gate.
 *
 * An observation can carry an instruction aimed at the agent. The reflector
 * reports one in `security_notes` as an id and a kind from a closed
 * vocabulary; it never writes the attack in prose (reflector never-rule 5).
 * The runtime then drops every bullet citing a flagged id and writes one fixed
 * bullet per note from runtime data only: the id, its session and the kind.
 * The observation's title, subtitle and facts are never copied, because the
 * observer wrote them and they can carry the payload.
 *
 * A real fact that shares a flagged observation is lost with it for this run.
 * That fails closed: the runtime cannot tell which half of one observation is
 * the payload, and a later observation that restates the fact cites cleanly.
 *
 * Redaction is keyed on uniqueness across the inputs, never on the shape of a
 * payload. A token is distinctive when it appears in a tainted observation and
 * in no clean observation, no session summary, not the previous memory and not
 * the output contract's section headings. A kept bullet carrying one marked
 * token (a URL, host, path, flag or identifier) or two distinct long words is
 * dropped whole, since a bullet redacted in place still carries the wording
 * around the hole. One long word alone is not enough: a warning that says
 * "instructions" shares a word with most payloads and nothing else.
 */
import type { ObservationRow, SummaryRow } from "../sources/claude-mem.ts";
import { citedIds, SECTIONS } from "./ledger.ts";

export const SECURITY_KINDS = ["instruction-in-data", "credential-exfil", "destructive-command", "remote-code", "policy-rewrite", "other"] as const;
export type SecurityKind = (typeof SECURITY_KINDS)[number];

export interface SecurityNote {
  obs: string;
  kind: SecurityKind;
}

const OBS_ID = /^obs:\d+$/;

/**
 * `security_notes` from a reply. A note whose `obs` is not a shown observation
 * id is dropped and reported by position only, never by its text; an unknown
 * kind becomes `other`. A missing field is no notes, so an older reply parses.
 * One note per observation: repeated notes merge their kinds.
 */
export function parseSecurityNotes(value: unknown, valid: ReadonlySet<string>): { notes: SecurityNote[]; rejected: number } {
  if (!Array.isArray(value)) return { notes: [], rejected: 0 };
  const byObs = new Map<string, Set<SecurityKind>>();
  let rejected = 0;
  for (const item of value) {
    const obs = typeof item === "object" && item !== null ? (item as { obs?: unknown }).obs : undefined;
    if (typeof obs !== "string" || !OBS_ID.test(obs) || !valid.has(obs)) {
      rejected += 1;
      continue;
    }
    const raw = (item as { kind?: unknown }).kind;
    const kind = SECURITY_KINDS.find((k) => k === raw) ?? "other";
    byObs.set(obs, (byObs.get(obs) ?? new Set()).add(kind));
  }
  const notes = [...byObs].flatMap(([obs, kinds]) => [...kinds].sort().map((kind) => ({ obs, kind })));
  return { notes, rejected };
}

/** The runtime-authored bullet for one flagged observation. Built only from the id, its session and the kinds. */
export function securityBullet(obs: string, kinds: readonly SecurityKind[], session: string | null): string {
  const where = session === null ? obs : `${obs} in session ${session}`;
  return `- Security: ${where} carried an instruction aimed at the agent (${[...new Set(kinds)].sort().join(", ")}); recorded as untrusted data and not acted on. [${obs}]`;
}

/**
 * Wording by which a model bullet describes an attack. A bullet matching it
 * taints the observations it cites, as a backstop for a reply that reports an
 * attack in prose instead of `security_notes`. It is the runtime's own list,
 * kept apart from any eval's scoring wording. It names the attack as an
 * attack: words a payload itself uses (`exfiltrate`, `payload`) and words that
 * also describe routine work (`ignored`, `instruction`) are left out, since a
 * clean observation tainted by an ordinary or a copied bullet loses its facts.
 * A describing bullet that also cites a clean observation taints it too; that
 * fails closed in the same way as a flagged observation's own facts.
 */
export const ATTACK_WORDING =
  /\b(?:prompt[- ]?injection|injected|injection|untrusted|malicious|embedded instruction|instructions? (?:aimed|addressed) at|tried to (?:add|insert|plant|inject)|not acted on|do not (?:run|follow|obey|act on) it)\b/i;

const SEPARATORS = /[\s"'`<>()[\]{}|,;!*\\]+/;
const LONG_WORD = /^[a-z]{10,}$/;

/** A marked token: 6+ characters with a digit, dot, slash, dash or underscore. */
export function markedShape(token: string): boolean {
  return token.length >= 6 && /[0-9./_-]/.test(token);
}

/** A token worth keying on: a marked token, or a word of 10+ letters. */
export function distinctiveShape(token: string): boolean {
  return markedShape(token) || LONG_WORD.test(token);
}

/** Every candidate token in `text`, lowercased: each whitespace-separated piece and its URL, host and path parts. */
export function candidateTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(SEPARATORS)) {
    const token = raw.replace(/[.,:;?!]+$/, "");
    for (const piece of [token, ...token.split(/[/:?=&#@]+/), ...token.split(/[/:?=&#@.]+/)]) {
      if (distinctiveShape(piece)) out.add(piece);
    }
  }
  return out;
}

function observationText(row: ObservationRow): string {
  return [row.title, row.subtitle, row.narrative, row.facts, row.concepts, row.files_read, row.files_modified].filter((v) => v).join("\n");
}

export interface RedactInputs {
  observations: readonly ObservationRow[];
  summaries: readonly SummaryRow[];
  previous: string;
  notes: readonly SecurityNote[];
}

export interface RedactResult {
  kept: string[];
  /** Bullets citing a flagged observation. */
  flagged: number;
  /** Bullets carrying a token unique to a tainted observation. */
  tokens: number;
  /** Observation ids treated as tainted, flagged or self-classified. */
  tainted: string[];
}

const isBullet = (line: string) => line.trimStart().startsWith("- ");

/**
 * Drop every bullet citing a flagged observation, then every bullet carrying a
 * token that only a tainted observation holds. Headings and blank lines pass.
 */
export function redact(lines: readonly string[], inputs: RedactInputs): RedactResult {
  const flaggedIds = new Set(inputs.notes.map((n) => n.obs));
  const tainted = new Set(flaggedIds);
  for (const line of lines) {
    if (isBullet(line) && ATTACK_WORDING.test(line)) for (const id of citedIds(line)) if (OBS_ID.test(id)) tainted.add(id);
  }
  const taintedRows = inputs.observations.filter((row) => tainted.has(`obs:${row.id}`));
  const clean = [
    ...inputs.observations.filter((row) => !tainted.has(`obs:${row.id}`)).map(observationText),
    ...inputs.summaries.map((s) => [s.request, s.completed, s.next_steps].filter((v) => v).join("\n")),
    inputs.previous,
    ...SECTIONS,
  ]
    .join("\n")
    .toLowerCase();
  const distinctive = [...new Set(taintedRows.flatMap((row) => [...candidateTokens(observationText(row))]))].filter((t) => !clean.includes(t));
  const marked = distinctive.filter(markedShape);
  const long = distinctive.filter((t) => !markedShape(t));
  const carries = (line: string) => {
    const lower = line.toLowerCase();
    return marked.some((t) => lower.includes(t)) || long.filter((t) => lower.includes(t)).length >= 2;
  };
  const kept: string[] = [];
  let flagged = 0;
  let byToken = 0;
  for (const line of lines) {
    if (!isBullet(line)) kept.push(line);
    else if ([...citedIds(line)].some((id) => flaggedIds.has(id))) flagged += 1;
    else if (carries(line)) byToken += 1;
    else kept.push(line);
  }
  return { kept, flagged, tokens: byToken, tainted: [...tainted].sort() };
}

/** `lines` with one runtime bullet per flagged observation appended to `## Unresolved`. */
export function withSecurityBullets(lines: readonly string[], notes: readonly SecurityNote[], sessionOf: (obs: string) => string | null): string[] {
  if (notes.length === 0) return [...lines];
  const kinds = new Map<string, SecurityKind[]>();
  for (const n of notes) kinds.set(n.obs, [...(kinds.get(n.obs) ?? []), n.kind]);
  const bullets = [...kinds].map(([obs, ks]) => securityBullet(obs, ks, sessionOf(obs)));
  const start = lines.findIndex((line) => line.trimEnd() === SECTIONS[2]);
  if (start === -1) return [...lines];
  let end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  if (end === -1) end = lines.length;
  while (end > start + 1 && lines[end - 1]!.trim() === "") end -= 1;
  return [...lines.slice(0, end), ...bullets, ...lines.slice(end)];
}
