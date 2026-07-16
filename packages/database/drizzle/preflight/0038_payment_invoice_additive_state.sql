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
	row_count = 38
	AND latest_created_at = 1776854799932
	AND latest_hash = '988d181605780021427919c7c28b4bddf32eccb2b039e19475cb866a6a988362'
	AND ledger_digest = 'd9c6257a2de66871dd511a4c347a2261'
	AND to_regclass('public.payment_idempotency_records') IS NULL
	AND to_regclass('public.document_sequences') IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'received_amounts'
			AND column_name IN (
				'replaces_payment_id',
				'replacement_payment_id',
				'reversed_at',
				'reversed_by',
				'reversal_reason'
			)
	) AS release1_preflight_ok
FROM ledger
\gset

\if :release1_preflight_ok
	\echo 'Release Batch 1 preflight passed: exact shared ledger through 0037 and no partial additive state.'
\else
	\echo 'Release Batch 1 preflight failed: expected the exact shared 0037 ledger and no Batch 1 objects. Stop and investigate.'
	SELECT 1 / 0 AS release1_preflight_abort;
\endif

COMMIT;
