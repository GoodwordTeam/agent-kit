/**
 * Codex in exec mode. Not a test file.
 *
 *   codex exec --json --ephemeral --skip-git-repo-check --ignore-rules --sandbox read-only
 *     --disable plugins --disable remote_plugin [-m M] [-c developer_instructions=TEXT] PROMPT
 *
 * Appended context goes in as `developer_instructions`, a developer message after the host's own
 * instructions; codex has no append-to-system-prompt flag. There is no turn cap flag, so
 * `maxTurns` is not passed. Isolation is a private CODEX_HOME and HOME: codex reads skills from
 * `$CODEX_HOME/skills` and `$HOME/.agents/skills`, AGENTS.md from `$CODEX_HOME`, and fetches
 * remote plugins into `$CODEX_HOME` unless the plugin features are off. The bundle's skills are
 * copied into the private `skills/`.
 *
 * Codex has no Skill or Read tool: a skill is loaded by printing its SKILL.md through the shell.
 * Every shell call becomes a Bash event, and each file it prints also becomes a Read event, so
 * graders that look for a SKILL.md read score codex the way they score the other hosts.
 */
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { privateHome } from "./home.ts";
import { readsOf, unwrap } from "./shell.ts";
import type { Isolation, SessionEvent, SessionRequest, SubjectAdapter } from "./types.ts";

interface Item {
  id?: string;
  type?: string;
  text?: string;
  command?: string;
  changes?: Array<{ path?: string; kind?: string }>;
  server?: string;
  tool?: string;
  arguments?: unknown;
  query?: string;
}

interface Line {
  type?: string;
  item?: Item;
}

const CHANGE_TOOL: Record<string, string> = { add: "Write", update: "Edit", delete: "Delete" };

function itemEvents(item: Item): SessionEvent[] {
  switch (item.type) {
    case "agent_message":
      return typeof item.text === "string" && item.text !== "" ? [{ kind: "message", text: item.text }] : [];
    case "command_execution": {
      const command = unwrap(item.command ?? "");
      const bash: SessionEvent = { kind: "tool", name: "Bash", raw: "command_execution", input: { command } };
      return [bash, ...readsOf(command).map((file_path): SessionEvent => ({ kind: "tool", name: "Read", raw: "command_execution", input: { file_path, via: "shell" } }))];
    }
    case "file_change":
      return (item.changes ?? []).map((c) => ({ kind: "tool", name: CHANGE_TOOL[c.kind ?? ""] ?? "Edit", raw: "file_change", input: { file_path: c.path, change: c.kind } }));
    case "mcp_tool_call":
      return [{ kind: "tool", name: `mcp__${item.server}__${item.tool}`, raw: "mcp_tool_call", input: { arguments: item.arguments } }];
    case "web_search":
      return [{ kind: "tool", name: "WebSearch", raw: "web_search", input: { query: item.query } }];
    default:
      return [];
  }
}

export const codex: SubjectAdapter = {
  host: "codex",
  injection: "developer-instructions",
  command(req: SessionRequest, model: string | undefined): string[] {
    return [
      "codex",
      "exec",
      "--json",
      "--ephemeral",
      "--skip-git-repo-check",
      "--ignore-rules",
      "--sandbox",
      "read-only",
      "--disable",
      "plugins",
      "--disable",
      "remote_plugin",
      ...(model === undefined ? [] : ["-m", model]),
      // A JSON string is a valid TOML basic string, which is how `-c` parses the value.
      ...(req.appendSystemPrompt === undefined ? [] : ["-c", `developer_instructions=${JSON.stringify(req.appendSystemPrompt)}`]),
      req.prompt,
    ];
  },
  parse(stdout: string) {
    const events: SessionEvent[] = [];
    const started = new Map<string, Item>();
    const done = new Set<string>();
    let reply = "";
    for (const raw of stdout.split("\n")) {
      let line: Line;
      try {
        line = JSON.parse(raw) as Line;
      } catch {
        continue;
      }
      const item = line.item;
      if (item === undefined) continue;
      if (line.type === "item.started" && item.id !== undefined) started.set(item.id, item);
      if (line.type !== "item.completed") continue;
      if (item.id !== undefined) done.add(item.id);
      events.push(...itemEvents(item));
      if (item.type === "agent_message" && typeof item.text === "string") reply = item.text.trim();
    }
    // A command still running when the session ended (a timeout) was still called.
    for (const [id, item] of started) if (!done.has(id)) events.push(...itemEvents(item));
    return { events, reply };
  },
  isolate(scratch: string, req: SessionRequest): Isolation {
    const callerHome = req.env.CODEX_HOME ?? join(req.env.HOME ?? homedir(), ".codex");
    const home = privateHome(join(scratch, "codex-home"), join(callerHome, "auth.json"), req.bundleDir === undefined ? undefined : join(req.bundleDir, "skills"), "skills");
    mkdirSync(join(scratch, "home"), { recursive: true });
    return {
      env: { CODEX_HOME: home.dir, HOME: join(scratch, "home") },
      leaks: ["the host's built-in system skills"],
      release: home.release,
    };
  },
};
