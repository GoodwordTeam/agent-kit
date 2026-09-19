# adapters/claude-code — host contract

Contract only. No implementation lives here; the packager that emits this bundle is `src/packaging/`.

This file states what the Claude Code host provides, what the package requires of it, which
`schemas/common.schema.json#/$defs/capability` values it can actually satisfy, how the contract
degrades where it cannot, and how the result is tested.

Observations below marked **verified** were taken against `claude` 2.1.278 on this machine
(`claude plugin validate --strict`, `claude plugin eval`). Everything else is stated as a
requirement on the packager, not as a claim about host behavior.

---

## 1. Bundle shape

`ak build` emits:

```text
dist/claude-code/
├── .claude-plugin/
│   ├── plugin.json            # enumerates skills[] explicitly
│   └── marketplace.json       # one entry, source "./"
├── skills/<id>/SKILL.md       # host frontmatter keys generated; body unchanged
├── skills/<id>/references/    # transitive dependencies resolved into the bundle
├── evals/<id>/<case>/case.yaml
└── NOTICE, LICENSE
```

`plugin.json` enumerates every skill path **explicitly** rather than relying on directory
discovery:

```json
{
  "name": "ak",
  "version": "0.1.0",
  "description": "One engineering lifecycle, amalgamated from six MIT donors.",
  "author": { "name": "agent-kit maintainers" },
  "license": "MIT",
  "skills": ["./skills/super-align", "./skills/super-bound"],
  "experimental": { "evals": "evals" }
}
```

Explicit enumeration is a package decision, not a donor practice — the donor at
`compound-engineering@05c42da:.claude-plugin/plugin.json` declares no `skills` key at all and lets
the host discover `skills/`. The package enumerates because the install set is profile-dependent
(`profiles/core.yaml` is not the whole catalog), so the manifest is the one place where "what this
bundle actually contains" is stated and testable. An enumerated path that does not exist, or a skill
directory that no entry names, is an `ak build` failure.

**Verified:** an explicit `skills` array of relative directory paths and an `experimental.evals`
string both pass `claude plugin validate --strict`.

---

## 2. Generated frontmatter keys

The canonical `SKILL.md` carries spec keys only (`AUTHORING.md` §4). This adapter adds:

| Generated key | Source in `skill.yaml` | Rule |
|---|---|---|
| `disable-model-invocation: true` | `invocation: U`, declared in `packaging.generated_frontmatter` | Emitted for **every** U skill in the bundle, with no exception and no per-skill opt-out |
| `argument-hint` | `packaging.generated_frontmatter.argument-hint` | Copied verbatim when present; omitted otherwise |
| `allowed-tools` | `packaging.generated_frontmatter.allowed-tools`, cross-checked against `requires[]` through §3 | Pre-approval only — see §4 |

M skills receive no `disable-model-invocation` key at all rather than an explicit `false`.

Each skill's `packaging.hosts[]` entry for `adapter: claude-code` carries the `mode` it runs in here
(`autonomous` / `guided` / `manual`) and the `unsupported` semantics this host cannot enforce. §4 is
what those entries must be consistent with; `ak validate` fails a skill claiming `autonomous` on this
host while requiring a capability §3 marks as not provided.

**Verified:** `disable-model-invocation`, `argument-hint`, `allowed-tools`, `license` and `metadata`
all pass `claude plugin validate --strict` in a skill's frontmatter. That acceptance is exactly why
hand-writing them into the canonical tree cannot be caught downstream, and why `ak validate` rejects
them at the source (`AUTHORING.md` §4).

---

## 3. Capability support

`common#/$defs/capability` values, and what this host does with each.

| Capability | Status | Detail |
|---|---|---|
| `repository-read` | satisfied | Read, Glob, Grep over the session's working directory |
| `repository-write` | satisfied | Write, Edit |
| `process-exec` | satisfied | Bash, subject to the operator's permission settings |
| `network-fetch` | satisfied | WebFetch, WebSearch, subject to the same settings |
| `vcs-local` | satisfied | Through `process-exec` (`git`) |
| `vcs-remote` | satisfied | Through `process-exec` (`git`, `gh`); credentials are the operator's, never the package's |
| `human-channel` | satisfied | The interactive session is the channel |
| `artifact-write` | satisfied for storage, **not** for binding | The host writes the file; it does not compute or check the artifact hash. Hash binding is the package's own responsibility (`schemas/common.schema.json#/$defs/envelope`) |
| `isolated-worktree` | **convention only** | `git worktree` is reachable through `process-exec`, but the host does not confine the session to the worktree it created. Ownership is enforced by `protocols/worktree-ownership`, not by the host |
| `isolated-review-context` | **partial** | The host provides fresh-context subagents. It provides no attestation that a reviewer context never saw the author's narrative, so the package cannot verify the property it depends on |
| `independent-context` | **partial** | Same limitation. Independence here is a convention of how the session is driven, not a host guarantee |
| `kb-read`, `kb-write` | **not provided** | The host supplies transport only. See `adapters/knowledgebase/CONTRACT.md` |
| `tracker-access` | **not provided** | See `adapters/runner-contract/CONTRACT.md` |
| `event-delivery` | **not provided** | The host is session-scoped. Hooks fire inside a live session; there is no durable inbound event queue that survives the session, so no event can be delivered to a run that is not currently open |
| `runner-grants` | **not provided** | The host has no grant validator. Nothing in it can decide that a charter authorizes a checkpoint |

