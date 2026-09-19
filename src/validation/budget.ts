import { join } from "node:path";

import { entryBodyPath } from "../catalog/layout.ts";
import { readTextIfPresent } from "../util/fs.ts";
import type { CheckContext } from "./context.ts";
import { error, warning, type Issue } from "./types.ts";

/** AUTHORING.md / AGENTS.md: SKILL.md is <=150 lines, hard cap 300. */
export const SKILL_LINE_WARN = 150;
export const SKILL_LINE_FAIL = 300;

function lineCount(text: string): number {
  const lines = text.split("\n");
  return lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

export function checkBudget(ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];

  for (const entry of ctx.catalog.bySection("skills")) {
    const file = entryBodyPath("skills", entry.id);
    const text = readTextIfPresent(join(ctx.root, file));
    if (text === null) continue;

    const lines = lineCount(text);
    if (lines > SKILL_LINE_FAIL) {
      issues.push(
        error(
          "budget.skill-over-cap",
          file,
          `${lines} lines exceeds the hard cap of ${SKILL_LINE_FAIL}. Move longer material behind references/.`,
        ),
      );
    } else if (lines > SKILL_LINE_WARN) {
      issues.push(
        warning(
          "budget.skill-over-target",
          file,
          `${lines} lines is over the ${SKILL_LINE_WARN}-line target (hard cap ${SKILL_LINE_FAIL}).`,
        ),
      );
    }
  }

  return issues;
}
