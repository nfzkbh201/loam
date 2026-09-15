import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { scanTarget, scanTargets } from "../src/scanner.mjs";
import { buildResearchExport } from "../src/report/research.mjs";

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
