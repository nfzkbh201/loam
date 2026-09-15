import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MCP_CONFIG_NAMES = [
  ".mcp.json",
  "mcp.json",
  "mcp-config.json",
  "mcp_config.json",
  "claude_desktop_config.json"
];

export function discoverTargets({ root = process.cwd(), home = os.homedir(), platform = process.platform } = {}) {
  const candidates = [
    ...projectCandidates(root),
    ...userCandidates(home, platform)
  ];

  return dedupe(candidates).map((candidate) => ({
    ...candidate,
    exists: fs.existsSync(candidate.path)
  }));
}

function projectCandidates(root) {
  const normalizedRoot = path.resolve(root);
  return MCP_CONFIG_NAMES.map((name) => ({
    type: "project_mcp_config",
    label: `Project config (${name})`,
    path: path.join(normalizedRoot, name),
    scan_hint: normalizedRoot
  }));
}

function userCandidates(home, platform) {
  const candidates = [
    {
      type: "claude_desktop_config",
      label: "Claude Desktop config",
      path: path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
      scan_hint: path.join(home, "Library", "Application Support", "Claude")
    },
    {
      type: "cursor_mcp_config",
      label: "Cursor MCP config",
      path: path.join(home, ".cursor", "mcp.json"),
      scan_hint: path.join(home, ".cursor")
    },
    {
      type: "codex_mcp_config",
      label: "Codex MCP config",
      path: path.join(home, ".codex", "mcp.json"),
      scan_hint: path.join(home, ".codex")
    }
  ];

  if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    candidates.push({
      type: "claude_desktop_config",
      label: "Claude Desktop config",
      path: path.join(appData, "Claude", "claude_desktop_config.json"),
      scan_hint: path.join(appData, "Claude")
    });
  }

  if (platform === "linux") {
    candidates.push({
      type: "claude_desktop_config",
      label: "Claude Desktop config",
      path: path.join(home, ".config", "Claude", "claude_desktop_config.json"),
      scan_hint: path.join(home, ".config", "Claude")
    });
  }

  return candidates;
}

function dedupe(candidates) {
  const seen = new Set();
  const output = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.path)) {
      continue;
    }

    seen.add(candidate.path);
    output.push(candidate);
  }

  return output;
}
