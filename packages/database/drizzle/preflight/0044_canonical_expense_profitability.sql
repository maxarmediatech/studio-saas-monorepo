\set ON_ERROR_STOP on

BEGIN READ ONLY;

WITH ledger AS (
	SELECT
		count(*) AS row_count,
		max(created_at) AS latest_created_at,
		(array_agg(hash ORDER BY created_at DESC))[1] AS latest_hash,
		md5(string_agg(hash, ',' ORDER BY created_at)) AS ledger_digest
	FROM drizzle.__drizzle_migrations
), billing_columns AS (
	SELECT count(*) AS column_count
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'organizations'
		AND column_name IN (
			'billing_seat_count',
			'billing_seat_synced_at',
			'billing_seat_sync_error'
		)
)
SELECT
	ledger.row_count = 44
	AND ledger.latest_created_at = 1784139517465
	AND ledger.latest_hash = 'f1a53f44017b75b87fd14b90d4f0936ef51c5d96c8bb40131d18ef5b234133d8'
	AND ledger.ledger_digest = '2f90a6c8a20ad9745bdcc3e89b9e1208'
	AND billing_columns.column_count = 3
		AS release6_expense_preflight_ok
FROM ledger
CROSS JOIN billing_columns
\gset

\if :release6_expense_preflight_ok
	\echo 'Release Batch 6 expense preflight passed: exact additive ledger and all billing reconciliation columns exist.'
\else
	\echo 'Release Batch 6 expense preflight failed: expected the exact 0043 ledger and complete additive billing schema. Stop and investigate.'
	SELECT 1 / 0 AS release6_expense_preflight_abort;
\endif

WITH allocation_rows AS (
	SELECT
		coalesce(ea.booking_id, s.booking_id) AS booking_id,
		CASE
			WHEN e.id IS NULL THEN 0
			WHEN ea.allocation_amount IS NOT NULL THEN ea.allocation_amount
			WHEN ea.allocation_percentage IS NOT NULL
				THEN e.amount * ea.allocation_percentage / 100
			ELSE e.amount
		END AS allocated_amount
	FROM expense_assignments AS ea
	LEFT JOIN shoots AS s
		ON s.id = ea.shoot_id
		AND s.deleted_at IS NULL
	LEFT JOIN expenses AS e
		ON e.id = ea.expense_id
		AND e.deleted_at IS NULL
), canonical AS (
	SELECT
		b.id,
		b.organization_id,
		b.total_expenses AS stored_total,
		coalesce(sum(allocation_rows.allocated_amount), 0) AS canonical_total
	FROM bookings AS b
	LEFT JOIN allocation_rows ON allocation_rows.booking_id = b.id
	GROUP BY b.id, b.organization_id, b.total_expenses
), mismatches AS (
	SELECT *
	FROM canonical
	WHERE stored_total IS DISTINCT FROM canonical_total
)
SELECT
	organization_id,
	count(*) AS mismatch_count,
	coalesce(sum(stored_total), 0) AS stored_total,
	coalesce(sum(canonical_total), 0) AS canonical_total
FROM mismatches
GROUP BY organization_id
ORDER BY organization_id;

COMMIT;
