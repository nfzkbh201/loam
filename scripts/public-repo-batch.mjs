#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const cli = path.join(root, "src", "cli.mjs");

const DEFAULTS = {
  csv: null,
  limit: 10,
  minScore: 0,
  workdir: path.join(root, "public-repos"),
  out: path.join(root, "research", "public-repo-scan-results.csv"),
  mode: "doctor",
  dryRun: false
};

function usage() {
  console.log(`loam public repo batch

Usage:
  node ./scripts/public-repo-batch.mjs --csv <repo-queue.csv> [--limit 10] [--min-score 85] [--mode doctor|scan-pack] [--workdir <dir>] [--out <file>] [--dry-run]

CSV requirements:
  Export the "Repo queue" sheet from the sourcing workbook as CSV.
  Required columns: URL
  Recommended columns: Priority score, Owner, Project, Status, Notes

Safety:
  This script clones public GitHub repositories and runs Loam static scans.
  It does not install dependencies, execute project scripts, run tests, or call live services.
`);
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }

    if (arg === "--csv") {
      options.csv = requiredValue(argv, i, "--csv");
      i += 1;
      continue;
    }

    if (arg === "--limit") {
      options.limit = parsePositiveInteger(requiredValue(argv, i, "--limit"), "--limit");
      i += 1;
      continue;
    }

    if (arg === "--min-score") {
      options.minScore = Number(requiredValue(argv, i, "--min-score"));
      if (Number.isNaN(options.minScore)) {
        return { error: "--min-score must be a number." };
      }
      i += 1;
      continue;
    }

    if (arg === "--workdir") {
      options.workdir = requiredValue(argv, i, "--workdir");
      i += 1;
      continue;
    }

    if (arg === "--out") {
      options.out = requiredValue(argv, i, "--out");
      i += 1;
      continue;
    }

    if (arg === "--mode") {
      options.mode = requiredValue(argv, i, "--mode");
      if (!["doctor", "scan-pack"].includes(options.mode)) {
        return { error: "--mode must be one of: doctor, scan-pack." };
      }
      i += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    return { error: `Unknown option: ${arg}` };
  }

  if (!options.csv) {
    return { error: "Missing --csv." };
  }

  return { options };
}

function requiredValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return parsed;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    usage();
    return;
  }

  if (parsed.error) {
    console.error(parsed.error);
    usage();
    process.exit(2);
  }

  const rows = readCsv(parsed.options.csv);
  const selected = selectRows(rows, parsed.options);

  if (selected.length === 0) {
    throw new Error("No GitHub rows matched the supplied filters.");
  }

  const results = [];
  for (const row of selected) {
    const result = processRow(row, parsed.options);
    results.push(result);
    console.log(`${result.status}: ${result.url}`);
  }

  if (!parsed.options.dryRun) {
    writeCsv(parsed.options.out, results);
    console.log(`Results written to ${path.resolve(parsed.options.out)}`);
  }
}

function selectRows(rows, options) {
  return rows
    .filter((row) => githubRepoFromUrl(row.URL || row.Url || row.url))
    .filter((row) => Number(row["Priority score"] || 0) >= options.minScore)
    .slice(0, options.limit);
}

function processRow(row, options) {
  const repo = githubRepoFromUrl(row.URL || row.Url || row.url);
  const slug = `${repo.owner}-${repo.name}`.replace(/[^A-Za-z0-9._-]+/g, "-");
  const localPath = path.resolve(options.workdir, slug);
  const base = {
    scan_id: `public-${slug}`,
    date: new Date().toISOString().slice(0, 10),
    priority_score: row["Priority score"] || "",
    owner: row.Owner || repo.owner,
    project: row.Project || repo.name,
    url: repo.url,
    local_path: localPath,
    mode: options.mode,
    status: options.dryRun ? "dry_run" : "started",
    found_surface_count: "",
    found_surfaces: "",
    risk_score: "",
    critical_count: "",
    high_count: "",
    medium_count: "",
    low_count: "",
    top_finding: "",
    notes: row.Notes || ""
  };

  if (options.dryRun) {
    return {
      ...base,
      status: "dry_run",
      notes: "Would clone and scan."
    };
  }

  fs.mkdirSync(options.workdir, { recursive: true });
  if (!fs.existsSync(localPath)) {
    run("git", ["clone", "--depth", "1", repo.url, localPath]);
  }

  const doctor = runJson(process.execPath, [cli, "doctor", localPath, "--json"]);
  const found = doctor.found || [];

  if (options.mode === "doctor" || found.length === 0) {
    return {
      ...base,
      status: found.length > 0 ? "doctor_run" : "low_signal",
      found_surface_count: found.length,
      found_surfaces: found.map((surface) => surface.label).join("; "),
      notes: found.length > 0 ? "Doctor found Loam surfaces. Run scan-pack next." : "No known Loam surfaces found by doctor."
    };
  }

  const scan = runJson(process.execPath, [cli, "scan", localPath, "--json"]);
  const packDir = path.join(root, "research", "public-repo-scan-packs", slug);
  run(process.execPath, [cli, "scan-pack", localPath, "--out", packDir, "--label", slug]);

  return {
    ...base,
    status: "scan_pack_run",
    found_surface_count: found.length,
    found_surfaces: found.map((surface) => surface.label).join("; "),
    risk_score: scan.summary?.risk_score ?? "",
    critical_count: scan.summary?.by_severity?.critical ?? "",
    high_count: scan.summary?.by_severity?.high ?? "",
    medium_count: scan.summary?.by_severity?.medium ?? "",
    low_count: scan.summary?.by_severity?.low ?? "",
    top_finding: scan.findings?.[0]?.title || "",
    notes: `Scan pack: ${packDir}`
  };
}

function githubRepoFromUrl(value) {
  if (!value) {
    return null;
  }

  const match = String(value).match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:[/?#].*)?$/);
  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    name: match[2].replace(/\.git$/, ""),
    url: `https://github.com/${match[1]}/${match[2].replace(/\.git$/, "")}.git`
  };
}

function runJson(command, args) {
  const result = run(command, args);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Could not parse JSON from ${command} ${args.join(" ")}: ${error.message}`);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status}\n${result.stdout}\n${result.stderr}`
    );
  }

  return result;
}

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const records = parseCsv(text);
  const [headers, ...rows] = records;

  if (!headers?.length) {
    throw new Error(`CSV has no header row: ${filePath}`);
  }

  return rows
    .filter((row) => row.some((value) => value !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function writeCsv(filePath, rows) {
  const headers = [
    "scan_id",
    "date",
    "priority_score",
    "owner",
    "project",
    "url",
    "local_path",
    "mode",
    "status",
    "found_surface_count",
    "found_surfaces",
    "risk_score",
    "critical_count",
    "high_count",
    "medium_count",
    "low_count",
    "top_finding",
    "notes"
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  }

  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join(os.EOL)}${os.EOL}`);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted && char === "\"" && next === "\"") {
      field += "\"";
      i += 1;
      continue;
    }

    if (char === "\"") {
      quoted = !quoted;
      continue;
    }

    if (!quoted && char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function csvEscape(value) {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

main();
