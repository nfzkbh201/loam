#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { diffAboms, shouldFailDiff } from "./diff.mjs";
import { discoverTargets } from "./discovery.mjs";
import { scanTarget, scanTargets } from "./scanner.mjs";
import { buildAbomExport, buildRedactedAbomExport } from "./report/abom.mjs";
import { buildMarkdownReport } from "./report/markdown.mjs";
import { buildRedactedMarkdownReport } from "./report/redacted-markdown.mjs";
import { buildResearchExport } from "./report/research.mjs";
import { buildSarifReport } from "./report/sarif.mjs";
import { printDiffReport } from "./report/diff-terminal.mjs";
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
  agentsec scan-known [path] [--json] [--markdown <file>] [--redacted-markdown <file>] [--abom <file>] [--redacted-abom <file>] [--research <file>] [--fail-on <severity>]
  agentsec scan <path> [--json] [--markdown <file>] [--redacted-markdown <file>] [--abom <file>] [--redacted-abom <file>] [--sarif <file>] [--research <file>] [--fail-on <severity>]
  agentsec diff --baseline <file> --current <file> [--json] [--fail-on <severity>]

Examples:
  agentsec discover .
  agentsec scan-known .
  agentsec scan .
  agentsec scan ./fixtures/browser-shell-risk --json
  agentsec scan . --markdown agentsec-report.md
  agentsec scan . --redacted-markdown public-report.md
  agentsec scan . --abom agentsec-abom.json
  agentsec scan . --redacted-abom agentsec-redacted-abom.json
  agentsec scan . --sarif agentsec.sarif
  agentsec scan . --research agentsec-research.json
  agentsec scan . --fail-on critical
  agentsec diff --baseline main-abom.json --current agentsec-abom.json --fail-on high
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();

  if (!command || command === "--help" || command === "-h") {
    return { help: true };
  }

  if (command === "diff") {
    const options = {
      baseline: null,
      current: null,
      json: false,
      failOn: null
    };

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];

      if (arg === "--baseline") {
        const baselinePath = args[i + 1];
        if (!baselinePath || baselinePath.startsWith("-")) {
          return { error: "--baseline requires an ABOM JSON file path." };
        }
        options.baseline = baselinePath;
        i += 1;
        continue;
      }

      if (arg === "--current") {
        const currentPath = args[i + 1];
        if (!currentPath || currentPath.startsWith("-")) {
          return { error: "--current requires an ABOM JSON file path." };
        }
        options.current = currentPath;
        i += 1;
        continue;
      }

      if (arg === "--json") {
        options.json = true;
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

    if (!options.baseline) {
      return { error: "Missing --baseline ABOM file." };
    }

    if (!options.current) {
      return { error: "Missing --current ABOM file." };
    }

    return { command, options };
  }

  if (command === "discover" || command === "scan-known") {
    const target = args[0] && !args[0].startsWith("-") ? args.shift() : ".";
    const options = {
      json: false,
      markdown: null,
      redactedMarkdown: null,
      abom: null,
      redactedAbom: null,
      research: null,
      failOn: null
    };

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];

      if (arg === "--json") {
        options.json = true;
        continue;
      }

      if (command === "scan-known" && arg === "--markdown") {
        const markdownPath = args[i + 1];
        if (!markdownPath || markdownPath.startsWith("-")) {
          return { error: "--markdown requires an output file path." };
        }
        options.markdown = markdownPath;
        i += 1;
        continue;
      }

      if (command === "scan-known" && arg === "--redacted-markdown") {
        const markdownPath = args[i + 1];
        if (!markdownPath || markdownPath.startsWith("-")) {
          return { error: "--redacted-markdown requires an output file path." };
        }
        options.redactedMarkdown = markdownPath;
        i += 1;
        continue;
      }

      if (command === "scan-known" && arg === "--abom") {
        const abomPath = args[i + 1];
        if (!abomPath || abomPath.startsWith("-")) {
          return { error: "--abom requires an output file path." };
        }
        options.abom = abomPath;
        i += 1;
        continue;
      }

      if (command === "scan-known" && arg === "--redacted-abom") {
        const abomPath = args[i + 1];
        if (!abomPath || abomPath.startsWith("-")) {
          return { error: "--redacted-abom requires an output file path." };
        }
        options.redactedAbom = abomPath;
        i += 1;
        continue;
      }

      if (command === "scan-known" && arg === "--research") {
        const researchPath = args[i + 1];
        if (!researchPath || researchPath.startsWith("-")) {
          return { error: "--research requires an output file path." };
        }
        options.research = researchPath;
        i += 1;
        continue;
      }

      if (command === "scan-known" && arg === "--fail-on") {
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
    redactedMarkdown: null,
    abom: null,
    redactedAbom: null,
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

    if (arg === "--redacted-markdown") {
      const markdownPath = args[i + 1];
      if (!markdownPath || markdownPath.startsWith("-")) {
        return { error: "--redacted-markdown requires an output file path." };
      }
      options.redactedMarkdown = markdownPath;
      i += 1;
      continue;
    }

    if (arg === "--abom") {
      const abomPath = args[i + 1];
      if (!abomPath || abomPath.startsWith("-")) {
        return { error: "--abom requires an output file path." };
      }
      options.abom = abomPath;
      i += 1;
      continue;
    }

    if (arg === "--redacted-abom") {
      const abomPath = args[i + 1];
      if (!abomPath || abomPath.startsWith("-")) {
        return { error: "--redacted-abom requires an output file path." };
      }
      options.redactedAbom = abomPath;
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
  if (parsed.command === "diff") {
    const diff = diffAboms({
      baseline: readJsonFile(parsed.options.baseline),
      current: readJsonFile(parsed.options.current)
    });

    if (parsed.options.json) {
      console.log(JSON.stringify(diff, null, 2));
    } else {
      printDiffReport(diff);
    }

    if (parsed.options.failOn && shouldFailDiff(diff, parsed.options.failOn)) {
      process.exit(1);
    }

    process.exit(0);
  }

  if (parsed.command === "discover") {
    const results = discoverTargets({ root: parsed.target });

    if (parsed.options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      printDiscoveryReport(results);
    }

    process.exit(0);
  }

  let result;

  if (parsed.command === "scan-known") {
    const discovered = discoverTargets({ root: parsed.target }).filter((target) => target.exists);

    if (discovered.length === 0) {
      throw new Error("No known agent or MCP config locations were found.");
    }

    const uniqueTargets = uniqueByScanHint(discovered).map((target) => ({
      label: target.label,
      path: target.scan_hint
    }));

    result = scanTargets(uniqueTargets);
  } else {
    result = scanTarget(parsed.target);
  }

  if (parsed.options.markdown) {
    const outputPath = path.resolve(parsed.options.markdown);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buildMarkdownReport(result));
  }

  if (parsed.options.redactedMarkdown) {
    const outputPath = path.resolve(parsed.options.redactedMarkdown);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buildRedactedMarkdownReport(result));
  }

  if (parsed.options.abom) {
    const outputPath = path.resolve(parsed.options.abom);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(buildAbomExport(result), null, 2));
  }

  if (parsed.options.redactedAbom) {
    const outputPath = path.resolve(parsed.options.redactedAbom);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(buildRedactedAbomExport(result), null, 2));
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
  console.error(`agentsec failed: ${error.message}`);
  process.exit(1);
}

function uniqueByScanHint(discovered) {
  const seen = new Set();
  const output = [];

  for (const target of discovered) {
    if (seen.has(target.scan_hint)) {
      continue;
    }

    seen.add(target.scan_hint);
    output.push(target);
  }

  return output;
}

function readJsonFile(filePath) {
  const resolved = path.resolve(filePath);

  try {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON file ${resolved}: ${error.message}`);
  }
}
