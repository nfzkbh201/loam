import { redactTargetLabel } from "./research.mjs";

export const ABOM_SCHEMA = "loam.abom";
export const ABOM_SCHEMA_VERSION = "0.1.0";
export const ABOM_KIND = "AgentBillOfMaterials";

export function buildAbomExport(result) {
  const exportedAt = new Date().toISOString();

  return {
    schema: ABOM_SCHEMA,
    schema_version: ABOM_SCHEMA_VERSION,
    kind: ABOM_KIND,
    tool: result.tool,
    version: result.version,
    exported_at: exportedAt,
    redacted: false,
    metadata: buildMetadata({ result, exportedAt, redacted: false }),
    target: result.target,
    targets: result.targets || [],
    abom: buildV0Abom(result, { redacted: false })
  };
}

export function buildRedactedAbomExport(result) {
  const exportedAt = new Date().toISOString();
  const abom = buildV0Abom(result, { redacted: true });

  return {
    schema: ABOM_SCHEMA,
    schema_version: ABOM_SCHEMA_VERSION,
    kind: ABOM_KIND,
    tool: result.tool,
    version: result.version,
    exported_at: exportedAt,
    redacted: true,
    metadata: buildMetadata({ result, exportedAt, redacted: true }),
    target: result.targets?.length > 0 ? "known agent config locations" : "target",
    targets: (result.targets || []).map((target) => ({
      label: redactTargetLabel(target.label) || "target",
      summary: target.summary
    })),
    abom: {
      ...abom,
      mcp_config_file_count: result.abom.mcp_config_files.length,
      mcp_server_count: result.abom.mcp_servers.length,
      agent_instruction_file_count: result.abom.agent_instructions.length,
      github_workflow_count: result.abom.github_workflows.length,
      env_file_count: result.abom.env_files.length,
      secret_like_env_key_count: result.abom.env_files.reduce((count, file) => count + file.secret_like_keys.length, 0),
      capabilities: result.abom.capabilities,
      mcp_servers: result.abom.mcp_servers.map((server) => ({
        target_label: redactTargetLabel(server.target_label) || null,
        capabilities: server.capabilities,
        path_count: server.paths.length,
        env_key_count: server.env_keys.length
      })),
      github_workflows: result.abom.github_workflows.map((workflow) => ({
        target_label: redactTargetLabel(workflow.target_label) || null,
        risk_signals: workflow.risk_signals
      })),
      agent_instructions: result.abom.agent_instructions.map((instruction) => ({
        target_label: redactTargetLabel(instruction.target_label) || null,
        capabilities: instruction.capabilities,
        risk_signals: instruction.risk_signals
      })),
      env_files: result.abom.env_files.map((file) => ({
        target_label: redactTargetLabel(file.target_label) || null,
        key_count: file.keys.length,
        secret_like_key_count: file.secret_like_keys.length
      }))
    }
  };
}

