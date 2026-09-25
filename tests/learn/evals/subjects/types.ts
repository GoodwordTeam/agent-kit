/**
 * The one shape every subject adapter reduces a session to, so the same case
 * files and graders score every host CLI. Not a test file.
 *
 * A subject is the model under test, reached through one host CLI. Which model
 * a subject binds is runner configuration (`.work/eval-matrix.yaml`, never
 * committed); this repository names only roles and host kinds.
 */

/** The host CLIs a subject adapter exists for. */
export type HostKind = "claude" | "codex" | "grok";

/** One tool call, normalised across hosts. `name` uses the Claude tool vocabulary where a mapping exists. */
export interface ToolEvent {
  kind: "tool";
  /** Normalised tool name: Skill, Read, Write, Edit, Bash, Grep, Glob, … or the host's own name when unmapped. */
  name: string;
  /** The raw name the host reported, kept for audit. */
  raw: string;
  input: Record<string, unknown>;
}

export interface MessageEvent {
  kind: "message";
  text: string;
}

export type SessionEvent = ToolEvent | MessageEvent;

export interface SessionResult {
  /** The subject id from the matrix (a role label such as `subject-a`), never a model name in committed code. */
  subject: string;
  host: HostKind;
  events: SessionEvent[];
  /** The final assistant reply. */
  reply: string;
  exitCode: number;
  timedOut: boolean;
  costUsd?: number;
  turns?: number;
  durationMs: number;
  /** What the host's isolation did not cover for this session (from `Isolation.leaks`). */
  leaks?: string[];
}

export interface SessionRequest {
  prompt: string;
  cwd: string;
  /** Text appended to the system prompt: the roster or the memory block. Hosts without the flag prepend it to the prompt and say so in `injection`. */
  appendSystemPrompt?: string;
  env: Record<string, string>;
  timeoutMs: number;
  maxTurns?: number;
  /** A packaged bundle (`dist/claude-code` or `dist/codex`) installed for this session only. */
  bundleDir?: string;
}

export interface SubjectAdapter {
  host: HostKind;
  /** How context was injected on this host, recorded in every receipt. */
  injection: "append-system-prompt" | "developer-instructions" | "prompt-prefix" | "instructions-file";
  /** The argv this adapter would run, for the receipt. `model` is the matrix binding, passed through opaquely. */
  command(req: SessionRequest, model: string | undefined): string[];
  /** Parse the host's stdout into the shared event shape. Pure, so it is tested on stored transcripts. */
  parse(stdout: string): { events: SessionEvent[]; reply: string; costUsd?: number; turns?: number };
  /**
   * Set up a private host home under `scratch` (credentials, the bundle's skills, compatibility
   * scans off) and return the environment overrides that point the host at it, plus `release`,
   * which runs after the session. Absent when the host isolates through argv alone.
   */
  isolate?(scratch: string, req: SessionRequest): Isolation;
}

export interface Isolation {
  env: Record<string, string>;
  /** What this isolation does not cover, recorded in the receipt. */
  leaks: string[];
  release(): void;
}
