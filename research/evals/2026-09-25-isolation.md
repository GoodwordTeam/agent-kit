# Eval isolation probe, 2026-09-25

Question: when `scripts/eval-local.sh` drives `claude plugin eval`, does anything from the operator's
machine reach the agent under test? If the operator's hooks, global `CLAUDE.md`, plugins or memory
reach it, every arm runs with the operator's live instructions and a with/without difference
measures the operator's setup as much as the bundle.

Answer: the host isolates configuration on its own. The environment is the one leak, and
`eval-local.sh` now closes it by default.

## Instrument

| Item | Value |
|---|---|
| Tree | `740d336fe2aecb81d56326435cb4dba67420988d`, dirty (the branch had uncommitted edits by several agents, including this change) |
| `.donors/` | present |
| Install config | default (no `ak.install.yaml`) |
| Host | `claude --version` = `2.1.282 (Claude Code)`, macOS (Darwin 25.6.0) |
| Agent model (from the trace init event, bound by the host default) | `claude-opus-5-5[1m]` |
| Bundle | the throwaway `ak-probe` bundle written by `scripts/eval-isolation-probe.sh`, sha256 `a3a9c5ad55036fa7ce009ebfbe33a9e290b00106a55600f8140385de7e8c9d4b`; one case, no skills, one regex grader, one run per arm |
| Launcher | an agent session inside Claude Code, with the operator's real `~/.claude`: 13 hook events in `settings.json`, an 84-line global `CLAUDE.md`, and installed plugins including `claude-mem@thedotmack`, `oh-my-claudecode@omc` and `compound-engineering` |
| Commands | `scripts/eval-isolation-probe.sh on --max-cost-usd 1` and `scripts/eval-isolation-probe.sh off --max-cost-usd 1` |

Everything the tree contributes to this measurement is the two scripts. The bundle is generated,
so the figures below are about the host and the launcher, not about the catalog.

The runner command each probe issued (from the receipts in `2026-09-25-isolation/`):

```
[env -i HOME USER LOGNAME PATH SHELL TERM LANG TMPDIR]   # "on" only
claude plugin eval <bundle> --no-publish --json <result> \
  --trust-plugin --keep-temp --allow-tools Bash --runs 1 --max-cost-usd 1
```

## What was planted

- Three canaries in the launching environment, with fresh random values per probe:
  `CLAUDE_CODE_AKPROBE_CANARY` and `EVAL_AKPROBE_CANARY` (prefixes the host documents as passed
  through to the child), and `AKPROBE_PLAIN_CANARY` (a prefix it does not pass).
- The operator's real setup, left untouched: its markers (`Rust Token Killer`, `oh-my-claudecode`,
  `claude-mem`, `project-memory-context`, `lavish`, `no-mistakes`, `firstmate`, `OMC`) sit in
  `~/.claude/CLAUDE.md` and in the context its hooks inject. The probe prompt contains none of them.
- The launcher's own `CLAUDE_CODE_SESSION_ID` and `CLAUDE_CODE_MESSAGING_SOCKET` values.

The case asks the agent to quote the first lines of every instruction or memory block it was given,
to run `printenv | grep -E 'AKPROBE|SESSION_ID|MESSAGING_SOCKET'`, and to list every variable name.
The verdict reads the kept trace of each run. It records the host's `system/init` event: plugins,
MCP servers, skills, agents, memory paths. It also records which canary values and markers appear
anywhere in the trace.

## Results

| Probe | Arm | `CLAUDE_CODE_*` canary | `EVAL_*` canary | plain canary | operator markers | launcher session id / socket | plugins loaded | MCP servers |
|---|---|---|---|---|---|---|---|---|
| on (default) | with | absent | absent | absent | none | absent / absent | `ak-probe@inline`, `agents-md@builtin` | none |
| on (default) | without | absent | absent | absent | none | absent / absent | `agents-md@builtin` | none |
| off (`--inherit-env`) | with | **present** | **present** | absent | none | absent / absent | `ak-probe@inline`, `agents-md@builtin` | none |
| off (`--inherit-env`) | without | **present** | **present** | absent | none | absent / absent | `agents-md@builtin` | none |

Both probes, both arms: `PROBE_DONE` graded 1/1, Wilson 95% [0.207, 1]. Cost $0.300 (on, 34 s) and
$0.269 (off, 37 s). Total live spend for this note, the two earlier runs in finding 2 included, was
$0.76. Verdicts and receipts are in `2026-09-25-isolation/`.

In all four runs, the host gave the child:

- only the built-in skills (16), with none from the operator's plugins;
- only the built-in agents (`claude`, `Explore`, `general-purpose`, `Plan`, `statusline-setup`);
- an auto-memory path under the run's own scratch config (`/private/tmp/e-*/config/projects/.../memory/`);
- its own `CLAUDE_CONFIG_DIR`, `HOME` and `TMPDIR`, plus `CLAUDE_CODE_DISABLE_CLAUDE_MDS`,
  `CLAUDE_CODE_EVAL_CONFINED` and `CLAUDE_CODE_MANAGED_SETTINGS_PATH`;
