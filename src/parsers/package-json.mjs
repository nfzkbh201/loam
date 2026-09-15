import fs from "node:fs";
import path from "node:path";

export function parsePackageJson(root) {
  const filePath = path.join(root, "package.json");

  if (!fs.existsSync(filePath)) {
    return {
      path: null,
      scripts: {},
      riskSignals: []
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const scripts = parsed.scripts || {};
    const scriptText = Object.values(scripts).join(" ").toLowerCase();
    const riskSignals = [];

    if (scriptText.includes("deploy")) {
      riskSignals.push("deploy_script");
    }

    if (scriptText.includes("gh ") || scriptText.includes("git push")) {
      riskSignals.push("repo_write_script");
    }

    return {
      path: filePath,
      scripts,
      riskSignals
    };
  } catch (error) {
    return {
      path: filePath,
      scripts: {},
      riskSignals: [`parse_error:${error.message}`]
    };
  }
}
