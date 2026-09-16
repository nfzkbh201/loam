import fs from "node:fs";
import path from "node:path";

const ROOT_INSTRUCTION_FILES = new Set(["CLAUDE.md", "AGENTS.md", ".cursorrules"]);
const CURSOR_RULE_EXTENSIONS = new Set([".md", ".mdc", ".txt"]);

export function parseAgentInstructions(root) {
  const files = findInstructionFiles(root);

  return files.map((filePath) => {
    const text = safeRead(filePath);
    const signals = inferInstructionSignals(text);

    return {
      file: filePath,
      relativePath: path.relative(root, filePath),
      capabilities: signals.capabilities,
      risk_signals: signals.riskSignals
    };
  });
}

function findInstructionFiles(root) {
  const results = [];

  for (const fileName of ROOT_INSTRUCTION_FILES) {
    const filePath = path.join(root, fileName);
    if (isFile(filePath)) {
      results.push(filePath);
    }
  }

  const cursorRulesDir = path.join(root, ".cursor", "rules");
  if (isDirectory(cursorRulesDir)) {
    for (const entry of fs.readdirSync(cursorRulesDir, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name);
      if (CURSOR_RULE_EXTENSIONS.has(extension)) {
        results.push(path.join(cursorRulesDir, entry.name));
      }
    }
  }

  return results;
}

function inferInstructionSignals(text) {
  const lower = text.toLowerCase();
  const capabilities = new Set();
  const riskSignals = new Set();

  if (matches(lower, ["browser", "web", "fetch", "crawl", "scrape", "http", "url"])) {
    capabilities.add("web_access");
  }

  if (matches(lower, ["shell", "terminal", "bash", "zsh", "command", "execute", "run commands"])) {
    capabilities.add("shell_exec");
  }

  if (matches(lower, ["read files", "filesystem", "file system", "read from disk", "local files"])) {
    capabilities.add("filesystem_access");
  }

  if (matches(lower, ["write files", "edit files", "delete files", "modify files", "commit changes"])) {
    capabilities.add("filesystem_write");
  }

  if (matches(lower, ["git commit", "git push", "pull request", "repo", "repository", "github"])) {
    capabilities.add("repo_access");
  }

  if (matches(lower, ["git push", "commit changes", "open pull request", "merge", "contents:write"])) {
    capabilities.add("repo_write");
  }

  if (matches(lower, ["deploy", "deployment", "production", "vercel", "netlify", "railway", "fly.io"])) {
    capabilities.add("deploy");
  }

  if (matches(lower, ["secret", "token", "api key", "apikey", "password", "credential", ".env"])) {
    capabilities.add("secrets_access");
  }

  if (matches(lower, ["stripe", "payment", "refund", "invoice", "wallet", "bank", "wire"])) {
    capabilities.add("payment");
  }

  if (matches(lower, ["customer", "crm", "database", "postgres", "mysql", "mongodb", "snowflake", "bigquery"])) {
    capabilities.add("customer_data");
  }

  if (matches(lower, ["without asking", "do not ask", "no approval", "auto-approve", "automatically"])) {
    riskSignals.add("no_visible_approval");
  }

  if (matches(lower, ["production", "deploy", "release"])) {
    riskSignals.add("deployment_instruction");
  }

  if (matches(lower, ["secret", "token", "api key", "apikey", "password", "credential", ".env"])) {
    riskSignals.add("credential_instruction");
  }

  if (matches(lower, ["git push", "commit changes", "merge", "contents:write"])) {
    riskSignals.add("repo_write_instruction");
  }

  return {
    capabilities: Array.from(capabilities).sort(),
    riskSignals: Array.from(riskSignals).sort()
  };
}

function matches(text, terms) {
  return terms.some((term) => text.includes(term));
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

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}
