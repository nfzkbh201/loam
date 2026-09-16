export function buildDiffMarkdownReport(diff) {
  const lines = [];

  lines.push("# Loam ABOM Diff");
  lines.push("");
  lines.push(`**Baseline:** ${formatMaybeCode(diff.baseline.target || "unknown target")}`);
  lines.push(`**Current:** ${formatMaybeCode(diff.current.target || "unknown target")}`);
  lines.push(
    `**Changes:** ${diff.summary.total_changes} ` +
      `(critical ${diff.summary.by_severity.critical}, high ${diff.summary.by_severity.high}, ` +
      `medium ${diff.summary.by_severity.medium}, low ${diff.summary.by_severity.low})`
  );
  lines.push("");

  if (diff.summary.total_changes === 0) {
    lines.push("No ABOM changes detected.");
    lines.push("");
    return lines.join("\n");
  }

  const riskPaths = diff.changes.filter((change) => change.type === "risk_path");
  if (riskPaths.length > 0) {
    lines.push("## New Risk Paths");
    lines.push("");
    lines.push("| Severity | Path | Recommended fix |");
    lines.push("| --- | --- | --- |");

    for (const change of riskPaths) {
      lines.push(
        `| ${escapeCell(change.severity)} | ${escapeCell(change.subject)} | ${escapeCell(change.fix)} |`
      );
    }

    lines.push("");
  }

  const addedTools = diff.changes.filter((change) => change.type === "mcp_server" && change.operation === "added");
  if (addedTools.length > 0) {
    lines.push("## New MCP Servers");
    lines.push("");
    lines.push("| Severity | Server | Capabilities |");
    lines.push("| --- | --- | --- |");

    for (const change of addedTools) {
      lines.push(
        `| ${escapeCell(change.severity)} | ${escapeCell(change.subject)} | ` +
          `${escapeCell((change.capabilities || []).join(", ") || "none")} |`
      );
    }

    lines.push("");
  }

  lines.push("## All Changes");
  lines.push("");
  lines.push("| Severity | Change | Type | Subject |");
  lines.push("| --- | --- | --- | --- |");

  for (const change of diff.changes) {
    lines.push(
      `| ${escapeCell(change.severity)} | ${escapeCell(change.title)} | ` +
        `${escapeCell(change.type)} | ${escapeCell(change.subject)} |`
    );
  }

  lines.push("");
  return lines.join("\n");
}

function formatMaybeCode(value) {
  return value === "unknown target" ? value : `\`${value}\``;
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|");
}
