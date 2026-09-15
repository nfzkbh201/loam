const SEVERITY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

export function runRules(context) {
  const servers = context.mcpConfigs.flatMap((config) => config.servers);
  const capabilities = new Set(servers.flatMap((server) => server.capabilities));
  const findings = [];

  if (capabilities.has("web_access") && capabilities.has("shell_exec")) {
    findings.push(finding({
      severity: "critical",
      title: "Untrusted web content can reach shell execution",
      path: ["web_access", "agent_context", "shell_exec"],
      why: "A browser or fetch tool can introduce prompt-injected content that influences a shell-capable agent.",
      fix: "Separate browser-facing agents from shell tools, or require explicit approval before shell execution.",
      evidence: serversWithAny(servers, ["web_access", "shell_exec"])
    }));
  }

  if (capabilities.has("web_access") && capabilities.has("filesystem_write")) {
    findings.push(finding({
      severity: "high",
      title: "Web-facing agent can influence filesystem writes",
      path: ["web_access", "agent_context", "filesystem_write"],
      why: "Untrusted webpage text could steer an agent into editing or deleting local files.",
      fix: "Use read-only filesystem access for web-facing agents, or isolate writes behind an approval step.",
      evidence: serversWithAny(servers, ["web_access", "filesystem_write"])
    }));
  }

  for (const server of servers) {
    if (server.paths.some((item) => item.broad)) {
      findings.push(finding({
        severity: "critical",
        title: "MCP server has broad filesystem access",
        path: [server.name, "filesystem_access"],
        why: "Broad filesystem access can expose unrelated repos, credentials, private documents, or shell history.",
        fix: "Scope filesystem MCP servers to the smallest project directory and prefer read-only access where possible.",
        evidence: [serverEvidence(server)]
      }));
    }
  }

  if (capabilities.has("secrets_access") && capabilities.has("web_access")) {
    findings.push(finding({
      severity: "critical",
      title: "Secrets may be reachable from a web-exposed agent",
      path: ["web_access", "agent_context", "secrets_access"],
      why: "Prompt-injected web content could influence an agent that also has credentials in its runtime.",
      fix: "Remove secrets from browser-facing agent runtimes or put credentialed tools behind approval.",
      evidence: serversWithAny(servers, ["web_access", "secrets_access"])
    }));
  }

  if (hasSecretLikeEnvFile(context) && (capabilities.has("web_access") || capabilities.has("shell_exec"))) {
    findings.push(finding({
      severity: "high",
      title: "Secret-like env keys exist near web or shell agent tools",
      path: ["env_file", "agent_runtime"],
      why: "Agent projects with local env secrets and web or shell tools can accidentally expose credentials through tool use or prompt-injected workflows.",
      fix: "Keep secrets outside agent-readable workspaces, scope credentials narrowly, and prevent web-facing agents from accessing credentialed runtimes.",
      evidence: envEvidence(context.envFiles)
    }));
  }

  if (capabilities.has("repo_write") && hasDeploySignal(context)) {
    findings.push(finding({
      severity: "critical",
      title: "Agent may write code and trigger deployment paths",
      path: ["repo_write", "deployment_workflow"],
      why: "An agent with repository write access near deployment automation can create a production-change path.",
      fix: "Require human review for agent-authored commits and separate deployment credentials from agent workflows.",
      evidence: [
        ...serversWithAny(servers, ["repo_write"]),
        ...workflowEvidence(context.githubWorkflows),
        ...scriptEvidence(context.packageJson)
      ]
    }));
  }

  if (capabilities.has("payment") && !hasApprovalSignal(servers)) {
    findings.push(finding({
      severity: "critical",
      title: "Payment-capable tool has no visible approval gate",
      path: ["agent_context", "payment"],
      why: "Agents that can initiate payments, refunds, or wallet actions need explicit spending and approval controls.",
      fix: "Add amount limits, approved beneficiaries, and human approval before payment tool execution.",
      evidence: serversWithAny(servers, ["payment"])
    }));
  }

  if (capabilities.has("customer_data") && capabilities.has("web_access")) {
    findings.push(finding({
      severity: "high",
      title: "Customer data tools share context with web access",
      path: ["web_access", "agent_context", "customer_data"],
      why: "Mixing untrusted web content and customer-data tools increases exfiltration and bad-action risk.",
      fix: "Split browsing and customer-data workflows into separate agents with a narrow handoff.",
      evidence: serversWithAny(servers, ["web_access", "customer_data"])
    }));
  }

  for (const server of servers) {
    if (server.capabilities.includes("unknown_publisher") && server.capabilities.includes("secrets_access")) {
      findings.push(finding({
        severity: "critical",
        title: "Unknown MCP server receives secrets",
        path: [server.name, "unknown_publisher", "secrets_access"],
        why: "Unverified MCP servers with credentials can become a direct supply-chain compromise path.",
        fix: "Pin the package, verify the publisher/source, remove secrets, or replace it with a trusted server.",
        evidence: [serverEvidence(server)]
      }));
    } else if (server.capabilities.includes("unknown_publisher")) {
      findings.push(finding({
        severity: "medium",
        title: "MCP server publisher could not be verified",
        path: [server.name, "unknown_publisher"],
        why: "Unknown or ad hoc MCP packages are harder to review, patch, and recall after an incident.",
        fix: "Use verified packages, pin versions, and document owner/review status for this server.",
        evidence: [serverEvidence(server)]
      }));
    }
  }

  return dedupe(findings).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

function finding({ severity, title, path, why, fix, evidence }) {
  return {
    id: slug(title),
    severity,
    title,
    path,
    why,
    fix,
    evidence
  };
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function serversWithAny(servers, capabilities) {
  return servers
    .filter((server) => capabilities.some((capability) => server.capabilities.includes(capability)))
    .map(serverEvidence);
}

function serverEvidence(server) {
  return {
    type: "mcp_server",
    name: server.name,
    package: server.packageName,
    config_file: server.configRelativePath,
    capabilities: server.capabilities
  };
}

function workflowEvidence(workflows) {
  return workflows
    .filter((workflow) => workflow.riskSignals.length > 0)
    .map((workflow) => ({
      type: "github_workflow",
      file: workflow.relativePath,
      risk_signals: workflow.riskSignals
    }));
}

function scriptEvidence(packageJson) {
  if (!packageJson.riskSignals || packageJson.riskSignals.length === 0) {
    return [];
  }

  return [
    {
      type: "package_json",
      scripts: packageJson.scripts,
      risk_signals: packageJson.riskSignals
    }
  ];
}

function envEvidence(envFiles) {
  return envFiles
    .filter((file) => file.secretLikeKeys.length > 0)
    .map((file) => ({
      type: "env_file",
      file: file.relativePath,
      secret_like_keys: file.secretLikeKeys
    }));
}

function hasSecretLikeEnvFile(context) {
  return context.envFiles.some((file) => file.secretLikeKeys.length > 0);
}

function hasDeploySignal(context) {
  return (
    context.packageJson.riskSignals.includes("deploy_script") ||
    context.githubWorkflows.some((workflow) => workflow.riskSignals.includes("deployment_workflow"))
  );
}

function hasApprovalSignal(servers) {
  const text = servers
    .flatMap((server) => [server.name, server.command, ...server.args])
    .join(" ")
    .toLowerCase();

  return text.includes("approval") || text.includes("human") || text.includes("limit") || text.includes("policy");
}

function dedupe(findings) {
  const seen = new Set();
  const output = [];

  for (const item of findings) {
    const key = `${item.id}:${JSON.stringify(item.path)}`;
    if (!seen.has(key)) {
      seen.add(key);
      output.push(item);
    }
  }

  return output;
}
