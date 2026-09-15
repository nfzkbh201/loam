import { buildRedactedFinding, redactTargetLabel } from "./research.mjs";

export function buildRedactedMarkdownReport(result) {
  const lines = [];

  lines.push("# AgentSec Redacted Risk Report");
  lines.push("");
  lines.push("This report is redacted for sharing. It removes exact paths, config filenames, server names, package names, command args, and env key names.");
  lines.push("");
  lines.push(`**Risk score:** ${result.summary.risk_score}/100`);
  lines.push(
    `**Findings:** ${result.summary.total_findings} ` +
      `(critical ${result.summary.by_severity.critical}, high ${result.summary.by_severity.high}, ` +
      `medium ${result.summary.by_severity.medium}, low ${result.summary.by_severity.low})`
  );
  lines.push("");

  if (result.targets?.length > 0) {
    lines.push("## Scanned Targets");
    lines.push("");
    lines.push("| Target | Findings | Risk score |");
    lines.push("| --- | ---: | ---: |");

    for (const target of result.targets) {
      lines.push(
        `| ${escapeCell(redactTargetLabel(target.label) || "target")} | ${target.summary.total_findings} | ${target.summary.risk_score}/100 |`
      );
    }

    lines.push("");
  }

  lines.push("## Redacted Inventory");
  lines.push("");
  lines.push(`- MCP config files: ${result.abom.mcp_config_files.length}`);
  lines.push(`- MCP servers: ${result.abom.mcp_servers.length}`);
  lines.push(`- GitHub workflow files: ${result.abom.github_workflows.length}`);
  lines.push(`- Env files: ${result.abom.env_files.length}`);
  lines.push(`- Secret-like env keys: ${result.abom.env_files.reduce((count, file) => count + file.secret_like_keys.length, 0)}`);
  lines.push(
    `- Capabilities: ${
      result.abom.capabilities.length ? result.abom.capabilities.map((item) => `\`${item}\``).join(", ") : "none detected"
    }`
  );
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("## Findings");
    lines.push("");
    lines.push("No findings detected.");
    lines.push("");
    return lines.join("\n");
  }

  for (const severity of ["critical", "high", "medium", "low"]) {
    const findings = result.findings
      .filter((finding) => finding.severity === severity)
      .map(buildRedactedFinding);

    if (findings.length === 0) {
      continue;
    }

    lines.push(`## ${titleCase(severity)} Findings`);
    lines.push("");

    for (const finding of findings) {
      lines.push(`### ${finding.title}`);
      lines.push("");

      if (finding.target_label) {
        lines.push(`**Target:** ${finding.target_label}`);
        lines.push("");
      }

      lines.push(`**Path:** ${finding.path.map((item) => `\`${item}\``).join(" -> ")}`);
      lines.push("");
      lines.push(`**Evidence types:** ${finding.evidence_types.map((item) => `\`${item}\``).join(", ") || "none"}`);
      lines.push("");
      lines.push(`**Why it matters:** ${finding.why}`);
      lines.push("");
      lines.push(`**Recommended fix:** ${finding.fix}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function titleCase(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
