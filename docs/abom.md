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
