import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { entryBodyPath } from "../catalog/layout.ts";
import { loadSkillManifest } from "../packaging/manifest.ts";
import { parseFrontmatter } from "../util/frontmatter.ts";
import { readTextIfPresent } from "../util/fs.ts";
import { splitSections } from "./bodies.ts";
import type { CheckContext } from "./context.ts";
import { error, skipped, type Issue } from "./types.ts";

/**
 * `## Side effects` against the union of the envelopes its invokers declare.
 *
 * One fact is written down in four places, and each pair of them can drift:
 *
 *   SKILL.md `## Side effects`   the executing agent reads this
 *     |  AUTHORING.md §4.1: one statement in two forms
 *   skill.yaml `side_effects`    the packager and this validator read this
 *     |  the skill-level list is what its entrypoints add up to
 *   skill.yaml `entrypoints.<n>.side_effects`
 *     |  a phase operation is the only way a controller reaches a U skill
 *   policies/invocation.yaml `operations[].side_effects`   the grant envelope
 *
 * The bottom link is the one with teeth. The runner validates a grant against
 * the operation's declared effects; an effect the skill performs that the
 * operation never declared happens outside anything the runner gated, which is
 * the side door `no_side_door` describes in a different vocabulary. The link is
 * checked against the *union* of the operations bound to an entrypoint, because
 * a skill reached by two operations may legitimately do what either permits --
 * an intersection would report the wider operation's own effects as violations.
 * Equality falls out: each operation's effects must be inside what the
 * entrypoint declares, and what the entrypoint declares must be inside the
 * union.
 *
 * The top link is parsed asymmetrically on purpose. The *declaration* is read
 * narrowly -- the opening sentence of the section, which is the form AUTHORING
 * §5 shows and both authored skills use -- so that a paragraph of commentary
 * naming an effect again cannot be mistaken for a second, differently shaped
 * list. The *denial* (`No `workspace-write``) is matched loosely, across the
 * whole section, because a missed denial costs one uncaught contradiction while
 * a missed declaration costs a false error on correct prose. Incompleteness is
 * tolerable in the direction that fails quiet and not in the one that fails loud.
 */

const POLICY_FILE = "policies/invocation.yaml";
const COMMON_SCHEMA = "schemas/common.schema.json";

/** A backticked token shaped like a side-effect id. Membership decides, not shape. */
const BACKTICKED = /`([a-z][a-z0-9-]*)`/g;

/** A denial: the word `no` immediately before a backticked effect. */
const DENIAL = /\bno\s+`([a-z][a-z0-9-]*)`/gi;

