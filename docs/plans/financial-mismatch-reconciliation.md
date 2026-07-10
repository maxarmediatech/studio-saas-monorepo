# Financial Mismatch Reconciliation

> **Read when:** running or changing the Phase 0.3 financial mismatch report, safe repair boundaries, or finance decision records.

## Command

Run against one organization at a time. The organization scope is mandatory so a report cannot accidentally mix tenant data.

```bash
pnpm --filter @repo/scripts financial-reconciliation -- \
  --organization-id <organization-id> --report

pnpm --filter @repo/scripts financial-reconciliation -- \
  --organization-id <organization-id> --fix-safe
```

`--as-of YYYY-MM-DD` is optional and makes invoice status evaluation repeatable. The report emits deterministic, sorted JSON. Exit code `1` means actionable mismatches remain; exit code `0` means none remain; exit code `2` means the command could not run.

Flag values are mandatory when their flag is present, unknown/duplicate flags are rejected, and `--as-of` must be a real calendar date (not only date-shaped text).

## Verification

The PostgreSQL integration test is skipped unless
`POSTGRES_RECONCILIATION_DATABASE_URL` points to an isolated, fully migrated
database. The test creates a uniquely named organization and cascading fixtures,
runs both `--report` and `--fix-safe`, verifies persisted repairs and invoice-link
disagreement detection, then deletes the organization. Never point this variable
at production.

```bash
POSTGRES_RECONCILIATION_DATABASE_URL=postgresql://... \
  pnpm --filter @repo/scripts test
```

## Taxonomy

The report emits exactly these `mismatchType` values:

1. `booking_total_vs_active_payments`
2. `schedule_total_vs_assigned_active_payments`
3. `invoice_paid_status_vs_valid_applications`
4. `receipt_payment_amount_mismatch`
5. `active_receipt_for_deleted_payment`
6. `cross_entity_booking_org_disagreement`
7. `duplicate_active_receipts_per_payment`
8. `duplicate_invoices_per_schedule`

All SQL is organization-scoped, joins compare organization and booking ownership, and active-record calculations exclude soft-deleted rows. Receipt/payment checks also compare their invoice IDs, so records tied to different invoices are manual-review mismatches even when organization and booking agree. The report includes the evidence IDs and expected/actual values needed for review.

## Safe-fix boundary

`--fix-safe` recalculates only cached booking totals, schedule paid amounts, and invoice paid amount/status when all linked active payments have valid organization and booking links. Cancelled schedules/invoices and ambiguous draft invoices are review-only. Receipt amounts, deleted-payment receipts, cross-entity links, and duplicate issued documents are never changed by this command.

The command re-checks the ownership guards inside one database transaction before updating. It returns before/after reports and the IDs of applied safe fixes.

## Approved decision record

Manual decisions use the JSON shape in [financial-mismatch-decision-template.json](./financial-mismatch-decision-template.json). Every record must include the date, decider, evidence, options, rationale, consequences, revisit condition, mismatch IDs, and intended action. A decision record documents approval; it does not authorize this Phase 0.3 command to mutate issued-document history.
