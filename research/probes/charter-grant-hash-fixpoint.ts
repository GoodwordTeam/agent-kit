/**
 * Can an honest charter satisfy
 * `charter.sensitive-grant-requires-explicit-human-approval-bound-to-this-hash`?
 *
 * The rule (src/validation/docrules.ts, RULE_GRANT) requires every entry in
 * `sensitive_grants[]` to carry `approval.artifact_hash` equal to the
 * charter's own `immutability.hash`. The hash is recomputed by RULE_HASH over
 * the canonical document with `immutability.hash` blanked, via `artifactHash`
 * (src/util/hash.ts), which drops a TOP-LEVEL `approvals` key and nothing
 * else.
 *
 * A sensitive grant's approval is not top-level. It is nested at
 * `sensitive_grants[i].approval`, so `approval.artifact_hash` is inside the
 * content its own value is a digest of. Writing the hash in changes the bytes
 * the hash is taken over, which changes the hash. There is no authoring effort
 * that closes that loop; it is a preimage problem, and an author who tries
 * will watch the value move every time they update it.
 *
 * The exclusion mechanism the fix needs already exists in two places and
 * reaches neither of these: `artifactHash` blanks top-level `approvals`, and
 * RULE_HASH blanks `immutability.hash` before recomputing. A nested grant
 * approval hash is the third thing that must be blanked and is not.
 *
 * RULE_HASH's own failure message says the recomputation is taken "with
 * immutability.hash blanked and approvals removed". That is true of a
 * top-level `approvals` key and false of these, which is how the gap reads as
 * covered.
 *
 * Consequence today: the rule is installed, iterated, and unfalsifiable. It
 * cannot object to a real charter because no real charter can reach the state
 * it guards, and it cannot be satisfied by one either. `templates/charter.example.json`
 * carries no sensitive grants -- the normal case, and the only satisfiable one --
 * so the whole run is silent about it. A charter that did grant a sensitive
 * action would fail validation no matter how correctly it was authored.
 *
 * This probe does not read the code. It iterates the fixed point the way an
 * author would: write the current hash into the grant's approval, recompute,
 * and see whether the value settles.
 *
 * WHAT A FAILING RUN MEANS
 *   The rule is still unsatisfiable. The fix is a decision about what the
 *   charter digest covers -- most naturally blanking nested grant approval
 *   hashes alongside `immutability.hash`, so an approval binds to the charter
 *   minus the approvals, which is what "bound to this hash" was meant to say.
 *   It is not an authoring problem and no template can close it.
 *
 * WHAT A PASSING RUN MEANS
 *   A charter carrying a sensitive grant reaches a stable hash, and the rule
 *   can be exercised by a document instead of only entered. Retire this probe
 *   in the commit that makes it pass.
 */

import { readFileSync } from "node:fs";
import { artifactHash, canonicalJson } from "../../src/util/hash.ts";

const MAX_ITERATIONS = 8;

function recompute(doc: Record<string, unknown>): string {
  const blanked = JSON.parse(canonicalJson(doc)) as Record<string, unknown>;
  (blanked["immutability"] as Record<string, unknown>)["hash"] = "";
  return artifactHash(blanked);
}

const charter = JSON.parse(
  readFileSync(new URL("../../templates/charter.example.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

if (Array.isArray(charter["sensitive_grants"]) && charter["sensitive_grants"].length > 0) {
  console.log("templates/charter.example.json already carries a sensitive grant.");
  console.log("This probe assumes the example has none; re-read it before trusting either answer.");
  process.exit(2);
}

// The narrowest honest charter that reaches the rule: one grant, explicitly
// approved by a human, with every other field left exactly as authored.
charter["sensitive_grants"] = [
  {
    action: "merge",
    scope: "Merge the single pull request opened by this run, after its required lanes report.",
    approval: {
      by: "human",
      authority: "explicit",
      at: "2026-09-19T09:00:00Z",
      artifact_hash: "",
    },
  },
];

const grant = (charter["sensitive_grants"] as Record<string, unknown>[])[0];
const approval = grant["approval"] as Record<string, unknown>;

const seen: string[] = [];
let settled = false;

for (let i = 0; i < MAX_ITERATIONS; i += 1) {
  const current = recompute(charter);
  if (approval["artifact_hash"] === current) {
    settled = true;
    break;
  }
  if (seen.includes(current)) {
    console.log(`Iteration ${i + 1}: the recomputed hash has begun to cycle without settling.`);
    break;
  }
  seen.push(current);
  console.log(`Iteration ${i + 1}: recomputed ${current.slice(0, 19)}...; writing it into the grant's approval.`);
  approval["artifact_hash"] = current;
}

const finalHash = recompute(charter);
const bound = approval["artifact_hash"] as string;

console.log("");
if (settled && bound === finalHash) {
  console.log("SATISFIED. A sensitive grant's approval hash is a fixed point of the charter digest.");
  console.log(`  immutability.hash and approval.artifact_hash agree at ${finalHash}`);
  console.log("Retire this probe in the commit that made it pass.");
  process.exit(0);
}

console.log("UNSATISFIABLE. The rule cannot be met by an honestly authored charter.");
console.log(`  approval.artifact_hash holds ${bound.slice(0, 19)}...`);
console.log(`  the charter now hashes to  ${finalHash.slice(0, 19)}...`);
console.log(
  `  ${seen.length} distinct hashes in ${MAX_ITERATIONS} iterations; the value moves each time it is written.`,
);
console.log("");
console.log("This is a preimage problem, not an authoring difficulty. The approval hash is nested");
console.log("inside the content it is a digest of, so writing it changes what it must equal.");
console.log("The fix is a decision about what the charter digest covers, in src/util/hash.ts or in");
console.log("charterRules' recomputation -- not a template, and not a schema constraint.");
process.exit(1);
