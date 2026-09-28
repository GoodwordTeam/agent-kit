/**
 * `ak learn setup uninstall` — remove this runtime's hook entries, scheduler
 * unit and claude-mem budget. Foreign hooks are untouched, and the ledgers are
 * kept: they are the user's data, removed only with `--purge`.
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { LearnContext } from "../core/context.ts";
import { readJson } from "../core/store.ts";
import { LABEL, schedulerKind, unitPaths } from "./schedule.ts";
import {
  CONTEXT_OBSERVATIONS,
  claudeSettingsPath,
  codexHome,
  dropHooks,
  type HookDoc,
  invalidJsonMessage,
  MEM_MODE,
  memDir,
  memPreviousPath,
  readJsonObject,
  type SetupDeps,
  writeJsonWithBackup,
} from "./wire.ts";

/** Every `<configDir>/projects/*\/agent-kit` ledger root. */
export function ledgerRoots(ctx: LearnContext): string[] {
  const projects = join(ctx.config.configDir, "projects");
  let folders: string[] = [];
  try {
    folders = readdirSync(projects);
  } catch {
    return [];
  }
  return folders.map((folder) => join(projects, folder, "agent-kit")).filter((dir) => existsSync(dir));
}

/**
 * Put claude-mem's budget and mode back to what they were before the first
 * wire. A key is restored only while it still holds the value wire set, so a
 * change the user made since is kept.
 */
function restoreMem(ctx: LearnContext, deps: SetupDeps): void {
  const settingsPath = join(memDir(ctx, deps), "settings.json");
  if (!existsSync(settingsPath)) {
    rmSync(memPreviousPath(ctx), { force: true });
    return;
  }
  const settings = readJsonObject<Record<string, unknown>>(settingsPath);
  if (settings === null) {
    ctx.io.err(invalidJsonMessage(settingsPath));
    return;
  }
  const previous = readJson<Record<string, unknown>>(memPreviousPath(ctx), {});
  const ours: Array<[string, unknown]> = [
    ["CLAUDE_MEM_CONTEXT_OBSERVATIONS", CONTEXT_OBSERVATIONS],
    ["CLAUDE_MEM_MODE", MEM_MODE],
  ];
  let changed = false;
  for (const [key, value] of ours) {
    if (settings[key] !== value) continue;
    const before = previous[key];
    if (before === undefined || before === null) delete settings[key];
    else settings[key] = before;
    changed = true;
  }
  // The record is spent once read, matched or not; a later wire records afresh.
  rmSync(memPreviousPath(ctx), { force: true });
  if (!changed) return;
  writeJsonWithBackup(settingsPath, settings);
  ctx.io.out(`${settingsPath}: observation budget and mode restored to their values before wire`);
}

export function uninstall(ctx: LearnContext, deps: SetupDeps, options: { purge?: boolean } = {}): number {
  for (const path of [claudeSettingsPath(ctx), join(codexHome(ctx, deps), "hooks.json")]) {
    if (!existsSync(path)) continue;
    const doc = readJsonObject<HookDoc>(path);
    if (doc === null) {
      ctx.io.err(invalidJsonMessage(path));
      continue;
    }
    const removed = dropHooks(doc);
    if (removed > 0) writeJsonWithBackup(path, doc);
    ctx.io.out(`${path}: ${removed} hook entries removed`);
  }

  const kind = schedulerKind(deps);
  const paths = unitPaths(deps, kind);
  if (kind === "launchd" && paths !== null && existsSync(paths.unit)) {
    deps.run(["launchctl", "bootout", `gui/${deps.uid}/${LABEL}`]);
    rmSync(paths.unit, { force: true });
    ctx.io.out(`${paths.unit}: unloaded and removed`);
  } else if (kind === "systemd" && paths !== null && (existsSync(paths.unit) || existsSync(paths.timer!))) {
    deps.run(["systemctl", "--user", "disable", "--now", `${LABEL}.timer`]);
    rmSync(paths.unit, { force: true });
    rmSync(paths.timer!, { force: true });
    deps.run(["systemctl", "--user", "daemon-reload"]);
    ctx.io.out(`${paths.unit}: disabled and removed`);
  } else if (kind === "cron") {
    ctx.io.out("remove the `learn memory tick` line with `crontab -e` if you added one");
  }

  restoreMem(ctx, deps);

  if (options.purge === true) {
    for (const dir of ledgerRoots(ctx)) {
      rmSync(dir, { recursive: true, force: true });
      ctx.io.out(`${dir}: purged`);
    }
    rmSync(ctx.config.runtimeDir, { recursive: true, force: true });
    ctx.io.out(`${ctx.config.runtimeDir}: purged`);
  } else {
    ctx.io.out(`ledgers under ${join(ctx.config.configDir, "projects")}/*/agent-kit were kept (they are your data; --purge removes them)`);
  }
  return 0;
}
