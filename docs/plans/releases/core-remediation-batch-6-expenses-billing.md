# Core remediation Release Batch 6 — expenses and billing

> **Read when:** reviewing, rehearsing, or deploying
> `codex/core-remediation-release-6-expenses-billing`.

## Scope

This branch builds on Release Batch 5 commit `a94a754c`. It contains the
reviewed expense and billing changes plus the final reconstructed migrations:

- `0043_expenses_billing_canonicalization.sql`
  - SHA-256: `f1a53f44017b75b87fd14b90d4f0936ef51c5d96c8bb40131d18ef5b234133d8`
  - adds billing seat count, last-success time, and actionable error state;
- `0044_canonical_expense_profitability.sql`
  - SHA-256: `3f799314296b54d07e5b02eedd70172158c2f991e4844d03a333f4eb8d43f063`
  - rebuilds booking expense totals from the canonical allocation ledger while
    expense writes and the booking cache are locked.

Runtime expense creation, amount updates, and deletion now rebuild affected
booking totals transactionally. Direct booking allocations and shoot
allocations both roll up to the booking; crew-only costs remain organization
overhead. Billing seat changes use the current member count only for catalog
prices explicitly marked seat-based, record success/failure, and can be
reconciled again with `pnpm subscriptions:reconcile-seats`.

## Required order

1. Record the Batch 5 application SHA, a recoverable backup/snapshot, and the
   exact starting ledger: 43 rows; latest migration time `1784138577327`;
   latest hash
   `2da65c47ac692d091ed7f40e479697aa1e4707ceda4a6fae5b9be0ac1ff8263c`;
   ordered digest `9323b3681d619cb16b845e538ca8b6d6`.
2. Run the exact read-only additive gate:

   ```bash
   PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000' \
     psql "$DATABASE_URL" -X -f \
     packages/database/drizzle/preflight/0043_expenses_billing_canonicalization.sql
   ```

3. Apply `0043` from the controlled release runner. Verify 44 ledger rows;
   latest time `1784139517465`; latest hash
   `f1a53f44017b75b87fd14b90d4f0936ef51c5d96c8bb40131d18ef5b234133d8`;
   ordered digest `2f90a6c8a20ad9745bdcc3e89b9e1208`; and all three
   `billing_seat_*` columns.
4. Deploy the Batch 6 application. Smoke expense create/update/delete against
   direct booking and shoot allocations. With an approved non-production
   billing organization, add/remove a member and verify provider quantity,
   cached count, success time, and cleared error.
5. Pause expense mutations. Run the read-only projection report and retain its
   per-organization counts/totals:

   ```bash
   PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000' \
     psql "$DATABASE_URL" -X -f \
     packages/database/drizzle/preflight/0044_canonical_expense_profitability.sql
   ```

   These are derived booking-cache mismatches only; `0044` is the approved
   taxonomy-safe repair. Unexpected ownership/allocation evidence is not
   repaired by this migration and requires a separate decision record.
6. Apply `0044` once. Measure lock wait and duration. Verify 45 ledger rows;
   latest time `1784139529495`; latest hash
   `3f799314296b54d07e5b02eedd70172158c2f991e4844d03a333f4eb8d43f063`;
   ordered digest `eebcacc31ed455fc76d53a8113fb29d9`.
7. Re-run the canonical comparison query from the `0044` preflight and require
   zero rows. Resume expense writes and repeat the expense smoke test.
8. With separate approval for provider writes, run
   `pnpm subscriptions:reconcile-seats`. Retain its synced/skipped/failed
   summary; require zero failures, then investigate every organization with a
   non-null `billing_seat_sync_error`. Never run this command merely as a
   read-only preflight: it changes provider subscription quantities.
9. Observe booking-total drift, migration lock time, seat sync errors, member
   counts, and provider quantities before production approval.

## Compatibility and roll-forward

- Batch 5 application on the Batch 6 schema is supported: `0043` is additive
  and `0044` only repairs a derived cache.
- Deploy `0043` before the Batch 6 application. The new expense code needs no
  new schema, but billing success/error recording requires the additive
  columns. Batch 6 application on the `0043` schema is supported while `0044`
  is pending.
- If `0043` fails, stop and investigate the exact ledger/partial-schema state.
  Do not manually mark it applied.
- If `0044` waits too long, cancel before acquisition, keep expense writes
  paused, inspect blockers, and retry. If it aborts, its transaction leaves the
  previous cache and ledger intact. If it succeeds, roll forward; do not restore
  stale booking totals.
- A seat provider failure does not roll back membership. It records an error
  and the same desired member count can be applied by the repeatable
  reconciliation command.

## Local proof — 2026-07-15

- Exact Batch 5 additive preflight passed; generated `0043` reached the exact
  44-row ledger above.
- The expense report found a deliberate synthetic mismatch (`999.00` stored,
  `200.00` canonical), including proof that a soft-deleted shoot allocation is
  not counted as live. `0044` repaired it to `200.00` and reached the exact
  45-row ledger above.
- Fresh and Batch-5-upgraded PostgreSQL 18 databases produced identical
  normalized schema dumps.
- The complete API suite passed 369 tests with 1 intentional skip, including
  the expense concurrency and billing ownership cases. Billing seat tests
  passed 3/3, scripts passed 43 tests, WhatsApp worker passed 12/12, and
  Calendar worker passed 4/4.
- API, auth, database, scripts, and web type-checks passed. Drizzle history,
  changed-source Biome, and `git diff --check` passed. The additive preflight
  also hard-aborted against a deliberately wrong final-ledger/partial-state
  target.

No provider seat mutation, staging write, production read/write, deployment,
push, or PR was performed. This is local release-construction evidence, not
production release approval. Staging must retain the actual backup reference,
preflight output, application SHAs, migration/lock timings, expense before/after
totals, seat provider IDs/results, and smoke evidence before production review.
