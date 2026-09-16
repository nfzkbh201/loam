# First 20 Scans Plan

The goal is not to prove every rule is perfect. The goal is to learn whether real agent builders have risky capability paths they did not know about.

## Target Mix

- 5 AI engineers using Claude Desktop, Cursor, Codex, or custom MCP configs
- 5 founders or indie hackers building agent workflows
- 5 security/platform engineers experimenting with internal agents
- 5 AI automation agencies or consultants

## Success Criteria

Strong signal:

- 20 scans completed
- 5+ serious findings
- 3+ people say “I did not know that was reachable”
- 3+ people ask for CI/GitHub Action usage
- 1+ person offers an intro to security/platform owner

Weak signal:

- findings are mostly obvious
- users do not care enough to fix anything
- users do not know who would own the problem
- no one wants it in CI

## What To Record

Use `research/scan-log-template.csv`.

Key fields:

- `surprise_factor`: low, medium, high
- `would_install_ci`: yes, no, unknown
- `would_pay`: yes, no, unknown
- `permission_redacted_export`: yes/no
- `permission_anonymous_quote`: yes/no

## Research Post Seed

Possible first post:

```text
We scanned 20 early AI agent/MCP setups. Here are the risky capability paths that showed up.
```

Do not name users or companies. Use aggregate counts and redacted examples only.
