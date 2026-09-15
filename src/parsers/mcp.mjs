import fs from "node:fs";
import path from "node:path";

const CONFIG_NAMES = new Set([
  ".mcp.json",
  "mcp.json",
  "mcp-config.json",
  "mcp_config.json",
  "claude_desktop_config.json"
]);
const IGNORED_DIRS = new Set(["node_modules", ".git", ".venv", "venv", "__pycache__", "dist", "build"]);

export function parseMcpConfigs(root) {
  const files = findConfigFiles(root);
  const configs = [];

  for (const filePath of files) {
    const raw = safeRead(filePath);
    if (!raw) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      configs.push({
        path: filePath,
        relativePath: path.relative(root, filePath),
        parseError: error.message,
        servers: []
      });
      continue;
    }

    const mcpServers = parsed.mcpServers || parsed.servers || {};
    const servers = Object.entries(mcpServers).map(([name, definition]) =>
      normalizeServer(root, filePath, name, definition || {})
    );

    configs.push({
      path: filePath,
      relativePath: path.relative(root, filePath),
      parseError: null,
      servers
    });
  }

  return configs;
}

function findConfigFiles(root) {
  const results = [];

  function walk(dir, depth) {
    if (depth > 5) {
      return;
    }

    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          walk(fullPath, depth + 1);
        }
        continue;
      }

      if (entry.isFile() && CONFIG_NAMES.has(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(root, 0);
  return results;
}

function normalizeServer(root, configPath, name, definition) {
  const command = String(definition.command || "");
  const args = Array.isArray(definition.args) ? definition.args.map(String) : [];
  const env = definition.env && typeof definition.env === "object" ? definition.env : {};
  const text = [name, command, ...args, ...Object.keys(env), ...Object.values(env)].join(" ").toLowerCase();
  const packageName = inferPackageName(command, args);
  const paths = inferPaths(args, root);
  const capabilities = inferCapabilities({ text, command, args, env, paths });

  return {
    name,
    command,
    args,
    packageName,
    configPath,
    configRelativePath: path.relative(root, configPath),
    envKeys: Object.keys(env),
    paths,
    capabilities
  };
}

function inferPackageName(command, args) {
  if (command.includes("npx") || command.includes("pnpm") || command.includes("yarn") || command.includes("bunx")) {
    return args.find((arg) => !arg.startsWith("-")) || null;
  }

  if (command.includes("node") || command.includes("python") || command.includes("uvx")) {
    return args.find((arg) => arg.includes("mcp") || arg.includes("server")) || command || null;
  }

  return command || null;
}

function inferPaths(args, root) {
  return args
    .filter((arg) => arg.startsWith("/") || arg.startsWith(".") || arg.startsWith("~"))
    .map((arg) => ({
      raw: arg,
      broad: isBroadPath(arg, root)
    }));
}

function inferCapabilities({ text, command, args, env, paths }) {
  const capabilities = new Set();

  if (matches(text, ["browser", "web", "crawl", "fetch", "http", "puppeteer", "playwright"])) {
    capabilities.add("web_access");
  }

  if (matches(text, ["shell", "terminal", "bash", "zsh", "exec", "command-runner"])) {
    capabilities.add("shell_exec");
  }

  const hasFilesystemSignal = matches(text, ["filesystem", "file-system", "fs", "file"]) || paths.length > 0;

  if (hasFilesystemSignal) {
    capabilities.add("filesystem_access");
  }

  if (hasFilesystemSignal && (paths.some((item) => item.broad) || matches(text, ["write", "edit", "delete", "rm "]))) {
    capabilities.add("filesystem_write");
  }

  if (matches(text, ["github", "gitlab", "repo", "pull request", "commit", "workflow"])) {
    capabilities.add("repo_access");
  }

  if (matches(text, ["repo_write", "repo:write", "contents:write", "workflow", "commit", "push"])) {
    capabilities.add("repo_write");
  }

  if (matches(text, ["deploy", "deployment", "vercel", "netlify", "railway", "fly.io", "aws", "gcp", "azure"])) {
    capabilities.add("deploy");
  }

  if (matches(text, ["stripe", "payment", "bank", "wire", "wallet", "x402", "invoice", "refund"])) {
    capabilities.add("payment");
  }

  if (matches(text, ["postgres", "mysql", "mongodb", "database", "db", "snowflake", "bigquery", "customer", "crm"])) {
    capabilities.add("customer_data");
  }

  if (hasSecretLikeEnv(env) || matches(text, ["secret", "token", "api_key", "apikey", "password", "credential"])) {
    capabilities.add("secrets_access");
  }

  if (isUnknownPackage(command, args)) {
    capabilities.add("unknown_publisher");
  }

  return Array.from(capabilities).sort();
}

function hasSecretLikeEnv(env) {
  return Object.keys(env).some((key) => /token|secret|password|api[_-]?key|credential/i.test(key));
}

function isUnknownPackage(command, args) {
  const packageName = inferPackageName(command, args) || "";
  if (!packageName) {
    return false;
  }

  if (packageName.startsWith("@modelcontextprotocol/")) {
    return false;
  }

  if (packageName.includes("github.com/") || packageName.includes("http://") || packageName.includes("https://")) {
    return true;
  }

  return !packageName.startsWith("@") && packageName.includes("mcp");
}

function isBroadPath(rawPath, root) {
  const normalized = rawPath.replace(/^~/, process.env.HOME || "~");
  const resolved = path.resolve(root, normalized);
  const home = process.env.HOME || "";

  return (
    rawPath === "/" ||
    normalized === home ||
    normalized === `${home}/` ||
    resolved === path.parse(resolved).root ||
    rawPath.includes("..")
  );
}

function matches(text, terms) {
  return terms.some((term) => text.includes(term));
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}
