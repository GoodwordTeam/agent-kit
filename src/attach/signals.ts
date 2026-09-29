/**
 * Activation signals for `ak attach`.
 *
 * The selector attaches packs by artifact and semantics. A file extension is
 * never decisive on its own: extension-shaped patterns appear only as
 * `supporting` evidence, or folded into a pattern that also carries meaning
 * (a lockfile name, a migration directory).
 *
 * This table is the whole lookup. `packs/<id>/pack.yaml` states each pack's
 * activation rules in words, and its schema admits no signal list, so the
 * deterministic half of those rules lives here as code and nothing on disk can
 * add to it or switch it off. Each signal names every `activation.rules[].id`
 * its observation is evidence for, so a selection cites the rules a reader can
 * find in the pack. One path or token is often evidence for several rules at
 * once (a manifest may add, bump or re-policy a dependency), and naming only
 * one would claim a precision the observation does not have. A rule in
 * `SEMANTIC_ONLY_RULES` is never cited: no observation here tells it apart.
 */

export type SignalKind = "path-regex" | "content-regex" | "field-present" | "field-regex";

export type SignalWeight = "sufficient" | "supporting";

export interface Signal {
  readonly kind: SignalKind;
  /** Regex source for path/content signals; a dotted field path for field signals. */
  readonly pattern: string;
  /** Regex source matched against the resolved field value, for `field-regex`. */
  readonly value?: string;
  readonly weight: SignalWeight;
  readonly note: string;
  /** Every `activation.rules[].id` in this pack's pack.yaml the observation is evidence for. */
  readonly rules: readonly string[];
}

export interface PackSignals {
  readonly pack: string;
  readonly signals: readonly Signal[];
}

/**
 * Activation rules no built-in signal implements, with the reason.
 *
 * Each is a rule whose deciding fact is semantic: it lives in data flow, in a
 * diff, or in a ticket's intent, and no path, token or field of one subject as
 * it stands tells it apart. A regex written for one would select on something
 * other than what the rule says. These rules are still in force wherever a
 * phase judges the artifact itself; `ak attach` just cannot see them.
 */
