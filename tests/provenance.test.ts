import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { checkProvenance, parseGLocator, parseLocatorField } from "../src/validation/provenance.ts";
import { loadCatalog } from "../src/catalog/load.ts";
import { writeAdaptations } from "../src/packaging/build.ts";
import { makeTree } from "./helpers/tree.ts";

const CATALOG = `schema_version: 1
package:
  id: ak
  name: agent-kit
  version: 0.1.0
  namespace: "/ak:"
  default_profile: core
skills:
  - id: adapted
    status: authored
    invocation: U
    provenance_origin: donor
  - id: invented
    status: authored
    invocation: M
    provenance_origin: conversation
schemas:
  - id: common
    status: contract
`;

const TRANSCRIPT = `${"line\n".repeat(2264)}`;

function ctxFor(files: Record<string, string>) {
  const root = makeTree({
    "catalog.yaml": CATALOG,
    "skills/adapted/SKILL.md": "---\nname: adapted\ndescription: d\n---\nbody\n",
    "skills/invented/SKILL.md": "---\nname: invented\ndescription: d\n---\nbody\n",
    "research/sources/grok-transcript.md": TRANSCRIPT,
    ...files,
  });
  const { catalog } = loadCatalog(root);
  if (catalog === null) throw new Error("fixture has no catalog");
  return { root, catalog };
}

