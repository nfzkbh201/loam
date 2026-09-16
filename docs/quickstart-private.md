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
  --markdown agentsec-report.md \
  --redacted-markdown agentsec-redacted-report.md \
  --abom agentsec-abom.json \
  --redacted-abom agentsec-redacted-abom.json \
  --research agentsec-research.json
```

This scans discovered config locations and writes:

- `agentsec-report.md`: private Markdown report
- `agentsec-redacted-report.md`: redacted Markdown report for sharing
- `agentsec-abom.json`: private Agent Bill of Materials
- `agentsec-redacted-abom.json`: redacted Agent Bill of Materials
- `agentsec-research.json`: redacted aggregate export, only share with permission

## Run A Specific Project Scan

```bash
node ./src/cli.mjs scan /path/to/project \
  --markdown agentsec-report.md \
  --research agentsec-research.json
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
