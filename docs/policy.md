# Policy

AgentSec supports dependency-free JSON policies for local scans and GitHub Action enforcement.

Create a policy at:

```text
.agentsec/policy.json
```

Example:

```json
{
  "name": "default agent review",
  "fail_on": "high",
  "deny_capabilities": ["payment"],
  "require_approval_for": ["shell_exec", "repo_write", "filesystem_write", "secrets_access"],
  "approved_capabilities": [],
  "allowed_mcp_servers": [
    "@modelcontextprotocol/server-filesystem",
    "@modelcontextprotocol/server-browser"
  ],
  "deny_risk_paths": [
    "web_access -> shell_exec",
    "web_access -> secrets_access"
  ]
}
```

Run with policy:

```bash
node ./src/cli.mjs scan . --policy .agentsec/policy.json
```

Write a PR-ready report with policy violations:

```bash
node ./src/cli.mjs scan . \
  --markdown agentsec-report.md \
  --policy .agentsec/policy.json
```

## Fields

- `fail_on`: fails when a policy violation reaches `low`, `medium`, `high`, or `critical`.
- `deny_capabilities`: fails on capabilities that should never appear.
- `require_approval_for`: reports capabilities that need explicit approval.
- `approved_capabilities`: approved subset of `require_approval_for`.
- `allowed_mcp_servers`: optional allowlist of MCP server package names or server names.
- `deny_risk_paths`: capability combinations that should not exist in the same agent/toolchain.

## GitHub Action

The Action checks `.agentsec/policy.json` by default. Override the path with:

```yaml
with:
  policy-path: .agentsec/policy.json
```

If the policy file exists, AgentSec applies it to the scan and includes violations in the job summary and PR comment.
