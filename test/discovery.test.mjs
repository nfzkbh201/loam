import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { discoverTargets } from "../src/discovery.mjs";

test("discovers project MCP configs by existence", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentsec-discovery-"));
  fs.writeFileSync(path.join(tmp, ".mcp.json"), "{}");

  const results = discoverTargets({
    root: tmp,
    home: path.join(tmp, "home"),
    platform: "darwin"
  });

  const projectConfig = results.find((result) => result.label === "Project config (.mcp.json)");
  assert.ok(projectConfig);
  assert.equal(projectConfig.exists, true);
  assert.equal(projectConfig.scan_hint, tmp);
});

test("discovers Claude Desktop config candidates without reading contents", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentsec-discovery-"));
  const home = path.join(tmp, "home");
  const claudeDir = path.join(home, "Library", "Application Support", "Claude");
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, "claude_desktop_config.json"), "{\"secret\":\"not-read\"}");

  const results = discoverTargets({
    root: tmp,
    home,
    platform: "darwin"
  });

  const claude = results.find((result) => result.type === "claude_desktop_config");
  assert.ok(claude);
  assert.equal(claude.exists, true);
  assert.equal(Object.prototype.hasOwnProperty.call(claude, "contents"), false);
});
