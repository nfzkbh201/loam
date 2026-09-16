# Founder And Builder Outreach

Loam is early. The ask should feel like research, not sales.

## Who To Ask First

Prioritize builders who are already using agents in real workflows:

- Cursor or Claude Code users shipping production code
- founders building with MCP servers or internal tools
- AI app builders with browser, repo, customer-data, or deployment access
- devtools founders who understand CI/security pain
- small teams where one person owns both speed and risk

Avoid broad enterprise security buyers at this stage. You want fast feedback from people who can run a local command and tell you whether the findings feel real.

## The Ask

Ask for one private local scan, not a meeting first.

```text
I’m building Loam, a local scanner for AI agent setups. It maps risky agent capability paths like browser-to-shell, repo-write near deployment, secrets near agent instructions, and unsafe MCP/tool configs.

Would you be open to running a local scan on one agent-enabled project?

Nothing uploads. It generates a private report for you and a redacted report/research export only if you choose to share it. I’m trying to learn what risky agent setups actually look like in the wild.
```

If they say yes:

```text
Amazing. From the repo you want to test:

node ./src/cli.mjs doctor .
node ./src/cli.mjs scan-pack . --label "builder-001"

The important files are:
- loam-scan/private-report.md: for you only
- loam-scan/redacted-report.md: share only if comfortable
- loam-scan/research.json: share only if you approve aggregate research use
```

## DM Variant

```text
Quick ask: I’m building Loam, a local scanner for AI agent/MCP security. It checks whether agent instructions/tools create risky paths like browser -> shell, repo write -> deploy, or secrets near agent context.

Would you be open to running it on one Cursor/Claude/MCP project? Nothing uploads; you keep the private report. I’m looking for early design partners and real-world patterns.
```

## After The Scan

Ask:

```text
1. Did any finding feel real or surprising?
2. Which finding would you actually fix?
3. Was the report understandable?
4. Would this be more useful locally, in CI, or as a GitHub PR comment?
5. Can I use the redacted result in aggregate research?
```

## Positioning

Use:

```text
Loam maps and reviews the agent attack surface before agent tools become production authority.
```

Avoid:

```text
AI security platform
agent firewall
full compliance
autonomous procurement marketplace
```

Those may become true later. Right now, the wedge is concrete: local agent stack risk reports.
