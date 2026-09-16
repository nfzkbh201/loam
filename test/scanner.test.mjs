import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { diffAboms, shouldFailDiff } from "../src/diff.mjs";
import { evaluatePolicy, shouldFailPolicy, validatePolicy } from "../src/policy.mjs";
import { scanTarget, scanTargets } from "../src/scanner.mjs";
import { buildAbomExport, buildRedactedAbomExport } from "../src/report/abom.mjs";
import { buildDiffMarkdownReport } from "../src/report/diff-markdown.mjs";
import { buildMarkdownReport } from "../src/report/markdown.mjs";
import { buildResearchExport } from "../src/report/research.mjs";
import { buildRedactedMarkdownReport } from "../src/report/redacted-markdown.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "..", "fixtures");

test("flags browser to shell risk", () => {
  const result = scanTarget(path.join(fixtures, "browser-shell-risk"));
  assert.equal(result.summary.by_severity.critical >= 1, true);
  assert.equal(
    result.findings.some((finding) => finding.id === "untrusted-web-content-can-reach-shell-execution"),
    true
  );
});

test("safe fixture has no findings", () => {
  const result = scanTarget(path.join(fixtures, "safe-agent"));
  assert.equal(result.findings.length, 0);
});

test("repo write with deployment path is critical", () => {
  const result = scanTarget(path.join(fixtures, "repo-write-deploy-risk"));
  assert.equal(
    result.findings.some((finding) => finding.id === "agent-may-write-code-and-trigger-deployment-paths"),
    true
  );
});

test("unknown MCP server with secrets is critical", () => {
  const result = scanTarget(path.join(fixtures, "unknown-mcp-risk"));
  assert.equal(result.summary.by_severity.critical >= 1, true);
  assert.equal(
    result.findings.some((finding) => finding.id === "unknown-mcp-server-receives-secrets"),
    true
  );
});

test("broad filesystem access is critical", () => {
  const result = scanTarget(path.join(fixtures, "broad-filesystem-risk"));
  assert.equal(
    result.findings.some((finding) => finding.id === "mcp-server-has-broad-filesystem-access"),
    true
  );
});

test("payment tool without approval is critical", () => {
  const result = scanTarget(path.join(fixtures, "payment-no-approval-risk"));
  assert.equal(
    result.findings.some((finding) => finding.id === "payment-capable-tool-has-no-visible-approval-gate"),
    true
  );
});

test("customer data with web access is high risk", () => {
  const result = scanTarget(path.join(fixtures, "customer-data-web-risk"));
  assert.equal(
    result.findings.some((finding) => finding.id === "customer-data-tools-share-context-with-web-access"),
    true
  );
});

test("env secret-like keys near web tools are flagged without exposing values", () => {
  const result = scanTarget(path.join(fixtures, "web-env-secrets-risk"));
  const finding = result.findings.find(
    (item) => item.id === "secret-like-env-keys-exist-near-web-or-shell-agent-tools"
  );
  assert.ok(finding);
  assert.equal(JSON.stringify(result).includes("super-secret"), false);
});

test("recognizes Claude Desktop MCP config files", () => {
  const result = scanTarget(path.join(fixtures, "claude-desktop-config-risk"));
  assert.equal(result.abom.mcp_config_files.includes("claude_desktop_config.json"), true);
  assert.equal(
    result.findings.some((finding) => finding.id === "untrusted-web-content-can-reach-shell-execution"),
    true
  );
});

test("research export strips names, args, config paths, and env keys", () => {
  const result = scanTarget(path.join(fixtures, "web-env-secrets-risk"));
  const research = buildResearchExport(result);
  const serialized = JSON.stringify(research);

  assert.equal(research.redacted, true);
  assert.equal(serialized.includes("CRM_API_TOKEN"), false);
  assert.equal(serialized.includes(".mcp.json"), false);
  assert.equal(serialized.includes("@modelcontextprotocol/server-browser"), false);
  assert.equal(serialized.includes("browser"), false);
});

test("scanTargets merges labeled results", () => {
  const result = scanTargets([
    {
      label: "Browser shell fixture",
      path: path.join(fixtures, "browser-shell-risk")
    },
    {
      label: "Payment fixture",
      path: path.join(fixtures, "payment-no-approval-risk")
    }
  ]);

  assert.equal(result.targets.length, 2);
  assert.equal(result.summary.by_severity.critical, 2);
  assert.equal(result.abom.mcp_servers.some((server) => server.config_file.startsWith("Browser shell fixture:")), true);
});

