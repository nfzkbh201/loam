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