---

## 4. Host-capability honesty

This is the part of the contract that must not be softened.

**`allowed-tools` is a pre-approval mechanism, not a sandbox.** The Agent Skills specification marks
it experimental, and Claude Code documents it as pre-approval: listing tools removes permission
prompts for them. It does **not** deny the tools that are absent from the list. A skill that declares
`allowed-tools: Read, Glob, Grep` can still call Bash if the session's permission settings allow
Bash. Plan §1.3 states this directly: "Do not assume that a host's manual-invocation flag is
portable, or that an allowed-tools declaration denies every other tool."

Consequences the package accepts:

- A skill's `## Side effects` section is a **declaration** that `ak validate` checks against
  `skill.yaml` and that the eval suite probes. It is not a confinement the host enforces.
- "Reviewers cannot edit" (`super-review`) is enforced by the review protocol and observed by an
  eval case, not by `allowed-tools`.
- Nothing in this catalog may cite `allowed-tools` as the reason a destructive action cannot happen.

**What this host does enforce**, and the package relies on:

| Restriction | Enforced? | How the package treats it |
|---|---|---|
| `disable-model-invocation: true` blocks model-initiated invocation | Yes, as documented host behavior | The structural half of the invocation law. The packager emits it for every U skill; a non-trigger eval case with a `tool_used: Skill` grader observes it |
| Permission prompts / permission modes | Yes, operator-configured | Outside the package's control and outside its guarantees. A skill never assumes a given mode |
| `allowed-tools` denies unlisted tools | **No** | Never relied on. Declarative only |
| Grant validation for delegated phase operations | **No** | See below |
| Durable event delivery | **No** | See below |
| Attested context isolation between seats | **No** | See below |

**The degradation rule.** A host that cannot enforce a restriction an autonomous run requires
**exposes the affected skill in guided/manual mode and rejects autonomous mode.** It never runs the
skill with the restriction silently absent. Plan §1.2: "A host lacking those restrictions must expose
the skill in guided/manual mode rather than silently weakening the contract."

Concretely, on this host alone, with no runner attached:

- Entrypoints whose authority is `delegated-grant` are **unavailable**. They do not fall back to
  `explicit`; a delegated-only operation with no grant validator has no legitimate starter.
- Entrypoints whose authority is `explicit-or-delegated` install and run in their **explicit** form
  only. The delegated form is unavailable.
- `profiles/autonomy` — `autopilot` and the operational loops — **does not install** against this
  host on its own. Its `requires` include `runner-grants` and `event-delivery`, neither of which
  this host provides. `ak build` refuses the combination rather than emitting a bundle whose skills
  describe checkpoints nobody can validate.
- A checkpoint that would need two independent supervisor seats stops for explicit human decision,
  because this host cannot attest that two seats were independent.

---

## 5. Install, validate, test

```bash
# Install
claude plugin marketplace add ~/Documents/agent-kit
claude plugin install ak@agent-kit          # restart required; skills appear under /ak:

# Validate the built bundle — CI gate
claude plugin validate dist/claude-code --strict

# Behavioral suite against the built bundle
claude plugin eval dist/claude-code --threshold 1.0 --no-publish
```

`--strict` treats warnings as errors and is the form CI runs; it fails on unrecognized fields and
missing metadata that the runtime would otherwise tolerate.

Tests this adapter owns, in `tests/adapters/`:

1. **Manifest completeness** — every profile-selected skill appears in `skills[]`, every entry
   resolves to a directory containing a `SKILL.md`, and no directory is unnamed.
2. **Key generation** — for a fixture `skill.yaml` with `authority: explicit`, the emitted
   frontmatter contains `disable-model-invocation: true`; for an M skill it contains no such key.
3. **Canonical purity** — an invalid-case fixture in which a canonical `SKILL.md` hand-writes
   `allowed-tools` must fail `ak validate`.
4. **Link closure in the bundle** — a skill referencing a `references/` file that the selected
   profile excludes fails the build.
5. **Autonomy refusal** — building `profiles/autonomy` against this host without a runner adapter
   fails with the missing capabilities named.
6. **Host conformance** — `claude plugin validate dist/claude-code --strict` exits zero.
7. **Non-trigger behavior** — each U skill's non-trigger eval case does not fire the skill.

---

## 6. What this adapter does not own

Load order beyond the manifest's enumeration, the operator's permission settings, credential
handling, MCP server configuration, and anything that would require the package to inspect the user's
session. A behavior that cannot be produced from this bundle's own files belongs to the runner
contract, not here.
