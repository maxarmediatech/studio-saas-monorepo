# Core remediation Release Batch 2 — financial reports and enforcement

> **Read when:** reviewing, rehearsing, or deploying
> `codex/core-remediation-release-2-financial-enforcement`.

## Scope

This branch builds on Release Batch 1 commit `92cf7c7b`. It adds the
organization-scoped financial reconciliation report, conservative
`--fix-safe` projection repair, a global report-only migration preflight, and:

- `0039_financial_relationship_enforcement.sql`
- SHA-256: `12fb5bf3c004a84338de755750c20daea4a52948e44ed0d66b8cd2233f33c42e`

Migration `0039` adds active invoice/schedule and receipt/payment uniqueness,
cross-organization/booking relationship guards, and invoice/schedule/payment
closure guards. It contains no automatic data repair.

## Required order

1. Record the Batch 1 application SHA, database ledger, and backup/snapshot.
2. Deploy this branch's application and scripts while the database remains at
   `0038`. Payment runtime behavior is unchanged from Batch 1.
3. Run the global report-only gate with an explicit rehearsal date and retain
   its JSON output:

   ```bash
   pnpm financial:migration-preflight --as-of YYYY-MM-DD
   ```

4. If it exits `1`, inspect each reported organization with:

   ```bash
   pnpm --filter @repo/scripts financial-reconciliation \
     --organization-id <organization-id> --as-of YYYY-MM-DD --report
   ```

   `--fix-safe` may repair only report-classified projection/cache mismatches.
   Issuance history, ambiguous links, duplicates, terminal invoice history,
   and cross-tenant relationships require a reviewed decision record, backup,
   and one-off forward correction. There is no `--fix-approved` mode.

5. Repeat the global preflight until it reports every organization and exits
   `0` with zero mismatches.
6. Run the exact-ledger/no-partial-enforcement preflight:

   ```bash
   PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000' \
     psql "$DATABASE_URL" -X -f \
     packages/database/drizzle/preflight/0039_financial_relationship_enforcement.sql
   ```

7. Apply migration `0039` once from the controlled release runner.
8. Verify 40 ledger rows, both financial uniqueness indexes, and all six
   relationship triggers.
9. Re-run the global financial preflight and smoke-test payment creation,
   schedule conversion, correction, receipt issuance/voiding, and invoice
   mutation/finalization.
10. Observe database errors, lock waits, row counts, and financial totals
    before starting Release Batch 3.

Do not apply `0039` before deploying the compatible Batch 2 scripts and
reviewing a zero-mismatch report.

## Compatibility and roll-forward

- Batch 2 application with Batch 1 schema: supported for the reporting window.
- Batch 1 application with Batch 2 schema: supported for production runtime
  paths. It already derives and validates payment relationships.
- Direct legacy writes that create an invoice/schedule mismatch are
  intentionally rejected after enforcement.

If the pre-migration application deployment fails, return to Batch 1 and do
not migrate. If `0039` succeeds but the Batch 2 application fails, return to
Batch 1 application commit `92cf7c7b` and keep the enforcement migration. Do
not remove constraints, payments, receipts, invoices, corrections,
idempotency records, or document sequences as rollback.

Any unexpected enforcement failure requires a reviewed forward migration or
data decision. Never edit an applied SQL file or migration ledger row.

## Local proof — 2026-07-15

- Global preflight rejected three deliberately stale projection mismatches,
  `--fix-safe` repaired exactly those three, and the second global report was
  clean.
- Dirty upgraded database with two active invoices for one schedule: `0039`
  aborted before DDL, named `pnpm financial:migration-preflight`, retained the
  39-row ledger, and created no enforcement object.
- Clean fresh and Batch 1-upgraded databases: migrated through `0039`; schema
  dumps were identical.
- Enforcement objects: two uniqueness indexes and six triggers present.
- Batch 2 API: 59 files, 275 tests passed.
- Financial scripts: 22 tests passed, including real PostgreSQL report,
  terminal-history, relationship, and preflight coverage.
- Batch 1 production-path compatibility against Batch 2 schema: 10 files,
  15 tests passed.
- Batch 1 full suite: 272/273 passed; the excluded test directly inserts an
  invalid payment invoice/schedule pair to create a legacy fixture, and is
  correctly rejected by the new database guard before exercising its receipt
  assertion.
- API, database, and scripts type-checks: passed.

This is local release construction evidence. Staging must retain the real
report output, data decisions, migration duration, lock observations,
starting/ending ledger, application SHAs, smoke results, and before/after
financial totals before production approval.
