/** Synchronous subprocess calls, with bytes kept as bytes where a hash depends on them. */

export interface ProcResult {
  code: number;
  stdout: Uint8Array;
  text: string;
  stderr: string;
}

export function run(cmd: readonly string[], cwd: string, env?: Record<string, string>): ProcResult {
  try {
    const proc = Bun.spawnSync([...cmd], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: env === undefined ? process.env : { ...process.env, ...env },
    });
    const stdout = proc.stdout;
    return {
      code: proc.exitCode ?? -1,
      stdout,
      text: new TextDecoder().decode(stdout).trim(),
      stderr: proc.stderr.toString().trim(),
    };
  } catch (e) {
    return { code: -1, stdout: new Uint8Array(), text: "", stderr: `cannot run ${cmd[0]} in ${cwd}: ${(e as Error).message}` };
  }
}

export function git(cwd: string, args: readonly string[], env?: Record<string, string>): ProcResult {
  return run(["git", ...args], cwd, env);
}