export const SEMANTIC_ONLY_RULES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "pack-api": {
    "api-version-change":
      "a version prefix or header is on every versioned route; whether one changed is a property of the diff",
  },
  "pack-frontend": {
    "user-visible-strings": "whether text is user-visible, or bypasses the project's i18n mechanism, is not a token",
  },
  "pack-secure": {
    "untrusted-input-sink": "whether untrusted data reaches a sink is data flow across code, not a pattern in one file",
  },
  "pack-test": {
    "bug-fix":
      "the rule needs the fix and the reported defect it answers; a goal saying fix, bug or regression establishes neither, where a removal goal states the removal itself",
  },
};

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
        rules: ["public-boundary-shape", "public-signature-with-callers", "state-changing-endpoint-retry"],
      },
      {
        kind: "path-regex",
        pattern: String.raw`\.(proto|graphql|graphqls)$`,
        weight: "sufficient",
        note: "interface definition language file",
        rules: ["public-boundary-shape"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`(^|\n)\s*(openapi|swagger)\s*:`,
        weight: "sufficient",
        note: "document declares an OpenAPI/Swagger contract",
        rules: ["public-boundary-shape"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`(RestController|RequestMapping|app\.(get|post|put|patch|delete)\(|router\.(get|post|put|patch|delete)\(|export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b)`,
        weight: "sufficient",
        note: "code declares a request handler with an observable response shape",
        rules: ["public-boundary-shape"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`(app\.(post|put|patch|delete)\(|router\.(post|put|patch|delete)\(|export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b)`,
        weight: "sufficient",
        note: "code declares a handler for a state-changing method",
        rules: ["public-boundary-shape", "state-changing-endpoint-retry"],
      },
      {
        kind: "field-present",
        pattern: "write_ownership.interfaces",
        weight: "sufficient",
        note: "artifact names interfaces it defines, consumes or changes",
        rules: ["public-boundary-shape", "public-signature-with-callers"],
      },
    ],
  },
  {
    pack: "pack-data",
    signals: [
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(migrations?|migrate)([/._-]|$)`,
        weight: "sufficient",
        note: "path names schema migration work",
        rules: ["migration-artifact"],
      },
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(db|database)([/._-]|$)`,
        weight: "sufficient",
        note: "path names database work: a migration or a script run against stored data",
        rules: ["migration-artifact", "data-transform-script"],
      },
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(backfills?|seeds?)([/._-]|$)`,
        weight: "sufficient",
        note: "path names a job that writes stored rows",
        rules: ["data-transform-script"],
      },
      {
        kind: "path-regex",
        pattern: String.raw`\.sql$`,
        weight: "sufficient",
        note: "SQL statement file",
        rules: ["migration-artifact", "data-transform-script"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`\b(CREATE\s+TABLE|ALTER\s+TABLE|ADD\s+COLUMN|create_table|add_column|addColumn)\b`,
        weight: "sufficient",
        note: "content changes a persistent schema",
        rules: ["migration-artifact"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`\b(DROP\s+TABLE|DROP\s+COLUMN|RENAME\s+COLUMN|remove_column|dropColumn)\b`,
        weight: "sufficient",
        note: "content drops or renames a table or column",
        rules: ["destructive-schema-step", "migration-artifact"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`\bbackfill\b`,
        weight: "sufficient",
        note: "content rewrites stored rows",
        rules: ["data-transform-script"],
      },
      {
        kind: "field-present",
        pattern: "write_ownership.migration_sequence",
        weight: "sufficient",
        note: "artifact claims a global migration sequence",
        rules: ["migration-artifact"],
      },
    ],
  },
  {
    pack: "pack-delete",
    signals: [
      {
        kind: "content-regex",
        pattern: String.raw`(@[Dd]eprecated|\bdeprecat(e|ed|es|ing|ion)\b|\bsunset\b)`,
        weight: "sufficient",
        note: "content states a deprecation",
        rules: ["deprecation-or-replacement"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`(\bremoval\s+plan\b|\bretire(d|s|ment)?\b|\btombstone\b)`,
        weight: "sufficient",
        note: "content states a removal",
        rules: ["removal"],
      },
      {
        kind: "field-regex",
        pattern: "goal",
        value: String.raw`\b(remove|delete|deprecate|retire|sunset|decommission)\b`,
        weight: "sufficient",
        note: "artifact goal is a removal",
        rules: ["removal", "deprecation-or-replacement"],
      },
      {
        kind: "path-regex",
        pattern: String.raw`\.(md|markdown|txt|rst)$`,
        weight: "supporting",
        note: "prose file; removal intent is often stated in prose, but the file type alone is not evidence",
        rules: ["deprecation-or-replacement", "removal"],
      },
    ],
  },
  {
    pack: "pack-deps",
    signals: [
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(package\.json|Gemfile|requirements\.txt|Pipfile|go\.mod|Cargo\.toml|pom\.xml|build\.gradle|build\.gradle\.kts|composer\.json|mix\.exs)$`,
        weight: "sufficient",
        note: "dependency manifest",
        rules: ["new-dependency", "version-bump", "install-policy-change"],
      },
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(package-lock\.json|bun\.lock|bun\.lockb|yarn\.lock|pnpm-lock\.yaml|Gemfile\.lock|poetry\.lock|Pipfile\.lock|go\.sum|Cargo\.lock|composer\.lock)$`,
        weight: "sufficient",
        note: "lockfile: resolved versions",
        rules: ["version-bump", "new-dependency", "install-policy-change"],
      },
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(\.tool-versions|Dockerfile)$`,
        weight: "sufficient",
        note: "declared toolchain or install environment",
        rules: ["install-policy-change"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`\b(dependencies|devDependencies|peerDependencies)\b\s*:`,
        weight: "sufficient",
        note: "document declares dependency sets",
        rules: ["new-dependency", "version-bump"],
      },
    ],
  },
  {
    pack: "pack-frontend",
    signals: [
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(components?|ui|views?|pages?|frontend|client)([/._-]|$)`,
        weight: "sufficient",
        note: "path names a user-facing surface",
        rules: ["interactive-ui", "styles-and-layout", "async-ui-state"],
      },
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(styles?|stylesheets?)([/._-]|$)`,
        weight: "sufficient",
        note: "path names styles",
        rules: ["styles-and-layout"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`(<template>|\baria-[a-z]+=)`,
        weight: "sufficient",
        note: "content renders an interactive surface",
        rules: ["interactive-ui"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`(className=|@media\b|styled\.|\btailwind\b)`,
        weight: "sufficient",
        note: "content styles a user-facing surface",
        rules: ["styles-and-layout"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`(\buseState\b|\buseEffect\b)`,
        weight: "sufficient",
        note: "content holds client state or effects",
        rules: ["async-ui-state"],
      },
      {
        kind: "path-regex",
        pattern: String.raw`\.(tsx|jsx|vue|svelte|html)$`,
        weight: "supporting",
        note: "view file type",
        rules: ["interactive-ui", "styles-and-layout", "async-ui-state"],
      },
      {
        kind: "path-regex",
        pattern: String.raw`\.(css|scss|sass|less)$`,
        weight: "supporting",
        note: "stylesheet file type",
        rules: ["styles-and-layout"],
      },
    ],
  },
  {
    pack: "pack-perf",
    signals: [
      {
        kind: "content-regex",
        pattern: String.raw`\b(p9[59]|latency\s+budget|performance\s+budget|throughput\s+target|memory\s+budget)\b`,
        weight: "sufficient",
        note: "a performance budget is stated",
        rules: ["budgeted-change"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`\b(benchmark|flame\s*graph|N\+1)\b`,
        weight: "sufficient",
        note: "a measurement is cited",
        rules: ["measured-problem"],
      },
      {
        kind: "field-present",
        pattern: "performance_budget",
        weight: "sufficient",
        note: "artifact carries a performance budget",
        rules: ["budgeted-change"],
      },
    ],
  },
  {
    pack: "pack-secure",
    signals: [
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(auth|authn|authz|security|session|permissions?|entitlements?|tenancy|tenant|login)([/._-]|$)`,
        weight: "sufficient",
        note: "path names an access-control boundary",
        rules: ["authn-authz-change"],
      },
      {
        kind: "path-regex",
        pattern: String.raw`(^|/)(secrets?|crypto|payments?|billing|password)([/._-]|$)`,
        weight: "sufficient",
        note: "path names secrets or sensitive data",
        rules: ["secret-or-sensitive-data"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`\b(Authorization|authenticat(e|ed|ion)|authoriz(e|ed|ation)|jwt|oauth|bearer|tenant_id|principal|rbac|acl)\b`,
        weight: "sufficient",
        note: "content handles identity or access control",
        rules: ["authn-authz-change"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`\b(api[_-]?key|secret[_-]?key|private[_-]?key|password)\b`,
        weight: "sufficient",
        note: "content handles credentials",
        rules: ["secret-or-sensitive-data"],
      },
      {
        kind: "content-regex",
        pattern: String.raw`\b(csrf|xsrf)\b`,
        weight: "sufficient",
        note: "content configures request-forgery protection",
        rules: ["trust-boundary-config"],
      },
      {
        kind: "field-regex",
        pattern: "write_ownership.interfaces[].name",
        value: String.raw`\b(auth|token|session|permission|credential)`,
        weight: "sufficient",
        note: "artifact owns an interface on a security boundary",
        rules: ["authn-authz-change"],
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
        rules: ["test-change"],
      },
      {
        kind: "path-regex",
        pattern: String.raw`\.(test|spec)\.[a-z]+$`,
        weight: "sufficient",
        note: "test file",
        rules: ["test-change"],
      },
      {
        kind: "path-regex",
        pattern: SOURCE_FILE,
        weight: "sufficient",
        note: "source file: new or changed behavior needs named verification",
        rules: ["behavior-change"],
      },
    ],
  },
];

export function builtinSignalsFor(pack: string): readonly Signal[] {
  return BUILTIN_SIGNALS.find((p) => p.pack === pack)?.signals ?? [];
}
