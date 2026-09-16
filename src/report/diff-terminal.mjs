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

export function printDiffReport(diff) {
  console.log(bold("agentsec ABOM diff"));
  console.log(`${dim("Baseline:")} ${diff.baseline.target || "unknown target"}`);
  console.log(`${dim("Current:")} ${diff.current.target || "unknown target"}`);
  console.log(
    `${dim("Changes:")} ${diff.summary.total_changes} ` +
      `(critical ${diff.summary.by_severity.critical}, high ${diff.summary.by_severity.high}, ` +
      `medium ${diff.summary.by_severity.medium}, low ${diff.summary.by_severity.low})`
  );

  if (diff.summary.total_changes === 0) {
    console.log("");
    console.log(`${COLORS.green}No ABOM changes detected.${COLORS.reset}`);
    return;
  }

  console.log("");
  console.log(bold("Changes"));

  for (const change of diff.changes) {
    console.log("");
    console.log(`${severity(change.severity)} ${bold(change.title)}`);
    console.log(`${dim("Type:")} ${change.type} (${change.operation})`);
    console.log(`${dim("Subject:")} ${change.subject}`);

    if (change.capabilities?.length > 0) {
      console.log(`${dim("Capabilities:")} ${change.capabilities.join(", ")}`);
    }

    if (change.risk_signals?.length > 0) {
      console.log(`${dim("Risk signals:")} ${change.risk_signals.join(", ")}`);
    }

    if (typeof change.secret_like_key_count === "number") {
      console.log(`${dim("Secret-like env keys:")} ${change.secret_like_key_count}`);
    }

    console.log(`${dim("Why:")} ${change.why}`);
    console.log(`${dim("Fix:")} ${change.fix}`);
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
