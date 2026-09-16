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
  const context = buildApprovalContext(policy);
  const violations = [
    ...deniedCapabilities(result, policy),
    ...approvalRequiredCapabilities(result, policy, context),
    ...allowedMcpServers(result, policy, context),
    ...deniedRiskPaths(result, policy, context)
  ].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.title.localeCompare(b.title));

  return {
    policy_name: policy.name || null,
    fail_on: policy.fail_on || null,
    summary: summarize(violations),
    approved_exceptions: context.approvedExceptions,
    violations
  };
}

export function shouldFailPolicy(policyResult, severity) {
  const threshold = SEVERITY_RANK[severity];
  return policyResult.violations.some((violation) => SEVERITY_RANK[violation.severity] >= threshold);
}

export function isFindingApprovedByPolicy(finding, policyResult) {
  for (const approval of policyResult?.approved_exceptions || []) {
    if (approval.type === "risk_path" && findingMatchesRiskPath(finding, approval.subject)) {
      return true;
    }

    if (approval.type === "capability" && findingMatchesCapability(finding, approval.subject)) {
      return true;
    }

    if (approval.type === "mcp_server" && findingMatchesMcpServer(finding, approval.subject)) {
      return true;
    }
  }

  return false;
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
    "deny_risk_paths",
    "approvals"
  ]) {
    if (policy[key] && !Array.isArray(policy[key])) {
      throw new Error(`policy.${key} must be an array.`);
    }
  }

  for (const approval of policy.approvals || []) {
    if (!approval || typeof approval !== "object" || Array.isArray(approval)) {
      throw new Error("policy.approvals entries must be objects.");
    }

    if (!["capability", "mcp_server", "risk_path"].includes(approval.type)) {
      throw new Error("policy.approvals entries must have type capability, mcp_server, or risk_path.");
    }

    if (!approval.subject) {
      throw new Error("policy.approvals entries must include subject.");
    }

    if (approval.type === "risk_path" && !normalizeRiskPath(approval.subject)) {
      throw new Error("policy.approvals risk_path subjects must be strings or arrays.");
    }

    if (approval.expires && Number.isNaN(Date.parse(approval.expires))) {
      throw new Error("policy.approvals expires values must be valid dates.");
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

function approvalRequiredCapabilities(result, policy, context) {
  const required = new Set(policy.require_approval_for || []);
  const approved = new Set(policy.approved_capabilities || []);
  const capabilities = result.abom.capabilities || [];

  const violations = [];

  for (const capability of capabilities) {
    if (!required.has(capability)) {
      continue;
    }

    if (approved.has(capability)) {
      addApprovedException(context, {
        type: "capability",
        subject: capability,
        reason: "Approved by approved_capabilities."
      });
      continue;
    }

    const approval = findApproval(context, "capability", capability);
    if (approval.active) {
      addApprovedException(context, approval.approval);
      continue;
    }

    violations.push({
      id: `policy-unapproved-capability-${slug(capability)}`,
      type: "unapproved_capability",
      severity: policy.severity?.unapproved_capability || DEFAULT_POLICY_SEVERITY.unapproved_capability,
      title: `Approval required for capability: ${capability}`,
      subject: capability,
      why: approval.expired
        ? "This capability has an expired approval."
        : "This capability is present but policy requires explicit approval for it.",
      fix: "Remove the capability or add a current approval after review.",
      ...(approval.expired ? { expired_approval: approval.expired } : {})
    });
  }

  return violations;
}

function allowedMcpServers(result, policy, context) {
  if (!policy.allowed_mcp_servers) {
    return [];
  }

  const allowed = new Set(policy.allowed_mcp_servers);
  const violations = [];

  for (const server of result.abom.mcp_servers || []) {
    if (isAllowedServer(server, allowed)) {
      continue;
    }

    const subject = server.package || server.name || "unknown MCP server";
    const approval = findServerApproval(context, server);
    if (approval.active) {
      addApprovedException(context, approval.approval);
      continue;
    }

    violations.push({
      id: `policy-unapproved-mcp-server-${slug(subject)}`,
      type: "unapproved_mcp_server",
      severity: policy.severity?.unapproved_mcp_server || DEFAULT_POLICY_SEVERITY.unapproved_mcp_server,
      title: `MCP server is not on the allowlist: ${subject}`,
      subject,
      why: approval.expired
        ? "This MCP server has an expired approval."
        : "This MCP server is present but policy only allows approved servers.",
      fix: "Remove the server or add a current MCP server approval after review.",
      ...(approval.expired ? { expired_approval: approval.expired } : {})
    });
  }

  return violations;
}

function deniedRiskPaths(result, policy, context) {
  const deniedPaths = (policy.deny_risk_paths || []).map(normalizeRiskPath).filter(Boolean);
  const capabilities = new Set(result.abom.capabilities || []);
  const violations = [];

  for (const riskPath of deniedPaths) {
    if (!riskPath.every((capability) => capabilities.has(capability))) {
      continue;
    }

    const subject = riskPath.join(" -> ");
    const approval = findApproval(context, "risk_path", subject);
    if (approval.active) {
      addApprovedException(context, approval.approval);
      continue;
    }

    violations.push({
      id: `policy-denied-risk-path-${slug(subject)}`,
      type: "denied_risk_path",
      severity: policy.severity?.denied_risk_path || DEFAULT_POLICY_SEVERITY.denied_risk_path,
      title: `Denied risk path present: ${subject}`,
      subject,
      why: approval.expired
        ? "This risk path has an expired approval."
        : "The current agent/toolchain matches a risk path denied by policy.",
      fix: "Split these capabilities across isolated agents or add a current risk-path approval before changing policy.",
      ...(approval.expired ? { expired_approval: approval.expired } : {})
    });
  }

  return violations;
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

function findingMatchesRiskPath(finding, subject) {
  const riskPath = normalizeRiskPath(subject);
  if (!riskPath) {
    return false;
  }

  return riskPath.every((capability) => finding.path.includes(capability));
}

function findingMatchesCapability(finding, subject) {
  return (
    finding.path.includes(subject) ||
    finding.evidence.some((evidence) => (evidence.capabilities || []).includes(subject))
  );
}

function findingMatchesMcpServer(finding, subject) {
  return finding.evidence.some(
    (evidence) => evidence.type === "mcp_server" && (evidence.name === subject || evidence.package === subject)
  );
}

function buildApprovalContext(policy) {
  const now = new Date();
  const active = [];
  const expired = [];

  for (const approval of policy.approvals || []) {
    const normalized = normalizeApproval(approval);
    if (normalized.expires && new Date(normalized.expires) < now) {
      expired.push(normalized);
    } else {
      active.push(normalized);
    }
  }

  return {
    activeApprovals: active,
    expiredApprovals: expired,
    approvedExceptions: []
  };
}

function normalizeApproval(approval) {
  const subject = approval.type === "risk_path" ? normalizeRiskPath(approval.subject).join(" -> ") : String(approval.subject);

  return {
    type: approval.type,
    subject,
    reason: approval.reason || null,
    approved_by: approval.approved_by || null,
    expires: approval.expires || null
  };
}

function findServerApproval(context, server) {
  const subjects = [server.package, server.name].filter(Boolean);
  for (const subject of subjects) {
    const approval = findApproval(context, "mcp_server", subject);
    if (approval.active || approval.expired) {
      return approval;
    }
  }

  return {};
}

function findApproval(context, type, subject) {
  const normalizedSubject = type === "risk_path" ? normalizeRiskPath(subject).join(" -> ") : String(subject);
  const active = context.activeApprovals.find(
    (approval) => approval.type === type && approval.subject === normalizedSubject
  );
  if (active) {
    return { active: true, approval: active };
  }

  const expired = context.expiredApprovals.find(
    (approval) => approval.type === type && approval.subject === normalizedSubject
  );
  if (expired) {
    return { expired };
  }

  return {};
}

function addApprovedException(context, approval) {
  const normalized = {
    type: approval.type,
    subject: approval.subject,
    reason: approval.reason || null,
    approved_by: approval.approved_by || null,
    expires: approval.expires || null
  };
  const key = `${normalized.type}:${normalized.subject}`;

  if (!context.approvedExceptions.some((item) => `${item.type}:${item.subject}` === key)) {
    context.approvedExceptions.push(normalized);
  }
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
