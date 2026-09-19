/**
 * Activation signals for `ak attach`.
 *
 * The selector attaches packs by artifact and semantics. A file extension is
 * never decisive on its own: extension-shaped patterns appear only as
 * `supporting` evidence, or folded into a pattern that also carries meaning
 * (a lockfile name, a migration directory).
 *
 * These built-in signals are the lookup path that works with no classifier and
 * no pack manifest on disk. A manifest may add signals; for the packs in
 * NEVER_DROPPED_PACKS it may not take any away.
 */

export type SignalKind = "path-regex" | "content-regex" | "field-present" | "field-regex";

export const SIGNAL_KINDS: readonly SignalKind[] = [
  "path-regex",
  "content-regex",
  "field-present",
  "field-regex",
];

export type SignalWeight = "sufficient" | "supporting";

export interface Signal {
  readonly kind: SignalKind;
  /** Regex source for path/content signals; a dotted field path for field signals. */
  readonly pattern: string;
  /** Regex source matched against the resolved field value, for `field-regex`. */
  readonly value?: string;
  readonly weight: SignalWeight;
  readonly note: string;
  /** Where the signal came from, for the rationale. */
  readonly origin?: string;
}

export interface PackSignals {
  readonly pack: string;
  readonly signals: readonly Signal[];
}

/**
 * Security, API and data facts must never be dropped for want of a classifier.
 * A pack manifest may extend these three; it may not disable them.
 */
export const NEVER_DROPPED_PACKS: ReadonlySet<string> = new Set([
  "pack-api",
  "pack-data",
  "pack-secure",
]);

const SOURCE_FILE = String.raw`\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|swift|scala|c|cc|cpp|h|hpp|cs|php|ex|exs)$`;