- its own session id and messaging socket, both inside the scaffold (`/private/tmp/e-*/tmp/cc-socks/`).
  The launcher's values never appeared.

No agent quoted an instruction file or memory, and the two `off` agents said outright that none
had been loaded. The only injected context any of them quoted was the host's own `gitStatus` and
commit-attribution blocks for its scaffold repository. The scratch config directory of a kept run
held a `settings.json` whose whole content was `{"env": {"DISABLE_AUTOUPDATER": "1"}}`, and an
`.claude.json` carrying a copied `oauthAccount`. So the host hands auth to the child itself, and the
launcher has nothing to arrange for it.

### Reading the control

- **Environment half (a real on/off control).** With `--inherit-env`, both planted values that use
  host-passed prefixes reached the child's shell in both arms. Under the default allowlist neither
  did. So the default closes a leak that exists. The plain-prefix canary never arrived, which
  confirms the host's own prefix filter.
- **Configuration half.** The host has no switch that turns its configuration isolation off, so
  there is no "off" run to compare against. The control here is the launcher itself. This session
  runs with claude-mem, oh-my-claudecode and the global `CLAUDE.md` loaded, and those markers are in
  its own context. Yet in both modes the child's init event lists no operator plugin, no MCP server
  and no operator skill, and no marker appears in any trace. The host docs say the same: user
  settings, hooks, `CLAUDE.md`, MCP servers, other plugins, memory and skills are absent, for both
  arms.

## Other findings

1. **`execution.env.CLAUDE_CONFIG_DIR` in a `case.yaml` does not reach the child. It fails the run.**
   Measured on a one-case scratch bundle at $0.00: `case "config-dir-env" execution.env key
   "CLAUDE_CONFIG_DIR" is not allowed — only EVAL_* keys can be set from case.yaml`. Candidate
   isolation methods (a) scratch `CLAUDE_CONFIG_DIR`, (b) scratch `HOME` and (c) `disableAllHooks`
   are all redundant: the host already applies (a) and (b) per run, and the child has no hooks to
   disable. Applying them in the launcher would only put the launcher's own auth at risk: on macOS
   the login lives in the keychain, and the keychain here holds separate
   `Claude Code-credentials-<suffix>` entries beside the default one, so a fresh config directory
   most likely starts logged out. That last point was not tested.
2. **Gated tools need `--allow-tools`.** Two earlier probe runs listed `allowed_tools: [Bash]` in
   the case but ran without `--allow-tools Bash` ($0.096 and $0.097; one of their traces was lost to
   a cleanup bug since fixed). The surviving trace's agent reported having no Bash tool, and the
   case still passed because its grader only checked for completion. Cases in `evals/` that list
   `Bash` (or `Write`, `Edit`, `WebFetch`) get those tools only when the operator grants them on the
   command line. A run without the grant measures a narrower agent than the case describes, and
   nothing in the result says so. `eval-local.sh` now grants each case its own tools; see "Does a
   grant stay inside the case that declared it?" below.
3. **Variables the host sets itself.** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` and `CLAUDE_EFFORT`
   were present in the child under the `env -i` allowlist too, so the host sets them rather than
   inheriting them. Under `--inherit-env`, the child also received `COLORTERM`, `FORCE_HYPERLINK`,
   `GIT_ASKPASS` and `GCM_INTERACTIVE` from the launcher.
4. **The "off" receipt predates one fix.** `off.receipt.json` shows `envPassed: []`. The
   script now writes `"all"` for `--inherit-env`, because an empty list read as "nothing passed".
   The receipts are kept as measured.

## Direct `claude -p` subjects (the cross-model harness)

`tests/learn/evals/subjects/claude.ts` starts `claude -p` itself, so none of the host's isolation
applies to it. It was using `--settings '{"disableAllHooks":true}' --setting-sources project,local
--strict-mcp-config`, and the user's global `CLAUDE.md` still reached the agent. Measured the same
day with one-turn `Reply OK.` runs on the smallest model tier, about $0.16 in all. The evidence is
the `prompt_snapshot` attachment in each session transcript, which records the rendered prompt;
the leak test searches it for `Contents of /Users/…`, `oh-my-claudecode` and the auto-memory path.

| Variant (all with the three flags above, unless noted) | cwd | Result |
|---|---|---|
| flags only | scratch dir under `/private/tmp` | nothing loaded |
| `--setting-sources user,project,local` (positive control) | scratch dir | `~/.claude/CLAUDE.md`, `RTK.md` and `rules/common/performance.md` loaded as **user** instructions |
| flags only | this repo | `~/.claude/CLAUDE.md` and `performance.md` loaded as **project** instructions ("checked into the codebase"), plus another project's auto-memory `MEMORY.md` |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1` | this repo | no instruction file and no `MEMORY.md` (3 of 3 runs); the auto-memory *instructions* remain, pointing at the operator's real memory directory |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1 CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` | this repo | nothing loaded and no memory directory named (6 of 6 runs) |
| `{"autoMemoryEnabled":false}` in `--settings` instead of the memory variable | this repo | nothing loaded (1 run) |
| scratch `HOME` | scratch dir | `Not logged in · Please run /login` |
| `--safe-mode` | scratch dir | nothing loaded, but the `--plugin-dir` bundle's skills are gone too, so it cannot serve the with arm |

