export function buildResearchExport(result) {
  const capabilityCounts = {};
  const findingCounts = {};

  for (const server of result.abom.mcp_servers) {
    for (const capability of server.capabilities) {
      capabilityCounts[capability] = (capabilityCounts[capability] || 0) + 1;
    }
  }

  for (const finding of result.findings) {
    findingCounts[finding.id] = (findingCounts[finding.id] || 0) + 1;
  }

  return {
    tool: result.tool,
    version: result.version,
    exported_at: new Date().toISOString(),
    redacted: true,
    summary: {
      risk_score: result.summary.risk_score,
      total_findings: result.summary.total_findings,
      by_severity: result.summary.by_severity
    },
    inventory: {
      mcp_config_file_count: result.abom.mcp_config_files.length,
      mcp_server_count: result.abom.mcp_servers.length,
      github_workflow_count: result.abom.github_workflows.length,
      env_file_count: result.abom.env_files.length,
      secret_like_env_key_count: result.abom.env_files.reduce(
        (count, file) => count + file.secret_like_keys.length,
        0
      ),
      capabilities: result.abom.capabilities,
      capability_counts: capabilityCounts
    },
    findings: result.findings.map((finding) => {
      const redacted = buildRedactedFinding(finding);
      return {
        id: redacted.id,
        severity: redacted.severity,
        path: redacted.path,
        evidence_types: redacted.evidence_types,
        target_label: redacted.target_label
      };
    }),
    finding_counts: findingCounts
  };
}

export function buildRedactedFinding(finding) {
  return {
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    path: finding.path.map(redactPathSegment),
    why: finding.why,
    fix: finding.fix,
    evidence_types: Array.from(new Set(finding.evidence.map((item) => item.type))).sort(),
    target_label: finding.target_label ? redactTargetLabel(finding.target_label) : null
  };
}

export function redactPathSegment(segment) {
  return SAFE_PATH_SEGMENTS.has(segment) ? segment : "component";
}

export function redactTargetLabel(label) {
  if (!label) {
    return null;
  }

  if (label.startsWith("Project config")) {
    return "project config";
  }

  if (label.includes("Claude")) {
    return "Claude config";
  }

  if (label.includes("Cursor")) {
    return "Cursor config";
  }

  if (label.includes("Codex")) {
    return "Codex config";
  }

  return "target";
}

const SAFE_PATH_SEGMENTS = new Set([
  "agent_context",
  "agent_runtime",
  "customer_data",
  "deployment_workflow",
  "env_file",
  "filesystem_access",
  "filesystem_write",
  "payment",
  "repo_write",
  "secrets_access",
  "shell_exec",
  "unknown_publisher",
  "web_access"
]);