export const BUILTIN_SIGNALS: readonly PackSignals[] = [
  {
    pack: "pack-api",
    signals: [
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(api|apis|routes?|controllers?|endpoints?|handlers?|graphql|grpc|proto|openapi|swagger|contracts?)([/._-]|$)`,
        weight: "sufficient",
        note: "path names a public interface surface",
      },
      {
        kind: "path-regex",
        pattern: String.raw`\.(proto|graphql|graphqls)$`,
        weight: "sufficient",
        note: "interface definition language file",
      },
      {
        kind: "content-regex",
        pattern: String.raw`(^|\n)\s*(openapi|swagger)\s*:`,
        weight: "sufficient",
        note: "document declares an OpenAPI/Swagger contract",
      },
      {
        kind: "content-regex",
        pattern: String.raw`(RestController|RequestMapping|app\.(get|post|put|patch|delete)\(|router\.(get|post|put|patch|delete)\(|export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b)`,
        weight: "sufficient",
        note: "code declares a request handler with an observable response shape",
      },
      {
        kind: "field-present",
        pattern: "write_ownership.interfaces",
        weight: "sufficient",
        note: "artifact claims ownership of an interface",
      },
    ],
  },
  {
    pack: "pack-data",
    signals: [
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(migrations?|migrate|backfills?|seeds?|db|database)([/._-]|$)`,
        weight: "sufficient",
        note: "path names persistent-data work",
      },
      {
        kind: "path-regex",
        pattern: String.raw`\.sql$`,
        weight: "sufficient",
        note: "SQL statement file",
      },
      {
        kind: "content-regex",
        pattern: String.raw`\b(CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|DROP\s+COLUMN|ADD\s+COLUMN|RENAME\s+COLUMN|create_table|add_column|remove_column|addColumn|dropColumn|backfill)\b`,
        weight: "sufficient",
        note: "content changes a persistent schema or rewrites stored rows",
      },
      {
        kind: "field-present",
        pattern: "write_ownership.migration_sequence",
        weight: "sufficient",
        note: "artifact claims a global migration sequence",
      },
    ],
  },
  {
    pack: "pack-delete",
    signals: [
      {
        kind: "content-regex",
        pattern: String.raw`(@[Dd]eprecated|\bdeprecat(e|ed|es|ing|ion)\b|\bsunset\b|\bremoval\s+plan\b|\bretire(d|s|ment)?\b|\btombstone\b)`,
        weight: "sufficient",
        note: "content states a removal, deprecation or replacement",
      },
      {
        kind: "field-regex",
        pattern: "goal",
        value: String.raw`\b(remove|delete|deprecate|retire|sunset|decommission)\b`,
        weight: "sufficient",
        note: "artifact goal is a removal",
      },
      {
        kind: "path-regex",
        pattern: String.raw`\.(md|markdown|txt|rst)$`,
        weight: "supporting",
        note: "prose file; removal intent is often stated in prose, but the file type alone is not evidence",
      },
    ],
  },
  {
    pack: "pack-deps",
    signals: [
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(package\.json|package-lock\.json|bun\.lock|bun\.lockb|yarn\.lock|pnpm-lock\.yaml|Gemfile|Gemfile\.lock|requirements\.txt|poetry\.lock|Pipfile|Pipfile\.lock|go\.mod|go\.sum|Cargo\.toml|Cargo\.lock|pom\.xml|build\.gradle|build\.gradle\.kts|composer\.json|composer\.lock|mix\.exs|\.tool-versions|Dockerfile)$`,
        weight: "sufficient",
        note: "dependency manifest or lockfile",
      },
      {
        kind: "content-regex",
        pattern: String.raw`\b(dependencies|devDependencies|peerDependencies)\b\s*:`,
        weight: "sufficient",
        note: "document declares dependency sets",
      },
    ],
  },
  {
    pack: "pack-frontend",
    signals: [
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(components?|ui|views?|pages?|styles?|stylesheets?|frontend|client)([/._-]|$)`,
        weight: "sufficient",
        note: "path names a user-facing surface",
      },
      {
        kind: "content-regex",
        pattern: String.raw`(\buseState\b|\buseEffect\b|className=|<template>|@media\b|\baria-[a-z]+=|styled\.|\btailwind\b)`,
        weight: "sufficient",
        note: "content renders or styles a user-facing surface",
      },
      {
        kind: "path-regex",
        pattern: String.raw`\.(tsx|jsx|vue|svelte|css|scss|sass|less|html)$`,
        weight: "supporting",
        note: "view or stylesheet file type",
      },
    ],
  },
  {
    pack: "pack-perf",
    signals: [
      {
        kind: "content-regex",
        pattern: String.raw`\b(p9[59]|latency\s+budget|performance\s+budget|throughput\s+target|memory\s+budget|benchmark|flame\s*graph|N\+1)\b`,
        weight: "sufficient",
        note: "a performance budget is stated or a measurement is cited",
      },
      {
        kind: "field-present",
        pattern: "performance_budget",
        weight: "sufficient",
        note: "artifact carries a performance budget",
      },
    ],
  },
  {
    pack: "pack-secure",
    signals: [
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(auth|authn|authz|security|secrets?|crypto|session|permissions?|entitlements?|tenancy|tenant|payments?|billing|login|password)([/._-]|$)`,
        weight: "sufficient",
        note: "path names a security boundary",
      },
      {
        kind: "content-regex",
        pattern: String.raw`\b(Authorization|authenticat(e|ed|ion)|authoriz(e|ed|ation)|jwt|oauth|csrf|xsrf|api[_-]?key|secret[_-]?key|private[_-]?key|password|bearer|tenant_id|principal|rbac|acl)\b`,
        weight: "sufficient",
        note: "content handles credentials, identity or access control",
      },
      {
        kind: "field-regex",
        pattern: "write_ownership.interfaces[].name",
        value: String.raw`\b(auth|token|session|permission|credential)`,
        weight: "sufficient",
        note: "artifact owns an interface on a security boundary",
      },
    ],
  },
  {
    pack: "pack-test",
    signals: [
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(tests?|__tests__|spec|specs)([/._-]|$)`,
        weight: "sufficient",
        note: "path names a test tree",
      },
      {
        kind: "path-regex",
        pattern: String.raw`\.(test|spec)\.[a-z]+$`,
        weight: "sufficient",
        note: "test file",
      },
      {
        kind: "path-regex",
        pattern: SOURCE_FILE,
        weight: "sufficient",
        note: "source file: new or changed behavior needs named verification",
      },
    ],
  },
];

export function builtinSignalsFor(pack: string): readonly Signal[] {
  return BUILTIN_SIGNALS.find((p) => p.pack === pack)?.signals ?? [];
}
