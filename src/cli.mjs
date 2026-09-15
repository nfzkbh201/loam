#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { discoverTargets } from "./discovery.mjs";
import { scanTarget } from "./scanner.mjs";
import { buildMarkdownReport } from "./report/markdown.mjs";
import { buildResearchExport } from "./report/research.mjs";
import { buildSarifReport } from "./report/sarif.mjs";
import { printDiscoveryReport } from "./report/discovery-terminal.mjs";
import { printTerminalReport } from "./report/terminal.mjs";

const SEVERITY_RANK = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

function usage() {
  console.log(`agentsec

Usage:
  agentsec discover [path] [--json]
  agentsec scan <path> [--json] [--markdown <file>] [--sarif <file>] [--research <file>] [--fail-on <severity>]

Examples:
  agentsec discover .
  agentsec scan .
  agentsec scan ./fixtures/browser-shell-risk --json
  agentsec scan . --markdown agentsec-report.md
  agentsec scan . --sarif agentsec.sarif
  agentsec scan . --research agentsec-research.json
  agentsec scan . --fail-on critical
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();

  if (!command || command === "--help" || command === "-h") {
    return { help: true };
  }

  if (command === "discover") {
    const target = args[0] && !args[0].startsWith("-") ? args.shift() : ".";
    const options = {
      json: false
    };

    for (const arg of args) {
      if (arg === "--json") {
        options.json = true;
        continue;
      }

      return { error: `Unknown option: ${arg}` };
    }

    return { command, target, options };
  }

  if (command !== "scan") {
    return { error: `Unknown command: ${command}` };
  }

  const target = args.shift();
  if (!target || target.startsWith("-")) {
    return { error: "Missing scan path." };
  }

  const options = {
    json: false,
    markdown: null,
    sarif: null,
    research: null,
    failOn: null
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--markdown") {
      const markdownPath = args[i + 1];
      if (!markdownPath || markdownPath.startsWith("-")) {
        return { error: "--markdown requires an output file path." };
      }
      options.markdown = markdownPath;
      i += 1;
      continue;
    }

    if (arg === "--sarif") {
      const sarifPath = args[i + 1];
      if (!sarifPath || sarifPath.startsWith("-")) {
        return { error: "--sarif requires an output file path." };
      }
      options.sarif = sarifPath;
      i += 1;
      continue;
    }

    if (arg === "--research") {
      const researchPath = args[i + 1];
      if (!researchPath || researchPath.startsWith("-")) {
        return { error: "--research requires an output file path." };
      }
      options.research = researchPath;
      i += 1;
      continue;
    }

    if (arg === "--fail-on") {
      const severity = args[i + 1];
      if (!SEVERITY_RANK[severity]) {
        return { error: "--fail-on must be one of: low, medium, high, critical." };
      }
      options.failOn = severity;
      i += 1;
      continue;
    }

    return { error: `Unknown option: ${arg}` };
  }

  return { command, target, options };
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
  if (parsed.command === "discover") {
    const results = discoverTargets({ root: parsed.target });

    if (parsed.options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      printDiscoveryReport(results);
    }

    process.exit(0);
  }

  const result = scanTarget(parsed.target);

  if (parsed.options.markdown) {
    const outputPath = path.resolve(parsed.options.markdown);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buildMarkdownReport(result));
  }

  if (parsed.options.sarif) {
    const outputPath = path.resolve(parsed.options.sarif);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(buildSarifReport(result), null, 2));
  }

  if (parsed.options.research) {
    const outputPath = path.resolve(parsed.options.research);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(buildResearchExport(result), null, 2));
  }

  if (parsed.options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printTerminalReport(result);
  }

  if (parsed.options.failOn) {
    const threshold = SEVERITY_RANK[parsed.options.failOn];
    const failed = result.findings.some((finding) => SEVERITY_RANK[finding.severity] >= threshold);
    if (failed) {
      process.exit(1);
    }
  }
} catch (error) {
  console.error(`agentsec scan failed: ${error.message}`);
  process.exit(1);
}
