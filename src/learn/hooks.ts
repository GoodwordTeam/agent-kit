/**
 * `ak learn hook <event>` — the only entry the host's hook configuration calls.
 *
 * A hook never blocks or fails a session: every handler is wrapped, errors go
 * to stderr, and the exit code is always 0.
 */
import type { LearnArea, LearnContext } from "./core/context.ts";
import { sessionStartBlock } from "./memory/session-context.ts";
import { promptHook, stopHook } from "./review/hooks.ts";

export interface HookPayload {
  cwd?: string;
  prompt?: string;
  user_prompt?: string;
  stop_hook_active?: boolean;
  [key: string]: unknown;
}

export function parsePayload(stdin: string | undefined): HookPayload {
  if (stdin === undefined || stdin.trim() === "") return {};
  try {
    const parsed = JSON.parse(stdin) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as HookPayload) : {};
  } catch {
    return {};
  }
}

function guarded(label: string, ctx: LearnContext, body: () => void): number {
  try {
    body();
  } catch (error) {
    ctx.io.err(`ak learn ${label}: ${(error as Error).message}`);
  }
  return 0;
}

export const hookArea: LearnArea = {
  summary: "entry points for host hooks; never blocks a session",
  verbs: {
    "session-start": {
      usage: "hook session-start            print the merged context block (guardrails, memory, lessons, roster)",
      run: (_args, ctx) =>
        guarded("session-start", ctx, () => {
          const payload = parsePayload(ctx.stdin);
          const block = sessionStartBlock({ ...ctx, cwd: typeof payload.cwd === "string" ? payload.cwd : ctx.cwd });
          if (block.trim() !== "") ctx.io.out(block.trimEnd());
        }),
    },
    stop: {
      usage: "hook stop [--source codex]    debounced: detach the review pipeline for this project",
      run: (args, ctx) => guarded("stop", ctx, () => stopHook(ctx, parsePayload(ctx.stdin), args)),
    },
    prompt: {
      usage: "hook prompt                   capture a user correction from a submitted prompt",
      run: (args, ctx) => guarded("prompt", ctx, () => promptHook(ctx, parsePayload(ctx.stdin), args)),
    },
  },
};
