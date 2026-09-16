const SEVERITY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const CAPABILITY_SEVERITY = {
  shell_exec: "critical",
  repo_write: "critical",
  payment: "critical",
  secrets_access: "critical",
  filesystem_write: "high",
  deploy: "high",
  web_access: "high",
  customer_data: "high",
  filesystem_access: "medium",
  repo_access: "medium",
  unknown_publisher: "medium"
};

const RISK_PATHS = [
  {
    id: "web-access-can-reach-shell-exec",
    severity: "critical",
    capabilities: ["web_access", "shell_exec"],
    title: "Risk path introduced: web access can reach shell execution",
    why: "The current ABOM combines untrusted web/browser content with shell execution capability.",
    fix: "Separate browser-facing agents from shell tools, or require explicit approval before shell execution."
  },
  {
    id: "web-access-can-influence-filesystem-write",
    severity: "high",
    capabilities: ["web_access", "filesystem_write"],
    title: "Risk path introduced: web access can influence filesystem writes",
    why: "The current ABOM combines untrusted web/browser content with filesystem write capability.",
    fix: "Use read-only filesystem access for web-facing agents, or isolate writes behind an approval step."
  },
  {
    id: "web-access-can-reach-secrets",
    severity: "critical",
    capabilities: ["web_access", "secrets_access"],
    title: "Risk path introduced: web access can reach secrets",
    why: "The current ABOM combines web/browser access with credential-bearing agent runtime signals.",
    fix: "Remove secrets from browser-facing agent runtimes or put credentialed tools behind approval."
  },
  {
    id: "customer-data-shares-context-with-web-access",
    severity: "high",
    capabilities: ["customer_data", "web_access"],
    title: "Risk path introduced: customer data shares context with web access",
    why: "The current ABOM combines customer-data tools with untrusted web/browser context.",
    fix: "Split browsing and customer-data workflows into separate agents with a narrow handoff."
  }
];

export function diffAboms({ baseline, current }) {
  const baselineAbom = normalizeAbom(baseline);
  const currentAbom = normalizeAbom(current);
  const changes = [
    ...diffCapabilities(baselineAbom, currentAbom),
    ...diffRiskPaths(baselineAbom, currentAbom),
    ...diffComponents("mcp_server", baselineAbom.mcpServers, currentAbom.mcpServers, serverKey, serverChange),
    ...diffComponents("github_workflow", baselineAbom.githubWorkflows, currentAbom.githubWorkflows, workflowKey, workflowChange),
    ...diffComponents("env_file", baselineAbom.envFiles, currentAbom.envFiles, envFileKey, envFileChange)
  ].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.title.localeCompare(b.title));

  return {
    tool: "agentsec",
    version: current.version || baseline.version || "0.1.0",
    compared_at: new Date().toISOString(),
    baseline: describeExport(baseline),
    current: describeExport(current),
    summary: summarizeChanges(changes),
    changes
  };
}

export function shouldFailDiff(diff, severity) {
  const threshold = SEVERITY_RANK[severity];
  return diff.changes.some((change) => SEVERITY_RANK[change.severity] >= threshold);
}

function normalizeAbom(exported) {
  const abom = exported.abom || {};
  return {
    capabilities: new Set(abom.capabilities || []),
    mcpServers: abom.mcp_servers || [],
    githubWorkflows: abom.github_workflows || [],
    envFiles: abom.env_files || [],
    deploymentWorkflowCount: countDeploymentWorkflows(abom.github_workflows || [])
  };
}

function describeExport(exported) {
  return {
    target: exported.target || null,
    exported_at: exported.exported_at || null,
    redacted: Boolean(exported.redacted)
  };
}

function diffCapabilities(baseline, current) {
  const changes = [];

  for (const capability of current.capabilities) {
    if (!baseline.capabilities.has(capability)) {
      changes.push({
        id: `capability-added-${capability}`,
        type: "capability",
        operation: "added",
        severity: CAPABILITY_SEVERITY[capability] || "medium",
        title: `Capability added: ${capability}`,
        subject: capability,
        why: "A new agent/tool capability appeared in the current ABOM.",
        fix: "Review the tool that introduced this capability and require approval if it expands the agent's authority."
      });
    }
  }

  for (const capability of baseline.capabilities) {
    if (!current.capabilities.has(capability)) {
      changes.push({
        id: `capability-removed-${capability}`,
        type: "capability",
        operation: "removed",
        severity: "low",
        title: `Capability removed: ${capability}`,
        subject: capability,
        why: "A capability present in the baseline ABOM is no longer present.",
        fix: "No action required unless this removal was unexpected."
      });
    }
  }

  if (
    current.capabilities.has("repo_write") &&
    current.deploymentWorkflowCount > 0 &&
    !(baseline.capabilities.has("repo_write") && baseline.deploymentWorkflowCount > 0)
  ) {
    changes.push({
      id: "repo-write-can-reach-deployment-workflow",
      type: "risk_path",
      operation: "introduced",
      severity: "critical",
      title: "Risk path introduced: repo write can reach deployment workflow",
      subject: "repo_write -> deployment_workflow",
      why: "The current ABOM combines agent repository write capability with deployment workflow signals.",
      fix: "Require human review for agent-authored commits and separate deployment credentials from agent workflows."
    });
  }

  return changes;
}

