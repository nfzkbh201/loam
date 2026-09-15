import fs from "node:fs";
import path from "node:path";

const ENV_FILES = [".env", ".env.local", ".env.example", ".env.sample"];
const SECRET_PATTERN = /token|secret|password|api[_-]?key|credential|private[_-]?key|access[_-]?key/i;

export function parseEnvFiles(root) {
  const files = [];

  for (const name of ENV_FILES) {
    const filePath = path.join(root, name);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const keys = [];
    const secretLikeKeys = [];
    const content = safeRead(filePath);

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const key = trimmed.split("=")[0].trim();
      if (!key) {
        continue;
      }

      keys.push(key);
      if (SECRET_PATTERN.test(key)) {
        secretLikeKeys.push(key);
      }
    }

    files.push({
      path: filePath,
      relativePath: path.relative(root, filePath),
      keys,
      secretLikeKeys
    });
  }

  return files;
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}
