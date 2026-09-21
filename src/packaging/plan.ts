import { join, posix } from "node:path";

import { entryBodyPath } from "../catalog/layout.ts";
import { readTextIfPresent, walkFiles } from "../util/fs.ts";
import { parseFrontmatter } from "../util/frontmatter.ts";
import { extractRelativeLinks, relativeLinkBetween, resolveFromFile } from "../util/links.ts";
import type { CheckContext } from "../validation/context.ts";
import { error, note, type Issue } from "../validation/types.ts";
import { generateHostFrontmatter, type SkillMode } from "./frontmatter.ts";
import { loadHostCapabilities, type HostId } from "./hosts.ts";
import { loadSkillManifest } from "./manifest.ts";
import { resolveProfile } from "./profiles.ts";

/** Trees that exist only in the source repository and are never installed. */
const SOURCE_ONLY_PREFIXES = ["research/", "provenance/", "src/", "tests/", "dist/", ".donors/", ".work/", "node_modules/"];

/** Where the packager parks a copied shared dependency, preserving its source layout. */
export const SHARED_ROOT = "references/shared";

/**
 * Each host's own manifest, carrying host keys only, at the path that host reads.
 *
 * Keyed by host because it was a single string, and a single string is how one
 * bundle came to be emitted twice under two names: `dist/codex` carried
 * `.claude-plugin/plugin.json`, the other host's directory, and every check
 * passed because both bundles were being measured against the same constant.
 * `adapters/claude-code/CONTRACT.md` §1 and `adapters/codex/CONTRACT.md` §2
 * each give their own path.
 */
export const HOST_MANIFEST_FILE: Record<HostId, string> = {
  "claude-code": ".claude-plugin/plugin.json",
  codex: ".codex-plugin/plugin.json",
};

/**
 * Where this package records what its own build decided, beside that host's
 * manifest.
 *
 * Separate from the host manifest because `claude plugin validate --strict`
 * errors on a key it does not define. Named here rather than spelled out at
 * each use: the previous spelling-it-out is what let a reader-facing message go
 * on naming the host manifest after the record moved out of it.
 *
 * It moved with the manifest rather than staying put. Left behind, the codex
 * bundle would still ship a `.claude-plugin/` directory holding one file --
 * the same defect as before, one file further down, and invisible to any check
 * that asks only about `plugin.json`.
 */
export const BUILD_RECORD_FILE: Record<HostId, string> = {
  "claude-code": ".claude-plugin/ak.json",
  codex: ".codex-plugin/ak.json",
};

/**
 * The licence files every bundle carries at its root, copied verbatim.
 *
 * A licensing obligation rather than bundle tidiness: six donors are MIT, MIT
 * requires the copyright notice and the permission notice accompany every copy,
 * and `dist/` is the copy that gets distributed. Absence is an `error()` for
 * that reason -- a build that quietly omits them reports success over a
 * distribution that may not lawfully be distributed, which is the worst shape
 * this package has a name for.
 *
 * Emitted from here, once, for every host rather than per adapter. Both host
 * contracts specify the same two names at the same place
 * (`adapters/claude-code/CONTRACT.md` §1, `adapters/codex/CONTRACT.md` §2), and
 * two bundles disagreeing about their own licensing is the defect this package
 * has already produced once in a different field.
 */
const LICENCE_FILES = ["NOTICE", "LICENSE"];

export interface BundleFile {
  /** Path inside dist/<host>/. */
  path: string;
  contents: string;
  /** Repo-relative source, when the file was copied rather than generated. */
  source?: string;
}

export interface HostDecision {
  skill: string;
  mode: SkillMode;
  rejected: string[];
  unenforceable: string[];
}

export interface BundlePlan {
  host: HostId;
  /** The profile applied, or `"all"`. Always set: every plan applied one. */
  profile: string;
  files: Map<string, BundleFile>;
  decisions: HostDecision[];
  issues: Issue[];
}

export interface PlanOptions {
  profile?: string;
}

