const findings = {
  "web-shell": {
    severity: "Critical",
    severityClass: "critical",
    title: "Untrusted web content can reach shell execution",
    path: "web_access -> agent_context -> shell_exec",
    why: "A browser or fetch tool can introduce prompt-injected content that influences an agent with shell execution.",
    evidence: "`.cursor/rules/agent.mdc` grants web, filesystem, secrets, and shell access in one runtime.",
    fix: "Separate browser-facing agents from shell-capable tools, or require explicit human approval before shell execution.",
    map: ["web", "agent", "shell"],
  },
  "web-secrets": {
    severity: "Critical",
    severityClass: "critical",
    title: "Secrets reachable from browser-facing agent context",
    path: "web_access -> agent_context -> secrets_access",
    why: "Prompt-injected web content can influence an agent that also has credential material available in the same runtime.",
    evidence: "Project instructions mention tokens and environment files near browser and shell-capable workflow guidance.",
    fix: "Move secrets outside agent-readable paths and split browsing agents from credentialed execution agents.",
    map: ["web", "agent", "secrets"],
  },
  "repo-deploy": {
    severity: "High",
    severityClass: "high",
    title: "Repository writes sit near deployment workflow",
    path: "repo_write -> deployment_workflow",
    why: "An agent that can write to the repo near deployment automation can create a production-change path.",
    evidence: "`CLAUDE.md` includes deploy instructions while the workspace allows agent-authored repository writes.",
    fix: "Require human review for agent-authored commits and separate deployment credentials from agent workflows.",
    map: ["repo", "CI", "deploy"],
  },
  "auto-approval": {
    severity: "High",
    severityClass: "high",
    title: "Agent instructions reduce approval around sensitive tools",
    path: "agent_instruction -> no_visible_approval -> sensitive_capability",
    why: "Instructions that tell agents not to ask or that normalize automatic actions can bypass human review.",
    evidence: "The instruction set includes broad autonomy language near shell, repo, and deployment capabilities.",
    fix: "Remove blanket auto-approval language and require explicit review for shell, repo, deploy, and payment actions.",
    map: ["rules", "approval", "tools"],
  },
  "mcp-filesystem": {
    severity: "High",
    severityClass: "high",
    title: "MCP filesystem server exposes broad project access",
    path: "mcp_server -> filesystem_access -> repo_context",
    why: "Broad filesystem MCP access can expose source, config, credentials, and build artifacts to agent context.",
    evidence: "The MCP server allows workspace-level reads instead of a narrow allowlist.",
    fix: "Scope filesystem MCP roots to task-specific directories and deny credential, build, and deploy paths by default.",
    map: ["MCP", "files", "repo"],
  },
};

const buttons = document.querySelectorAll(".finding");
const detailSeverity = document.querySelector("#detailSeverity");
const detailPath = document.querySelector("#detailPath");
const detailTitle = document.querySelector("#detailTitle");
const detailWhy = document.querySelector("#detailWhy");
const detailEvidence = document.querySelector("#detailEvidence");
const detailFix = document.querySelector("#detailFix");
const pathStart = document.querySelector("#pathStart");
const pathMiddle = document.querySelector("#pathMiddle");
const pathEnd = document.querySelector("#pathEnd");

function renderFinding(id) {
  const finding = findings[id];
  if (!finding) return;

  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.finding === id);
  });

  detailSeverity.textContent = finding.severity;
  detailSeverity.className = `severity ${finding.severityClass}`;
  detailPath.textContent = finding.path;
  detailTitle.textContent = finding.title;
  detailWhy.textContent = finding.why;
  detailEvidence.textContent = finding.evidence;
  detailFix.textContent = finding.fix;
  [pathStart.textContent, pathMiddle.textContent, pathEnd.textContent] = finding.map;
}

buttons.forEach((button) => {
  button.addEventListener("click", () => renderFinding(button.dataset.finding));
});
