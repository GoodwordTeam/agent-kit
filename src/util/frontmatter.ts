import { parse as parseYaml } from "yaml";

export interface Frontmatter {
  present: boolean;
  data: Record<string, unknown>;
  /** Body text after the closing delimiter. */
  body: string;
  /** 1-based line number the body starts on. 1 when there is no frontmatter. */
  bodyStartLine: number;
  /** 1-based file line of each top-level frontmatter key, for precise reporting. */
  keyLines: Record<string, number>;
  error?: string;
}

const DELIMITER = /^---\s*$/;

/** Split Agent Skills frontmatter from a markdown body without throwing on bad YAML. */
export function parseFrontmatter(text: string): Frontmatter {
  const lines = text.split("\n");
  if (lines.length === 0 || !DELIMITER.test(lines[0] ?? "")) {
    return { present: false, data: {}, body: text, bodyStartLine: 1, keyLines: {} };
  }
  let close = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (DELIMITER.test(lines[i] ?? "")) {
      close = i;
      break;
    }
  }
  if (close === -1) {
    return {
      present: true,
      data: {},
      body: text,
      bodyStartLine: 1,
      keyLines: {},
      error: "unterminated frontmatter block",
    };
  }

  const raw = lines.slice(1, close).join("\n");
  const keyLines: Record<string, number> = {};
  for (let i = 1; i < close; i += 1) {
    const match = /^([A-Za-z0-9_][A-Za-z0-9_-]*)\s*:/.exec(lines[i] ?? "");
    if (match?.[1] !== undefined && keyLines[match[1]] === undefined) keyLines[match[1]] = i + 1;
  }

  const body = lines.slice(close + 1).join("\n");
  const bodyStartLine = close + 2;

  let data: Record<string, unknown> = {};
  let error: string | undefined;
  try {
    const parsed = parseYaml(raw) as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    } else if (parsed !== null && parsed !== undefined) {
      error = "frontmatter is not a mapping";
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }

  return { present: true, data, body, bodyStartLine, keyLines, error };
}
