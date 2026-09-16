# agentsec

`agentsec` is a dependency-free prototype scanner for risky AI agent and MCP toolchains.

It is designed for the emerging agentic supply chain: MCP servers, tools, plugins, credentials, prompts, browser access, filesystem access, and CI/CD permissions.

It creates a small Agent Bill of Materials (ABOM) and flags critical risk paths such as:

- browser or web tools sharing context with shell execution
- broad filesystem access
- secrets reachable from agent runtimes
- repository write access near deployment automation
- payment-capable tools without visible approval gates
- unknown MCP servers receiving credentials
- secret-like env keys near web or shell-enabled agents
- customer-data tools sharing context with web access

## Quick Start

```bash
cd agentsec
node ./src/cli.mjs discover .
node ./src/cli.mjs scan-known .
node ./src/cli.mjs scan ./fixtures/browser-shell-risk
node ./src/cli.mjs scan ./fixtures/unknown-mcp-risk --json
node ./src/cli.mjs scan ./fixtures/browser-shell-risk --markdown agentsec-report.md
node ./src/cli.mjs scan ./fixtures/browser-shell-risk --redacted-markdown public-report.md
node ./src/cli.mjs scan ./fixtures/browser-shell-risk --sarif agentsec.sarif
node ./src/cli.mjs scan ./fixtures/browser-shell-risk --research agentsec-research.json
node ./src/cli.mjs scan ./fixtures/repo-write-deploy-risk --fail-on critical
```

For design-partner scans:

```bash
node ./scripts/private-scan.mjs /path/to/project
```

## Example Finding

See [examples/sample-report.md](examples/sample-report.md) for a full Markdown report.

```text
CRITICAL Untrusted web content can reach shell execution
Path: web_access -> agent_context -> shell_exec

Why:
A browser or fetch tool can introduce prompt-injected content that influences a shell-capable agent.

Fix:
Separate browser-facing agents from shell tools, or require explicit approval before shell execution.
```

## GitHub Action

```yaml
name: agentsec
on: [pull_request]

permissions:
  contents: read
  pull-requests: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./agentsec
        with:
          path: .
          fail-on: critical
          comment: true
          github-token: ${{ github.token }}
```

The action writes the report to the GitHub job summary and, on pull requests, creates or updates a single AgentSec comment.

## Current Scope

The prototype scans:

- `.mcp.json`
- `mcp.json`
- `mcp-config.json`
- `mcp_config.json`
- `claude_desktop_config.json`
- root `package.json` scripts
- `.github/workflows/*.yml`
- `.github/workflows/*.yaml`
- `.env`, `.env.local`, `.env.example`, `.env.sample` key names only

It intentionally does not print env values.

## Discovery

Use discovery to find likely agent/MCP config locations before choosing what to scan:

```bash
node ./src/cli.mjs discover .
node ./src/cli.mjs discover . --json
```

Discovery only checks whether known config paths exist. It does not read or upload their contents.

To scan existing discovered config locations in one combined report:

```bash
node ./src/cli.mjs scan-known . --markdown agentsec-report.md --research agentsec-research.json
```

Add a human-readable redacted report for safe sharing:

```bash
node ./src/cli.mjs scan-known . \
  --markdown agentsec-report.md \
  --redacted-markdown public-report.md \
  --research agentsec-research.json
```

## Demo Fixtures

The `fixtures/` directory contains intentionally vulnerable agent setups:

- `browser-shell-risk`
- `broad-filesystem-risk`
- `claude-desktop-config-risk`
- `customer-data-web-risk`
- `payment-no-approval-risk`
- `repo-write-deploy-risk`
- `unknown-mcp-risk`
- `web-env-secrets-risk`

## Outputs

`agentsec` can emit:

- terminal report
- JSON report
- Markdown report for PR comments
- redacted Markdown report for sharing anonymized findings
- SARIF report for security tooling
- redacted research export for aggregate studies

The research export strips server names, package names, command args, config paths, env key names, and env values. It keeps aggregate counts, capabilities, finding IDs, severities, and evidence types.

## Development

```bash
node --test
npm pack --dry-run
```

## Research Use

This project is intended for defensive research into agentic supply-chain security. Only scan systems you own or have explicit permission to assess. When publishing findings, anonymize real organizations and never disclose secrets or private configs.

See [docs/private-scans.md](docs/private-scans.md) for a design-partner scan workflow.

See [DESIGN_PARTNER.md](DESIGN_PARTNER.md) for the full run kit and outreach copy.

See [research/first-20-scans.md](research/first-20-scans.md) and [research/scan-log-template.csv](research/scan-log-template.csv) for the first validation loop.
