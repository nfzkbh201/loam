# Private Quickstart

Use this when sharing the private repo with an early tester or design partner.

## Clone

```bash
git clone git@github.com:nfzkbh201/agentsec.git
cd agentsec
```

If SSH is not configured:

```bash
git clone https://github.com/nfzkbh201/agentsec.git
cd agentsec
```

## Check Known Config Locations

```bash
node ./src/cli.mjs discover .
```

Discovery only checks whether known config paths exist. It does not read file contents.

## Run A Combined Scan

```bash
node ./src/cli.mjs scan-known . \
  --markdown loam-report.md \
  --redacted-markdown loam-redacted-report.md \
  --abom loam-abom.json \
  --redacted-abom loam-redacted-abom.json \
  --research loam-research.json
```

This scans discovered config locations and writes:

- `loam-report.md`: private Markdown report
- `loam-redacted-report.md`: redacted Markdown report for sharing
- `loam-abom.json`: private Agent Bill of Materials
- `loam-redacted-abom.json`: redacted Agent Bill of Materials
- `loam-research.json`: redacted aggregate export, only share with permission

Known config discovery includes MCP configs plus project instruction files such as `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and Cursor `.cursor/rules`.

## Run A Specific Project Scan

```bash
node ./src/cli.mjs scan /path/to/project \
  --markdown loam-report.md \
  --research loam-research.json
```

## Private Scan Wrapper

```bash
node ./scripts/private-scan.mjs /path/to/project --target-label "agent-project"
```

## Notes

- Requires Node.js 18 or newer.
- The scanner does not upload data.
- Env values are not printed.
- Only scan systems you own or have permission to assess.
