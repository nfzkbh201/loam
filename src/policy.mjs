const SEVERITY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const DEFAULT_POLICY_SEVERITY = {
  denied_capability: "critical",
  denied_risk_path: "critical",
  unapproved_capability: "high",
  unapproved_mcp_server: "medium"
};

export function evaluatePolicy(result, policy) {
  const violations = [
    ...deniedCapabilities(result, policy),
    ...approvalRequiredCapabilities(result, policy),
    ...allowedMcpServers(result, policy),
    ...deniedRiskPaths(result, policy)
  ].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.title.localeCompare(b.title));

  return {
    policy_name: policy.name || null,
    fail_on: policy.fail_on || null,
    summary: summarize(violations),
    violations
  };
}

export function shouldFailPolicy(policyResult, severity) {
  const threshold = SEVERITY_RANK[severity];
  return policyResult.violations.some((violation) => SEVERITY_RANK[violation.severity] >= threshold);
}

export function validatePolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw new Error("Policy must be a JSON object.");
  }

  if (policy.fail_on && !SEVERITY_RANK[policy.fail_on]) {
    throw new Error("policy.fail_on must be one of: low, medium, high, critical.");
  }

  for (const key of [
    "deny_capabilities",
    "require_approval_for",
    "approved_capabilities",
    "allowed_mcp_servers",
    "deny_risk_paths"
  ]) {
    if (policy[key] && !Array.isArray(policy[key])) {
      throw new Error(`policy.${key} must be an array.`);
    }
  }
}

function deniedCapabilities(result, policy) {
  const denied = new Set(policy.deny_capabilities || []);
  const capabilities = result.abom.capabilities || [];

  return capabilities
    .filter((capability) => denied.has(capability))
    .map((capability) => ({
      id: `policy-denied-capability-${slug(capability)}`,
      type: "denied_capability",
      severity: policy.severity?.denied_capability || DEFAULT_POLICY_SEVERITY.denied_capability,
      title: `Denied capability present: ${capability}`,
      subject: capability,
      why: "This capability is explicitly denied by policy.",
      fix: "Remove the capability from the agent/toolchain or update the policy after review."
    }));
}

function approvalRequiredCapabilities(result, policy) {
  const required = new Set(policy.require_approval_for || []);
  const approved = new Set(policy.approved_capabilities || []);
  const capabilities = result.abom.capabilities || [];

  return capabilities
    .filter((capability) => required.has(capability) && !approved.has(capability))
    .map((capability) => ({
      id: `policy-unapproved-capability-${slug(capability)}`,
      type: "unapproved_capability",
      severity: policy.severity?.unapproved_capability || DEFAULT_POLICY_SEVERITY.unapproved_capability,
      title: `Approval required for capability: ${capability}`,
      subject: capability,
      why: "This capability is present but policy requires explicit approval for it.",
      fix: "Remove the capability or add it to approved_capabilities after review."
    }));
}

function allowedMcpServers(result, policy) {
  if (!policy.allowed_mcp_servers) {
    return [];
  }

  const allowed = new Set(policy.allowed_mcp_servers);

  return (result.abom.mcp_servers || [])
    .filter((server) => !isAllowedServer(server, allowed))
    .map((server) => {
      const subject = server.package || server.name || "unknown MCP server";
      return {
        id: `policy-unapproved-mcp-server-${slug(subject)}`,
        type: "unapproved_mcp_server",
        severity: policy.severity?.unapproved_mcp_server || DEFAULT_POLICY_SEVERITY.unapproved_mcp_server,
        title: `MCP server is not on the allowlist: ${subject}`,
        subject,
        why: "This MCP server is present but policy only allows approved servers.",
        fix: "Remove the server or add its package/name to allowed_mcp_servers after review."
      };
    });
}

function deniedRiskPaths(result, policy) {
  const deniedPaths = (policy.deny_risk_paths || []).map(normalizeRiskPath).filter(Boolean);
  const capabilities = new Set(result.abom.capabilities || []);

  return deniedPaths
    .filter((riskPath) => riskPath.every((capability) => capabilities.has(capability)))
    .map((riskPath) => {
      const subject = riskPath.join(" -> ");
      return {
        id: `policy-denied-risk-path-${slug(subject)}`,
        type: "denied_risk_path",
        severity: policy.severity?.denied_risk_path || DEFAULT_POLICY_SEVERITY.denied_risk_path,
        title: `Denied risk path present: ${subject}`,
        subject,
        why: "The current agent/toolchain matches a risk path denied by policy.",
        fix: "Split these capabilities across isolated agents or add explicit approval controls before changing policy."
      };
    });
}

function isAllowedServer(server, allowed) {
  return allowed.has(server.package) || allowed.has(server.name);
}

function normalizeRiskPath(value) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("->")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return null;
}

function summarize(violations) {
  const bySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  for (const violation of violations) {
    bySeverity[violation.severity] += 1;
  }

  return {
    total_violations: violations.length,
    by_severity: bySeverity
  };
}

function slug(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
