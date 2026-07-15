\set ON_ERROR_STOP on

BEGIN READ ONLY;

WITH ledger AS (
	SELECT
		count(*) AS row_count,
		max(created_at) AS latest_created_at,
		(array_agg(hash ORDER BY created_at DESC))[1] AS latest_hash,
		md5(string_agg(hash, ',' ORDER BY created_at)) AS ledger_digest
	FROM drizzle.__drizzle_migrations
), legacy_open_jobs AS (
	SELECT count(*) AS row_count
	FROM calendar_sync_jobs
	WHERE intent_id IS NULL
		AND status <> 'completed'
)
SELECT
	ledger.row_count = 41
	AND ledger.latest_created_at = 1784135676915
	AND ledger.latest_hash = 'e62798d94efd7cdb0321112b9d1b67c1d3b2cd0479bdc22895c28b734f3ebf6b'
	AND ledger.ledger_digest = '5efd64bb2f3ea3c5815606b938351cc5'
	AND legacy_open_jobs.row_count = 0 AS release3_cutover_ok
FROM ledger
CROSS JOIN legacy_open_jobs
\gset

\if :release3_cutover_ok
	\echo 'Release Batch 3 cutover preflight passed: exact 0040 ledger and no unfinished legacy calendar jobs.'
\else
	\echo 'Release Batch 3 cutover preflight failed: stop the cutover and inspect the ledger or unfinished legacy jobs below.'
	SELECT
		organization_id,
		status,
		job_type,
		count(*) AS job_count,
		min(created_at) AS oldest_created_at
	FROM calendar_sync_jobs
	WHERE intent_id IS NULL
		AND status <> 'completed'
	GROUP BY organization_id, status, job_type
	ORDER BY organization_id, status, job_type;
	SELECT 1 / 0 AS release3_cutover_abort;
\endif

COMMIT;