function diffRiskPaths(baseline, current) {
  return RISK_PATHS.filter((riskPath) => hasCapabilities(current, riskPath.capabilities) && !hasCapabilities(baseline, riskPath.capabilities)).map(
    (riskPath) => ({
      id: riskPath.id,
      type: "risk_path",
      operation: "introduced",
      severity: riskPath.severity,
      title: riskPath.title,
      subject: riskPath.capabilities.join(" -> "),
      why: riskPath.why,
      fix: riskPath.fix
    })
  );
}

function diffComponents(type, baselineItems, currentItems, keyFor, changeFor) {
  const baselineMap = mapByKey(baselineItems, keyFor);
  const currentMap = mapByKey(currentItems, keyFor);
  const changes = [];

  for (const [key, item] of currentMap) {
    if (!baselineMap.has(key)) {
      changes.push(changeFor({ type, operation: "added", item }));
    }
  }

  for (const [key, item] of baselineMap) {
    if (!currentMap.has(key)) {
      changes.push(changeFor({ type, operation: "removed", item }));
    }
  }

  return changes;
}

function mapByKey(items, keyFor) {
  const output = new Map();

  for (const item of items) {
    const key = keyFor(item);
    output.set(key, item);
  }

  return output;
}

function serverKey(server) {
  return [
    server.target_label || "",
    server.config_file || "",
    server.name || "",
    server.package || "",
    server.command || "",
    JSON.stringify(server.args || []),
    JSON.stringify(server.capabilities || [])
  ].join("|");
}

function workflowKey(workflow) {
  return [workflow.target_label || "", workflow.file || "", JSON.stringify(workflow.risk_signals || [])].join("|");
}

function envFileKey(file) {
  return [
    file.target_label || "",
    file.file || "",
    JSON.stringify(file.keys || []),
    JSON.stringify(file.secret_like_keys || [])
  ].join("|");
}

function serverChange({ operation, item }) {
  const capabilities = item.capabilities || [];
  const highest = highestSeverity(capabilities.map((capability) => CAPABILITY_SEVERITY[capability] || "medium"));
  const subject = item.name || item.package || item.target_label || "MCP server";

  return {
    id: `mcp-server-${operation}-${slug(subject)}-${slug(capabilities.join("-"))}`,
    type: "mcp_server",
    operation,
    severity: operation === "added" ? highest : "low",
    title: `MCP server ${operation}: ${subject}`,
    subject,
    capabilities,
    why:
      operation === "added"
        ? "A new MCP server appeared in the current ABOM."
        : "An MCP server present in the baseline ABOM is no longer present.",
    fix:
      operation === "added"
        ? "Review the server package, command, args, env keys, and capability set before approving the change."
        : "No action required unless this removal was unexpected."
  };
}

function workflowChange({ operation, item }) {
  const riskSignals = item.risk_signals || [];
  const hasDeployment = riskSignals.includes("deployment_workflow");
  const subject = item.file || item.target_label || "GitHub workflow";

  return {
    id: `github-workflow-${operation}-${slug(subject)}-${slug(riskSignals.join("-"))}`,
    type: "github_workflow",
    operation,
    severity: operation === "added" && hasDeployment ? "high" : "low",
    title: `GitHub workflow ${operation}: ${subject}`,
    subject,
    risk_signals: riskSignals,
    why:
      operation === "added"
        ? "A GitHub workflow appeared in the current ABOM."
        : "A GitHub workflow present in the baseline ABOM is no longer present.",
    fix:
      operation === "added" && hasDeployment
        ? "Review deployment permissions and require human approval for agent-authored production changes."
        : "No action required unless this workflow change was unexpected."
  };
}

function envFileChange({ operation, item }) {
  const secretLikeKeys = item.secret_like_keys || [];
  const subject = item.file || item.target_label || "env file";

  return {
    id: `env-file-${operation}-${slug(subject)}`,
    type: "env_file",
    operation,
    severity: operation === "added" && secretLikeKeys.length > 0 ? "high" : "low",
    title: `Env file ${operation}: ${subject}`,
    subject,
    secret_like_key_count: secretLikeKeys.length,
    why:
      operation === "added"
        ? "An env file appeared in the current ABOM."
        : "An env file present in the baseline ABOM is no longer present.",
    fix:
      operation === "added" && secretLikeKeys.length > 0
        ? "Keep secrets outside agent-readable workspaces and prevent web-facing agents from reaching credentialed runtimes."
        : "No action required unless this env file change was unexpected."
  };
}

function summarizeChanges(changes) {
  const bySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  for (const change of changes) {
    bySeverity[change.severity] += 1;
  }

  return {
    total_changes: changes.length,
    by_severity: bySeverity,
    highest_severity: highestSeverity(changes.map((change) => change.severity)) || null
  };
}

function countDeploymentWorkflows(workflows) {
  return workflows.filter((workflow) => (workflow.risk_signals || []).includes("deployment_workflow")).length;
}

function hasCapabilities(abom, capabilities) {
  return capabilities.every((capability) => abom.capabilities.has(capability));
}

function highestSeverity(severities) {
  let highest = null;

  for (const severity of severities) {
    if (!highest || SEVERITY_RANK[severity] > SEVERITY_RANK[highest]) {
      highest = severity;
    }
  }

  return highest;
}

function slug(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
