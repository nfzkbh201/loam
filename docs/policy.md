# Policy

Loam supports dependency-free JSON policies for local scans and GitHub Action enforcement.

Create a policy at:

```text
.loam/policy.json
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
  ],
  "approvals": []
}
```

Run with policy:

```bash
node ./src/cli.mjs scan . --policy .loam/policy.json
```

Create the default policy file:

```bash
node ./src/cli.mjs init-policy
```

Use a custom path:

```bash
node ./src/cli.mjs init-policy --policy ./team-agent-policy.json
```

Write a PR-ready report with policy violations:

```bash
node ./src/cli.mjs scan . \
  --markdown loam-report.md \
  --policy .loam/policy.json \
  --approval-suggestions
```

## Fields

- `fail_on`: fails when a policy violation reaches `low`, `medium`, `high`, or `critical`.
- `deny_capabilities`: fails on capabilities that should never appear.
- `require_approval_for`: reports capabilities that need explicit approval.
- `approved_capabilities`: approved subset of `require_approval_for`.
- `allowed_mcp_servers`: optional allowlist of MCP server package names or server names.
- `deny_risk_paths`: capability combinations that should not exist in the same agent/toolchain.
- `approvals`: reviewed exceptions for capabilities, MCP servers, or risk paths.

## Approvals

Approvals let a team accept a specific risky item temporarily without weakening the whole policy:

```json
{
  "approvals": [
    {
      "type": "capability",
      "subject": "shell_exec",
      "reason": "Allowed for local development agent only",
      "approved_by": "noor",
      "expires": "2026-12-31"
    },
    {
      "type": "mcp_server",
      "subject": "mcp-shell",
      "reason": "Temporary design partner fixture",
      "approved_by": "noor",
      "expires": "2026-12-31"
    },
    {
      "type": "risk_path",
      "subject": "web_access -> shell_exec",
      "reason": "Reviewed isolated sandbox",
      "approved_by": "noor",
      "expires": "2026-12-31"
    }
  ]
}
```

Supported approval types:

- `capability`: approves a capability listed in `require_approval_for`.
- `mcp_server`: approves an MCP server outside `allowed_mcp_servers`, matching package name or server name.
- `risk_path`: approves a matching `deny_risk_paths` combination.

Expired approvals are treated as policy violations. `deny_capabilities` remains a hard deny and is not bypassed by approvals.

Add approvals from the CLI instead of hand-editing JSON:

```bash
node ./src/cli.mjs approve capability shell_exec \
  --reason "Allowed for local development agent only" \
  --approved-by noor \
  --expires 2026-12-31

node ./src/cli.mjs approve mcp_server mcp-shell \
  --reason "Temporary design partner fixture" \
  --approved-by noor \
  --expires 2026-12-31

node ./src/cli.mjs approve risk_path "web_access -> shell_exec" \
  --reason "Reviewed isolated sandbox" \
  --approved-by noor \
  --expires 2026-12-31
```

List approvals:

```bash
node ./src/cli.mjs list-approvals
node ./src/cli.mjs list-approvals --json
```

`approve` creates `.loam/policy.json` from the example policy if it does not exist. It avoids duplicate active approvals for the same type and subject. If an old approval has expired, adding a new approval for the same subject creates a fresh current approval.

## Approval Suggestions

Generate approval commands from current policy violations:

```bash
node ./src/cli.mjs suggest-approvals . --policy .loam/policy.json
```

Add suggestions to scan output and Markdown reports:

```bash
node ./src/cli.mjs scan . \
  --policy .loam/policy.json \
  --approval-suggestions \
  --markdown loam-report.md
```

Suggestions are generated for approvable violations:

- `unapproved_capability` -> `approve capability ...`
- `unapproved_mcp_server` -> `approve mcp_server ...`
- `denied_risk_path` -> `approve risk_path ...`

Hard-denied capabilities from `deny_capabilities` do not get approval suggestions because approvals do not bypass hard denies.

## GitHub Action

The Action checks `.loam/policy.json` by default. Override the path with:

```yaml
with:
  policy-path: .loam/policy.json
```

If the policy file exists, Loam applies it to the scan and includes violations in the job summary and PR comment.
