import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Directories never walked: generated, vendored or scratch. */
const DEFAULT_SKIP = new Set([".git", "node_modules", ".donors", ".work", ".omc", ".DS_Store"]);

export function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

export function exists(path: string): boolean {
  return existsSync(path);
}

export function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function readTextIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** Recursively list files under `root/rel`, returned as root-relative POSIX paths, sorted. */
export function walkFiles(root: string, rel: string, skip: ReadonlySet<string> = DEFAULT_SKIP): string[] {
  const start = rel === "." ? root : join(root, rel);
  if (!isDir(start)) return [];
  const out: string[] = [];
  const stack = [start];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (skip.has(name)) continue;
      const full = join(dir, name);
      if (isDir(full)) stack.push(full);
      else out.push(toPosix(relative(root, full)));
    }
  }
  return out.sort();
}

/** Immediate subdirectory names, sorted. Empty when the path is not a directory. */
export function listDirs(path: string): string[] {
  if (!isDir(path)) return [];
  return readdirSync(path)
    .filter((name) => !DEFAULT_SKIP.has(name) && isDir(join(path, name)))
    .sort();
}

/** Immediate file names, sorted. */
export function listFiles(path: string): string[] {
  if (!isDir(path)) return [];
  return readdirSync(path)
    .filter((name) => !DEFAULT_SKIP.has(name) && !isDir(join(path, name)))
    .sort();
}
