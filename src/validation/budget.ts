import { join } from "node:path";

import { entryBodyPath, type DirectorySection } from "../catalog/layout.ts";
import { readTextIfPresent } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { error, warning, type Issue } from "./types.ts";

/** AUTHORING.md §1: a body is <=150 lines, hard cap 300. */
export const SKILL_LINE_WARN = 150;
export const SKILL_LINE_FAIL = 300;

/**
 * The sections §1's line budget governs.
 *
 * §12 says §1 applies to protocol and role bodies unchanged, and this check
 * read `SKILL.md` alone. The gap was not cosmetic: a 151-line protocol body had
 * a formal exception record written for it, citing a ruling that does not
 * govern it, against a threshold nothing had ever applied to that file. An
 * unmeasured cap invites exactly that -- a writer reasoning about a limit the
 * tool is silent on cannot tell a real overage from an imagined one.
 *
 * `packs` is here because §12.6 applies §1 to a `PACK.md` unchanged: a domain
 * pack is attached into every phase whose artifact earns it, so its length is
 * paid on each match. `references` is not, because a reference pack is the long
 * material §1 sends behind the limit (§12.5).
 */
export const BUDGETED: ReadonlyArray<{ section: DirectorySection; over: string; cap: string }> = [
  { section: "skills", over: "budget.skill-over-target", cap: "budget.skill-over-cap" },
  { section: "packs", over: "budget.body-over-target", cap: "budget.body-over-cap" },
  { section: "protocols", over: "budget.body-over-target", cap: "budget.body-over-cap" },
  { section: "roles", over: "budget.body-over-target", cap: "budget.body-over-cap" },
];

function lineCount(text: string): number {
  const lines = text.split("\n");
  return lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

export function checkBudget(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];

  for (const { section, over, cap } of BUDGETED) {
    for (const entry of ctx.catalog.bySection(section)) {
      const file = entryBodyPath(section, entry.id);
      const text = readTextIfPresent(join(ctx.root, file));
      if (text === null) continue;

      const lines = lineCount(text);
      if (lines > SKILL_LINE_FAIL) {
        issues.push(
          error(
            cap,
            file,
            `${lines} lines exceeds the hard cap of ${SKILL_LINE_FAIL}. Move longer material behind references/.`,
          ),
        );
      } else if (lines > SKILL_LINE_WARN) {
        issues.push(
          warning(
            over,
            file,
            `${lines} lines is over the ${SKILL_LINE_WARN}-line target (hard cap ${SKILL_LINE_FAIL}), which AUTHORING.md §12 applies to this body unchanged.`,
          ),
        );
      }
    }
  }

  return issues;
}
