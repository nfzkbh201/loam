import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePolicy } from "./policy.mjs";

export const DEFAULT_POLICY_PATH = ".loam/policy.json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE_POLICY_PATH = path.resolve(__dirname, "..", "examples", "policy.json");

export function initPolicyFile({ policyPath = DEFAULT_POLICY_PATH, force = false } = {}) {
  const resolved = path.resolve(policyPath);

  if (fs.existsSync(resolved) && !force) {
    return {
      created: false,
      path: resolved,
      message: `Policy already exists at ${resolved}. Use --force to overwrite.`
    };
  }

  const policy = readJsonFile(EXAMPLE_POLICY_PATH);
  writePolicyFile(resolved, policy);

  return {
    created: true,
    path: resolved,
    message: `Created policy at ${resolved}.`
  };
}

export function addApproval({ policyPath = DEFAULT_POLICY_PATH, approval }) {
  const resolved = path.resolve(policyPath);
  const policy = fs.existsSync(resolved) ? readJsonFile(resolved) : readJsonFile(EXAMPLE_POLICY_PATH);
  policy.approvals = policy.approvals || [];

  const normalized = normalizeApproval(approval);
  validatePolicy({ ...policy, approvals: [...policy.approvals, normalized] });

  const now = new Date();
  const existing = policy.approvals.find((item) => {
    const candidate = normalizeApproval(item);
    const active = !candidate.expires || new Date(candidate.expires) >= now;
    return active && candidate.type === normalized.type && candidate.subject === normalized.subject;
  });

  if (existing) {
    return {
      added: false,
      path: resolved,
      approval: normalizeApproval(existing),
      message: `Approval already exists for ${normalized.type}: ${normalized.subject}.`
    };
  }

  policy.approvals.push(normalized);
  writePolicyFile(resolved, policy);

  return {
    added: true,
    path: resolved,
    approval: normalized,
    message: `Added approval for ${normalized.type}: ${normalized.subject}.`
  };
}

export function listApprovals({ policyPath = DEFAULT_POLICY_PATH } = {}) {
  const resolved = path.resolve(policyPath);
  const policy = readJsonFile(resolved);
  validatePolicy(policy);

  const now = new Date();
  const approvals = (policy.approvals || []).map(normalizeApproval);

  return {
    path: resolved,
    active: approvals.filter((approval) => !approval.expires || new Date(approval.expires) >= now),
    expired: approvals.filter((approval) => approval.expires && new Date(approval.expires) < now)
  };
}

export function normalizeApproval(approval) {
  return {
    type: approval.type,
    subject: approval.type === "risk_path" ? normalizeRiskPath(approval.subject).join(" -> ") : String(approval.subject),
    reason: approval.reason || null,
    approved_by: approval.approved_by || null,
    expires: approval.expires || null
  };
}

function writePolicyFile(filePath, policy) {
  validatePolicy(policy);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(policy, null, 2)}\n`);
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON file ${filePath}: ${error.message}`);
  }
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

  return [];
}