So `--setting-sources` alone does not help. Any cwd under `$HOME` walks up to `$HOME`, and the
project-file walk then reads `~/.claude/CLAUDE.md` as that ancestor's project instructions, whatever
the setting sources say. A scratch `HOME` loses the keychain login. `--bare` skips keychain reads by
design and needs `ANTHROPIC_API_KEY`, which this machine does not use. The recipe that holds, and
keeps both auth and `--plugin-dir`:

```
CLAUDE_CODE_DISABLE_CLAUDE_MDS=1 CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 \
  claude --settings '{"disableAllHooks":true}' --setting-sources project,local --strict-mcp-config \
  --no-session-persistence -p …
```

`CLAUDE_CODE_DISABLE_CLAUDE_MDS` is the variable the host sets for its own eval children (see the
variable list above). It also drops the repository's `AGENTS.md`, which is what a subject run
wants. `--no-session-persistence` keeps these runs out of the operator's `~/.claude/projects`
transcripts; without it, every probe above left a session file there. One early run appeared to leak
under both variables. That was a harness error: in zsh an unquoted `$v` holding two assignments
was not split, so `env` set one variable to the string `1 CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`.

## Does a grant stay inside the case that declared it?

It does not. One run, two cases, `--allow-tools Bash --ablation none` on the smallest model tier,
driven through `eval-local.sh` so that the `~/.docker` shuffle applied. Cost $0.07. The first
attempt, run without the shuffle, refused both cases at $0.00, the Read-only one included, with
"a Bash-granting evaluation cannot run here".

| Case | `allowed_tools` | Tools in the child's init event | Bash called |
|---|---|---|---|
| `with-bash` | `[Bash]` | Task, Bash, Read, Skill, TaskCreate/Get/List/Stop/Update, ToolSearch | yes, `TOOLPROBE_42` |
| `without-bash` | `[Read]` | Task, **Bash**, Glob, Grep, Read, Skill, TaskCreate/Get/List/Stop/Update, ToolSearch | **yes**, `TOOLPROBE_42` |

The operator's `--allow-tools` adds the granted tool to every case in the run, whether or not the
case lists it. So granting the union of every case's tools in one invocation would widen each case
that lists fewer. To give each case exactly its own gated tools, run once per distinct gated-tool
set. The corpus at `740d336` (dirty) has five such sets across 118 cases: none (39), Bash (37),
Edit+Write (21), Bash+Edit+Write (20), Write (1). `--case` takes a single name glob, and case
names are not unique across skills (`no-knowledgebase-write-stops-before-publishing` exists under
both `doc-review` and `super-bound`). A name filter alone therefore cannot carve out a group.

**What `eval-local.sh` does about it.** The script reads the `case.yaml` of every case the run
selects, honouring `--case` and `--tag`. It groups those cases by the gated tools they declare and
runs each group in its own host invocation, against a staged copy of the bundle whose eval
directory holds only that group's cases. A single group runs against the bundle itself. A
user-supplied `--allow-tools` overrides the grouping and runs once with that grant. `--max-cost-usd`
is one budget across all the invocations, and a group the budget cannot reach is recorded as
skipped, with `partial: true`. The receipt's `grants` and `invocations` fields record, per
invocation, the grant, the cases, the staged bundle's sha256, the command, the exit status and the
cost. Checked live on the same two-case bundle with no `--allow-tools` ($0.04, smallest tier). The
script made two invocations. `without-bash` ran with a grant of none: its init event listed Task,
Glob, Grep, Read, Skill, the Task* tools and ToolSearch, with no Bash, and it answered `NO_BASH`.
`with-bash` ran with a grant of `[Bash]`, listed Bash and ran it. I reran it after adding the per-invocation `partial` flag and the stop on an empty selection
($0.04, budget $0.15). The result was the same: `without-bash` had no Bash in its init event and
answered `NO_BASH`, and `with-bash` had Bash, called it once and answered `TOOLPROBE_42`. The two
invocations cost $0.016 and $0.024, each with `partial: false`. When `--case` and `--tag` select no
case, the script stops with exit 2 before calling the host. On the current `dist/` (stale,
95 cases), an offline run against a stub host formed five groups: none 35, Bash 21,
Bash+Edit+Write 18, Edit+Write 20, Write 1.

## Reproduce

```bash
scripts/eval-isolation-probe.sh on  --max-cost-usd 1
scripts/eval-isolation-probe.sh off --max-cost-usd 1
```

Each prints the verdict JSON and the paths of the result, receipt and kept traces. Expect `on` to
show every canary absent and `off` to show the `CLAUDE_CODE_*` and `EVAL_*` canaries present, with no
operator marker in either.
