import { posix } from "node:path";

export interface RelativeLink {
  /** Target as written, with any anchor stripped. */
  target: string;
  anchor?: string;
  /** 1-based line in the containing file. */
  line: number;
  /** The exact source text that produced this link, for rewriting. */
  raw: string;
}

/** `](target)` — a markdown inline link or image. */
const MD_LINK = /\]\(\s*([^)\s]+?)\s*\)/g;

/** A relative path written inside inline code, e.g. `../../protocols/tdd/PROTOCOL.md`. */
const CODE_PATH = /`(\.{1,2}\/[^`\s]+?\.(?:md|ya?ml|json|txt))`/g;

function isRelative(target: string): boolean {
  if (target.startsWith("./") || target.startsWith("../")) return true;
  return false;
}

/**
 * Relative references a bundle must still resolve. Absolute URLs, anchors,
 * mail links and root-absolute paths are out of scope: none of them is a
 * repository file the packager could copy.
 */
export function extractRelativeLinks(text: string): RelativeLink[] {
  const lines = text.split("\n");
  const out: RelativeLink[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const candidates: Array<{ target: string; raw: string }> = [];

    MD_LINK.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MD_LINK.exec(line)) !== null) {
      if (m[1] !== undefined) candidates.push({ target: m[1], raw: m[0] });
    }
    CODE_PATH.lastIndex = 0;
    while ((m = CODE_PATH.exec(line)) !== null) {
      if (m[1] !== undefined) candidates.push({ target: m[1], raw: m[0] });
    }

    for (const { target, raw } of candidates) {
      if (!isRelative(target)) continue;
      const hashAt = target.indexOf("#");
      const path = hashAt === -1 ? target : target.slice(0, hashAt);
      const anchor = hashAt === -1 ? undefined : target.slice(hashAt + 1);
      if (path.length === 0) continue;
      const key = `${i}:${path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(anchor === undefined ? { target: path, line: i + 1, raw } : { target: path, anchor, line: i + 1, raw });
    }
  }

  return out;
}

/** Resolve a relative target against the referencing file. Null when it escapes the tree. */
export function resolveFromFile(file: string, target: string): string | null {
  const resolved = posix.normalize(posix.join(posix.dirname(file), target));
  if (resolved.startsWith("../") || resolved === ".." || posix.isAbsolute(resolved)) return null;
  return resolved.replace(/\/$/, "");
}

/** Relative path from one file's directory to another file. Always `./`- or `../`-prefixed. */
export function relativeLinkBetween(fromFile: string, toFile: string): string {
  const rel = posix.relative(posix.dirname(fromFile), toFile);
  return rel.startsWith(".") ? rel : `./${rel}`;
}
