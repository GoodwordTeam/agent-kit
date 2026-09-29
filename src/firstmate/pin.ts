/**
 * Pinning a built bundle by content hash, so that upgrading the kit never
 * changes the instructions of a task already bound (CONTRACT.md §5).
 *
 * The hash is over every file's relative path and content digest, in sorted
 * order. A pin directory that already exists is re-hashed before it is trusted:
 * a pin whose contents no longer match its name is refused, not reused.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function files(dir: string, root = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full, root));
    else out.push(relative(root, full));
  }
  return out;
}

export function treeHash(dir: string): string {
  const outer = createHash("sha256");
  for (const rel of files(dir).sort()) {
    const inner = createHash("sha256")
      .update(readFileSync(join(dir, rel)))
      .digest("hex");
    outer.update(`${rel}\0${inner}\n`);
  }
  return outer.digest("hex");
}

export interface Pin {
  hash: string;
  path: string;
}

function trusted(path: string, hex: string): Pin | string {
  const found = treeHash(path);
  if (found !== hex)
    return `pin ${path} holds content hashing to ${found}; refusing a pin whose contents do not match its name`;
  return { hash: `sha256:${hex}`, path };
}

export function pinBundle(bundleDir: string, pinsDir: string): Pin | string {
  const hex = treeHash(bundleDir);
  const path = join(pinsDir, hex);
  if (existsSync(path)) return trusted(path, hex);
  mkdirSync(pinsDir, { recursive: true });
  const staging = `${path}.partial-${process.pid}`;
  rmSync(staging, { recursive: true, force: true });
  cpSync(bundleDir, staging, { recursive: true });
  try {
    renameSync(staging, path);
  } catch (e) {
    if (!existsSync(path)) return `could not pin ${bundleDir} at ${path}: ${(e as Error).message}`;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  return trusted(path, hex);
}
