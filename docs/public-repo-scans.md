# Public Repo Scan Workflow

Use this workflow to turn the public repo sourcing workbook into Loam validation data.

## Source

Workbook:

```text
outputs/public-repo-sourcing/loam-public-repo-sourcing.xlsx
```

Export the `Repo queue` sheet as CSV before running the batch script. The script expects a `URL` column and uses `Priority score`, `Owner`, `Project`, and `Notes` when present.

## Dry run

```bash
node ./scripts/public-repo-batch.mjs \
  --csv ./outputs/public-repo-sourcing/repo-queue.csv \
  --min-score 85 \
  --limit 10 \
  --dry-run
```

## Doctor pass

```bash
node ./scripts/public-repo-batch.mjs \
  --csv ./outputs/public-repo-sourcing/repo-queue.csv \
  --min-score 85 \
  --limit 10 \
  --mode doctor \
  --out ./research/public-repo-scan-results.csv
```

## Scan-pack pass

Run this only for repos where doctor finds Loam surfaces.

```bash
node ./scripts/public-repo-batch.mjs \
  --csv ./outputs/public-repo-sourcing/repo-queue.csv \
  --min-score 85 \
  --limit 10 \
  --mode scan-pack \
  --out ./research/public-repo-scan-results.csv
```

## Rules

- Clone public repos only.
- Do not install dependencies.
- Do not run project scripts, tests, examples, notebooks, services, Spaces, or deployments.
- Do not use discovered credentials, endpoints, or tokens.
- Treat findings as research leads until manually reviewed.
- Do not publish named findings without permission or responsible disclosure.
