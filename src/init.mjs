import fs from "node:fs";
import path from "node:path";
import { buildAbomExport, validateAbomV0Document } from "./report/abom.mjs";
import { initPolicyFile } from "./policy-file.mjs";
import { scanTarget } from "./scanner.mjs";

export const DEFAULT_INIT_OPTIONS = {
  target: ".",
  force: false,
  failOn: "high"
};

export function initProject({
  target = DEFAULT_INIT_OPTIONS.target,
  force = DEFAULT_INIT_OPTIONS.force,
  failOn = DEFAULT_INIT_OPTIONS.failOn
} = {}) {
  const root = path.resolve(target);
  const loamDir = path.join(root, ".loam");
  const workflowDir = path.join(root, ".github", "workflows");
  const policyPath = path.join(loamDir, "policy.json");
  const baselinePath = path.join(loamDir, "baseline-abom.json");
  const readmePath = path.join(loamDir, "README.md");
  const workflowPath = path.join(workflowDir, "loam.yml");
  const results = [];

  if (!isDirectory(root)) {
    throw new Error(`Init target is not a directory: ${root}`);
  }

  fs.mkdirSync(loamDir, { recursive: true });
  fs.mkdirSync(workflowDir, { recursive: true });

  const policyResult = initPolicyFile({ policyPath, force });
  results.push({
    path: policyPath,
    status: policyResult.created ? "created" : force ? "overwritten" : "skipped"
  });

  const scan = scanTarget(root);
  const baseline = buildAbomExport(scan);
  const validation = validateAbomV0Document(baseline);
  if (!validation.valid) {
    throw new Error(`Generated baseline ABOM failed validation: ${validation.errors.join("; ")}`);
  }

  results.push(
    writeManagedFile({
      filePath: baselinePath,
      content: `${JSON.stringify(baseline, null, 2)}\n`,
      force
    })
  );

  results.push(
    writeManagedFile({
      filePath: readmePath,
      content: buildLoamReadme({ failOn }),
      force
    })
  );

  results.push(
    writeManagedFile({
      filePath: workflowPath,
      content: buildGithubWorkflow({ failOn }),
      force
    })
  );

  return {
    root,
    files: results,
    next_steps: [
      "Review .loam/policy.json and adjust allowed MCP servers or approval requirements.",
      "Commit .loam/ and .github/workflows/loam.yml.",
      "Open a pull request that changes agent, MCP, env, package, or workflow config.",
      "Loam will comment with the scan report and ABOM diff."
    ],
    private_beta_note:
      "While the Loam repo is private, partner repositories need a LOAM_GITHUB_TOKEN secret with read access to nfzkbh201/loam."
  };
}

export function buildGithubWorkflow({ failOn = DEFAULT_INIT_OPTIONS.failOn } = {}) {
  return `name: loam

on:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Checkout Loam
        uses: actions/checkout@v4
        with:
          repository: nfzkbh201/loam
          path: .loam-action
          token: \${{ secrets.LOAM_GITHUB_TOKEN || github.token }}

      - uses: ./.loam-action
        with:
          path: .
          fail-on: ${failOn}
          comment: true
          diff: true
          baseline-path: .loam/baseline-abom.json
          policy-path: .loam/policy.json
          github-token: \${{ github.token }}
`;
}

export function buildLoamReadme({ failOn = DEFAULT_INIT_OPTIONS.failOn } = {}) {
  return `# Loam

This directory was created by \`loam init\`.

## Files

- \`policy.json\`: local authority policy for agent and MCP toolchains.
- \`baseline-abom.json\`: approved Agent Bill of Materials baseline for PR diffs.

## Local commands

\`\`\`bash
node ./src/cli.mjs scan . --policy .loam/policy.json --approval-suggestions
node ./src/cli.mjs scan . --abom .loam/baseline-abom.json
node ./src/cli.mjs diff --baseline .loam/baseline-abom.json --current loam-abom.json --fail-on ${failOn}
\`\`\`

## Private beta GitHub setup

The generated workflow checks out \`nfzkbh201/loam\`. While Loam is private, add a repository secret named \`LOAM_GITHUB_TOKEN\` with read access to that repo.
`;
}

function writeManagedFile({ filePath, content, force }) {
  const existed = fs.existsSync(filePath);

  if (existed && !force) {
    return {
      path: filePath,
      status: "skipped"
    };
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);

  return {
    path: filePath,
    status: existed && force ? "overwritten" : "created"
  };
}

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}
