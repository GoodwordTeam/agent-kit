import { describe, expect, test } from "bun:test";

import {
  confirmedName,
  escapeSlack,
  postVersion,
  publishedVersion,
  renderVersion,
} from "./.github/scripts/release-post.mjs";

describe("Agent Kit release post", () => {
  test("renders the approved short version format without a hard-coded pilot claim", () => {
    const text = renderVersion({
      repository: "GoodwordTeam/agent-kit",
      version: "v0.1.131-goodword.3",
      baseSha: "1".repeat(40),
      headSha: "2".repeat(40),
      titles: ["feat: let Goody opt in one session at a time"],
      actorName: "Eduardo Picazo",
      runUrl: "https://github.com/GoodwordTeam/agent-kit/actions/runs/4001",
    });
    expect(text).toBe(
      "🧰 New version · agent-kit v0.1.131-goodword.3\n\n" +
        "let Goody opt in one session at a time.\n\n" +
        `<https://github.com/GoodwordTeam/agent-kit/compare/${"1".repeat(40)}...${"2".repeat(40)}|Notes>\n\n` +
        "Released by Eduardo Picazo\n\n" +
        "<https://github.com/GoodwordTeam/agent-kit/actions/runs/4001|Run>",
    );
    expect(text).not.toContain("Pilot only");
  });

  test("escapes version notes text and confirms mapped or fallback names", () => {
    expect(escapeSlack("<!channel> & <@U123>")).toBe("&lt;!channel&gt; &amp; &lt;@U123&gt;");
    expect(confirmedName("Pibomeister", "")).toBe("Eduardo Picazo");
    expect(confirmedName("officialtayfish", "")).toBe("officialtayfish");
  });

  test("uses the bounded summary shape when a version contains several changes", () => {
    const text = renderVersion({
      repository: "GoodwordTeam/agent-kit",
      version: "v1.0.0",
      baseSha: "1".repeat(40),
      headSha: "2".repeat(40),
      titles: ["feat: first", "fix: second", "chore: third"],
      actorName: "Eduardo Picazo",
      runUrl: "https://github.com/GoodwordTeam/agent-kit/actions/runs/1",
    });
    expect(text).toContain("3 changes are ready, including first and second.");
    expect(text).not.toContain("third");
  });

  test("requires a published tag instead of trusting a similarly named branch", () => {
    const headSha = "2".repeat(40);
    const tags = [{ name: "v1.0.0", commit: { sha: headSha } }];
    expect(publishedVersion(tags, "v1.0.0", headSha)).toBe("v1.0.0");
    expect(publishedVersion([], "v-not-a-tag", headSha)).toBe("");
  });

  test("dry-run prints the payload without calling Slack", async () => {
    let called = false;
    let output = "";
    const result = await postVersion(
      {
        repository: "GoodwordTeam/agent-kit",
        version: "v1.0.0",
        baseSha: "1".repeat(40),
        headSha: "2".repeat(40),
        titles: ["Release one"],
        actorName: "Eduardo Picazo",
        runUrl: "https://github.com/GoodwordTeam/agent-kit/actions/runs/1",
        runId: "1",
      },
      {
        channel: "C092BEPK6CB",
        dryRun: true,
        fetchImpl: async () => {
          called = true;
          throw new Error("unexpected Slack call");
        },
        write: (value) => {
          output += value;
        },
      },
    );
    expect(called).toBe(false);
    expect(JSON.parse(output)).toEqual(result.payload);
  });
});
