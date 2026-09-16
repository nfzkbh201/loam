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
