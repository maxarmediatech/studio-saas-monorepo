# Core remediation Release Batch 1 — payment and invoice additive state

> **Read when:** reviewing, rehearsing, or deploying
> `codex/core-remediation-release-1-payments`.

## Scope

This branch starts at `origin/main` commit `06fbe555` and contains only the
approved payment, receipt, invoice, and financial-document runtime changes.
Its sole new migration is:

- `0038_payment_invoice_additive_state.sql`
- SHA-256: `983bf84f5d43669b1541eb64d0b85ab132c52b76a4661898ba0acf6ecca895ad`

The migration adds payment idempotency records, audited payment-correction
columns, and invoice/receipt document sequences. It does not add the active
invoice/schedule or receipt/payment uniqueness constraints, relationship
triggers, repair data, submission state, Calendar state, WhatsApp state,
expense state, billing state, or booking sequences.

## Required order

1. Record the deployed application SHA and database backup/snapshot identity.
2. Run the read-only preflight against the target database:

   ```bash
   PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000' \
     psql "$DATABASE_URL" -X -f \
     packages/database/drizzle/preflight/0038_payment_invoice_additive_state.sql
   ```

3. Apply the migration once from the controlled release runner:

   ```bash
   pnpm --filter @repo/database exec drizzle-kit migrate \
     --config=drizzle.config.ts
   ```

4. Verify the ledger has 39 rows and ends at
   `0038_payment_invoice_additive_state`.
5. Deploy this branch's application code.
6. Smoke-test received-payment creation and identical retry, schedule
   conversion and identical retry, payment correction, receipt issuance, and
   invoice line-item/finalization locking.
7. Observe errors, lock waits, payment/receipt counts, and financial totals
   before starting Release Batch 2.

Do not deploy the application before the additive migration. Do not apply any
enforcement migration in this batch.

## Compatibility contract

- Old application with the new schema: supported. The migration only creates
  new objects and nullable columns.
- New application with the new schema: supported and tested.
- New application with the old schema: intentionally unsupported; the new
  services require the idempotency and sequence tables. This is why the
  migration runs first.

If the application deployment fails after migration, restore the previous
application version and leave `0038` applied. The old application ignores the
additive objects. Do not delete correction links, sequence rows, idempotency
records, payments, receipts, invoices, or financial history as rollback.

## Local proof — 2026-07-15

- Production-mirror staging read-only ledger: 38 rows, exact ordered digest
  through `0037_absurd_shriek`; no shared remediation-tail migration applied.
- Fresh database migration: 39 ledger rows through the new `0038`; passed.
- Upgraded database: migrated with `origin/main` through `0037`, seeded with
  an existing booking/schedule/invoice/payment/receipt chain, then upgraded
  through the new `0038`; passed.
- Existing upgraded row counts and payment/receipt totals: unchanged.
- Fresh and upgraded schema-only PostgreSQL 18 dumps: identical.
- Old `origin/main` API against upgraded schema: 33 files, 194 tests passed.
- Batch 1 API against fresh schema: 57 files, 273 tests passed.
- Batch 1 API against upgraded schema: 57 files, 273 tests passed.
- API, database, and web type-checks: passed; web used the specified 6 GB Node
  heap.
- Drizzle generation after `0038`: no schema changes.

This is local release construction evidence, not staging deployment approval.
Before production, retain the staging migration duration, lock observations,
smoke-test results, starting/ending ledger, exact application SHA, and
before/after financial counts in the release record.

## Roll-forward response

- Preflight failure: stop; do not migrate or alter the ledger.
- Migration failure: retain the database error and transaction state; repair
  only with a reviewed forward migration.
- Migration succeeds but application fails: return to the old application;
  keep the additive schema.
- New application exposes a data inconsistency: stop the batch, preserve all
  financial history, run report-only diagnostics, and prepare a reviewed
  forward correction. Do not continue to Batch 2.