test("redacted markdown hides server names, package names, and config filenames", () => {
  const result = scanTargets([
    {
      label: "Cursor MCP config",
      path: path.join(fixtures, "browser-shell-risk")
    }
  ]);
  const markdown = buildRedactedMarkdownReport(result);

  assert.equal(markdown.includes("@modelcontextprotocol/server-browser"), false);
  assert.equal(markdown.includes("mcp-shell"), false);
  assert.equal(markdown.includes(".mcp.json"), false);
  assert.equal(markdown.includes("shell ("), false);
  assert.equal(markdown.includes("Cursor config"), true);
  assert.equal(markdown.includes("web_access"), true);
});

test("ABOM exports full and redacted inventories", () => {
  const result = scanTargets([
    {
      label: "Cursor MCP config",
      path: path.join(fixtures, "browser-shell-risk")
    }
  ]);

  const full = buildAbomExport(result);
  const redacted = buildRedactedAbomExport(result);
  const redactedText = JSON.stringify(redacted);

  assert.equal(full.redacted, false);
  assert.equal(full.abom.mcp_servers.some((server) => server.package === "@modelcontextprotocol/server-browser"), true);
  assert.equal(redacted.redacted, true);
  assert.equal(redacted.abom.mcp_server_count, 2);
  assert.equal(redactedText.includes("@modelcontextprotocol/server-browser"), false);
  assert.equal(redactedText.includes("mcp-shell"), false);
  assert.equal(redactedText.includes(".mcp.json"), false);
  assert.equal(redactedText.includes("Cursor config"), true);
});

test("ABOM diff flags newly introduced critical risk paths", () => {
  const baseline = buildAbomExport(scanTarget(path.join(fixtures, "safe-agent")));
  const current = buildAbomExport(scanTarget(path.join(fixtures, "browser-shell-risk")));
  const diff = diffAboms({ baseline, current });

  assert.equal(diff.summary.by_severity.critical >= 1, true);
  assert.equal(
    diff.changes.some((change) => change.id === "web-access-can-reach-shell-exec"),
    true
  );
  assert.equal(
    diff.changes.some((change) => change.id === "capability-added-shell_exec"),
    true
  );
  assert.equal(shouldFailDiff(diff, "critical"), true);
});

test("ABOM diff markdown summarizes risk paths for PR comments", () => {
  const baseline = buildAbomExport(scanTarget(path.join(fixtures, "safe-agent")));
  const current = buildAbomExport(scanTarget(path.join(fixtures, "browser-shell-risk")));
  const markdown = buildDiffMarkdownReport(diffAboms({ baseline, current }));

  assert.equal(markdown.includes("# AgentSec ABOM Diff"), true);
  assert.equal(markdown.includes("## New Risk Paths"), true);
  assert.equal(markdown.includes("web_access -> shell_exec"), true);
  assert.equal(markdown.includes("## New MCP Servers"), true);
});

test("policy flags denied and unapproved agent capabilities", () => {
  const result = scanTarget(path.join(fixtures, "browser-shell-risk"));
  const policy = {
    name: "strict agent review",
    fail_on: "high",
    deny_capabilities: ["shell_exec"],
    require_approval_for: ["web_access"],
    allowed_mcp_servers: ["@modelcontextprotocol/server-browser"],
    deny_risk_paths: ["web_access -> shell_exec"]
  };

  validatePolicy(policy);
  result.policy = evaluatePolicy(result, policy);
  const markdown = buildMarkdownReport(result);

  assert.equal(result.policy.summary.by_severity.critical, 2);
  assert.equal(result.policy.summary.by_severity.high, 1);
  assert.equal(result.policy.summary.by_severity.medium, 1);
  assert.equal(
    result.policy.violations.some((violation) => violation.id === "policy-denied-capability-shell-exec"),
    true
  );
  assert.equal(
    result.policy.violations.some((violation) => violation.id === "policy-denied-risk-path-web-access-shell-exec"),
    true
  );
  assert.equal(shouldFailPolicy(result.policy, "high"), true);
  assert.equal(markdown.includes("## Policy"), true);
  assert.equal(markdown.includes("Denied capability present: shell_exec"), true);
});
