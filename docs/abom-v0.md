# Loam ABOM v0

ABOM means Agent Bill of Materials.

An SBOM inventories software components. A Loam ABOM inventories agent authority: the agents, instructions, tools, credentials reachability, approval boundaries, and authority paths that determine what an AI agent can see, call, change, or trigger.

The category question is:

```text
What authority exists in this agentic system, and how can it compose?
```

The risk question is:

```text
Can untrusted input influence sensitive authority?
```

## Required Shape

Every Loam ABOM v0 export is a JSON document with:

- `schema`: always `loam.abom`
- `schema_version`: currently `0.1.0`
- `kind`: always `AgentBillOfMaterials`
- `metadata`: scanner, target, generation time, redaction state
- `abom.agents`: detected agent runtimes or agent workspaces
- `abom.instruction_sources`: Cursor rules, Claude instructions, AGENTS files, and similar authority-shaping instructions
- `abom.tools`: package scripts, GitHub workflows, and other callable project tools
- `abom.mcp_servers`: MCP server inventory with capabilities, env-key names, paths, and source config
- `abom.secrets_reachability`: secret-like keys and which agent/tool capabilities can reach them
- `abom.approval_boundaries`: observed, missing, unknown, or approved-sensitive-action boundaries
- `abom.authority_paths`: composed paths such as `web_access -> agent_context -> shell_exec`
- `abom.findings`: risk findings with evidence and remediation
- `abom.policy_results`: optional Loam policy evaluation results

The machine-readable schema lives at:

```text
schemas/abom-v0.schema.json
```

## ABOM vs SBOM

| Question | SBOM | Loam ABOM |
| --- | --- | --- |
| What is inventoried? | Packages, libraries, versions | Agents, instructions, tools, authority, paths |
| Main risk model | Vulnerable or malicious components | Unsafe combinations of agent authority |
| Key relationship | Package depends on package | Untrusted input can influence sensitive capability |
| Example item | `lodash@4.17.21` | `web_access -> agent_context -> shell_exec` |
| Main user | AppSec, compliance, supply chain | AI safety, security, platform, founders using agents |

## Export

Generate a full ABOM:

```bash
node ./src/cli.mjs abom . --out loam-abom.json --validate
```

Generate a redacted ABOM:

```bash
node ./src/cli.mjs abom . --out loam-redacted-abom.json --redacted --validate
```

Existing scan commands still work:

```bash
node ./src/cli.mjs scan . --abom loam-abom.json
node ./src/cli.mjs scan-pack .
```

## Validate

Validate any ABOM v0 export:

```bash
node ./src/cli.mjs validate-abom loam-abom.json
```

Machine-readable validation:

```bash
node ./src/cli.mjs validate-abom loam-abom.json --json
```

## Authority Path Semantics

Authority paths are the heart of the ABOM. They describe how capabilities combine.

Example:

```json
{
  "id": "authority-path:untrusted-web-content-can-reach-shell-execution",
  "severity": "critical",
  "title": "Untrusted web content can reach shell execution",
  "nodes": ["web_access", "agent_context", "shell_exec"],
  "why": "A browser or fetch tool can introduce prompt-injected content that influences a shell-capable agent.",
  "fix": "Separate browser-facing agents from shell tools, or require explicit approval before shell execution."
}
```

This is not a dependency edge. It is an authority edge.

## Redaction

Full ABOMs are private by default because they can include local paths, server names, package names, command args, and env-key names.

Redacted ABOMs preserve:

- counts
- capability labels
- risk paths
- severity
- remediation guidance
- anonymized component references

Redacted ABOMs remove:

- exact local file paths
- server names
- package names
- command args
- raw env-key names

## Versioning

ABOM v0 is intentionally small and concrete. Future versions should add richer fields only when the scanner can produce them with evidence.

Likely v0.2 additions:

- tool permission modes
- approval UX details
- runtime isolation boundaries
- identity scopes
- data classifications
- policy pack provenance
