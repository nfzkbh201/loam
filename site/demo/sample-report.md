# Loam Sample Report

Target: `cursor-claude-agent-workspace`

Risk score: 82 / 100

Findings: 2 critical, 3 high

## Agent Bill of Materials

- Instructions: `.cursor/rules/agent.mdc`, `CLAUDE.md`
- MCP servers: `filesystem`, `browser`
- Capabilities: `web_access`, `agent_context`, `shell_exec`, `filesystem_access`, `secrets_access`, `repo_write`, `deployment_workflow`
- Deployment paths: GitHub Actions production workflow

## Critical Findings

### Untrusted web content can reach shell execution

Path: `web_access -> agent_context -> shell_exec`

Why: A browser or fetch tool can introduce prompt-injected content that influences an agent with shell execution.

Fix: Separate browser-facing agents from shell-capable tools, or require explicit human approval before shell execution.

### Secrets reachable from browser-facing agent context

Path: `web_access -> agent_context -> secrets_access`

Why: Prompt-injected web content can influence an agent that also has credential material available in the same runtime.

Fix: Move secrets outside agent-readable paths and split browsing agents from credentialed execution agents.

## High Findings

### Repository writes sit near deployment workflow

Path: `repo_write -> deployment_workflow`

Fix: Require human review for agent-authored commits and separate deployment credentials from agent workflows.

### Agent instructions reduce approval around sensitive tools

Path: `agent_instruction -> no_visible_approval -> sensitive_capability`

Fix: Remove blanket auto-approval language and require explicit review for shell, repo, deploy, and payment actions.

### MCP filesystem server exposes broad project access

Path: `mcp_server -> filesystem_access -> repo_context`

Fix: Scope filesystem MCP roots to task-specific directories and deny credential, build, and deploy paths by default.
