/**
 * Wiki pages: a flat `key: value` frontmatter block and a markdown body, plus
 * the exact-string patch operations the judge may request against a body.
 *
 * The frontmatter is deliberately not YAML. Values are scalars, integers or
 * `[a, b]` lists, which is all a pattern or lesson page carries, and a format
 * this small cannot be coaxed into executing anything.
 *
 * Values often come from the judge, so rendering is where the format is
 * defended: a value can never end its line (newlines are folded to spaces) and a
 * list item can never end its list (`,`, `[` and `]` are dropped). Parsing keeps
 * the first occurrence of a key, so no later line can override a runtime-owned
 * field such as `count`, `status` or `id`.
 */

export type PageValue = string | number | string[] | null;
export type PageMeta = Record<string, PageValue>;

const FM = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export function parsePage(text: string): { meta: PageMeta; body: string } {
  const match = FM.exec(text);
  if (match === null) return { meta: {}, body: text };
  const meta: PageMeta = {};
  for (const line of match[1]!.split("\n")) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    if (key in meta) continue;
    const raw = line.slice(colon + 1).trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      meta[key] = raw
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "");
    } else if (/^\d+$/.test(raw)) {
      meta[key] = Number.parseInt(raw, 10);
    } else {
      meta[key] = raw;
    }
  }
  return { meta, body: match[2]! };
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function renderPage(meta: PageMeta, body: string): string {
  const lines = Object.entries(meta).map(([key, value]) => {
    const name = oneLine(key).replace(/:/g, "");
    if (Array.isArray(value))
      return `${name}: [${value.map((item) => oneLine(item).replace(/[,[\]]/g, "")).join(", ")}]`;
    return `${name}: ${value === null ? "" : oneLine(String(value))}`;
  });
  return `---\n${lines.join("\n")}\n---\n${body}`;
}

export type PatchOp = "append" | "replace" | "insert_after";

/** Exact-string patch. `append` ignores the target; `replace` and `insert_after` need it present. */
export function patchBody(body: string, op: PatchOp, target: string, text: string): string {
  if (op === "append") return `${body.replace(/\n+$/, "")}\n${text.replace(/\n+$/, "")}\n`;
  if (!body.includes(target)) throw new Error(`target not found for ${op}: ${JSON.stringify(target.slice(0, 60))}`);
  if (op === "replace") return body.replace(target, () => text);
  if (op === "insert_after") return body.replace(target, () => `${target}\n${text}`);
  throw new Error(`unknown op ${String(op)}`);
}
