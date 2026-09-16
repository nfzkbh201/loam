# Loam Demo

Run from the repo root:

```bash
node ./src/cli.mjs doctor ./fixtures/cursor-rules-risk
node ./src/cli.mjs scan ./fixtures/cursor-rules-risk
node ./src/cli.mjs scan ./fixtures/claude-instructions-risk
```

Create a tester-ready scan pack:

```bash
node ./src/cli.mjs scan-pack ./fixtures/cursor-rules-risk --label "cursor-demo"
```

The scan pack writes:

- `private-report.md`
- `redacted-report.md`
- `private-abom.json`
- `redacted-abom.json`
- `research.json`
- `summary.txt`

Use `private-report.md` internally. Share `redacted-report.md` and `research.json` only after review and permission.
