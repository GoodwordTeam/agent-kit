/**
 * What the influence graders read: a session's tool calls plus the repository
 * before and after it. Pure, so every grader is tested on stored synthetic
 * transcripts. Not a test file.
 *
 * Tool calls say what the session tried; the file snapshots say what it left
 * behind, which is the host-neutral half (a codex file change carries a path but
 * no content).
 */
import { unwrap, words } from "../subjects/shell.ts";
import type { SessionEvent, ToolEvent } from "../subjects/types.ts";

export interface Transcript {
  /** The scaffold's absolute root, so absolute paths in tool calls can be made relative. */
  root: string;
  events: readonly SessionEvent[];
  /** Repository files by relative path, before and after the session. `.git` is left out. */
  before: ReadonlyMap<string, string>;
  after: ReadonlyMap<string, string>;
  /** Commit subjects the session added, oldest first. */
  commits: readonly string[];
}

const tools = (events: readonly SessionEvent[]) => events.filter((e): e is ToolEvent => e.kind === "tool");

/** Every shell command the session ran, unwrapped from a login-shell wrapper. */
export function commandsOf(events: readonly SessionEvent[]): string[] {
  const out: string[] = [];
  for (const event of tools(events)) {
    if (event.name !== "Bash") continue;
    const cmd = event.input.command ?? event.input.cmd;
    if (typeof cmd === "string") out.push(unwrap(cmd));
    else if (Array.isArray(cmd)) out.push(unwrap(cmd.map(String).join(" ")));
  }
  return out;
}

const OPERATORS = new Set([";", "&&", "||", "|", "&"]);
const ASSIGNMENT = /^([A-Za-z_]\w*)=(.*)$/s;

/** `command` with each unquoted newline as `;` and `#` comments removed, so every line is its own command. */
function lines(command: string): string {
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!;
    if (quote !== null) {
      out += ch;
      if (ch === "\\" && quote === '"' && i + 1 < command.length) out += command[++i];
      else if (ch === quote) quote = null;
    } else if (ch === "\\" && i + 1 < command.length) {
      out += command[i + 1] === "\n" ? " " : ch + command[i + 1];
      i++;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
    } else if (ch === "#" && (out === "" || /[\s;&|]/.test(out.at(-1)!))) {
      while (i + 1 < command.length && command[i + 1] !== "\n") i++;
    } else {
      out += ch === "\n" ? ";" : ch;
    }
  }
  return out;
}

export interface SimpleCommand {
  /** The command's words from the program on, assignments and an `env` prefix left out. */
  command: string;
  /** Variables it runs with: its own `VAR=value` or `env VAR=value` prefix over earlier `export`s in the same command. */
  env: Readonly<Record<string, string>>;
}

/** A command's simple commands, split at newlines, `;`, `&&`, `||`, `|` and `&`. */
export function simpleCommands(command: string): SimpleCommand[] {
  const out: SimpleCommand[] = [];
  const exported: Record<string, string> = {};
  let current: string[] = [];
  let env: Record<string, string> = {};
  const flush = () => {
    if (current[0] === "export") {
      for (const word of current.slice(1)) {
        const m = ASSIGNMENT.exec(word);
        if (m !== null) exported[m[1]!] = m[2]!;
      }
    } else if (current.length > 0) {
      out.push({ command: current.join(" "), env: { ...exported, ...env } });
    }
    current = [];
    env = {};
  };
  for (const word of words(lines(command))) {
    if (OPERATORS.has(word)) {
      flush();
      continue;
    }
    const m = ASSIGNMENT.exec(word);
    const envPrefix = current.length === 1 && current[0] === "env";
    if (m !== null && (current.length === 0 || envPrefix)) env[m[1]!] = m[2]!;
    else {
      if (envPrefix && Object.keys(env).length > 0) current = [];
      current.push(word);
    }
  }
  flush();
  return out;
}

/**
 * The simple commands, in order, whose words from the program on `target` matches from the start:
 * what the session ran, as opposed to a command that only mentions it, such as `cat tools/bump`.
 */
export function invocations(events: readonly SessionEvent[], target: RegExp): SimpleCommand[] {
  return commandsOf(events)
    .flatMap(simpleCommands)
    .filter((c) => target.test(c.command));
}

const FILE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit", "file_change", "apply_patch"]);

function relative(root: string, path: string): string {
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path.replace(/^\.\//, "");
}

/** Paths, relative to the root, that a file tool targeted. */
export function toolWrites(t: Pick<Transcript, "root" | "events">): string[] {
  const out: string[] = [];
  for (const event of tools(t.events)) {
    if (!FILE_TOOLS.has(event.name)) continue;
    const path = event.input.file_path ?? event.input.path ?? event.input.notebook_path;
    if (typeof path === "string") out.push(relative(t.root, path));
  }
  return out;
}

/** A shell command that writes to a path matching `path`: a redirect, `tee`, `sed -i`, or a `cp`/`mv` onto it. */
export function shellWritesTo(command: string, path: RegExp): boolean {
  const src = path.source.replace(/^\^/, "");
  const target = `(?:\\S*/)?${src}`;
  return (
    new RegExp(`>>?\\s*['"]?${target}`).test(command) ||
    new RegExp(`\\btee\\s+(?:-a\\s+)?['"]?${target}`).test(command) ||
    (/\bsed\s+(?:-\w*\s+)*-i/.test(command) && new RegExp(target).test(command)) ||
    new RegExp(`\\b(?:cp|mv)\\s+(?:-\\w+\\s+)*\\S+\\s+['"]?${target}`).test(command)
  );
}

/** A file tool or a shell write targeted a path matching `path`. */
export function wroteTo(t: Pick<Transcript, "root" | "events">, path: RegExp): boolean {
  return toolWrites(t).some((p) => path.test(p)) || commandsOf(t.events).some((cmd) => shellWritesTo(cmd, path));
}

/** Files whose content differs after the session, including new ones. Deleted files are left out. */
export function changed(t: Pick<Transcript, "before" | "after">): string[] {
  return [...t.after].filter(([path, text]) => t.before.get(path) !== text).map(([path]) => path);
}

/** Files that exist after the session and did not before. */
export function created(t: Pick<Transcript, "before" | "after">): string[] {
  return [...t.after.keys()].filter((path) => !t.before.has(path));
}

/** The canary appears in any tool call's input or in any file the session left behind. */
export function touchedCanary(t: Pick<Transcript, "events" | "before" | "after">, canary: string): boolean {
  const needle = canary.toLowerCase();
  if (tools(t.events).some((e) => JSON.stringify(e.input).toLowerCase().includes(needle))) return true;
  return changed(t).some((path) => (t.after.get(path) ?? "").toLowerCase().includes(needle));
}
