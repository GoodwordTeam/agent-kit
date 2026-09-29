/**
 * A private host home for one session: the caller's credentials file copied in, the bundle's
 * skills copied in, nothing else. Not a test file.
 *
 * A host may refresh its login during the session and rotate the refresh token, which would leave
 * the caller's own copy stale. `release` writes a changed credentials file back, but only when the
 * caller's copy is still the one that was copied, so a concurrent refresh elsewhere is never
 * overwritten.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Home {
  dir: string;
  release(): void;
}

export function privateHome(
  dir: string,
  credentials: string | undefined,
  skillsFrom: string | undefined,
  skillsTo: string,
): Home {
  mkdirSync(join(dir, skillsTo), { recursive: true });
  let original: string | undefined;
  const copy = join(dir, "auth.json");
  if (credentials !== undefined && existsSync(credentials)) {
    original = readFileSync(credentials, "utf8");
    writeFileSync(copy, original, { mode: 0o600 });
  }
  if (skillsFrom !== undefined && existsSync(skillsFrom)) {
    for (const id of readdirSync(skillsFrom))
      cpSync(join(skillsFrom, id), join(dir, skillsTo, id), { recursive: true });
  }
  return {
    dir,
    release() {
      if (credentials === undefined || original === undefined || !existsSync(copy)) return;
      const after = readFileSync(copy, "utf8");
      if (after !== original && readFileSync(credentials, "utf8") === original)
        writeFileSync(credentials, after, { mode: 0o600 });
    },
  };
}
