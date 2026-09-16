#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { diffAboms, shouldFailDiff } from "./diff.mjs";
import { discoverTargets } from "./discovery.mjs";
import { addApproval, DEFAULT_POLICY_PATH, initPolicyFile, listApprovals } from "./policy-file.mjs";
import { buildApprovalSuggestions } from "./policy-suggestions.mjs";
import { evaluatePolicy, isFindingApprovedByPolicy, shouldFailPolicy, validatePolicy } from "./policy.mjs";
import { scanTarget, scanTargets } from "./scanner.mjs";
import { buildAbomExport, buildRedactedAbomExport } from "./report/abom.mjs";
import { buildMarkdownReport } from "./report/markdown.mjs";
import { buildRedactedMarkdownReport } from "./report/redacted-markdown.mjs";
import { buildResearchExport } from "./report/research.mjs";
import { buildSarifReport } from "./report/sarif.mjs";
import { buildDiffMarkdownReport } from "./report/diff-markdown.mjs";
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
  console.log(`loam

Usage:
  loam discover [path] [--json]
  loam doctor [path] [--json]
  loam scan-pack <path> [--out <dir>] [--label <text>]
  loam scan-known [path] [--json] [--markdown <file>] [--redacted-markdown <file>] [--abom <file>] [--redacted-abom <file>] [--research <file>] [--policy <file>] [--approval-suggestions] [--fail-on <severity>]
  loam scan <path> [--json] [--markdown <file>] [--redacted-markdown <file>] [--abom <file>] [--redacted-abom <file>] [--sarif <file>] [--research <file>] [--policy <file>] [--approval-suggestions] [--fail-on <severity>]
  loam diff --baseline <file> --current <file> [--json] [--markdown <file>] [--fail-on <severity>]
  loam init-policy [--policy <file>] [--force]
  loam approve <capability|mcp_server|risk_path> <subject> --reason <text> --approved-by <name> --expires <date> [--policy <file>]
  loam list-approvals [--policy <file>] [--json]
  loam suggest-approvals <path> --policy <file> [--json] [--approved-by <name>] [--expires <date>]

Examples:
  loam discover .
  loam doctor .
  loam scan-pack . --label "cursor-user-001"
  loam scan-known .
  loam scan .
  loam scan ./fixtures/browser-shell-risk --json
  loam scan . --markdown loam-report.md
  loam scan . --redacted-markdown public-report.md
  loam scan . --abom loam-abom.json
  loam scan . --redacted-abom loam-redacted-abom.json
  loam scan . --sarif loam.sarif
  loam scan . --research loam-research.json
  loam scan . --policy .loam/policy.json
  loam scan . --fail-on critical
  loam diff --baseline main-abom.json --current loam-abom.json --fail-on high
  loam init-policy
  loam approve capability shell_exec --reason "Local dev agent only" --approved-by noor --expires 2026-12-31
  loam list-approvals
  loam suggest-approvals . --policy .loam/policy.json
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();

  if (!command || command === "--help" || command === "-h") {
    return { help: true };
  }

  if (command === "init-policy") {
    const options = {
      policy: DEFAULT_POLICY_PATH,
      force: false
    };

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];

      if (arg === "--policy") {
        const policyPath = args[i + 1];
        if (!policyPath || policyPath.startsWith("-")) {
          return { error: "--policy requires a JSON policy file path." };
        }
        options.policy = policyPath;
        i += 1;
        continue;
      }

      if (arg === "--force") {
        options.force = true;
        continue;
      }

      return { error: `Unknown option: ${arg}` };
    }

    return { command, options };
  }

  if (command === "approve") {
    const type = args.shift();
    if (!["capability", "mcp_server", "risk_path"].includes(type)) {
      return { error: "approve type must be one of: capability, mcp_server, risk_path." };
    }

    const subjectParts = [];
    while (args.length > 0 && !args[0].startsWith("-")) {
      subjectParts.push(args.shift());
    }

    const subject = subjectParts.join(" ").trim();
    if (!subject) {
      return { error: "approve requires a subject." };
    }

    const options = {
      policy: DEFAULT_POLICY_PATH,
      reason: null,
      approvedBy: null,
      expires: null
    };

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];

      if (arg === "--policy") {
        const policyPath = args[i + 1];
        if (!policyPath || policyPath.startsWith("-")) {
          return { error: "--policy requires a JSON policy file path." };
        }
        options.policy = policyPath;
        i += 1;
        continue;
      }

      if (arg === "--reason") {
        const reason = args[i + 1];
        if (!reason || reason.startsWith("-")) {
          return { error: "--reason requires text." };
        }
        options.reason = reason;
        i += 1;
        continue;
      }

      if (arg === "--approved-by") {
        const approvedBy = args[i + 1];
        if (!approvedBy || approvedBy.startsWith("-")) {
          return { error: "--approved-by requires a name." };
        }
        options.approvedBy = approvedBy;
        i += 1;
        continue;
      }

      if (arg === "--expires") {
        const expires = args[i + 1];
        if (!expires || expires.startsWith("-")) {
          return { error: "--expires requires a date." };
        }
        if (Number.isNaN(Date.parse(expires))) {
          return { error: "--expires must be a valid date." };
        }
        options.expires = expires;
        i += 1;
        continue;
      }

      return { error: `Unknown option: ${arg}` };
    }

    if (!options.reason) {
      return { error: "approve requires --reason." };
    }

    if (!options.approvedBy) {
      return { error: "approve requires --approved-by." };
    }

    if (!options.expires) {
      return { error: "approve requires --expires." };
    }

    return { command, type, subject, options };
  }

  if (command === "list-approvals") {
    const options = {
      policy: DEFAULT_POLICY_PATH,
      json: false
    };

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];

      if (arg === "--policy") {
        const policyPath = args[i + 1];
        if (!policyPath || policyPath.startsWith("-")) {
          return { error: "--policy requires a JSON policy file path." };
        }
        options.policy = policyPath;
        i += 1;
        continue;
      }

      if (arg === "--json") {
        options.json = true;
        continue;
      }

      return { error: `Unknown option: ${arg}` };
    }

    return { command, options };
  }

  if (command === "suggest-approvals") {
    const target = args.shift();
    if (!target || target.startsWith("-")) {
      return { error: "Missing suggest-approvals path." };
    }

    const options = {
      policy: null,
      json: false,
      approvedBy: "$USER",
      expires: null
    };

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];

      if (arg === "--policy") {
        const policyPath = args[i + 1];
        if (!policyPath || policyPath.startsWith("-")) {
          return { error: "--policy requires a JSON policy file path." };
        }
        options.policy = policyPath;
        i += 1;
        continue;
      }

      if (arg === "--json") {
        options.json = true;
        continue;
      }

      if (arg === "--approved-by") {
        const approvedBy = args[i + 1];
        if (!approvedBy || approvedBy.startsWith("-")) {
          return { error: "--approved-by requires a name." };
        }
        options.approvedBy = approvedBy;
        i += 1;
        continue;
      }

      if (arg === "--expires") {
        const expires = args[i + 1];
        if (!expires || expires.startsWith("-")) {
          return { error: "--expires requires a date." };
        }
        if (Number.isNaN(Date.parse(expires))) {
          return { error: "--expires must be a valid date." };
        }
        options.expires = expires;
        i += 1;
        continue;
      }

      return { error: `Unknown option: ${arg}` };
    }

    if (!options.policy) {
      return { error: "suggest-approvals requires --policy." };
    }

    return { command, target, options };
  }

  if (command === "diff") {
    const options = {
      baseline: null,
      current: null,
      json: false,
      markdown: null,
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

      if (arg === "--markdown") {
        const markdownPath = args[i + 1];
        if (!markdownPath || markdownPath.startsWith("-")) {
          return { error: "--markdown requires an output file path." };
        }
        options.markdown = markdownPath;
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

    if (!options.baseline) {
      return { error: "Missing --baseline ABOM file." };
    }

    if (!options.current) {
      return { error: "Missing --current ABOM file." };
    }

    return { command, options };
  }

  if (command === "scan-pack") {
    const target = args.shift();
    if (!target || target.startsWith("-")) {
      return { error: "Missing scan-pack path." };
    }

    const options = {
      out: "loam-scan",
      label: null
    };

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];

      if (arg === "--out") {
        const outPath = args[i + 1];
        if (!outPath || outPath.startsWith("-")) {
          return { error: "--out requires a directory path." };
        }
        options.out = outPath;
        i += 1;
        continue;
      }

      if (arg === "--label") {
        const label = args[i + 1];
        if (!label || label.startsWith("-")) {
          return { error: "--label requires text." };
        }
        options.label = label;
        i += 1;
        continue;
      }

      return { error: `Unknown option: ${arg}` };
    }

    return { command, target, options };
  }

  if (command === "doctor") {
    const target = args[0] && !args[0].startsWith("-") ? args.shift() : ".";
    const options = {
      json: false
    };

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];

      if (arg === "--json") {
        options.json = true;
        continue;
      }

      return { error: `Unknown option: ${arg}` };
    }

    return { command, target, options };
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
      policy: null,
      approvalSuggestions: false,
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

      if (command === "scan-known" && arg === "--policy") {
        const policyPath = args[i + 1];
        if (!policyPath || policyPath.startsWith("-")) {
          return { error: "--policy requires a JSON policy file path." };
        }
        options.policy = policyPath;
        i += 1;
        continue;
      }

      if (command === "scan-known" && arg === "--approval-suggestions") {
        options.approvalSuggestions = true;
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
    policy: null,
    approvalSuggestions: false,
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

    if (arg === "--policy") {
      const policyPath = args[i + 1];
      if (!policyPath || policyPath.startsWith("-")) {
        return { error: "--policy requires a JSON policy file path." };
      }
      options.policy = policyPath;
      i += 1;
      continue;
    }

    if (arg === "--approval-suggestions") {
      options.approvalSuggestions = true;
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
  if (parsed.command === "init-policy") {
    const result = initPolicyFile({ policyPath: parsed.options.policy, force: parsed.options.force });
    console.log(result.message);
    process.exit(0);
  }

  if (parsed.command === "approve") {
    const result = addApproval({
      policyPath: parsed.options.policy,
      approval: {
        type: parsed.type,
        subject: parsed.subject,
        reason: parsed.options.reason,
        approved_by: parsed.options.approvedBy,
        expires: parsed.options.expires
      }
    });
    console.log(result.message);
    process.exit(0);
  }

  if (parsed.command === "list-approvals") {
    const result = listApprovals({ policyPath: parsed.options.policy });
    if (parsed.options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printApprovals(result);
    }
    process.exit(0);
  }

  if (parsed.command === "suggest-approvals") {
    const result = scanTarget(parsed.target);
    const policy = readJsonFile(parsed.options.policy);
    validatePolicy(policy);
    result.policy = evaluatePolicy(result, policy);
    result.policy.approval_suggestions = buildApprovalSuggestions(result.policy, {
      policyPath: parsed.options.policy,
      approvedBy: parsed.options.approvedBy,
      expires: parsed.options.expires
    });

    if (parsed.options.json) {
      console.log(JSON.stringify(result.policy.approval_suggestions, null, 2));
    } else {
      printApprovalSuggestions(result.policy.approval_suggestions);
    }

    process.exit(0);
  }

  if (parsed.command === "diff") {
    const diff = diffAboms({
      baseline: readJsonFile(parsed.options.baseline),
      current: readJsonFile(parsed.options.current)
    });

    if (parsed.options.markdown) {
      const outputPath = path.resolve(parsed.options.markdown);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, buildDiffMarkdownReport(diff));
    }

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

  if (parsed.command === "doctor") {
    const report = buildDoctorReport(parsed.target);
    if (parsed.options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printDoctorReport(report);
    }

    process.exit(0);
  }

  if (parsed.command === "scan-pack") {
    const result = scanTarget(parsed.target);
    const output = writeScanPack({ result, target: parsed.target, options: parsed.options });

    console.log(`Loam scan pack written to ${output.directory}`);
    console.log(`Private report: ${output.files.privateReport}`);
    console.log(`Redacted report: ${output.files.redactedReport}`);
    console.log(`Research export: ${output.files.research}`);
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

  if (parsed.options.policy) {
    const policy = readJsonFile(parsed.options.policy);
    validatePolicy(policy);
    result.policy = evaluatePolicy(result, policy);
    if (parsed.options.approvalSuggestions) {
      result.policy.approval_suggestions = buildApprovalSuggestions(result.policy, {
        policyPath: parsed.options.policy
      });
    }
  } else if (parsed.options.approvalSuggestions) {
    throw new Error("--approval-suggestions requires --policy.");
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
    const findingsFailed = result.findings.some(
      (finding) =>
        SEVERITY_RANK[finding.severity] >= threshold &&
        !isFindingApprovedByPolicy(finding, result.policy)
    );
    const policyFailed = result.policy ? shouldFailPolicy(result.policy, parsed.options.failOn) : false;
    if (findingsFailed || policyFailed) {
      process.exit(1);
    }
  }

  if (result.policy?.fail_on && shouldFailPolicy(result.policy, result.policy.fail_on)) {
    process.exit(1);
  }
} catch (error) {
  console.error(`loam failed: ${error.message}`);
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

function buildDoctorReport(target) {
  const root = path.resolve(target);
  const discovered = discoverTargets({ root });
  const projectDiscovered = discovered.filter((item) => path.resolve(item.scan_hint) === root);
  const extraSurfaces = discoverProjectSurfaces(root);
  const found = [
    ...projectDiscovered.filter((item) => item.exists).map(surfaceFromDiscovery),
    ...extraSurfaces.filter((item) => item.exists)
  ].sort((a, b) => a.label.localeCompare(b.label));
  const missing = [
    ...projectDiscovered.filter((item) => !item.exists).map(surfaceFromDiscovery),
    ...extraSurfaces.filter((item) => !item.exists)
  ].sort((a, b) => a.label.localeCompare(b.label));
  const ready = found.length > 0;

  return {
    tool: "loam",
    target: root,
    status: ready ? "ready_for_scan_pack" : "low_signal",
    found,
    missing,
    global_found: [],
    recommended_command: `node ./src/cli.mjs scan-pack ${shellQuote(root)} --label "design-partner-001"`,
    notes: ready
      ? [
          "Loam found project-level agent surfaces it can scan.",
          "Doctor stays scoped to this project; use discover for broader config inventory.",
          "Run scan-pack to create private and redacted outputs."
        ]
      : [
          "Loam did not find known project-level agent surfaces.",
          "Doctor stays scoped to this project; use discover for broader config inventory.",
          "You can still run scan-pack, but the output may be low signal."
        ]
  };
}

function discoverProjectSurfaces(root) {
  return [
    {
      type: "package_json",
      label: "package.json scripts",
      path: path.join(root, "package.json"),
      exists: isFile(path.join(root, "package.json"))
    },
    {
      type: "github_workflows",
      label: "GitHub workflows",
      path: path.join(root, ".github", "workflows"),
      exists: isDirectory(path.join(root, ".github", "workflows"))
    },
    {
      type: "env_file",
      label: "env files",
      path: root,
      exists: [".env", ".env.local", ".env.example", ".env.sample"].some((name) => isFile(path.join(root, name)))
    }
  ];
}

function surfaceFromDiscovery(item) {
  return {
    type: item.type,
    label: item.label,
    path: item.path,
    scan_hint: item.scan_hint
  };
}

function printDoctorReport(report) {
  console.log("Loam Doctor");
  console.log("");
  console.log(`Target: ${report.target}`);
  console.log(`Status: ${report.status}`);
  console.log("");
  printSurfaceSection("Found", report.found);
  printSurfaceSection("Not found", report.missing);

  if (report.global_found.length > 0) {
    printSurfaceSection("Global configs also present", report.global_found);
  }

  console.log("Recommended next step:");
  console.log(report.recommended_command);
  console.log("");
  console.log("Notes:");
  for (const note of report.notes) {
    console.log(`- ${note}`);
  }
}

function printSurfaceSection(title, surfaces) {
  console.log(`${title}:`);
  if (surfaces.length === 0) {
    console.log("- none");
  } else {
    for (const surface of surfaces) {
      console.log(`- ${surface.label}`);
    }
  }
  console.log("");
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function writeScanPack({ result, target, options }) {
  const directory = path.resolve(options.out);
  fs.mkdirSync(directory, { recursive: true });

  const files = {
    privateReport: path.join(directory, "private-report.md"),
    redactedReport: path.join(directory, "redacted-report.md"),
    privateAbom: path.join(directory, "private-abom.json"),
    redactedAbom: path.join(directory, "redacted-abom.json"),
    research: path.join(directory, "research.json"),
    summary: path.join(directory, "summary.txt")
  };

  fs.writeFileSync(files.privateReport, buildMarkdownReport(result));
  fs.writeFileSync(files.redactedReport, buildRedactedMarkdownReport(result));
  fs.writeFileSync(files.privateAbom, JSON.stringify(buildAbomExport(result), null, 2));
  fs.writeFileSync(files.redactedAbom, JSON.stringify(buildRedactedAbomExport(result), null, 2));
  fs.writeFileSync(files.research, JSON.stringify(buildResearchExport(result), null, 2));
  fs.writeFileSync(files.summary, buildScanPackSummary({ result, target, label: options.label, files }));

  return {
    directory,
    files
  };
}

function buildScanPackSummary({ result, target, label, files }) {
  return [
    "Loam Scan Pack",
    "",
    `Target label: ${label || "not provided"}`,
    `Target path: ${path.resolve(target)}`,
    `Risk score: ${result.summary.risk_score}/100`,
    `Findings: ${result.summary.total_findings}`,
    `Critical: ${result.summary.by_severity.critical}`,
    `High: ${result.summary.by_severity.high}`,
    `Medium: ${result.summary.by_severity.medium}`,
    `Low: ${result.summary.by_severity.low}`,
    "",
    "Files",
    "- private-report.md: keep private; includes exact paths and evidence",
    "- redacted-report.md: shareable after review",
    "- private-abom.json: keep private; full agent inventory",
    "- redacted-abom.json: shareable aggregate inventory",
    "- research.json: redacted aggregate export for research",
    "",
    "Suggested sharing flow",
    "1. Review private-report.md locally.",
    "2. Share redacted-report.md only if you are comfortable with the anonymized findings.",
    "3. Share research.json only if you explicitly approve aggregate research use.",
    "",
    `Generated files are in: ${path.dirname(files.summary)}`,
    ""
  ].join("\n");
}

function printApprovals(result) {
  console.log(`Policy: ${result.path}`);
  console.log(`Active approvals: ${result.active.length}`);

  for (const approval of result.active) {
    console.log(formatApproval(approval));
  }

  console.log(`Expired approvals: ${result.expired.length}`);
  for (const approval of result.expired) {
    console.log(formatApproval(approval));
  }
}

function formatApproval(approval) {
  const metadata = [
    approval.approved_by ? `by ${approval.approved_by}` : null,
    approval.expires ? `until ${approval.expires}` : null,
    approval.reason ? `for ${approval.reason}` : null
  ]
    .filter(Boolean)
    .join(", ");

  return `- ${approval.type}: ${approval.subject}${metadata ? ` (${metadata})` : ""}`;
}

function printApprovalSuggestions(suggestions) {
  if (suggestions.length === 0) {
    console.log("No approval suggestions.");
    return;
  }

  console.log("Approval suggestions:");
  console.log("");
  for (const suggestion of suggestions) {
    console.log(`# ${suggestion.severity} ${suggestion.type}: ${suggestion.subject}`);
    console.log(suggestion.command);
    console.log("");
  }
}
