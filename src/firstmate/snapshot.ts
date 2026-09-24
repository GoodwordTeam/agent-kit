/**
 * The source snapshot a binding starts from: the committed revision and the
 * digest of the working-tree diff over it (common#/$defs/revision_ref).
 *
 * Untracked files count as intent-to-add, as the definition says. They are
 * marked on a temporary copy of the index, so taking a snapshot never changes
 * the project's own index.
 *
 * The copy keeps the index's mtime. Git trusts a file's cached stat only when the file is older
 * than the index; a copy stamped "now" would make a same-size edit made in the second of the last
 * index write look clean, and the snapshot would miss it.
 */
import { copyFileSync, existsSync, mkdtempSync, rmSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { createHash } from "node:crypto";

import { git } from "./proc.ts";

export interface Snapshot {
  repo: string;
  revision: string;
  diff_hash: string;
}

export function takeSnapshot(project: string): Snapshot | string {
  const head = git(project, ["rev-parse", "HEAD"]);
  if (head.code !== 0 || !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(head.text)) {
    return `${project} has no committed revision: ${head.stderr || head.text}`;
  }
  const indexPath = git(project, ["rev-parse", "--git-path", "index"]);
  if (indexPath.code !== 0) return `cannot locate the index of ${project}`;
  const index = isAbsolute(indexPath.text) ? indexPath.text : join(project, indexPath.text);

  const scratch = mkdtempSync(join(tmpdir(), "ak-fm-index-"));
  const temp = join(scratch, "index");
  try {
    if (existsSync(index)) {
      copyFileSync(index, temp);
      const { atime, mtime } = statSync(index);
      utimesSync(temp, atime, mtime);
    }
    const env = { GIT_INDEX_FILE: temp };
    const untracked = git(project, ["ls-files", "--others", "--exclude-standard", "-z"], env);
    if (untracked.code !== 0) return `cannot list untracked files in ${project}: ${untracked.stderr}`;
    const paths = untracked.text.split("\0").filter((p) => p !== "");
    if (paths.length > 0) {
      const add = git(project, ["add", "--intent-to-add", "--", ...paths], env);
      if (add.code !== 0) return `cannot mark untracked files in ${project}: ${add.stderr}`;
    }
    const diff = git(project, ["diff", "--no-ext-diff", "--binary", head.text], env);
    if (diff.code !== 0) return `cannot diff ${project} against ${head.text}: ${diff.stderr}`;
    const digest = createHash("sha256").update(diff.stdout).digest("hex");

    const remote = git(project, ["config", "--get", "remote.origin.url"]);
    return { repo: remote.code === 0 && remote.text !== "" ? remote.text : project, revision: head.text, diff_hash: `sha256:${digest}` };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
