import { DEFAULT_POLICY_PATH } from "./policy-file.mjs";

const APPROVABLE_TYPES = {
  unapproved_capability: "capability",
  unapproved_mcp_server: "mcp_server",
  denied_risk_path: "risk_path"
};

export function buildApprovalSuggestions(policyResult, options = {}) {
  const policyPath = options.policyPath || DEFAULT_POLICY_PATH;
  const approvedBy = options.approvedBy || "$USER";
  const expires = options.expires || defaultExpiry();
  const reason = options.reason || "TODO: reviewed exception";
  const suggestions = [];
  const seen = new Set();

  for (const violation of policyResult?.violations || []) {
    const approvalType = APPROVABLE_TYPES[violation.type];
    if (!approvalType) {
      continue;
    }

    const key = `${approvalType}:${violation.subject}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    suggestions.push({
      type: approvalType,
      subject: violation.subject,
      severity: violation.severity,
      source_violation: violation.id,
      command: buildApproveCommand({
        type: approvalType,
        subject: violation.subject,
        policyPath,
        reason,
        approvedBy,
        expires
      })
    });
  }

  return suggestions;
}

export function buildApproveCommand({ type, subject, policyPath, reason, approvedBy, expires }) {
  return [
    "node ./src/cli.mjs approve",
    shellQuote(type),
    shellQuote(subject),
    "--policy",
    shellQuote(policyPath),
    "--reason",
    shellQuote(reason),
    "--approved-by",
    shellQuote(approvedBy),
    "--expires",
    shellQuote(expires)
  ].join(" ");
}

function defaultExpiry() {
  const now = new Date();
  return `${now.getUTCFullYear()}-12-31`;
}

function shellQuote(value) {
  const text = String(value);

  if (text === "$USER") {
    return "\"$USER\"";
  }

  if (/^[A-Za-z0-9_./:@-]+$/.test(text)) {
    return text;
  }

  return `"${text.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("$", "\\$")}"`;
}
