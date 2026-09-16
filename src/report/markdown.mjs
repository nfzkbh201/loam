export function buildMarkdownReport(result) {
  const lines = [];

  lines.push("# AgentSec Risk Report");
  lines.push("");
  lines.push(`**Target:** \`${result.target}\``);
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
        `| ${escapeCell(target.label)} | ${target.summary.total_findings} | ${target.summary.risk_score}/100 |`
      );
    }

    lines.push("");
  }

  lines.push("## Agent Bill of Materials");
  lines.push("");
  lines.push(`- MCP config files: ${result.abom.mcp_config_files.length}`);
  lines.push(`- MCP servers: ${result.abom.mcp_servers.length}`);
  lines.push(
    `- Capabilities: ${
      result.abom.capabilities.length ? result.abom.capabilities.map((item) => `\`${item}\``).join(", ") : "none detected"
    }`
  );
  lines.push("");

  if (result.abom.mcp_servers.length > 0) {
    lines.push("| MCP server | Package | Capabilities | Config |");
    lines.push("| --- | --- | --- | --- |");

    for (const server of result.abom.mcp_servers) {
      lines.push(
        `| ${escapeCell(server.name)} | ${escapeCell(server.package || "unknown")} | ` +
          `${escapeCell(server.capabilities.join(", ") || "none")} | ${escapeCell(server.config_file)} |`
      );
    }

    lines.push("");
  }

  if (result.abom.env_files.length > 0) {
    lines.push("| Env file | Keys | Secret-like keys |");
    lines.push("| --- | --- | --- |");

    for (const envFile of result.abom.env_files) {
      lines.push(
        `| ${escapeCell(envFile.file)} | ${envFile.keys.length} | ` +
          `${escapeCell(envFile.secret_like_keys.join(", ") || "none")} |`
      );
    }

    lines.push("");
  }

  if (result.policy) {
    lines.push("## Policy");
    lines.push("");
    lines.push(
      `Violations: ${result.policy.summary.total_violations} ` +
        `(critical ${result.policy.summary.by_severity.critical}, high ${result.policy.summary.by_severity.high}, ` +
        `medium ${result.policy.summary.by_severity.medium}, low ${result.policy.summary.by_severity.low})`
    );
    lines.push("");

    if (result.policy.violations.length > 0) {
      lines.push("| Severity | Violation | Subject | Recommended fix |");
      lines.push("| --- | --- | --- | --- |");

      for (const violation of result.policy.violations) {
        lines.push(
          `| ${escapeCell(violation.severity)} | ${escapeCell(violation.title)} | ` +
            `${escapeCell(violation.subject)} | ${escapeCell(violation.fix)} |`
        );
      }

      lines.push("");
    }

    if (result.policy.approved_exceptions?.length > 0) {
      lines.push("### Approved Exceptions");
      lines.push("");
      lines.push("| Type | Subject | Approved by | Expires | Reason |");
      lines.push("| --- | --- | --- | --- | --- |");

      for (const approval of result.policy.approved_exceptions) {
        lines.push(
          `| ${escapeCell(approval.type)} | ${escapeCell(approval.subject)} | ` +
            `${escapeCell(approval.approved_by || "unknown")} | ${escapeCell(approval.expires || "none")} | ` +
            `${escapeCell(approval.reason || "none")} |`
        );
      }

      lines.push("");
    }
  }

  if (result.findings.length === 0) {
    lines.push("## Findings");
    lines.push("");
    lines.push("No findings detected.");
    lines.push("");
    return lines.join("\n");
  }

  for (const severity of ["critical", "high", "medium", "low"]) {
    const findings = result.findings.filter((finding) => finding.severity === severity);
    if (findings.length === 0) {
      continue;
    }

    lines.push(`## ${titleCase(severity)} Findings`);
    lines.push("");

    for (const finding of findings) {
      lines.push(`### ${finding.title}`);
      lines.push("");
      lines.push(`**Path:** ${finding.path.map((item) => `\`${item}\``).join(" -> ")}`);
      lines.push("");
      lines.push(`**Why it matters:** ${finding.why}`);
      lines.push("");
      lines.push(`**Recommended fix:** ${finding.fix}`);
      lines.push("");

      if (finding.evidence.length > 0) {
        lines.push("**Evidence:**");
        lines.push("");

        for (const evidence of finding.evidence) {
          lines.push(`- ${formatEvidence(evidence)}`);
        }

        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

function formatEvidence(evidence) {
  if (evidence.type === "mcp_server") {
    return (
      `\`${evidence.config_file}\`: \`${evidence.name}\`` +
      `${evidence.package ? ` (\`${evidence.package}\`)` : ""}` +
      ` with ${evidence.capabilities.map((item) => `\`${item}\``).join(", ")}`
    );
  }

  if (evidence.type === "github_workflow") {
    return `\`${evidence.file}\` with ${evidence.risk_signals.map((item) => `\`${item}\``).join(", ")}`;
  }

  if (evidence.type === "package_json") {
    return `\`package.json\` with ${evidence.risk_signals.map((item) => `\`${item}\``).join(", ")}`;
  }

  if (evidence.type === "env_file") {
    return `\`${evidence.file}\` with secret-like keys ${evidence.secret_like_keys.map((item) => `\`${item}\``).join(", ")}`;
  }

  return `\`${JSON.stringify(evidence)}\``;
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function titleCase(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