/** A real donor clone: the pin check shells out to git, so the test does too. */
function makeDonorRepo(root: string, dir: string, files: Record<string, string>): string {
  const full = join(root, dir);
  mkdirSync(full, { recursive: true });
  const git = (...args: string[]) => execFileSync("git", ["-C", full, ...args], { encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "T");
  for (const [rel, contents] of Object.entries(files)) {
    mkdirSync(join(full, rel, ".."), { recursive: true });
    writeFileSync(join(full, rel), contents);
  }
  git("add", "-A");
  git("commit", "-q", "-m", "seed");
  return git("rev-parse", "HEAD").trim();
}

function lockFor(commit: string): string {
  return `schema_version: 1
donors:
  - id: donor-one
    repo: example/one
    path: .donors/donor_one
    commit: ${commit}
    license: MIT
`;
}

/**
 * The real map is capability-keyed: one row per capability, pointing at the
 * entry directory it landed in. An entry's coverage is therefore resolved
 * through `destination`, never through an id that happens to match.
 */
const CONVERSATION_MAP = `schema_version: 1
capabilities:
  - id: invented-capability
    disposition: retained
    destination: skills/invented
    origin: conversation
    locator: G:L1672-1676
`;

describe("G:L locator parsing", () => {
  test("accepts a single line and a range", () => {
    expect(parseGLocator("G:L1672")).toEqual({ start: 1672, end: 1672 });
    expect(parseGLocator("G:L1672-1676")).toEqual({ start: 1672, end: 1676 });
  });

  test("rejects a malformed locator", () => {
    expect(parseGLocator("L1672")).toBeNull();
    expect(parseGLocator("G:1672")).toBeNull();
    expect(parseGLocator("G:L")).toBeNull();
  });

  test("rejects an inverted range: start must be <= end", () => {
    expect(parseGLocator("G:L1676-1672")).toBeNull();
  });
});

describe("donor provenance", () => {
  test("an adapted file whose donor path exists at the pin passes", () => {
    const root = makeTree({
      "catalog.yaml": CATALOG,
      "skills/adapted/SKILL.md": "---\nname: adapted\ndescription: d\n---\nbody\n",
      "skills/invented/SKILL.md": "---\nname: invented\ndescription: d\n---\nbody\n",
      "research/sources/grok-transcript.md": TRANSCRIPT,
      "provenance/conversation-map.yaml": CONVERSATION_MAP,
    });
    const commit = makeDonorRepo(root, ".donors/donor_one", { "skills/brainstorm/SKILL.md": "# Brainstorm\n" });
    writeFileSync(join(root, "provenance/upstream.lock.yaml"), lockFor(commit));
    mkdirSync(join(root, "provenance/adaptations.d"), { recursive: true });
    writeFileSync(
      join(root, "provenance/adaptations.d/batch-1.yaml"),
      `adaptations:\n  - path: skills/adapted/SKILL.md\n    source: donor-one@${commit}:skills/brainstorm/SKILL.md\n`,
    );
    const { catalog } = loadCatalog(root);
    // A real tree has the generated file beside its fragments; build it so the
    // assertion is about the donor pin and not about a tree that never built.
    expect(writeAdaptations({ root, catalog: catalog! })).toEqual([]);
    expect(checkProvenance({ root, catalog: catalog! }).filter((i) => i.severity === "error")).toEqual([]);
  });

  test("a donor path that does not exist at the pin is an error naming the pin", () => {
    const root = makeTree({
      "catalog.yaml": CATALOG,
      "skills/adapted/SKILL.md": "---\nname: adapted\ndescription: d\n---\nbody\n",
      "skills/invented/SKILL.md": "---\nname: invented\ndescription: d\n---\nbody\n",
      "research/sources/grok-transcript.md": TRANSCRIPT,
      "provenance/conversation-map.yaml": CONVERSATION_MAP,
    });
    const commit = makeDonorRepo(root, ".donors/donor_one", { "skills/brainstorm/SKILL.md": "# Brainstorm\n" });
    writeFileSync(join(root, "provenance/upstream.lock.yaml"), lockFor(commit));
    mkdirSync(join(root, "provenance/adaptations.d"), { recursive: true });
    writeFileSync(
      join(root, "provenance/adaptations.d/batch-1.yaml"),
      `adaptations:\n  - path: skills/adapted/SKILL.md\n    source: donor-one@${commit}:skills/ghost/SKILL.md\n`,
    );
    const { catalog } = loadCatalog(root);
    const issue = checkProvenance({ root, catalog: catalog! }).find((i) => i.rule === "provenance.source-not-at-pin");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("skills/ghost/SKILL.md");
  });

  test("an adapted entry with no adaptations row at all is an error", () => {
    const ctx = ctxFor({
      "provenance/upstream.lock.yaml": lockFor("0".repeat(40)),
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
      "provenance/conversation-map.yaml": CONVERSATION_MAP,
    });
    const issue = checkProvenance(ctx).find((i) => i.rule === "provenance.missing-adaptation");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("skills/adapted");
  });

  test("a malformed source locator is an error", () => {
    const ctx = ctxFor({
      "provenance/upstream.lock.yaml": lockFor("0".repeat(40)),
      "provenance/adaptations.d/batch-1.yaml": "adaptations:\n  - path: skills/adapted/SKILL.md\n    source: not-a-locator\n",
      "provenance/conversation-map.yaml": CONVERSATION_MAP,
    });
    expect(checkProvenance(ctx).some((i) => i.rule === "provenance.malformed-source")).toBe(true);
  });

  test("an unknown donor id is an error", () => {
    const ctx = ctxFor({
      "provenance/upstream.lock.yaml": lockFor("0".repeat(40)),
      "provenance/adaptations.d/batch-1.yaml":
        "adaptations:\n  - path: skills/adapted/SKILL.md\n    source: nobody@0000000000000000000000000000000000000000:x.md\n",
      "provenance/conversation-map.yaml": CONVERSATION_MAP,
    });
    expect(checkProvenance(ctx).some((i) => i.rule === "provenance.unknown-donor")).toBe(true);
  });

  test("a row citing a commit other than the pin is a warning naming both", () => {
    const ctx = ctxFor({
      "provenance/upstream.lock.yaml": lockFor("a".repeat(40)),
      "provenance/adaptations.d/batch-1.yaml":
        "adaptations:\n  - path: skills/adapted/SKILL.md\n    source: donor-one@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:x.md\n",
      "provenance/conversation-map.yaml": CONVERSATION_MAP,
    });
    const issue = checkProvenance(ctx).find((i) => i.rule === "provenance.commit-not-pinned");
    expect(issue?.severity).toBe("warning");
  });

  test("absent .donors/ is reported as skipped, never as a failure", () => {
    const ctx = ctxFor({
      "provenance/upstream.lock.yaml": lockFor("a".repeat(40)),
      "provenance/adaptations.d/batch-1.yaml":
        "adaptations:\n  - path: skills/adapted/SKILL.md\n    source: donor-one@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:x.md\n",
      "provenance/conversation-map.yaml": CONVERSATION_MAP,
    });
    const issues = checkProvenance(ctx);
    expect(issues.some((i) => i.rule === "provenance.donors-unavailable" && i.severity === "note")).toBe(true);
    expect(issues.some((i) => i.rule === "provenance.source-not-at-pin")).toBe(false);
  });

  test("every fragment under provenance/adaptations.d/ counts toward the merged view", () => {
    const ctx = ctxFor({
      "provenance/upstream.lock.yaml": lockFor("a".repeat(40)),
      "provenance/adaptations.d/batch-3.yaml":
        "adaptations:\n  - path: skills/adapted/SKILL.md\n    source: donor-one@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:x.md\n",
      "provenance/conversation-map.yaml": CONVERSATION_MAP,
    });
    expect(checkProvenance(ctx).some((i) => i.rule === "provenance.missing-adaptation")).toBe(false);
  });

  test("a hand-written provenance/adaptations.yaml is not an input; the fragments are", () => {
    const ctx = ctxFor({
      "provenance/upstream.lock.yaml": lockFor("a".repeat(40)),
      "provenance/adaptations.yaml":
        "adaptations:\n  - path: skills/adapted/SKILL.md\n    source: donor-one@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:x.md\n",
      "provenance/conversation-map.yaml": CONVERSATION_MAP,
    });
    const issues = checkProvenance(ctx);
    expect(issues.some((i) => i.rule === "provenance.missing-adaptation")).toBe(true);
    expect(issues.some((i) => i.rule === "provenance.adaptations-out-of-sync")).toBe(true);
  });
});

describe("conversation provenance", () => {
  test("a conversation-origin entry with a valid in-range locator passes", () => {
    const ctx = ctxFor({ "provenance/conversation-map.yaml": CONVERSATION_MAP, "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n" });
    expect(checkProvenance(ctx).filter((i) => i.rule.startsWith("provenance.g-locator"))).toEqual([]);
  });

  test("a conversation-origin entry with no map row is an error", () => {
    const ctx = ctxFor({ "provenance/conversation-map.yaml": "capabilities: []\n", "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n" });
    const issue = checkProvenance(ctx).find((i) => i.rule === "provenance.missing-conversation-origin");
    expect(issue?.message).toContain("invented");
  });

  test("a locator past the end of the transcript is an error naming the bound", () => {
    const ctx = ctxFor({
      "provenance/conversation-map.yaml": "capabilities:\n  - id: invented-capability\n    disposition: retained\n    destination: skills/invented\n    origin: conversation\n    locator: G:L9999\n",
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    const issue = checkProvenance(ctx).find((i) => i.rule === "provenance.g-locator-out-of-range");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("2264");
  });

  test("an inverted range is an error", () => {
    const ctx = ctxFor({
      "provenance/conversation-map.yaml": "capabilities:\n  - id: invented-capability\n    disposition: retained\n    destination: skills/invented\n    origin: conversation\n    locator: G:L200-100\n",
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    expect(checkProvenance(ctx).some((i) => i.rule === "provenance.g-locator-invalid")).toBe(true);
  });

  test("a conversation-origin entry carrying a donor source path is a fabricated source", () => {
    const ctx = ctxFor({
      "provenance/conversation-map.yaml":
        "capabilities:\n  - id: invented-capability\n    disposition: retained\n    destination: skills/invented\n    origin: conversation\n    locator: G:L100\n    source: donor-one@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:x.md\n",
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    const issue = checkProvenance(ctx).find((i) => i.rule === "provenance.fabricated-source");
    expect(issue?.severity).toBe("error");
  });

  test("a missing transcript is reported as skipped rather than failing every locator", () => {
    const root = makeTree({
      "catalog.yaml": CATALOG,
      "skills/adapted/SKILL.md": "---\nname: adapted\ndescription: d\n---\nbody\n",
      "skills/invented/SKILL.md": "---\nname: invented\ndescription: d\n---\nbody\n",
      "provenance/conversation-map.yaml": CONVERSATION_MAP,
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    const { catalog } = loadCatalog(root);
    const issues = checkProvenance({ root, catalog: catalog! });
    expect(issues.some((i) => i.rule === "provenance.transcript-unavailable")).toBe(true);
    expect(issues.some((i) => i.rule === "provenance.g-locator-out-of-range")).toBe(false);
  });
});

describe("locator field grammar", () => {
  test("a field is a semicolon-separated list of one or more references", () => {
    expect(parseLocatorField("G:L2159-2173; G:L2072-2074")).toEqual([
      { kind: "transcript", start: 2159, end: 2173 },
      { kind: "transcript", start: 2072, end: 2074 },
    ]);
  });

  test("a single reference is still a valid field", () => {
    expect(parseLocatorField("G:L1672")).toEqual([{ kind: "transcript", start: 1672, end: 1672 }]);
  });

  test("a plan or arch section is a reference, and the plan outranks the transcript", () => {
    expect(parseLocatorField("plan §7.1")).toEqual([{ kind: "document", document: "plan", section: "7.1" }]);
    expect(parseLocatorField("arch §3")).toEqual([{ kind: "document", document: "arch", section: "3" }]);
    expect(parseLocatorField("plan §9 (Milestone 7)")).toEqual([
      { kind: "document", document: "plan", section: "9 (Milestone 7)" },
    ]);
  });

  test("transcript and document references mix in one field", () => {
    expect(parseLocatorField("G:L1668-1676; G:L1530-1532; plan §7.1")).toHaveLength(3);
  });

  test("free text is not a reference, so the widened grammar is not an escape hatch", () => {
    expect(parseLocatorField("see the discussion above")).toBeNull();
    expect(parseLocatorField("plan")).toBeNull();
    expect(parseLocatorField("plan §")).toBeNull();
    expect(parseLocatorField("")).toBeNull();
    expect(parseLocatorField(";")).toBeNull();
  });

  test("one bad reference fails the whole field rather than being skipped", () => {
    expect(parseLocatorField("G:L100; see above")).toBeNull();
    expect(parseLocatorField("G:L200-100; plan §2")).toBeNull();
  });

  test("every G:L reference in a multi-valued field is range-checked, not just the first", () => {
    const ctx = ctxFor({
      "provenance/conversation-map.yaml":
        "capabilities:\n  - id: invented-capability\n    disposition: retained\n    destination: skills/invented\n" +
        "    origin: conversation\n    locator: G:L100; G:L9999; plan §2.1\n",
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    const issue = checkProvenance(ctx).find((i) => i.rule === "provenance.g-locator-out-of-range");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("G:L9999");
  });

  test("a multi-valued field whose references all resolve passes", () => {
    const ctx = ctxFor({
      "provenance/conversation-map.yaml":
        "capabilities:\n  - id: invented-capability\n    disposition: retained\n    destination: skills/invented\n" +
        "    origin: conversation\n    locator: G:L2159-2173; G:L2072-2074; plan §7.1\n",
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    expect(checkProvenance(ctx).filter((i) => i.rule.startsWith("provenance.g-locator"))).toEqual([]);
  });
});

describe("conversation-map destinations", () => {
  test("coverage is resolved through destination, not through an id that happens to match", () => {
    const ctx = ctxFor({
      "provenance/conversation-map.yaml":
        "capabilities:\n  - id: invented\n    disposition: retained\n    destination: skills/adapted\n" +
        "    origin: donor\n    locator: G:L100\n",
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    const issue = checkProvenance(ctx).find((i) => i.rule === "provenance.missing-conversation-origin");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("skills/invented");
  });

  test("several capabilities may land in one destination", () => {
    const ctx = ctxFor({
      "provenance/conversation-map.yaml":
        "capabilities:\n" +
        "  - id: cap-one\n    disposition: retained\n    destination: skills/invented\n    origin: conversation\n    locator: G:L100\n" +
        "  - id: cap-two\n    disposition: folded\n    destination: skills/invented\n    origin: conversation\n    locator: G:L200-210\n",
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    expect(checkProvenance(ctx).some((i) => i.rule === "provenance.missing-conversation-origin")).toBe(false);
  });

  test("a destination no catalog entry owns is an error naming it", () => {
    const ctx = ctxFor({
      "provenance/conversation-map.yaml":
        "capabilities:\n  - id: invented-capability\n    disposition: retained\n    destination: skills/invented\n" +
        "    origin: conversation\n    locator: G:L100\n" +
        "  - id: ghost\n    disposition: retained\n    destination: skills/ghost\n    origin: conversation\n    locator: G:L120\n",
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    const issue = checkProvenance(ctx).find((i) => i.rule === "provenance.destination-without-entry");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("skills/ghost");
  });

  test("a destination naming a file-section entry resolves too", () => {
    const ctx = ctxFor({
      "provenance/conversation-map.yaml":
        "capabilities:\n  - id: invented-capability\n    disposition: retained\n    destination: skills/invented\n" +
        "    origin: conversation\n    locator: G:L100\n" +
        "  - id: envelope\n    disposition: retained\n    destination: schemas/common\n    origin: donor\n    locator: G:L130\n",
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    expect(checkProvenance(ctx).some((i) => i.rule === "provenance.destination-without-entry")).toBe(false);
  });

  test("an excluded capability carries no destination and is not a drift", () => {
    const ctx = ctxFor({
      "provenance/conversation-map.yaml":
        "capabilities:\n  - id: invented-capability\n    disposition: retained\n    destination: skills/invented\n" +
        "    origin: conversation\n    locator: G:L100\n" +
        "  - id: dropped\n    disposition: excluded\n    origin: conversation\n    locator: G:L140; plan §2.6\n",
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    const issues = checkProvenance(ctx);
    expect(issues.some((i) => i.rule === "provenance.destination-without-entry")).toBe(false);
    expect(issues.some((i) => i.rule === "provenance.capability-without-destination")).toBe(false);
  });

  test("a retained capability with nowhere to land is a warning", () => {
    const ctx = ctxFor({
      "provenance/conversation-map.yaml":
        "capabilities:\n  - id: invented-capability\n    disposition: retained\n    destination: skills/invented\n" +
        "    origin: conversation\n    locator: G:L100\n" +
        "  - id: homeless\n    disposition: retained\n    origin: conversation\n    locator: G:L150\n",
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    const issue = checkProvenance(ctx).find((i) => i.rule === "provenance.capability-without-destination");
    expect(issue?.severity).toBe("warning");
    expect(issue?.message).toContain("homeless");
  });

  test("every row's locator is checked, not only the rows an authored entry reaches", () => {
    const ctx = ctxFor({
      "provenance/conversation-map.yaml":
        "capabilities:\n  - id: invented-capability\n    disposition: retained\n    destination: skills/invented\n" +
        "    origin: conversation\n    locator: G:L100\n" +
        "  - id: dropped\n    disposition: excluded\n    origin: conversation\n    locator: nowhere in particular\n",
      "provenance/adaptations.d/batch-1.yaml": "adaptations: []\n",
    });
    const issue = checkProvenance(ctx).find((i) => i.rule === "provenance.g-locator-invalid");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("dropped");
  });
});
