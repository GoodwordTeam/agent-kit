# agent-kit — maintainer guide

This repository is a **catalog of engineering instructions**, not an application. It amalgamates six
MIT-licensed donors into *one* lifecycle rather than shipping four plugins that fight over activation
descriptions. Read this file before changing anything under `skills/`, `packs/`, `protocols/`,
`roles/` or `references/`.

Governing design: `research/sources/engineering-skills-repo-plan.md` (cited as `arch §N`).
Design brief: `research/sources/grok-transcript.md` (cited as `G:Lx–Ly`).
**Precedence: arch doc > later transcript turns > earlier transcript turns.**
Donor behavior is whatever the pinned commit in `provenance/upstream.lock.yaml` actually contains —
never what either document claims about it, and never memory.

---

## The invocation law

Non-negotiable. Written once, here, and enforced by `ak validate`'s invocation-graph check.

> - **User-invoked:** align, bound, wayfind, ship, compound. Only a human starts these.
> - **Model-invoked:** scout, tdd, diagnose, standards-review, spec-review, prototype, attach-pack.
> - A user-invoked skill may call model-invoked skills.
> - A user-invoked skill may **not** call another user-invoked skill. […]
> - Domain packs auto-attach by artifact type. They never start a phase.

Source: `G:L1672–1676`. The elision in the fourth bullet drops a model-routing illustration that the
content denylist forbids outside `provenance/` and `research/sources/`; the unedited text is at
`research/sources/grok-transcript.md:1675`. The *rule* is reproduced exactly.

**The quote uses the design brief's vocabulary, not this package's.** It names capabilities, and this
package reclassified several of them: two became protocols and two became roles, none of which are
skills. `catalog.yaml` is authoritative for what each id *is*; take a section from it, never from the
law above. No id is both a skill and a protocol, so this is reclassification, not a contradiction.

| In the quote | Here | Lives at |
|---|---|---|
| align, bound, ship, scout | `super-align`, `super-bound`, `super-ship`, `super-scout` | `skills/super-*/` |
| wayfind, compound, diagnose, prototype | unchanged | `skills/<id>/` |
| tdd, attach-pack | protocols, not skills | `protocols/<id>/PROTOCOL.md` |
| standards-review, spec-review | `reviewer-standards`, `reviewer-spec` — roles, not skills | `roles/<id>/ROLE.md` |

The law still binds each of them. A protocol or a role is not an entrypoint at all, which is a
stricter position than the quote's model-invoked class, not a loophole in it.

### How the law is satisfied where skills legitimately need each other

`super-ship` needs `compound`; `autopilot` needs gated phases. Both are U skills calling U skills,
which the law forbids. The resolution (arch §7.1, §11) is **not** an exception — it is a split:

| Layer | Who may start it | Example |
|---|---|---|
| Public entrypoint | A human, explicitly. For a U skill only the slash command counts | `/ak:super-review` |
| Phase operation | A delegated controller, **only** under a runner-validated grant | `review.delta` |

A human invokes the entrypoint. A controller invokes the phase operation, and only when the runner
validates a grant that covers it. **Ordinary workers cannot manufacture a grant or start a new gated
phase**, and public wrappers and the supervisor pair run the same protocol, so there is no second
pipeline. Where a host cannot validate a grant, the skill **stops for explicit invocation** rather
than reproducing a forbidden command's effect through a side door (ruling
`entrypoint-phase-operation-split`).

`authority` values live in `schemas/common.schema.json#/$defs/authority`:
`explicit`, `explicit-or-delegated`, `delegated-grant`, `active-review-run`, `model`.

---

## Model routing is stripped, and the stripping is enforced

No model selection, pricing, provider config, effort ladder, escalation tier or routing dependency
appears anywhere in this catalog. A large fraction of the design brief is model routing; each concept
was replaced with a role- or evidence-based equivalent:

| Design-brief concept | What this repo does instead |
|---|---|
| Tier choice / confidence scoring before a spawn | Deterministic policy checks against artifact evidence |
| Named-model implementer seating | An `implementer` role; the runner binds who fills it |
| "Cross-family on purpose" supervisor pairing | Two `supervisor` seats declared **independent**; independence is a runner-enforced constraint |
| "Fail closed on low confidence" | "Fail closed when required evidence is absent" |
| "Do not put <model> on security" | The security seat may not be filled by the implementer of the change under review nor by whoever approved its spec (ruling `missing-supervisor-never-implementer`) |
| In-skill cost/token caps | Budgets passed in by the runner; the repo enforces only the cap it was handed |

