# Loam Roadmap

## Current Build

Loam is now a local agent authority scanner with:

- static scans for MCP configs, agent instructions, env key names, package scripts, and GitHub workflows
- ABOM v0 export and validation
- ABOM diff for approved-baseline comparison
- policy checks and temporary approvals
- scan packs for private design-partner reviews
- `loam init` for repo installation
- GitHub Action comments focused on authority changes

## Next Four Weeks

### 1. Make PR Review the Product

- Improve the Authority Change comment with tighter grouping, policy context, and clearer before/after language.
- Add a fixture PR workflow that demonstrates `loam init`, baseline creation, and a failing authority diff.
- Add screenshots or a demo clip to the website.

### 2. Run Public Repo Validation

- Export `Repo queue` from the public repo sourcing workbook as CSV.
- Run `scripts/public-repo-batch.mjs` in doctor mode for the top 10-20 GitHub leads.
- Run scan packs only where doctor finds agent surfaces.
- Log true positives, false positives, missing coverage, and outreach candidates.

### 3. Tighten ABOM v0.2

- Add explicit `authority_edges` and review status fields based on public repo findings.
- Separate discovered capability from approved capability.
- Add source confidence and evidence type fields.

### 4. Design Partner Loop

- Use public repo findings to write credible outreach.
- Run 5 private scans with founders/builders.
- Ask whether findings were surprising, fixable, and CI-worthy.

## Later

- Hosted ABOM viewer with drag-and-drop authority graph.
- Policy packs for Cursor, Claude Code, MCP-heavy repos, and deployment-agent setups.
- Repo-native baseline approval flow.
- Research post from aggregate anonymous scan data.
