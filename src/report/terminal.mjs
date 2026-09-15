const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  green: "\x1b[32m"
};

const SEVERITY_COLOR = {
  critical: COLORS.red,
  high: COLORS.yellow,
  medium: COLORS.blue,
  low: COLORS.green
};

export function printTerminalReport(result) {
  console.log(`${bold("agentsec scan report")}`);
  console.log(`${dim("Target:")} ${result.target}`);
  console.log(`${dim("Risk score:")} ${result.summary.risk_score}/100`);
  console.log(
    `${dim("Findings:")} ${result.summary.total_findings} ` +
      `(critical ${result.summary.by_severity.critical}, high ${result.summary.by_severity.high}, ` +
      `medium ${result.summary.by_severity.medium}, low ${result.summary.by_severity.low})`
  );

  console.log("");
  console.log(bold("Agent Bill of Materials"));
  console.log(`MCP configs: ${result.abom.mcp_config_files.length || 0}`);
  console.log(`MCP servers: ${result.abom.mcp_servers.length || 0}`);
  console.log(`Capabilities: ${result.abom.capabilities.length ? result.abom.capabilities.join(", ") : "none detected"}`);
  console.log(`Env files: ${result.abom.env_files.length || 0}`);

  if (result.findings.length === 0) {
    console.log("");
    console.log(`${COLORS.green}No findings detected.${COLORS.reset}`);
    return;
  }

  console.log("");
  console.log(bold("Findings"));

  for (const finding of result.findings) {
    const label = severity(finding.severity);
    console.log("");
    console.log(`${label} ${bold(finding.title)}`);
    console.log(`${dim("Path:")} ${finding.path.join(" -> ")}`);
    console.log(`${dim("Why:")} ${finding.why}`);
    console.log(`${dim("Fix:")} ${finding.fix}`);

    if (finding.evidence.length > 0) {
      console.log(dim("Evidence:"));
      for (const evidence of finding.evidence) {
        if (evidence.type === "mcp_server") {
          console.log(
            `  - ${evidence.config_file}: ${evidence.name}` +
              `${evidence.package ? ` (${evidence.package})` : ""}` +
              ` [${evidence.capabilities.join(", ")}]`
          );
        } else if (evidence.type === "github_workflow") {
          console.log(`  - ${evidence.file} [${evidence.risk_signals.join(", ")}]`);
        } else if (evidence.type === "package_json") {
          console.log(`  - package.json [${evidence.risk_signals.join(", ")}]`);
        } else if (evidence.type === "env_file") {
          console.log(`  - ${evidence.file} [secret-like keys: ${evidence.secret_like_keys.join(", ")}]`);
        }
      }
    }
  }
}

function severity(value) {
  return `${SEVERITY_COLOR[value] || ""}${value.toUpperCase()}${COLORS.reset}`;
}

function bold(value) {
  return `${COLORS.bold}${value}${COLORS.reset}`;
}

function dim(value) {
  return `${COLORS.dim}${value}${COLORS.reset}`;
}