What the right-hand column cannot carry, because it is a translation table and not the rule: a seat
that cannot be filled independently is **unavailable**, and unavailability blocks the checkpoint. It
is never backfilled — not by the implementer, not by the author, not by the spec approver, and not by
a seat already sitting on the panel (ruling `missing-supervisor-never-implementer`).

`ak validate` fails on any denylist hit outside `provenance/` and `research/sources/`, which quote the
sources verbatim by design. The non-routing concepts arch § tells us to keep — per-finding solution
specificity, difficulty, evidence classification, independent roles, iteration limits — all survive,
expressed without any classifier.

---

## Repository layout

| Path | Contents | Committed? |
|---|---|---|
| `catalog.yaml` | Single source of truth. Every skill, pack, protocol, role, reference | yes |
| `skills/<id>/SKILL.md` | Canonical skill bodies. Agent Skills spec frontmatter only | yes |
| `packs/`, `protocols/`, `roles/`, `references/` | Attachable constraints, shared phase logic, role prompts, reference packs | yes |
| `schemas/` | 14 JSON Schemas; `common` holds the shared `$defs` | yes |
| `policies/`, `profiles/` | Machine-readable rulings and install profiles. Profiles never name models | yes |
| `adapters/` | Host contracts: claude-code, codex, runner, knowledgebase | yes |
| `provenance/` | `upstream.lock.yaml`, `adaptations.yaml`, `conversation-map.yaml`, licenses | yes |
| `research/` | Design sources and the donor dossiers. **Denylist-exempt** | yes |
| `src/`, `tests/` | The `ak` CLI and its tests | yes |
| `dist/` | Generated by `ak build`. Never hand-edited | yes |
| `.donors/` | Full donor clones, reproducible from `upstream.lock.yaml` | **no** |
| `.work/` | Scratch | **no** |

---

## Authoring rules

The full contract is `AUTHORING.md`. The parts that get violated most:

1. **Canonical `SKILL.md` frontmatter carries only Agent Skills spec keys** — `name`, `description`,
   optionally `license` and `metadata`. `name` must equal the directory name.
   Host keys (`disable-model-invocation`, `argument-hint`, `allowed-tools`) are **generated** by the
   packager from `skill.yaml`. Hand-writing them into a canonical file is a validation failure.
2. **≤150 lines, hard cap 300.** Longer material goes behind `references/`. Progressive disclosure is
   the mechanism — not a full-body shim that depends on another plugin's hooks.
3. **Every adapted file needs a provenance row** in `provenance/adaptations.yaml` of the form
   `donor@commit:path`, and that path must exist at the pin. A capability with no upstream source is
   `origin: conversation` with a `G:L` locator — never a fabricated source path.
4. **Cite the ruling.** Wherever a skill touches a resolved conflict, it references the row in
   `policies/resolved-conflicts.yaml`. Improvisation at those exact points is what the rulings exist
   to prevent.
5. **No placeholders.** `TODO`, `TBD`, `lorem`, `placeholder` fail validation.

## Things that are deliberately absent

Arch §2.6. These are selections, not gaps — re-adding one is a design change, not a fix:

- No second `/lfg` or "run everything" entrypoint beside `autopilot`
- No `/teach`; no visual-review HTML
- No duplicate donor brainstorm / plan / work / review / TDD / worktree commands
- The 17 CE personas are pass-1 machinery, not individually invocable skills
- CE Proof is an optional *publishing adapter*, not an engineering skill
- Model routers and model price/effort tables are entirely out of scope

## Numeric heuristics are guidance, not gates

The ~100-line PR target and the 80/15/5 test pyramid are configurable starting points, established
per project and carried in the project record. **Neither is validated or enforced here, and neither
is grounds for a finding on its own** — that clause is the whole point, and it is the one a reader
supplies wrongly if it is left out. Real constraints are set per project, and exceptions are
**recorded** rather than forcing artificial file splits or meaningless tests (ruling
`numeric-heuristics-are-guidance`; arch §3, §11).

## Before you commit

```bash
bun test                 # validator, selector and packager units, incl. invalid-case fixtures
bun run ak validate      # catalog complete, schemas valid, links closed, no denylist hits
bun run ak build --check # dist/ in sync
```

Commit messages end with the session's configured `Co-Authored-By:` attribution trailer. The
assistant identity in that trailer is supplied by the harness at commit time; it is deliberately
not written here, because every tracked file in this repo outside `provenance/` and
`research/sources/` must survive the model-name denylist.
