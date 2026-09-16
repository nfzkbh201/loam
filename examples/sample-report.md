# Loam Risk Report

**Target:** `fixtures/browser-shell-risk`
**Risk score:** 45/100
**Findings:** 2 (critical 1, high 0, medium 1, low 0)

## Agent Bill of Materials

- MCP config files: 1
- MCP servers: 2
- Capabilities: `shell_exec`, `unknown_publisher`, `web_access`

| MCP server | Package | Capabilities | Config |
| --- | --- | --- | --- |
| browser | @modelcontextprotocol/server-browser | web_access | .mcp.json |
| shell | mcp-shell | shell_exec, unknown_publisher | .mcp.json |

## Critical Findings

### Untrusted web content can reach shell execution

**Path:** `web_access` -> `agent_context` -> `shell_exec`

**Why it matters:** A browser or fetch tool can introduce prompt-injected content that influences a shell-capable agent.

**Recommended fix:** Separate browser-facing agents from shell tools, or require explicit approval before shell execution.

**Evidence:**

- `.mcp.json`: `browser` (`@modelcontextprotocol/server-browser`) with `web_access`
- `.mcp.json`: `shell` (`mcp-shell`) with `shell_exec`, `unknown_publisher`

## Medium Findings

### MCP server publisher could not be verified

**Path:** `shell` -> `unknown_publisher`

**Why it matters:** Unknown or ad hoc MCP packages are harder to review, patch, and recall after an incident.

**Recommended fix:** Use verified packages, pin versions, and document owner/review status for this server.

**Evidence:**

- `.mcp.json`: `shell` (`mcp-shell`) with `shell_exec`, `unknown_publisher`
