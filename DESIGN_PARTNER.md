# Design Partner Scan Kit

This is the lightweight workflow for private design-partner scans.

## What The Scanner Does

It scans local agent and MCP configuration for risky capability paths such as:

- web or browser access sharing context with shell execution
- broad filesystem access
- unknown MCP servers receiving credentials
- repo-write access near deployment workflows
- payment/refund tools without visible approval gates
- customer-data tools sharing context with web access

It does not upload data.

## What It Outputs

The private scan script writes two files:

- `agentsec-report.md`: readable private report for the owner
- `agentsec-research.json`: redacted aggregate export for research, only shared with permission

The redacted export removes:

- absolute paths
- config filenames
- MCP server names
- package names
- command args
- env key names
- env values

## Run A Private Scan

```bash
node ./scripts/private-scan.mjs /path/to/project
```

Or choose an output folder:

```bash
node ./scripts/private-scan.mjs /path/to/project --out ./scan-output
```

Use a label if the owner does not want absolute local paths in the Markdown report:

```bash
node ./scripts/private-scan.mjs /path/to/project --out ./scan-output --target-label "agent-project"
```

## Outreach Message

```text
I’m building a local scanner for AI agent/MCP security. It looks for risky capability paths like browser-to-shell, broad filesystem access, unknown MCP servers with credentials, and agent access near deployment/payment tools.

Would you be open to letting me scan one of your agent/MCP setups and send you a private Markdown risk report?

The scan runs locally. Nothing is uploaded. If you’re comfortable, it can also generate a redacted research export that strips paths, server names, packages, command args, and env keys so I can aggregate patterns across early scans.
```

## Post-Scan Questions

Ask these after sending the report:

```text
1. Did any finding surprise you?
2. Which finding would you actually fix?
3. Would you want this in CI?
4. Who would own this internally: AI/platform/security/devtools?
5. Would you be comfortable being quoted anonymously?
```

## Manual Research Log

```text
scan_id:
date:
user type:
agent framework:
MCP usage:
critical findings:
high findings:
surprise factor:
would install in CI:
would pay:
follow-up requested:
permission to use redacted export:
permission to quote anonymized finding:
```
