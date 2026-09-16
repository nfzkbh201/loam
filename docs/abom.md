# Agent Bill of Materials

An Agent Bill of Materials, or ABOM, is a structured inventory of the components and capabilities available to an AI agent.

Traditional SBOMs describe software packages. Agentic systems need a broader view because the risk comes from capability paths, not just dependencies.

An ABOM should include:

- agent framework and runtime
- models
- MCP servers
- tools and plugins
- prompts and policies
- reachable files
- reachable APIs
- credentials and env keys by name only
- browser or network access
- payment or deployment capabilities
- customer-data access

The core question is:

```text
What can this agent see, call, change, or spend?
```

The next question is:

```text
Can untrusted input influence those capabilities?
```

Example risk path:

```text
untrusted webpage
→ agent context
→ shell tool
→ repository write access
→ deployment workflow
```

## Export

Private/internal ABOM:

```bash
node ./src/cli.mjs scan /path/to/project --abom agentsec-abom.json
```

Redacted/shareable ABOM:

```bash
node ./src/cli.mjs scan /path/to/project --redacted-abom agentsec-redacted-abom.json
```

Combined known-config ABOM:

```bash
node ./src/cli.mjs scan-known . \
  --abom agentsec-abom.json \
  --redacted-abom agentsec-redacted-abom.json
```

The full ABOM may include config filenames, server names, package names, commands, args, env key names, and path arguments. Treat it as private.

The redacted ABOM preserves aggregate counts, capability labels, target type labels, and per-component capability sets, but removes exact paths, config filenames, server names, package names, command args, and env key names.

## Diff

Compare an approved ABOM baseline against a new scan:

```bash
mkdir -p .agentsec
node ./src/cli.mjs scan . --abom .agentsec/baseline-abom.json

node ./src/cli.mjs scan . --abom agentsec-abom.json
node ./src/cli.mjs diff \
  --baseline .agentsec/baseline-abom.json \
  --current agentsec-abom.json
```

Use `--fail-on` to turn the diff into a CI gate:

```bash
node ./src/cli.mjs diff \
  --baseline .agentsec/baseline-abom.json \
  --current agentsec-abom.json \
  --markdown agentsec-diff.md \
  --fail-on high
```

The diff reports:

- added or removed capabilities
- added or removed MCP servers
- added or removed GitHub workflow files
- added or removed env files
- newly introduced risk paths, such as `web_access -> shell_exec`

Use full ABOMs for precise diffs. Redacted ABOMs are better for sharing aggregate inventory and research findings.

## GitHub PR Baseline

The GitHub Action looks for this baseline by default:

```text
.agentsec/baseline-abom.json
```

Create or refresh it when the current agent/toolchain state has been reviewed and approved:

```bash
mkdir -p .agentsec
node ./src/cli.mjs scan . --abom .agentsec/baseline-abom.json
```

On pull requests, the Action generates a current ABOM, compares it with the baseline, writes the diff to the job summary, and updates the AgentSec PR comment.
