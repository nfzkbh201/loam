#!/usr/bin/env node
import fs from "node:fs";
import https from "node:https";

const marker = "<!-- loam-risk-report -->";

async function main() {
  const [reportPath] = process.argv.slice(2);
  const token = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!reportPath) {
    throw new Error("Usage: github-comment.mjs <report-path>");
  }

  if (!token || !repository || !eventPath) {
    console.log("Skipping PR comment: GITHUB_TOKEN, GITHUB_REPOSITORY, or GITHUB_EVENT_PATH is missing.");
    return;
  }

  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const pullRequest = event.pull_request;

  if (!pullRequest?.number) {
    console.log("Skipping PR comment: current event is not a pull request.");
    return;
  }

  const body = `${marker}\n${fs.readFileSync(reportPath, "utf8")}`;
  const [owner, repo] = repository.split("/");
  const comments = await githubRequest({
    method: "GET",
    path: `/repos/${owner}/${repo}/issues/${pullRequest.number}/comments`,
    token
  });

  const existing = comments.find((comment) => comment.body?.startsWith(marker));

  if (existing) {
    await githubRequest({
      method: "PATCH",
      path: `/repos/${owner}/${repo}/issues/comments/${existing.id}`,
      token,
      body: { body }
    });
    console.log(`Updated Loam PR comment #${existing.id}.`);
    return;
  }

  const created = await githubRequest({
    method: "POST",
    path: `/repos/${owner}/${repo}/issues/${pullRequest.number}/comments`,
    token,
    body: { body }
  });
  console.log(`Created Loam PR comment #${created.id}.`);
}

function githubRequest({ method, path, token, body }) {
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: "api.github.com",
        path,
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "loam-action",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {})
        }
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          const parsed = raw ? JSON.parse(raw) : {};

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GitHub API ${method} ${path} failed with ${response.statusCode}: ${raw}`));
            return;
          }

          resolve(parsed);
        });
      }
    );

    request.on("error", reject);

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
