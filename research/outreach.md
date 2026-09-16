# Outreach Templates

Use these to get the first design-partner scans. The ask is deliberately small: run a local scan, send a private report, and optionally collect a redacted export.

## Friendly Founder

```text
I’m building a local scanner for AI agent/MCP security. It looks for risky capability paths like browser-to-shell, broad filesystem access, unknown MCP servers with credentials, and agent access near deploy/payment tools.

Could I run it against one of your agent/MCP setups and send you a private Markdown report?

It runs locally and does not upload data. If you’re comfortable, it can also generate a redacted export for aggregate research that strips paths, server names, packages, command args, and env keys.
```

## AI Engineer

```text
I’m testing a scanner for agentic supply-chain risk: MCP servers, tools, env keys, repo/deploy permissions, browser access, filesystem access, and risky capability paths.

Would you be open to running it on one agent project or local MCP setup? I’ll send back a private report and would love feedback on whether the findings are real enough to put in CI.

No data is uploaded. There’s also a redacted report mode for anonymized findings.
```

## Security / Platform Engineer

```text
I’m working on a defensive scanner for AI agent/MCP toolchains. It produces an Agent Bill of Materials and flags paths like untrusted web content → agent context → shell, secrets near web-facing tools, repo write near deployment workflows, and payment/customer-data access without obvious controls.

Would you be willing to review a scan on a non-sensitive agent setup? I’m trying to learn whether this belongs in CI/security review and who would own it internally.

The scanner runs locally and produces both a private report and a redacted research artifact.
```

## Follow-Up After Report

```text
Curious what you think:

1. Did any finding surprise you?
2. Which finding would you actually fix?
3. Would you want this as a CI check?
4. Who would own this internally: AI, platform, security, or devtools?
5. Can I use a redacted/anonymized version of the finding in aggregate research?
```