function isSourceOnly(path: string): boolean {
  return SOURCE_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function publishedPathFor(sourcePath: string, includedSkillDirs: ReadonlySet<string>): string | null {
  const skillDir = /^skills\/([^/]+)\//.exec(sourcePath)?.[1];
  if (skillDir !== undefined) return includedSkillDirs.has(skillDir) ? sourcePath : null;
  if (isSourceOnly(sourcePath)) return null;
  return posix.join(SHARED_ROOT, sourcePath);
}

/**
 * Rewrite every relative reference in `text` so it resolves inside the bundle,
 * pulling each referenced file in as a dependency. Returns the rewritten text
 * and the source paths that must also be copied.
 */
function rewriteLinks(
  sourcePath: string,
  publishedPath: string,
  text: string,
  includedSkillDirs: ReadonlySet<string>,
  file: string,
): { text: string; dependencies: string[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const dependencies: string[] = [];
  let out = text;

  for (const link of extractRelativeLinks(text)) {
    const resolved = resolveFromFile(sourcePath, link.target);
    if (resolved === null) continue; // checkSourceLinks owns escaping references.

    const targetPublished = publishedPathFor(resolved, includedSkillDirs);
    if (targetPublished === null) {
      issues.push(
        error(
          "packaging.not-bundleable",
          file,
          `Reference '${link.target}' resolves to '${resolved}', which is never installed. An installed skill may not reference a source-tree-only path or an excluded skill.`,
          link.line,
        ),
      );
      continue;
    }

    dependencies.push(resolved);
    const wanted = relativeLinkBetween(publishedPath, targetPublished);
    if (wanted === link.target) continue;
    const anchor = link.anchor === undefined ? "" : `#${link.anchor}`;
    const replacement = link.raw.replace(`${link.target}${anchor}`, `${wanted}${anchor}`);
    out = out.split(link.raw).join(replacement);
  }

  return { text: out, dependencies, issues };
}

export function planBundle(ctx: CheckContext, host: HostId, options: PlanOptions): BundlePlan {
  const { root, catalog } = ctx;
  const issues: Issue[] = [];
  const files = new Map<string, BundleFile>();
  const decisions: HostDecision[] = [];

  const capabilities = loadHostCapabilities(root, host);
  issues.push(...capabilities.issues);

  const membership = resolveProfile(root, catalog, options.profile);
  issues.push(...membership.issues);

  /**
   * A skill the catalog has not authored yet is excluded from the bundle, not
   * a reason the bundle cannot be built.
   *
   * Treating a missing body as a packaging error meant `ak build` could emit
   * nothing until the last of the declared skills was written: 33 errors that
   * said nothing about the bundle and blocked every release before the final
   * one. `status` is the catalog's own statement about what exists, so it
   * decides membership, and a body that is genuinely missing from an
   * `authored` skill is still an error below.
   *
   * Keyed on the catalog rather than on whether a file is present, which is
   * the difference between an exclusion and a silent drop: a body sitting in
   * the tree under a `contract` entry is excluded too, and the author hears
   * about it from `catalog.status-behind-body`. Built in catalog order because
   * this list reaches `.claude-plugin/plugin.json`, whose bytes `ak build
   * --check` compares.
   */
  const selected = new Set(membership.skills);
  const included = new Set<string>();
  const excluded: Array<{ skill: string; reason: string }> = [];
  for (const entry of catalog.bySection("skills")) {
    if (!selected.has(entry.id)) continue;
    if (entry.status === "authored") {
      included.add(entry.id);
      continue;
    }
    excluded.push({ skill: entry.id, reason: `status: ${entry.status}` });
  }

  /**
   * Excluding every skill does not produce a small bundle, it produces no
   * bundle -- a directory holding its own manifest and nothing to install.
   * Reporting success over that would be the defect the exclusion was meant to
   * remove, wearing a green run instead of an error count, so a bundle with
   * nothing left in it fails.
   *
   * This is also what keeps the exclusion an unblocking change: the build goes
   * green on the first authored skill rather than on the last.
   */
  if (included.size === 0 && excluded.length > 0) {
    issues.push(
      error(
        "packaging.empty-bundle",
        "catalog.yaml",
        `Every skill selected for this bundle is excluded, so it would contain no skills at all: ${excluded.map((e) => e.skill).join(", ")}. A bundle is emitted once at least one selected skill is authored.`,
      ),
    );
  }

  /**
   * Said out loud, because the build record is a file nobody opens on a green
   * run and a bundle quietly missing most of its skills is exactly the failure
   * this package keeps finding elsewhere.
   *
   * The filename is written once and used for both the issue's `file` and the
   * sentence that sends a reader there. It was written twice before, and when
   * the `ak` block moved out of the host manifest into `ak.json` both copies
   * were left naming the manifest -- a note pointing at a file that no longer
   * carried what the note promised it did.
   */
  if (excluded.length > 0) {
    issues.push(
      note(
        "packaging.excluded-unauthored",
        BUILD_RECORD_FILE[host],
        `${excluded.length} skill(s) are excluded from this bundle because catalog.yaml does not declare them authored: ${excluded.map((e) => e.skill).join(", ")}. The exclusion and its reason are recorded in ${BUILD_RECORD_FILE[host]}.`,
      ),
    );
  }

  const ordered = catalog.bySection("skills").filter((e) => included.has(e.id));
  const emitted: string[] = [];
  const pending: Array<{ source: string; published: string }> = [];

  for (const entry of ordered) {
    const bodyPath = entryBodyPath("skills", entry.id);
    const body = readTextIfPresent(join(root, bodyPath));
    if (body === null) {
      issues.push(error("packaging.skill-body-missing", bodyPath, `Skill '${entry.id}' is included in the bundle but has no ${bodyPath}.`));
      continue;
    }

    const manifest = loadSkillManifest(root, entry.id);
    if (manifest.parseError !== undefined) {
      issues.push(error("packaging.skill-yaml-unparseable", `skills/${entry.id}/skill.yaml`, manifest.parseError));
    }

    const unenforceable = manifest.requiresEnforced.filter((r) => !capabilities.enforces.has(r));
    const wantsAutonomous = manifest.autonomyModes.includes("autonomous");
    const mode: SkillMode = wantsAutonomous ? (unenforceable.length === 0 ? "autonomous" : "guided") : "manual";
    const rejected = wantsAutonomous && unenforceable.length > 0 ? ["autonomous"] : [];
    decisions.push({ skill: entry.id, mode, rejected, unenforceable });

    const canonical = parseFrontmatter(body);
    const generated = generateHostFrontmatter(entry, canonical, manifest, mode, unenforceable, host);
    const rewritten = rewriteLinks(bodyPath, bodyPath, canonical.body, included, bodyPath);
    issues.push(...rewritten.issues);

    files.set(bodyPath, { path: bodyPath, contents: `${generated.text}${rewritten.text}`, source: bodyPath });
    emitted.push(entry.id);
    for (const dep of rewritten.dependencies) {
      const published = publishedPathFor(dep, included);
      if (published !== null) pending.push({ source: dep, published });
    }

    // Skill-local assets travel with the skill, keeping their own links valid.
    for (const asset of skillAssets(root, entry.id)) {
      const text = readTextIfPresent(join(root, asset));
      if (text === null) continue;
      const assetRewrite = rewriteLinks(asset, asset, text, included, asset);
      issues.push(...assetRewrite.issues);
      files.set(asset, { path: asset, contents: assetRewrite.text, source: asset });
      for (const dep of assetRewrite.dependencies) {
        const published = publishedPathFor(dep, included);
        if (published !== null) pending.push({ source: dep, published });
      }
    }
  }

  // Transitive closure over shared dependencies.
  const done = new Set<string>();
  while (pending.length > 0) {
    const next = pending.shift();
    if (next === undefined) continue;
    if (done.has(next.source) || files.has(next.published)) continue;
    done.add(next.source);

    const text = readTextIfPresent(join(root, next.source));
    if (text === null) continue; // checkSourceLinks owns the dangling-source case.

    const rewritten = rewriteLinks(next.source, next.published, text, included, next.source);
    issues.push(...rewritten.issues);
    files.set(next.published, { path: next.published, contents: rewritten.text, source: next.source });
    for (const dep of rewritten.dependencies) {
      const published = publishedPathFor(dep, included);
      if (published !== null) pending.push({ source: dep, published });
    }
  }

  for (const name of LICENCE_FILES) {
    const text = readTextIfPresent(join(ctx.root, name));
    if (text === null) {
      issues.push(
        error(
          "packaging.licence-file-missing",
          name,
          `${name} is not in the source tree, so the bundle cannot carry it. MIT requires the copyright notice and the permission notice accompany every copy of the software, and dist/ is a copy that gets distributed. Write ${name} at the repository root.`,
        ),
      );
      continue;
    }
    files.set(name, { path: name, contents: text, source: name });
  }

  files.set(HOST_MANIFEST_FILE[host], {
    path: HOST_MANIFEST_FILE[host],
    contents: pluginManifest(ctx, host, emitted),
  });
  files.set(BUILD_RECORD_FILE[host], {
    path: BUILD_RECORD_FILE[host],
    contents: buildRecord(host, membership.profile, excluded, decisions, capabilities.enforces, capabilities.notes),
  });

  return { host, profile: membership.profile, files: sortFiles(files), decisions, issues };
}

function skillAssets(root: string, skillId: string): string[] {
  const out: string[] = [];
  for (const sub of ["references", "assets"]) {
    const dir = `skills/${skillId}/${sub}`;
    for (const file of walkFiles(root, dir)) out.push(file);
  }
  return out;
}

function sortFiles(files: Map<string, BundleFile>): Map<string, BundleFile> {
  return new Map([...files.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * The host's manifest, carrying host keys only.
 *
 * `claude plugin validate --strict` treats a key it does not define as an error
 * ("Unknown field 'ak'. Claude Code ignores it at load time."), so anything this
 * package wants to record about its own build goes in `buildRecord` instead.
 */
function pluginManifest(ctx: CheckContext, host: HostId, skills: ReadonlyArray<string>): string {
  const pkg = ctx.catalog.package;
  const manifest = {
    name: pkg.id,
    version: pkg.version,
    description: pkg.name,
    skills: skillRegistration(host, skills),
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * How each host is told which skills the bundle holds.
 *
 * The two forms are a contract difference, not a style one. claude-code
 * enumerates every path in catalog order, so load order is controlled rather
 * than glob-dependent and the manifest is the one place that states what this
 * bundle actually contains -- which matters because the install set is
 * profile-dependent (`adapters/claude-code/CONTRACT.md` §1). codex takes the
 * directory pointer its contract carries from the donor
 * (`adapters/codex/CONTRACT.md` §1).
 *
 * The forms resolve to the same set only because both bundles are built from
 * one `skills/` tree. That is a property of this function's caller rather than
 * of the manifests, and nothing in either manifest would show it breaking --
 * a pointer states no set to disagree with. The comparison in
 * `tests/packaging.test.ts` is what holds it, per §1: divergence between the
 * two bundles is a build failure, not a host difference.
 */
function skillRegistration(host: HostId, skills: ReadonlyArray<string>): string | string[] {
  return host === "codex" ? "./skills/" : skills.map((id) => `./skills/${id}`);
}

/**
 * What this build decided, written beside the host's manifest rather than
 * inside it. Read by people and by the release checks, never by the host.
 */
function buildRecord(
  host: HostId,
  /** Passed in, not re-derived: the record states the selection that was made. */
  profile: string,
  excluded: ReadonlyArray<{ skill: string; reason: string }>,
  decisions: ReadonlyArray<HostDecision>,
  enforces: ReadonlySet<string>,
  notes: ReadonlyArray<string>,
): string {
  const record = {
    profile,
    /**
     * Emitted even when empty. An absent key would read as "an older build
     * that did not record this" rather than "nothing was left out", and the
     * two have to be distinguishable in a file whose job is to say what the
     * bundle does not contain.
     */
    excluded: excluded.map((e) => ({ skill: e.skill, reason: e.reason })),
    host: { id: host, enforces: [...enforces].sort(), notes: [...notes] },
    modes: decisions.map((d) => ({ skill: d.skill, mode: d.mode })),
    autonomy_rejected: decisions
      .filter((d) => d.rejected.length > 0)
      .map((d) => ({ skill: d.skill, unenforceable: d.unenforceable })),
  };
  return `${JSON.stringify(record, null, 2)}\n`;
}
