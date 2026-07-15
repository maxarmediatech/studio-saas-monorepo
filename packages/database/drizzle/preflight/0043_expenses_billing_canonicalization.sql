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
	ledger.row_count = 43
	AND ledger.latest_created_at = 1784138577327
	AND ledger.latest_hash = '2da65c47ac692d091ed7f40e479697aa1e4707ceda4a6fae5b9be0ac1ff8263c'
	AND ledger.ledger_digest = '9323b3681d619cb16b845e538ca8b6d6'
	AND billing_columns.column_count = 0
		AS release6_additive_preflight_ok
FROM ledger
CROSS JOIN billing_columns
\gset

\if :release6_additive_preflight_ok
	\echo 'Release Batch 6 additive preflight passed: exact Batch 5 ledger and no partial billing schema.'
\else
	\echo 'Release Batch 6 additive preflight failed: expected exact Batch 5 ledger and no billing reconciliation columns. Stop and investigate.'
	SELECT 1 / 0 AS release6_additive_preflight_abort;
\endif

COMMIT;
