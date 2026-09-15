import fs from "node:fs";
import path from "node:path";

export function parseGithubWorkflows(root) {
  const workflowDir = path.join(root, ".github", "workflows");

  if (!fs.existsSync(workflowDir)) {
    return [];
  }

  const workflows = [];

  for (const entry of safeReaddir(workflowDir)) {
    if (!entry.name.endsWith(".yml") && !entry.name.endsWith(".yaml")) {
      continue;
    }

    const filePath = path.join(workflowDir, entry.name);
    const content = safeRead(filePath).toLowerCase();
    const riskSignals = [];

    if (content.includes("deploy") || content.includes("workflow_dispatch")) {
      riskSignals.push("deployment_workflow");
    }

    if (content.includes("contents: write") || content.includes("contents:write")) {
      riskSignals.push("repo_write_permission");
    }

    if (content.includes("secrets.")) {
      riskSignals.push("uses_github_secrets");
    }

    workflows.push({
      path: filePath,
      relativePath: path.relative(root, filePath),
      riskSignals
    });
  }

  return workflows;
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}
