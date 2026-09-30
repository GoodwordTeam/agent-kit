// Usage: bun rescore.ts <tree> <xmodel-dir> <out.json>. Rescores every dumped session with <tree>'s scorer.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [tree, dir, out] = process.argv.slice(2) as [string, string, string];
const te = await import(join(tree, "tests/learn/evals/trigger-eval.ts"));
const { loadCatalog } = await import(join(tree, "src/catalog/load.ts"));
// Fingerprints from the tree the sessions ran against (67e61e9), so every scorer sees the same bodies.
const BASE = process.env.BASE_TREE!;
const { catalog } = loadCatalog(BASE);
const entries = catalog.bySection("skills");
const fingerprints = new Map<string, string>();
for (const e of entries) {
  const f = join(BASE, "skills", e.id, "SKILL.md");
  const line = existsSync(f) ? te.bodyFingerprint(readFileSync(f, "utf8")) : null;
  if (line !== null) fingerprints.set(e.id, line);
}
const scoring = {
  arm: "natural",
  userInvoked: new Set(entries.filter((e: any) => e.invocation === "U").map((e: any) => e.id)),
  known: new Set(entries.map((e: any) => e.id)),
  drafts: new Map(),
  fingerprints,
};
const claudeSlash = entries.map((e: any) => `ak:${e.id}`);
const result: Record<string, any[]> = {};
for (const rep of ["r1", "r2"]) {
  for (const f of readdirSync(join(dir, rep)).filter((f) => f.endsWith(".json"))) {
    const receipt = JSON.parse(readFileSync(join(dir, rep, f), "utf8"));
    const sub = receipt.subjects[0];
    const rows = sub.results.map((r: any) => {
      const dump = JSON.parse(readFileSync(join(dir, rep, "transcripts", sub.subject, `${r.id}.json`), "utf8"));
      const s = te.scoreCase(
        dump.case,
        dump.events,
        dump.reply,
        scoring,
        sub.host === "claude" ? claudeSlash : undefined,
      );
      return {
        ...s,
        expects: s.expects,
        invalid: r.invalid ?? null,
        before: {
          outcome: r.outcome,
          pass: r.pass,
          hit: r.hit,
          false_fire: r.false_fire,
          unscored: r.unscored ?? false,
        },
      };
    });
    result[`${sub.subject}/${rep}`] = rows;
  }
}
writeFileSync(out, JSON.stringify(result));
console.log("wrote", out, Object.keys(result).length, "runs");
