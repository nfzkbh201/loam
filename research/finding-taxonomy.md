# Finding Taxonomy

Use this taxonomy when summarizing early scans.

## Capability Path Risks

- `web_to_shell`: untrusted web/browser/fetch content can influence shell execution
- `web_to_filesystem_write`: untrusted web content can influence filesystem writes
- `web_to_customer_data`: customer-data tools share context with web access
- `web_to_secrets`: web-facing agent tools share runtime with credential access

## Dependency / Supply-Chain Risks

- `unknown_mcp_publisher`: MCP server publisher or source is not clearly verified
- `unknown_mcp_with_secrets`: unknown MCP server receives credentials or secret-like env keys
- `broad_filesystem_access`: MCP server can access home/root/parent directories
- `secret_like_env_near_agent`: secret-like env keys exist near web or shell-enabled agent tools

## Economic / Production Action Risks

- `payment_without_approval`: payment/refund/wallet tool has no visible approval gate
- `repo_write_to_deploy`: repo write access exists near deployment automation

## Useful Notes Per Finding

Track:

- whether the owner knew about it
- whether they think it is actually exploitable
- whether they would fix it
- whether it belongs in CI
- whether it is false positive, true positive, or “directionally useful”
