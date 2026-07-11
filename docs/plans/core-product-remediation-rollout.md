# Core Product Remediation Rollout

> **Read when:** preparing staging or production deployment of `codex/core-product-remediation`.

## Rule

The repository keeps one ordered Drizzle migration journal. Deployment is staged by domain release; it does not create separate journals and does not run the whole unverified tail against production in one step.

The migrations after `main` are currently unshipped development history. Before the first shared-environment rollout, record that environment's `__drizzle_migrations` state. Once a migration has run in a shared persistent environment, its SQL is immutable and any correction is a new forward migration.

## Release batches

| Batch | Domain | Required preflight | Completion evidence |
| --- | --- | --- | --- |
| 1 | Payment/invoice additive state | Fresh migration and API compatibility | Payment idempotency/correction tests; no enforcement yet relied upon. |
| 2 | Financial enforcement | Financial `--report` for every organization; all ambiguous rows owned and resolved | `0038` and `0043` apply on sanitized production copy. |
| 3 | Submission/calendar | Producer and worker compatibility | Claim/concurrency tests; calendar reconciliation second run is a no-op. |
| 4 | WhatsApp additive reliability | Worker/API deployed compatibly with old rows | Webhook replay, campaign concurrency, lease recovery tests. |
| 5 | WhatsApp uniqueness enforcement | `pnpm whatsapp:migration-preflight` returns zero duplicates | `0046` applies on sanitized production copy. |
| 6 | Expenses/billing | Profitability and seat before/after reports | Canonical totals and provider quantities agree. |

Because the current branch contains all domains, create each deployable release from `main` using the reviewed domain commits and its required migration slice. Do not deploy this branch wholesale merely because the clean-database migration succeeds.

## Financial preflight

For every production organization:

```bash
pnpm --filter @repo/scripts financial-reconciliation \
  --organization-id <organization-id> --report
```

`--fix-safe` may update only the documented cache-safe classes. Decision JSON is evidence for a reviewed manual repair; no `--fix-approved` command exists.

## WhatsApp preflight

```bash
pnpm whatsapp:migration-preflight
```

Exit `0` means no duplicate account/contact or account/provider-message identities. Exit `1` prints deterministic JSON requiring review. The command is report-only and never chooses which historical identity to delete or merge.

## Rehearsal record

For every batch capture:

- Starting migration ledger and application commit.
- Preflight output and decision records.
- Migration duration and blocking-lock observations.
- Domain-specific before/after totals or identity counts.
- Rolling-deploy compatibility result.
- Roll-forward recovery steps.

Financial documents, receipt numbers, reversals, and idempotency tombstones are never deleted as rollback.
