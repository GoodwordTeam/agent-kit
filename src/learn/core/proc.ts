/**
 * Synchronous process runner shared by the learning runtime.
 *
 * Every learning job is a short batch run, so a blocking spawn is the simplest
 * honest shape. A timeout is always applied: a hung child must never wedge a
 * scheduled tick.
 */
import { spawnSync } from "node:child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  /** True when the child was killed by the timeout rather than exiting. */
  timedOut: boolean;
}

export interface RunOptions {
  cwd?: string;
  input?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export function run(cmd: readonly string[], options: RunOptions = {}): RunResult {
  const [bin, ...args] = cmd;
  if (bin === undefined) throw new Error("run: empty command");
  const result = spawnSync(bin, args, {
    cwd: options.cwd,
    input: options.input,
    env: options.env ?? process.env,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const timedOut = result.error !== undefined && (result.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
  return {
    code: result.status ?? (result.error === undefined ? 1 : 127),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? (result.error?.message ?? ""),
    timedOut,
  };
}
