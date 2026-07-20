\set ON_ERROR_STOP on

BEGIN READ ONLY;

WITH ledger AS (
	SELECT
		count(*) AS row_count,
		max(created_at) AS latest_created_at,
		(array_agg(hash ORDER BY created_at DESC))[1] AS latest_hash,
		md5(string_agg(hash, ',' ORDER BY created_at)) AS ledger_digest
	FROM drizzle.__drizzle_migrations
), two_factor_columns AS (
	SELECT count(*) AS column_count
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'two_factors'
		AND column_name IN (
			'verified',
			'failed_verification_count',
			'locked_until'
		)
)
SELECT
	ledger.row_count = 45
	AND ledger.latest_created_at = 1784139529495
	AND ledger.latest_hash = '3f799314296b54d07e5b02eedd70172158c2f991e4844d03a333f4eb8d43f063'
	AND ledger.ledger_digest = 'eebcacc31ed455fc76d53a8113fb29d9'
	AND two_factor_columns.column_count = 0
		AS better_auth_1_6_preflight_ok
FROM ledger
CROSS JOIN two_factor_columns
\gset

\if :better_auth_1_6_preflight_ok
	\echo 'Better Auth 1.6 preflight passed: exact 0044 ledger and no partial two-factor lockout schema.'
\else
	\echo 'Better Auth 1.6 preflight failed: expected the exact 0044 ledger and no lockout columns. Stop and investigate.'
	SELECT 1 / 0 AS better_auth_1_6_preflight_abort;
\endif

COMMIT;
