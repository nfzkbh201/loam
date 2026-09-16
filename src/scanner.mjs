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

  return buildScanResult({
    target: root,
    context,
    findings,
    summary
  });
}

export function scanTargets(targets) {
  const results = targets.map((target) => {
    const result = scanTarget(target.path);
    return labelResult(result, target.label || target.path);
  });

  const findings = results.flatMap((result) => result.findings);
  const summary = summarize(findings);
  const capabilities = Array.from(new Set(results.flatMap((result) => result.abom.capabilities))).sort();

  return {
    tool: "loam",
    version: "0.1.0",
    scanned_at: new Date().toISOString(),
    target: "known agent config locations",
    targets: results.map((result) => ({
      label: result.target_label,
      target: result.target,
      summary: result.summary
    })),
    abom: {
      mcp_config_files: results.flatMap((result) => result.abom.mcp_config_files),
      mcp_servers: results.flatMap((result) => result.abom.mcp_servers),
      capabilities,
      package_scripts: {},
      github_workflows: results.flatMap((result) => result.abom.github_workflows),
      env_files: results.flatMap((result) => result.abom.env_files)
    },
    summary,
    findings
  };
}

function buildScanResult({ target, context, findings, summary }) {
  return {
    tool: "loam",
    version: "0.1.0",
    scanned_at: new Date().toISOString(),
    target,
    abom: buildAbom(context),
    summary,
    findings
  };
}

function labelResult(result, label) {
  return {
    ...result,
    target_label: label,
    abom: {
      ...result.abom,
      mcp_config_files: result.abom.mcp_config_files.map((file) => `${label}: ${file}`),
      mcp_servers: result.abom.mcp_servers.map((server) => ({
        ...server,
        target_label: label,
        config_file: `${label}: ${server.config_file}`
      })),
      github_workflows: result.abom.github_workflows.map((workflow) => ({
        ...workflow,
        target_label: label,
        file: `${label}: ${workflow.file}`
      })),
      env_files: result.abom.env_files.map((envFile) => ({
        ...envFile,
        target_label: label,
        file: `${label}: ${envFile.file}`
      }))
    },
    findings: result.findings.map((finding) => ({
      ...finding,
      target_label: label,
      evidence: finding.evidence.map((evidence) => labelEvidence(evidence, label))
    }))
  };
}

function labelEvidence(evidence, label) {
  if (evidence.type === "mcp_server") {
    return {
      ...evidence,
      target_label: label,
      config_file: `${label}: ${evidence.config_file}`
    };
  }

  if (evidence.type === "github_workflow" || evidence.type === "env_file") {
    return {
      ...evidence,
      target_label: label,
      file: `${label}: ${evidence.file}`
    };
  }

  return {
    ...evidence,
    target_label: label
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
