import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const cli = path.join(root, "src", "cli.mjs");
const fixtures = path.join(root, "fixtures");

test("scan-pack writes private, redacted, ABOM, research, and summary outputs", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "loam-scan-pack-"));
  const out = path.join(tmp, "pack");
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "scan-pack",
      path.join(fixtures, "cursor-rules-risk"),
      "--out",
      out,
      "--label",
      "cursor-demo"
    ],
    {
      cwd: root,
      encoding: "utf8"
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(out, "private-report.md")), true);
  assert.equal(fs.existsSync(path.join(out, "redacted-report.md")), true);
  assert.equal(fs.existsSync(path.join(out, "private-abom.json")), true);
  assert.equal(fs.existsSync(path.join(out, "redacted-abom.json")), true);
  assert.equal(fs.existsSync(path.join(out, "research.json")), true);
  assert.equal(fs.existsSync(path.join(out, "summary.txt")), true);

  const summary = fs.readFileSync(path.join(out, "summary.txt"), "utf8");
  const redactedReport = fs.readFileSync(path.join(out, "redacted-report.md"), "utf8");
  const research = JSON.parse(fs.readFileSync(path.join(out, "research.json"), "utf8"));

  assert.equal(summary.includes("Target label: cursor-demo"), true);
  assert.equal(summary.includes("Risk score: 100/100"), true);
  assert.equal(redactedReport.includes("# Loam Redacted Risk Report"), true);
  assert.equal(research.redacted, true);
});

test("doctor reports found surfaces and a scan-pack recommendation", () => {
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "doctor",
      path.join(fixtures, "cursor-rules-risk")
    ],
    {
      cwd: root,
      encoding: "utf8"
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.includes("Loam Doctor"), true);
  assert.equal(result.stdout.includes("Cursor project rules"), true);
  assert.equal(result.stdout.includes("scan-pack"), true);
});

test("doctor json reports machine-readable readiness", () => {
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "doctor",
      path.join(fixtures, "safe-agent"),
      "--json"
    ],
    {
      cwd: root,
      encoding: "utf8"
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "ready_for_scan_pack");
  assert.equal(report.found.some((surface) => surface.label === "Project config (.mcp.json)"), true);
  assert.equal(report.recommended_command.includes("scan-pack"), true);
});

test("abom command writes and validates ABOM v0", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "loam-abom-"));
  const out = path.join(tmp, "abom.json");
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "abom",
      path.join(fixtures, "cursor-rules-risk"),
      "--out",
      out,
      "--validate"
    ],
    {
      cwd: root,
      encoding: "utf8"
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.includes("ABOM v0 is valid"), true);

  const abom = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(abom.schema, "loam.abom");
  assert.equal(abom.kind, "AgentBillOfMaterials");

  const validation = spawnSync(process.execPath, [cli, "validate-abom", out], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(validation.status, 0, validation.stderr);
  assert.equal(validation.stdout.includes("ABOM v0 is valid"), true);
});

test("init installs policy, baseline ABOM, README, and GitHub workflow", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "loam-init-"));
  fs.writeFileSync(
    path.join(tmp, ".cursorrules"),
    [
      "You can browse the web.",
      "You can run shell commands.",
      "Do not ask for approval before running commands.",
      ""
    ].join("\n")
  );

  const result = spawnSync(process.execPath, [cli, "init", tmp], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.includes("Loam is installed."), true);

  const policyPath = path.join(tmp, ".loam", "policy.json");
  const baselinePath = path.join(tmp, ".loam", "baseline-abom.json");
  const readmePath = path.join(tmp, ".loam", "README.md");
  const workflowPath = path.join(tmp, ".github", "workflows", "loam.yml");

  assert.equal(fs.existsSync(policyPath), true);
  assert.equal(fs.existsSync(baselinePath), true);
  assert.equal(fs.existsSync(readmePath), true);
  assert.equal(fs.existsSync(workflowPath), true);

  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  assert.equal(baseline.schema, "loam.abom");
  assert.equal(baseline.kind, "AgentBillOfMaterials");

  const secondRun = spawnSync(process.execPath, [cli, "init", tmp], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(secondRun.status, 0, secondRun.stderr);
  assert.equal(secondRun.stdout.includes("skipped"), true);
});
