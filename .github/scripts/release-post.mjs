#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const names = JSON.parse(readFileSync(new URL("../release-real-names.json", import.meta.url), "utf8"));
const titlePrefix = /^(?:build|chore|ci|docs|feat|fix|perf|refactor|style|test)(?:\([^)]*\))?!?:\s*/i;

export const escapeSlack = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
export const normalizeTitle = (value) =>
  String(value || "")
    .replace(titlePrefix, "")
    .trim();
export const confirmedName = (login, profileName) => names[login] || String(profileName || "").trim() || login;
export const publishedVersion = (tags, headBranch, headSha) => {
  const exact = tags.find((tag) => tag.name === headBranch && tag.commit.sha === headSha && /^v/.test(tag.name));
  return exact?.name || tags.find((tag) => /^v/.test(tag.name) && tag.commit.sha === headSha)?.name || "";
};

export function renderVersion({ repository, version, baseSha, headSha, titles, actorName, runUrl }) {
  const summary =
    titles.length === 0
      ? `Published ${escapeSlack(version)}.`
      : titles.length === 1
        ? `${escapeSlack(normalizeTitle(titles[0]))}.`
        : titles.length === 2
          ? `${escapeSlack(normalizeTitle(titles[0]))} and ${escapeSlack(normalizeTitle(titles[1]))}.`
          : `${titles.length} changes are ready, including ${escapeSlack(normalizeTitle(titles[0]))} and ${escapeSlack(normalizeTitle(titles[1]))}.`;
  const notes = baseSha
    ? `<https://github.com/${repository}/compare/${baseSha}...${headSha}|Notes>`
    : `<https://github.com/${repository}/commit/${headSha}|Notes>`;
  return [
    `🧰 New version · agent-kit ${escapeSlack(version)}`,
    "",
    summary,
    "",
    notes,
    "",
    `Released by ${escapeSlack(actorName)}`,
    "",
    `<${runUrl}|Run>`,
  ].join("\n");
}

const messageId = ({ repository, version, runId }) => {
  const hex = createHash("sha256").update([repository, version, runId].join("\0")).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
};

export function payloadFor(data, channel) {
  const text = renderVersion(data);
  return {
    channel,
    text,
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
    client_msg_id: messageId(data),
  };
}

export async function postVersion(
  data,
  { slackToken, channel, dryRun = false, fetchImpl = fetch, write = (value) => process.stdout.write(value) } = {},
) {
  const payload = payloadFor(data, channel);
  if (dryRun) {
    write(`${JSON.stringify(payload, null, 2)}\n`);
    return { payload };
  }
  if (!slackToken || !channel)
    throw new Error("GOODWORD_RELEASES_SLACK_TOKEN and RELEASES_SLACK_CHANNEL_ID are required");
  const response = await fetchImpl("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${slackToken}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`Slack post failed: ${result.error || response.status}`);
  return { payload, result };
}

async function github(path, token, repository) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GitHub ${response.status} for ${path}`);
  return response.json();
}

async function releaseData({ event, repository, token }) {
  const source = event.workflow_run;
  if (!source || source.conclusion !== "success") return null;
  if (source.head_branch === "main") return null;
  const tags = await github("/tags?per_page=100", token, repository);
  const version = publishedVersion(tags, String(source.head_branch || ""), source.head_sha);
  if (!version) return null;
  const current = tags.findIndex((tag) => tag.name === version);
  let baseSha = current >= 0 ? tags[current + 1]?.commit.sha || "" : "";
  if (!baseSha) {
    const commit = await github(`/commits/${source.head_sha}`, token, repository);
    baseSha = commit.parents?.[0]?.sha || "";
  }
  const compare = baseSha
    ? await github(`/compare/${baseSha}...${source.head_sha}`, token, repository)
    : { commits: [] };
  const pullRequests = [];
  const seen = new Set();
  for (const commit of compare.commits || []) {
    const linked = await github(`/commits/${commit.sha}/pulls`, token, repository);
    for (const pull of linked) {
      if (!pull.merged_at || seen.has(pull.number)) continue;
      seen.add(pull.number);
      pullRequests.push(pull);
    }
  }
  const profile = await fetch(`https://api.github.com/users/${encodeURIComponent(source.actor.login)}`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
  });
  const profileBody = profile.ok ? await profile.json() : {};
  return {
    repository,
    version,
    baseSha,
    headSha: source.head_sha,
    titles: pullRequests.map((pull) => pull.title),
    actorName: confirmedName(source.actor.login, profileBody.name),
    runUrl: source.html_url,
    runId: String(source.id),
  };
}

const warning = (message) =>
  process.stdout.write(
    `::warning title=Goodword Releases::${String(message).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}\n`,
  );

export async function main({
  event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")),
  repository = process.env.GITHUB_REPOSITORY,
  githubToken = process.env.GITHUB_TOKEN,
  slackToken = process.env.SLACK_TOKEN,
  channel = process.env.SLACK_CHANNEL_ID,
  dryRun = process.env.DRY_RUN === "true",
  fetchImpl = fetch,
} = {}) {
  try {
    if (!githubToken) throw new Error("GITHUB_TOKEN is required");
    const data = await releaseData({ event, repository, token: githubToken });
    if (!data) return { skipped: true };
    return await postVersion(data, { slackToken, channel, dryRun, fetchImpl });
  } catch (error) {
    warning(error.stack || error.message);
    return { warning: error.message };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