function obj(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function list(values: Iterable<string>): string {
  return [...values].join(", ");
}

/**
 * The closed side-effect vocabulary, read from the schema that defines it.
 *
 * Null rather than a hardcoded fallback. A fallback would be a second copy of a
 * vocabulary this repository already keeps in one place, and a stale copy
 * answers confidently and wrongly -- it would call an effect the schema added
 * an unknown token in the prose, and the run would look healthy. Not knowing is
 * reportable; guessing is not.
 */
function sideEffectVocabulary(root: string): Set<string> | null {
  const text = readTextIfPresent(join(root, COMMON_SCHEMA));
  if (text === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const values = obj(obj(parsed)?.["$defs"])?.["side_effect"];
  const members = strings(obj(values)?.["enum"]);
  return members.length === 0 ? null : new Set(members);
}

interface Operation {
  readonly id: string;
  readonly exposedBy: string;
  /** The entrypoint the policy names, when it names one. */
  readonly entrypoint: string | null;
  readonly effects: ReadonlyArray<string>;
}

/**
 * Absent and unreadable are different facts and the summary must not merge them.
 *
 * No policy file means there are no operations: an empty subject, which hides
 * nothing, and which `policy.invocation-unavailable` already states. A policy
 * file that will not parse means the operations exist and were not read -- the
 * envelopes go uncompared while the run still reports clean on them.
 */
type PolicyState = "ok" | "absent" | "unreadable";

function loadOperations(root: string): { state: PolicyState; operations: Operation[] } {
  const text = readTextIfPresent(join(root, POLICY_FILE));
  if (text === null) return { state: "absent", operations: [] };
  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch {
    return { state: "unreadable", operations: [] };
  }
  const raw = obj(parsed)?.["operations"];
  const operations: Operation[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const entry = obj(item);
    if (entry === null) continue;
    const id = entry["id"];
    const exposedBy = entry["exposed_by"];
    if (typeof id !== "string" || typeof exposedBy !== "string") continue;
    operations.push({
      id,
      exposedBy,
      entrypoint: typeof entry["entrypoint"] === "string" ? entry["entrypoint"] : null,
      effects: strings(entry["side_effects"]),
    });
  }
  return { state: "ok", operations };
}

interface Entrypoint {
  readonly name: string;
  /** The phase operation this entrypoint says it runs, when it says one. */
  readonly operation: string | null;
  /** Null when the entrypoint does not narrow the skill-level list. */
  readonly effects: ReadonlyArray<string> | null;
}

function entrypointsOf(raw: Record<string, unknown>): Entrypoint[] {
  const declared = obj(raw["entrypoints"]);
  if (declared === null) return [];
  const out: Entrypoint[] = [];
  for (const [name, value] of Object.entries(declared)) {
    const entry = obj(value);
    if (entry === null) continue;
    out.push({
      name,
      operation: typeof entry["operation"] === "string" ? entry["operation"] : null,
      effects: entry["side_effects"] === undefined ? null : strings(entry["side_effects"]),
    });
  }
  return out;
}

interface Prose {
  /** Effects named in the opening declaration. */
  readonly named: Set<string>;
  /** Effects the section says are absent, matched anywhere in it. */
  readonly denied: Set<string>;
  /** The sentence read as the declaration, quoted back in the failure message. */
  readonly opening: string;
  /** 1-based line of the `## Side effects` heading in the file. */
  readonly line: number;
}

/**
 * The declaration: the first non-empty paragraph, cut at its first sentence end.
 *
 * Both forms AUTHORING permits survive this. An inline list followed by a
 * denial in the same paragraph cuts at the period; a paragraph of bullets has
 * no sentence end and is taken whole.
 */
function openingDeclaration(text: string): string {
  const paragraph = text.split(/\n[ \t]*\n/).find((part) => part.trim() !== "") ?? "";
  const trimmed = paragraph.trim();
  const end = trimmed.search(/\.(\s|$)/);
  return end === -1 ? trimmed : trimmed.slice(0, end + 1);
}

function readSideEffectSection(body: string, offset: number, effects: ReadonlySet<string>): Prose | null {
  const section = splitSections(body).find((s) => s.heading === "## Side effects");
  if (section === undefined) return null;

  const opening = openingDeclaration(section.text);
  const named = new Set<string>();
  for (const match of opening.matchAll(BACKTICKED)) {
    const token = match[1];
    if (token !== undefined && effects.has(token)) named.add(token);
  }
  const denied = new Set<string>();
  for (const match of section.text.matchAll(DENIAL)) {
    const token = match[1];
    if (token !== undefined && effects.has(token)) denied.add(token);
  }
  return { named, denied, opening, line: section.line + offset };
}

/** §4.1: the section and the field must agree, and neither substitutes for the other. */
function checkProse(file: string, manifestFile: string, prose: Prose, declared: ReadonlySet<string>): Issue[] {
  const issues: Issue[] = [];

  if (prose.named.size === 0) {
    // A skill with no effects declares that with the one sentence §3 gives it.
    // Anything else is prose standing where the list belongs.
    if (declared.size === 0 && prose.opening === "None.") return [];
    return [
      error(
        "sideeffects.prose-no-list",
        file,
        `## Side effects opens with prose rather than the list AUTHORING.md §3 requires. Read as the declaration: ${JSON.stringify(prose.opening)}. Name the values from common.schema.json#/$defs/side_effect, as a list, in the section's first sentence, or open with exactly \"None.\" when ${manifestFile} declares no side effects.`,
        prose.line,
      ),
    ];
  }

  const missing = [...declared].filter((effect) => !prose.named.has(effect));
  if (missing.length > 0) {
    issues.push(
      error(
        "sideeffects.prose-missing-effect",
        file,
        `${manifestFile} declares ${list(missing)}, which ## Side effects does not name. The executing agent reads the prose; an effect only the manifest knows about is undeclared where it matters.`,
        prose.line,
      ),
    );
  }

  const extra = [...prose.named].filter((effect) => !declared.has(effect));
  if (extra.length > 0) {
    issues.push(
      error(
        "sideeffects.prose-undeclared-effect",
        file,
        `## Side effects names ${list(extra)}, which ${manifestFile} side_effects does not declare. The packager reads the manifest; an effect only the prose knows about is not carried into any host bundle.`,
        prose.line,
      ),
    );
  }

  const contradicted = [...prose.denied].filter((effect) => declared.has(effect));
  if (contradicted.length > 0) {
    issues.push(
      error(
        "sideeffects.prose-denies-declared-effect",
        file,
        `## Side effects states that ${list(contradicted)} does not happen while ${manifestFile} declares it. The two surfaces state opposite facts about one effect; decide which is true before either is shipped.`,
        prose.line,
      ),
    );
  }

  return issues;
}

/** Which entrypoint an operation runs, or the reason nothing could say. */
type Binding = { readonly entrypoint: string } | { readonly issue: Issue };

function bindOperation(op: Operation, manifestFile: string, entrypoints: ReadonlyArray<Entrypoint>): Binding {
  const names = new Set(entrypoints.map((e) => e.name));
  const claimants = entrypoints.filter((e) => e.operation === op.id).map((e) => e.name);

  if (op.entrypoint !== null) {
    if (!names.has(op.entrypoint)) {
      return {
        issue: error(
          "sideeffects.operation-entrypoint-unknown",
          POLICY_FILE,
          `operation ${op.id} names entrypoint '${op.entrypoint}' on ${op.exposedBy}, which ${manifestFile} does not declare. Declared: ${names.size === 0 ? "none" : list(names)}.`,
        ),
      };
    }
    if (claimants.length > 0 && !claimants.includes(op.entrypoint)) {
      return {
        issue: error(
          "sideeffects.operation-entrypoint-conflict",
          manifestFile,
          `${POLICY_FILE} binds operation ${op.id} to entrypoint '${op.entrypoint}', while ${manifestFile} has entrypoint '${claimants.join("', '")}' claiming it with operation: ${op.id}. Two bindings naming different entrypoints leave the envelope to whichever file is read first.`,
        ),
      };
    }
    return { entrypoint: op.entrypoint };
  }

  if (claimants.length === 1) return { entrypoint: claimants[0] as string };
  if (claimants.length > 1) {
    return {
      issue: error(
        "sideeffects.operation-entrypoint-conflict",
        manifestFile,
        `entrypoints '${claimants.join("', '")}' each declare operation: ${op.id}. One operation runs one entrypoint's logic; two claims leave its envelope undecided.`,
      ),
    };
  }
  if (entrypoints.length === 1) return { entrypoint: (entrypoints[0] as Entrypoint).name };

  return {
    issue: error(
      "sideeffects.operation-entrypoint-unresolved",
      manifestFile,
      `operation ${op.id} exposes ${op.exposedBy}, which declares ${entrypoints.length} entrypoints and binds none of them to it. Name the entrypoint with operation: ${op.id} in ${manifestFile}, or with entrypoint: in ${POLICY_FILE}; the envelope cannot be guessed.`,
    ),
  };
}

interface SkillResult {
  readonly issues: Issue[];
  /** A prose body with no manifest to agree with: reported, never passed over. */
  readonly manifestMissing: boolean;
  /** True only when a manifest was read and compared. */
  readonly examined: boolean;
}

const NOTHING: SkillResult = { issues: [], manifestMissing: false, examined: false };

function checkOneSkill(
  id: string,
  root: string,
  vocabulary: ReadonlySet<string> | null,
  operations: ReadonlyArray<Operation>,
): SkillResult {
  const bodyPath = entryBodyPath("skills", id);
  const manifestFile = `skills/${id}/skill.yaml`;
  const body = readTextIfPresent(join(root, bodyPath));
  const manifestText = readTextIfPresent(join(root, manifestFile));

  // Neither surface exists: `catalog.entry-not-authored` already names this
  // skill on its own line, and nothing here has gone unexamined.
  if (body === null && manifestText === null) return NOTHING;
  if (manifestText === null) return { ...NOTHING, manifestMissing: true };

  const manifest = loadSkillManifest(root, id);
  // `schemas.document-unparseable` names this file with the parser's own
  // message. Reading zero effects out of it here would turn one accurate
  // report into several inaccurate ones.
  if (manifest.parseError !== undefined) return NOTHING;

  const issues: Issue[] = [];
  const declared = new Set(strings(manifest.raw["side_effects"]));
  const entrypoints = entrypointsOf(manifest.raw);

  if (body !== null && vocabulary !== null) {
    const front = parseFrontmatter(body);
    const prose = readSideEffectSection(front.body, front.bodyStartLine - 1, vocabulary);
    // `body.missing-section` owns a skill body with no `## Side effects`.
    if (prose !== null) issues.push(...checkProse(bodyPath, manifestFile, prose, declared));
  }

  for (const entrypoint of entrypoints) {
    if (entrypoint.effects === null) continue;
    const outside = entrypoint.effects.filter((effect) => !declared.has(effect));
    if (outside.length === 0) continue;
    issues.push(
      error(
        "sideeffects.entrypoint-effect-not-in-skill",
        manifestFile,
        `entrypoint '${entrypoint.name}' declares ${list(outside)}, which the skill-level side_effects does not. The skill-level list is what ## Side effects mirrors, so an effect only an entrypoint declares is absent from the prose the agent reads.`,
      ),
    );
  }

  // Only when every entrypoint narrows. An entrypoint that declares nothing
  // claims the whole skill-level list, so the union would be that list and the
  // comparison would say nothing whatever the skill declared.
  if (entrypoints.length > 0 && entrypoints.every((e) => e.effects !== null)) {
    const union = new Set(entrypoints.flatMap((e) => [...(e.effects ?? [])]));
    const orphaned = [...declared].filter((effect) => !union.has(effect));
    if (orphaned.length > 0) {
      issues.push(
        error(
          "sideeffects.skill-effect-no-entrypoint",
          manifestFile,
          `side_effects declares ${list(orphaned)}, which no entrypoint performs. The skill-level list is what its entrypoints add up to; an effect above all of them is claimed by nothing that runs.`,
        ),
      );
    }
  }

  const bound = new Map<string, Operation[]>();
  for (const op of operations) {
    if (op.exposedBy !== id) continue;
    const binding = bindOperation(op, manifestFile, entrypoints);
    if ("issue" in binding) {
      issues.push(binding.issue);
      continue;
    }
    const existing = bound.get(binding.entrypoint);
    if (existing === undefined) bound.set(binding.entrypoint, [op]);
    else existing.push(op);
  }

  for (const [name, ops] of bound) {
    const entrypoint = entrypoints.find((e) => e.name === name);
    const effects = entrypoint?.effects ?? null;
    const performs = new Set(effects ?? [...declared]);
    const permitted = new Set(ops.flatMap((op) => [...op.effects]));
    const inherited = effects === null ? ", inherited from the skill-level list it does not narrow" : "";

    const unpermitted = [...performs].filter((effect) => !permitted.has(effect));
    if (unpermitted.length > 0) {
      issues.push(
        error(
          "sideeffects.entrypoint-effect-unpermitted",
          manifestFile,
          `entrypoint '${name}'${inherited} declares ${list(unpermitted)}, which no operation reaching it permits (${ops.map((op) => op.id).join(", ")} in ${POLICY_FILE}). The runner validates a grant against the operation's declared effects; an effect outside them happens with nothing gating it.`,
        ),
      );
    }

    for (const op of ops) {
      const undeclared = op.effects.filter((effect) => !performs.has(effect));
      if (undeclared.length === 0) continue;
      issues.push(
        error(
          "sideeffects.operation-effect-undeclared",
          manifestFile,
          `operation ${op.id} in ${POLICY_FILE} permits ${list(undeclared)}, which entrypoint '${name}'${inherited} does not declare. A grant envelope wider than the skill it covers authorizes an effect nothing says the skill performs.`,
        ),
      );
    }
  }

  return { issues, manifestMissing: false, examined: true };
}

export function checkSideEffects(ctx: CheckContext): Issue[] {
  const { root, catalog } = ctx;
  const vocabulary = sideEffectVocabulary(root);
  const policy = loadOperations(root);

  const issues: Issue[] = [];
  const missingManifests: string[] = [];
  let examined = 0;

  for (const entry of catalog.bySection("skills")) {
    const result = checkOneSkill(entry.id, root, vocabulary, policy.operations);
    issues.push(...result.issues);
    if (result.manifestMissing) missingManifests.push(entry.id);
    if (result.examined) examined += 1;
  }

  for (const id of missingManifests) {
    issues.push(
      skipped(
        "sideeffects.manifest-unavailable",
        `skills/${id}/skill.yaml`,
        "skill side effects",
        `${entryBodyPath("skills", id)} exists and declares its effects in prose, but there is no skill.yaml to agree with, so neither the §4.1 mirror nor the operation envelopes were compared for this skill.`,
      ),
    );
  }

  if (vocabulary === null && (examined > 0 || missingManifests.length > 0)) {
    issues.push(
      skipped(
        "sideeffects.vocabulary-unavailable",
        COMMON_SCHEMA,
        "side-effect vocabulary",
        `${COMMON_SCHEMA} has no readable $defs/side_effect enum, so no backticked token in a ## Side effects section could be told from an effect and the prose was not compared with any manifest.`,
      ),
    );
  }

  if (policy.state === "unreadable" && examined > 0) {
    issues.push(
      skipped(
        "sideeffects.policy-unavailable",
        POLICY_FILE,
        "side-effect envelopes",
        `The invocation policy exists and could not be parsed, so the operations it declares went unread and the ${examined} authored skill manifest${examined === 1 ? "" : "s"} here were compared against no grant envelope.`,
      ),
    );
  }

  return issues;
}
