/**
 * Scanner term definitions.
 *
 * This is the ONE file in the repository that is allowed to contain the denied
 * strings, because a scanner cannot check for a term it may not name. Every
 * content scan exempts SCANNER_DEFINITION_FILE from its own terms; see
 * src/validation/content.ts. Keep the terms here and nowhere else, so the
 * exemption stays a single path rather than a growing list.
 */

export type TermKind = "model-name" | "pricing" | "ladder" | "placeholder" | "local-doc-target";

export interface ScanTerm {
  /** Stable id reported in validation output. */
  id: string;
  kind: TermKind;
  /** Compiled matcher. Always global so every hit on a line is reported. */
  pattern: RegExp;
  /** A string that this term must match. Tested against the term's own pattern. */
  probe: string;
  /** True when the pattern is line-anchored, so the probe must not be prefixed. */
  anchored?: boolean;
  reason: string;
}

export const SCANNER_DEFINITION_FILE = "src/denylist.ts";

/** Word-boundary wrapper. `sol` must not fire on `solution`, `solid` or `console`. */
function word(source: string): RegExp {
  return new RegExp(`\\b${source}\\b`, "gi");
}

/** Literal wrapper for shapes whose edges are not word characters, e.g. `$/1M`. */
function shape(source: string): RegExp {
  return new RegExp(source, "gi");
}

const MODEL_NAMES: ReadonlyArray<readonly [string, string]> = [
  ["jev", "jev"],
  ["luna", "luna"],
  ["astra", "astra"],
  ["terra", "terra"],
  ["sol", "sol"],
  ["fable", "fable"],
  ["opus", "opus"],
  ["sonnet", "sonnet"],
  ["haiku", "haiku"],
];

export const DENY_TERMS: ReadonlyArray<ScanTerm> = [
  ...MODEL_NAMES.map(([id, literal], index): ScanTerm => ({
    id: `model-name-${index + 1}-${id}`,
    kind: "model-name",
    pattern: word(literal),
    probe: literal,
    reason: "Model names are stripped from this catalog (AGENTS.md, 'Model routing is stripped').",
  })),
  {
    id: "model-family-prefix",
    kind: "model-name",
    // Hyphen-terminated vendor family prefix; matches the prefix wherever it starts a token.
    pattern: shape("\\bgpt-"),
    probe: "gpt-4o",
    reason: "Provider model families are stripped from this catalog.",
  },
  {
    id: "pricing-per-million-slash",
    kind: "pricing",
    pattern: shape("\\$\\s*/\\s*1M"),
    probe: "$/1M",
    reason: "Pricing tables are out of scope (plan §2.6, AGENTS.md).",
  },
  {
    id: "pricing-per-million-words",
    kind: "pricing",
    pattern: shape("\\bper\\s+1M\\b"),
    probe: "per 1M",
    reason: "Pricing tables are out of scope (plan §2.6, AGENTS.md).",
  },
  {
    // Configuration-shaped only. Prose such as "no effort ladder appears here"
    // is a statement of the policy and must not trip the policy.
    id: "ladder-reasoning-effort",
    kind: "ladder",
    pattern: shape("\\breasoning[_ -]?effort\\b"),
    probe: "reasoning_effort: high",
    reason: "Effort ladders are replaced by evidence-based policy checks (AGENTS.md).",
  },
  {
    id: "ladder-effort-assignment",
    kind: "ladder",
    pattern: shape("\\beffort\\s*[:=]\\s*(minimal|low|medium|high|max|maximum|[0-9]+)\\b"),
    probe: "effort: high",
    reason: "Effort ladders are replaced by evidence-based policy checks (AGENTS.md).",
  },
  {
    id: "ladder-model-tier",
    kind: "ladder",
    pattern: shape("\\bmodel[_ -]?tier\\b"),
    probe: "model_tier: 2",
    reason: "Model tiers are replaced by roles the runner binds (AGENTS.md).",
  },
  {
    id: "ladder-model-assignment",
    kind: "ladder",
    pattern: shape("^\\s*-?\\s*model\\s*[:=]\\s*\\S"),
    probe: "model: some-name",
    anchored: true,
    reason: "Model selection keys do not appear in this catalog (AGENTS.md).",
  },
  {
    id: "ladder-thinking-budget",
    kind: "ladder",
    pattern: shape("\\b(thinking[_ -]?budget|max[_ -]?thinking[_ -]?tokens)\\b"),
    probe: "thinking_budget: 8000",
    reason: "In-skill token caps are replaced by runner-supplied budgets (AGENTS.md).",
  },
];

export const PLACEHOLDER_TERMS: ReadonlyArray<ScanTerm> = [
  { id: "placeholder-todo", kind: "placeholder", pattern: word("TODO"), probe: "TODO", reason: "Unfinished marker." },
  { id: "placeholder-tbd", kind: "placeholder", pattern: word("TBD"), probe: "TBD", reason: "Unfinished marker." },
  { id: "placeholder-lorem", kind: "placeholder", pattern: word("lorem"), probe: "lorem", reason: "Filler text." },
  {
    id: "placeholder-placeholder",
    kind: "placeholder",
    pattern: word("placeholder"),
    probe: "placeholder",
    reason: "Filler text.",
  },
];

/**
 * Application-local documentation write targets. ADR-0001 replaces all three
 * with central-KB equivalents; release scenario 21 tests it.
 */
export const LOCAL_DOC_TARGET_TERMS: ReadonlyArray<ScanTerm> = [
  {
    id: "local-doc-context-md",
    kind: "local-doc-target",
    pattern: shape("\\bCONTEXT\\.md\\b"),
    probe: "CONTEXT.md",
    reason: "ADR-0001 §1: replaced by the KB glossary and concept/system pages.",
  },
  {
    id: "local-doc-solutions",
    kind: "local-doc-target",
    pattern: shape("\\bdocs/solutions/"),
    probe: "docs/solutions/",
    reason: "ADR-0001 §1: replaced by KB gotcha and pattern pages.",
  },
  {
    id: "local-doc-adr",
    kind: "local-doc-target",
    pattern: shape("\\bdocs/adr/"),
    probe: "docs/adr/",
    reason: "ADR-0001 §1: replaced by KB adr pages, created proposed.",
  },
];

export interface TermHit {
  term: ScanTerm;
  /** 1-based line number. */
  line: number;
  /** The matched text. */
  text: string;
}

/** Scan text for the given terms, reporting every hit with a 1-based line number. */
export function matchTerms(text: string, terms: ReadonlyArray<ScanTerm>): TermHit[] {
  const hits: TermHit[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    for (const term of terms) {
      term.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = term.pattern.exec(line)) !== null) {
        hits.push({ term, line: i + 1, text: match[0] });
        if (match[0].length === 0) term.pattern.lastIndex += 1;
      }
    }
  }
  return hits;
}
