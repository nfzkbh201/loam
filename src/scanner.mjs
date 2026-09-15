import fs from "node:fs";
import path from "node:path";
import { parseMcpConfigs } from "./parsers/mcp.mjs";
import { parsePackageJson } from "./parsers/package-json.mjs";
import { parseGithubWorkflows } from "./parsers/github-actions.mjs";
import { parseEnvFiles } from "./parsers/env.mjs";
import { runRules } from "./rules/index.mjs";

export function scanTarget(targetPath) {
  const root = path.resolve(targetPath);

  if (!fs.existsSync(root)) {
    throw new Error(`Path does not exist: ${root}`);
  }

  const context = {
    root,
    mcpConfigs: parseMcpConfigs(root),
    packageJson: parsePackageJson(root),
    githubWorkflows: parseGithubWorkflows(root),
    envFiles: parseEnvFiles(root)
  };

  const findings = runRules(context);
  const summary = summarize(findings);

  return {
    tool: "agentsec",
    version: "0.1.0",
    scanned_at: new Date().toISOString(),
    target: root,
    abom: buildAbom(context),
    summary,
    findings
  };
}

function summarize(findings) {
  const bySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  for (const finding of findings) {
    bySeverity[finding.severity] += 1;
  }

  const riskScore = Math.min(
    100,
    bySeverity.critical * 35 + bySeverity.high * 20 + bySeverity.medium * 10 + bySeverity.low * 3
  );

  return {
    total_findings: findings.length,
    by_severity: bySeverity,
    risk_score: riskScore
  };
}

function buildAbom(context) {
  const servers = context.mcpConfigs.flatMap((config) => config.servers);
  const capabilities = Array.from(new Set(servers.flatMap((server) => server.capabilities))).sort();

  return {
    mcp_config_files: context.mcpConfigs.map((config) => config.relativePath),
    mcp_servers: servers.map((server) => ({
      name: server.name,
      package: server.packageName,
      command: server.command,
      args: server.args,
      config_file: server.configRelativePath,
      capabilities: server.capabilities,
      paths: server.paths,
      env_keys: server.envKeys
    })),
    capabilities,
    package_scripts: context.packageJson.scripts,
    github_workflows: context.githubWorkflows.map((workflow) => ({
      file: workflow.relativePath,
      risk_signals: workflow.riskSignals
    })),
    env_files: context.envFiles.map((file) => ({
      file: file.relativePath,
      keys: file.keys,
      secret_like_keys: file.secretLikeKeys
    }))
  };
}
