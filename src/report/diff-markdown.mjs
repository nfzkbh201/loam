export function buildDiffMarkdownReport(diff) {
  const lines = [];

  lines.push("# Loam Authority Change");
  lines.push("");
  lines.push(`**Risk:** ${formatRisk(diff.summary.highest_severity)}`);
  lines.push(`**Baseline:** ${formatMaybeCode(diff.baseline.target || "unknown target")}`);
  lines.push(`**Current:** ${formatMaybeCode(diff.current.target || "unknown target")}`);
  lines.push(`**Changes:** ${formatChangeSummary(diff.summary)}`);
  lines.push("");

  if (diff.summary.total_changes === 0) {
    lines.push("No new agent authority detected against the approved ABOM baseline.");
    lines.push("");
    return lines.join("\n");
  }

  const authority = diff.changes.filter(
    (change) =>
      change.operation !== "removed" &&
      (change.type === "risk_path" || change.type === "capability") &&
      ["critical", "high"].includes(change.severity)
  );
  if (authority.length > 0) {
    lines.push("## New Authority Introduced");
    lines.push("");
    for (const change of authority.slice(0, 8)) {
      lines.push(`- **${formatSeverity(change.severity)}** ${formatMaybeCode(change.subject)} - ${change.title}`);
    }
    lines.push("");
  }

  const surfaces = diff.changes.filter(
    (change) =>
      change.operation === "added" &&
      ["mcp_server", "agent_instruction", "github_workflow", "env_file"].includes(change.type)
  );
  if (surfaces.length > 0) {
    lines.push("## New Surfaces");
    lines.push("");
    for (const change of surfaces.slice(0, 10)) {
      lines.push(`- **${formatSurfaceType(change.type)}:** ${formatMaybeCode(change.subject)}${formatSurfaceDetail(change)}`);
    }
    lines.push("");
  }

  const reviewNeeded = diff.changes.filter(
    (change) => change.operation !== "removed" && ["critical", "high"].includes(change.severity)
  );
  if (reviewNeeded.length > 0) {
    lines.push("## Review Needed");
    lines.push("");
    for (const fix of unique(reviewNeeded.map((change) => change.fix)).slice(0, 6)) {
      lines.push(`- ${fix}`);
    }
    lines.push("");
  }

  const riskPaths = diff.changes.filter((change) => change.type === "risk_path");
  if (riskPaths.length > 0) {
    lines.push("## Authority Paths");
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

  const addedInstructions = diff.changes.filter((change) => change.type === "agent_instruction" && change.operation === "added");
  if (addedInstructions.length > 0) {
    lines.push("## New Agent Instructions");
    lines.push("");
    lines.push("| Severity | Instruction | Capabilities | Risk signals |");
    lines.push("| --- | --- | --- | --- |");

    for (const change of addedInstructions) {
      lines.push(
        `| ${escapeCell(change.severity)} | ${escapeCell(change.subject)} | ` +
          `${escapeCell((change.capabilities || []).join(", ") || "none")} | ` +
          `${escapeCell((change.risk_signals || []).join(", ") || "none")} |`
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

function formatRisk(severity) {
  return severity ? formatSeverity(severity) : "No new authority";
}

function formatSeverity(severity) {
  return String(severity || "none").replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatChangeSummary(summary) {
  return (
    `${summary.total_changes} ` +
    `(critical ${summary.by_severity.critical}, high ${summary.by_severity.high}, ` +
    `medium ${summary.by_severity.medium}, low ${summary.by_severity.low})`
  );
}

function formatSurfaceType(type) {
  return String(type).replaceAll("_", " ");
}

function formatSurfaceDetail(change) {
  if (change.capabilities?.length > 0) {
    return ` (${change.capabilities.join(", ")})`;
  }

  if (change.risk_signals?.length > 0) {
    return ` (${change.risk_signals.join(", ")})`;
  }

  if (Number.isInteger(change.secret_like_key_count) && change.secret_like_key_count > 0) {
    return ` (${change.secret_like_key_count} secret-like keys)`;
  }

  return "";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatMaybeCode(value) {
  return value === "unknown target" ? value : `\`${value}\``;
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|");
}