export function validateAbomV0Document(document) {
  const errors = [];

  requireEqual(document, "schema", ABOM_SCHEMA, errors);
  requireEqual(document, "schema_version", ABOM_SCHEMA_VERSION, errors);
  requireEqual(document, "kind", ABOM_KIND, errors);
  requireEqual(document, "tool", "loam", errors);
  requireString(document, "version", errors);
  requireString(document, "exported_at", errors);
  requireObject(document, "metadata", errors);
  requireObject(document, "abom", errors);

  if (document.metadata) {
    requireString(document.metadata, "target", errors, "metadata.target");
    requireObject(document.metadata, "scanner", errors, "metadata.scanner");
    requireString(document.metadata, "generated_at", errors, "metadata.generated_at");
    requireBoolean(document.metadata, "redacted", errors, "metadata.redacted");
  }

  if (document.abom) {
    for (const key of [
      "agents",
      "instruction_sources",
      "tools",
      "mcp_servers",
      "secrets_reachability",
      "approval_boundaries",
      "authority_paths",
      "findings"
    ]) {
      requireArray(document.abom, key, errors, `abom.${key}`);
    }

    if (!("policy_results" in document.abom)) {
      errors.push("Missing required field: abom.policy_results");
    }

    for (const [index, path] of (document.abom.authority_paths || []).entries()) {
      requireString(path, "id", errors, `abom.authority_paths[${index}].id`);
      requireString(path, "severity", errors, `abom.authority_paths[${index}].severity`);
      requireString(path, "title", errors, `abom.authority_paths[${index}].title`);
      requireArray(path, "nodes", errors, `abom.authority_paths[${index}].nodes`);
      requireString(path, "why", errors, `abom.authority_paths[${index}].why`);
      requireString(path, "fix", errors, `abom.authority_paths[${index}].fix`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function buildMetadata({ result, exportedAt, redacted }) {
  return {
    target: redacted ? (result.targets?.length > 0 ? "known agent config locations" : "target") : result.target,
    targets: redacted
      ? (result.targets || []).map((target) => ({
          label: redactTargetLabel(target.label) || "target",
          summary: target.summary
        }))
      : result.targets || [],
    scanner: {
      name: "loam",
      version: result.version
    },
    generated_at: exportedAt,
    scanned_at: result.scanned_at,
    redacted
  };
}

function buildV0Abom(result, { redacted }) {
  const legacy = redacted ? redactLegacyInventory(result) : result.abom;

  return {
    ...legacy,
    agents: buildAgents(result, { redacted }),
    instruction_sources: buildInstructionSources(result, { redacted }),
    tools: buildTools(result, { redacted }),
    mcp_servers: buildMcpServers(result, { redacted }),
    secrets_reachability: buildSecretsReachability(result, { redacted }),
    approval_boundaries: buildApprovalBoundaries(result, { redacted }),
    authority_paths: buildAuthorityPaths(result, { redacted }),
    findings: buildFindings(result, { redacted }),
    policy_results: result.policy || null
  };
}

function buildAgents(result, { redacted }) {
  const instructions = result.abom.agent_instructions || [];

  if (instructions.length === 0) {
    return [
      {
        id: "agent:local-workspace",
        name: redacted ? "Local agent workspace" : "Local agent workspace",
        type: "local_agent_workspace",
        sources: [],
        capabilities: result.abom.capabilities || [],
        risk_signals: []
      }
    ];
  }

  return instructions.map((instruction, index) => ({
    id: `agent:${slug(redacted ? `instruction-${index + 1}` : instruction.file)}`,
    name: redacted ? `Agent instruction ${index + 1}` : inferAgentName(instruction.file),
    type: inferAgentType(instruction.file),
    sources: [redacted ? `instruction:${index + 1}` : instruction.file],
    capabilities: instruction.capabilities || [],
    risk_signals: instruction.risk_signals || []
  }));
}

function buildInstructionSources(result, { redacted }) {
  return (result.abom.agent_instructions || []).map((instruction, index) => ({
    id: `instruction:${slug(redacted ? `${index + 1}` : instruction.file)}`,
    type: inferInstructionType(instruction.file),
    source: redacted ? `instruction:${index + 1}` : instruction.file,
    capabilities: instruction.capabilities || [],
    risk_signals: instruction.risk_signals || []
  }));
}

function buildTools(result, { redacted }) {
  const packageScripts = Object.entries(result.abom.package_scripts || {}).map(([name, command], index) => ({
    id: `tool:package-script:${slug(redacted ? `${index + 1}` : name)}`,
    type: "package_script",
    name: redacted ? `package-script:${index + 1}` : name,
    source: "package.json",
    command: redacted ? null : command,
    capabilities: inferScriptCapabilities(command),
    risk_signals: inferScriptRiskSignals(command)
  }));

  const workflows = (result.abom.github_workflows || []).map((workflow, index) => ({
    id: `tool:github-workflow:${slug(redacted ? `${index + 1}` : workflow.file)}`,
    type: "github_workflow",
    name: redacted ? `github-workflow:${index + 1}` : workflow.file,
    source: redacted ? "github-workflow" : workflow.file,
    capabilities: workflowCapabilities(workflow.risk_signals || []),
    risk_signals: workflow.risk_signals || []
  }));

  return [...packageScripts, ...workflows];
}

function buildMcpServers(result, { redacted }) {
  return (result.abom.mcp_servers || []).map((server, index) => ({
    id: `mcp:${slug(redacted ? `${index + 1}` : server.name || server.package || index + 1)}`,
    name: redacted ? `mcp-server:${index + 1}` : server.name,
    package: redacted ? null : server.package,
    command: redacted ? "" : server.command,
    args: redacted ? [] : server.args || [],
    config_file: redacted ? "mcp-config" : server.config_file,
    capabilities: server.capabilities || [],
    env_keys: redacted ? server.env_keys.map(() => "REDACTED_ENV_KEY") : server.env_keys || [],
    paths: redacted ? (server.paths || []).map((item) => ({ broad: Boolean(item.broad) })) : server.paths || []
  }));
}

function buildSecretsReachability(result, { redacted }) {
  const envReachability = (result.abom.env_files || [])
    .filter((file) => (file.secret_like_keys || []).length > 0)
    .map((file, index) => ({
      id: `secrets:env:${slug(redacted ? `${index + 1}` : file.file)}`,
      source: redacted ? `env-file:${index + 1}` : file.file,
      reachable_by: reachableByForSecrets(result),
      secret_keys: redacted ? file.secret_like_keys.map(() => "REDACTED_SECRET_KEY") : file.secret_like_keys,
      exposure: reachableByForSecrets(result).length > 0 ? "agent_runtime_adjacent" : "present_not_linked"
    }));

  const mcpReachability = (result.abom.mcp_servers || [])
    .filter((server) => (server.env_keys || []).length > 0)
    .map((server, index) => ({
      id: `secrets:mcp:${slug(redacted ? `${index + 1}` : server.name || index + 1)}`,
      source: redacted ? `mcp-server:${index + 1}` : server.name,
      reachable_by: server.capabilities || [],
      secret_keys: redacted ? server.env_keys.map(() => "REDACTED_ENV_KEY") : server.env_keys,
      exposure: "tool_runtime_env"
    }));

  return [...envReachability, ...mcpReachability];
}

function buildApprovalBoundaries(result, { redacted }) {
  const boundaries = [];
  const sensitiveCapabilities = (result.abom.capabilities || []).filter((capability) =>
    ["shell_exec", "repo_write", "deploy", "payment", "secrets_access", "filesystem_write"].includes(capability)
  );
  const noApprovalInstructions = (result.abom.agent_instructions || []).filter((instruction) =>
    (instruction.risk_signals || []).includes("no_visible_approval")
  );

  if (sensitiveCapabilities.length > 0) {
    boundaries.push({
      id: "approval:sensitive-capabilities",
      subject: "sensitive_capability_use",
      status: noApprovalInstructions.length > 0 ? "missing" : "unknown",
      sensitive_capabilities: sensitiveCapabilities,
      evidence: redacted
        ? noApprovalInstructions.map((_, index) => ({ type: "agent_instruction", source: `instruction:${index + 1}` }))
        : noApprovalInstructions.map((instruction) => ({
            type: "agent_instruction",
            file: instruction.file,
            risk_signals: instruction.risk_signals
          }))
    });
  }

  for (const exception of result.policy?.approved_exceptions || []) {
    boundaries.push({
      id: `approval:exception:${slug(exception.type)}:${slug(exception.subject)}`,
      subject: exception.subject,
      status: "approved_exception",
      sensitive_capabilities: exception.type === "capability" ? [exception.subject] : [],
      evidence: [
        {
          type: "policy_approval",
          approved_by: exception.approved_by || null,
          expires: exception.expires || null,
          reason: exception.reason || null
        }
      ]
    });
  }

  return boundaries;
}

function buildAuthorityPaths(result, { redacted }) {
  return (result.findings || []).map((finding) => ({
    id: `authority-path:${finding.id}`,
    severity: finding.severity,
    title: finding.title,
    nodes: finding.path || [],
    why: finding.why,
    fix: finding.fix,
    evidence: redacted ? redactEvidence(finding.evidence || []) : finding.evidence || []
  }));
}

function buildFindings(result, { redacted }) {
  return (result.findings || []).map((finding) => ({
    ...finding,
    evidence: redacted ? redactEvidence(finding.evidence || []) : finding.evidence || []
  }));
}

function redactLegacyInventory(result) {
  return {
    mcp_config_files: result.abom.mcp_config_files.map((_, index) => `mcp-config:${index + 1}`),
    mcp_servers: result.abom.mcp_servers.map((server, index) => ({
      target_label: redactTargetLabel(server.target_label) || null,
      name: `mcp-server:${index + 1}`,
      package: null,
      command: "",
      args: [],
      config_file: "mcp-config",
      capabilities: server.capabilities,
      paths: (server.paths || []).map((item) => ({ broad: Boolean(item.broad) })),
      env_keys: server.env_keys.map(() => "REDACTED_ENV_KEY")
    })),
    capabilities: result.abom.capabilities,
    package_scripts: {},
    github_workflows: result.abom.github_workflows.map((workflow, index) => ({
      target_label: redactTargetLabel(workflow.target_label) || null,
      file: `github-workflow:${index + 1}`,
      risk_signals: workflow.risk_signals
    })),
    env_files: result.abom.env_files.map((file, index) => ({
      target_label: redactTargetLabel(file.target_label) || null,
      file: `env-file:${index + 1}`,
      keys: file.keys.map(() => "REDACTED_ENV_KEY"),
      secret_like_keys: file.secret_like_keys.map(() => "REDACTED_SECRET_KEY")
    })),
    agent_instructions: result.abom.agent_instructions.map((instruction, index) => ({
      target_label: redactTargetLabel(instruction.target_label) || null,
      file: `instruction:${index + 1}`,
      capabilities: instruction.capabilities,
      risk_signals: instruction.risk_signals
    }))
  };
}

function reachableByForSecrets(result) {
  const capabilities = new Set(result.abom.capabilities || []);
  return ["web_access", "shell_exec", "filesystem_access", "filesystem_write"]
    .filter((capability) => capabilities.has(capability));
}

function inferAgentName(file) {
  if (file.includes(".cursor/") || file.includes(".cursorrules")) {
    return "Cursor agent";
  }
  if (file.endsWith("CLAUDE.md")) {
    return "Claude Code agent";
  }
  if (file.endsWith("AGENTS.md")) {
    return "Project agent";
  }
  return "Local agent";
}

function inferAgentType(file) {
  if (file.includes(".cursor/") || file.includes(".cursorrules")) {
    return "cursor";
  }
  if (file.endsWith("CLAUDE.md")) {
    return "claude_code";
  }
  if (file.endsWith("AGENTS.md")) {
    return "generic_agent";
  }
  return "local_agent";
}

function inferInstructionType(file) {
  if (file.includes(".cursor/")) {
    return "cursor_rule";
  }
  if (file.endsWith("CLAUDE.md")) {
    return "claude_project_instruction";
  }
  if (file.endsWith("AGENTS.md")) {
    return "project_agent_instruction";
  }
  return "agent_instruction";
}

function inferScriptCapabilities(command) {
  const text = String(command || "").toLowerCase();
  const capabilities = new Set();
  if (text.includes("deploy") || text.includes("vercel") || text.includes("netlify") || text.includes("flyctl")) {
    capabilities.add("deploy");
  }
  if (text.includes("git push") || text.includes("release")) {
    capabilities.add("repo_write");
  }
  if (text.includes("stripe") || text.includes("payment")) {
    capabilities.add("payment");
  }
  return Array.from(capabilities).sort();
}

function inferScriptRiskSignals(command) {
  const text = String(command || "").toLowerCase();
  const signals = [];
  if (text.includes("deploy") || text.includes("release")) {
    signals.push("deployment_script");
  }
  return signals;
}

function workflowCapabilities(riskSignals) {
  const capabilities = new Set();
  if (riskSignals.includes("deployment_workflow")) {
    capabilities.add("deploy");
  }
  if (riskSignals.includes("repo_write_permission")) {
    capabilities.add("repo_write");
  }
  if (riskSignals.includes("uses_github_secrets")) {
    capabilities.add("secrets_access");
  }
  return Array.from(capabilities).sort();
}

function redactEvidence(evidence) {
  return evidence.map((item, index) => {
    const output = {
      type: item.type || "evidence",
      redacted_ref: `evidence:${index + 1}`
    };

    if (item.capabilities) {
      output.capabilities = item.capabilities;
    }
    if (item.risk_signals) {
      output.risk_signals = item.risk_signals;
    }
    if (item.secret_like_keys) {
      output.secret_like_key_count = item.secret_like_keys.length;
    }
    return output;
  });
}

function requireEqual(object, key, expected, errors, label = key) {
  if (object?.[key] !== expected) {
    errors.push(`Expected ${label} to equal ${expected}.`);
  }
}

function requireString(object, key, errors, label = key) {
  if (typeof object?.[key] !== "string" || object[key].length === 0) {
    errors.push(`Expected ${label} to be a non-empty string.`);
  }
}

function requireBoolean(object, key, errors, label = key) {
  if (typeof object?.[key] !== "boolean") {
    errors.push(`Expected ${label} to be a boolean.`);
  }
}

function requireObject(object, key, errors, label = key) {
  if (!object?.[key] || typeof object[key] !== "object" || Array.isArray(object[key])) {
    errors.push(`Expected ${label} to be an object.`);
  }
}

function requireArray(object, key, errors, label = key) {
  if (!Array.isArray(object?.[key])) {
    errors.push(`Expected ${label} to be an array.`);
  }
}

function slug(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "item";
}
