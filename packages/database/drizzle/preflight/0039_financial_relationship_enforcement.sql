\set ON_ERROR_STOP on

BEGIN READ ONLY;

WITH ledger AS (
	SELECT
		count(*) AS row_count,
		max(created_at) AS latest_created_at,
		(array_agg(hash ORDER BY created_at DESC))[1] AS latest_hash,
		md5(string_agg(hash, ',' ORDER BY created_at)) AS ledger_digest
	FROM drizzle.__drizzle_migrations
)
SELECT
	row_count = 39
	AND latest_created_at = 1784133515996
	AND latest_hash = '983bf84f5d43669b1541eb64d0b85ab132c52b76a4661898ba0acf6ecca895ad'
	AND ledger_digest = '16e57939b760c5ecb252c266b55f2e50'
	AND to_regclass('public.invoices_active_payment_schedule_idx') IS NULL
	AND to_regclass('public.receipts_active_received_amount_idx') IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM pg_trigger
		WHERE NOT tgisinternal
			AND tgname IN (
				'payment_schedules_financial_relationship_guard',
				'invoices_financial_relationship_guard',
				'received_amounts_financial_relationship_guard',
				'receipts_financial_relationship_guard',
				'received_amounts_relationship_closure_guard',
				'invoices_payment_relationship_closure_guard'
			)
	) AS release2_ledger_preflight_ok
FROM ledger
\gset

\if :release2_ledger_preflight_ok
	\echo 'Release Batch 2 ledger preflight passed: exact Batch 1 ledger and no partial enforcement state.'
\else
	\echo 'Release Batch 2 ledger preflight failed: expected exact Batch 1 state and no enforcement objects. Stop and investigate.'
	SELECT 1 / 0 AS release2_ledger_preflight_abort;
\endif

COMMIT;
