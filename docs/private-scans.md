# Private Scan Playbook

Use this flow when asking a builder or design partner to scan their agent setup.

## Ask

```text
Can I run a local scanner against your agent/MCP config and send you a private risk report?

It does not upload data. It can also produce a redacted research export that strips paths, tool names, package names, command args, and env keys.
```

The scanner also checks project instruction files such as `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and Cursor `.cursor/rules` files for risky authority language.

## Local Report

```bash
node ./src/cli.mjs scan /path/to/project --markdown loam-report.md
```

Share `loam-report.md` privately with the owner.

The private scan wrapper also creates `loam-redacted-report.md`, which is intended for sharing anonymized findings after the owner approves.

## Append To Research Log

```bash
node ./scripts/private-scan.mjs /path/to/project \
  --target-label "founder-1" \
  --scan-id "scan-001" \
  --append-log ./research/scan-log.csv
```

If the CSV does not exist, the script creates it with the standard header.

## Redacted Research Export

Only request this with permission.

```bash
node ./src/cli.mjs scan /path/to/project --research loam-research.json
```

The export keeps:

- total finding counts
- severity counts
- capability counts
- agent instruction file counts
- finding IDs
- evidence types

The export removes:

- absolute paths
- config filenames
- MCP server names
- package names
- command args
- env key names
- env values

## Research Log

Track each scan manually:

```text
scan_id:
date:
user type:
agent framework:
permission to quote anonymized findings:
critical findings:
surprise factor:
would install in CI:
follow-up requested:
```
