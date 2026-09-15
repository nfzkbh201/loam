#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { scanTarget } from "../src/scanner.mjs";
import { buildMarkdownReport } from "../src/report/markdown.mjs";
import { buildRedactedMarkdownReport } from "../src/report/redacted-markdown.mjs";
import { buildResearchExport } from "../src/report/research.mjs";

function usage() {
  console.log(`Private design-partner scan

Usage:
  node ./scripts/private-scan.mjs <path> [--out <dir>] [--target-label <label>]

Example:
  node ./scripts/private-scan.mjs /path/to/project --out ./scan-output --target-label "design-partner-project"
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const target = args.shift();

  if (!target || target === "--help" || target === "-h") {
    return { help: true };
  }

  const options = {
    outDir: null,
    targetLabel: null
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--out") {
      const value = args[i + 1];
      if (!value || value.startsWith("-")) {
        return { error: "--out requires a directory." };
      }
      options.outDir = value;
      i += 1;
      continue;
    }

    if (arg === "--target-label") {
      const value = args[i + 1];
      if (!value || value.startsWith("-")) {
        return { error: "--target-label requires a label." };
      }
      options.targetLabel = value;
      i += 1;
      continue;
    }

    return { error: `Unknown option: ${arg}` };
  }

  return { target, options };
}

const parsed = parseArgs(process.argv.slice(2));

if (parsed.help) {
  usage();
  process.exit(0);
}

if (parsed.error) {
  console.error(parsed.error);
  usage();
  process.exit(2);
}

try {
  const result = scanTarget(parsed.target);
  const displayResult = parsed.options.targetLabel ? { ...result, target: parsed.options.targetLabel } : result;
  const timestamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const outDir = path.resolve(parsed.options.outDir || path.join(process.cwd(), "agentsec-scan-output", timestamp));

  fs.mkdirSync(outDir, { recursive: true });

  const markdownPath = path.join(outDir, "agentsec-report.md");
  const redactedMarkdownPath = path.join(outDir, "agentsec-redacted-report.md");
  const researchPath = path.join(outDir, "agentsec-research.json");

  fs.writeFileSync(markdownPath, buildMarkdownReport(displayResult));
  fs.writeFileSync(redactedMarkdownPath, buildRedactedMarkdownReport(result));
  fs.writeFileSync(researchPath, JSON.stringify(buildResearchExport(result), null, 2));

  console.log("Private scan complete.");
  console.log(`Markdown report: ${markdownPath}`);
  console.log(`Redacted Markdown report: ${redactedMarkdownPath}`);
  console.log(`Redacted research export: ${researchPath}`);
  console.log("");
  console.log(
    `Findings: ${result.summary.total_findings} ` +
      `(critical ${result.summary.by_severity.critical}, high ${result.summary.by_severity.high}, ` +
      `medium ${result.summary.by_severity.medium}, low ${result.summary.by_severity.low})`
  );
  console.log(`Risk score: ${result.summary.risk_score}/100`);
} catch (error) {
  console.error(`private scan failed: ${error.message}`);
  process.exit(1);
}
