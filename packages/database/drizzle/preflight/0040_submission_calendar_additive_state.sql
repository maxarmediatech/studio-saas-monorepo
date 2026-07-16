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
	row_count = 40
	AND latest_created_at = 1784134483742
	AND latest_hash = '12fb5bf3c004a84338de755750c20daea4a52948e44ed0d66b8cd2233f33c42e'
	AND ledger_digest = '6defd8f405654841b7cefad72d5a9791'
	AND to_regclass('public.calendar_delivery_intents') IS NULL
	AND to_regclass('public.calendar_route_changes') IS NULL
	AND to_regclass('public.calendar_sync_jobs_active_delivery_key_idx') IS NULL
	AND to_regclass('public.google_calendar_connections_active_org_user_idx') IS NULL
	AND to_regclass('public.google_calendar_connections_org_user_version_idx') IS NULL
	AND to_regclass('public.shoot_calendar_events_org_shoot_crew_idx') IS NULL
	AND to_regclass('public.google_calendar_connections_org_user_idx') IS NOT NULL
	AND to_regclass('public.shoot_calendar_events_shoot_crew_idx') IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND (
				(table_name = 'assignment_submissions' AND column_name = 'review_claimed_at')
				OR (
					table_name = 'calendar_sync_jobs'
					AND column_name IN (
						'delivery_key',
						'intent_id',
						'generation',
						'claim_token',
						'effect_state',
						'provider_result',
						'compensation_sequence'
					)
				)
				OR (
					table_name = 'google_calendar_connections'
					AND column_name IN ('version', 'revoked_at')
				)
				OR (
					table_name = 'shoot_calendar_events'
					AND column_name IN (
						'delivery_sync_status',
						'delivery_last_error',
						'cancellation_sync_status',
						'cancellation_last_error',
						'intent_generation',
						'intent_state',
						'delivered_generation',
						'delivered_delivery_method',
						'delivered_recipient_email',
						'delivered_calendar_id',
						'delivered_google_event_id',
						'delivered_ical_uid',
						'delivered_ical_sequence'
					)
				)
			)
	)
	AND NOT EXISTS (
		SELECT 1
		FROM pg_enum
		JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
		JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
		WHERE pg_namespace.nspname = 'public'
			AND pg_type.typname IN (
				'calendar_delivery_method',
				'calendar_event_sync_status'
			)
			AND pg_enum.enumlabel = 'unsendable'
	) AS release3_ledger_preflight_ok
FROM ledger
\gset

\if :release3_ledger_preflight_ok
	\echo 'Release Batch 3 ledger preflight passed: exact Batch 2 ledger and no partial submission/calendar state.'
\else
	\echo 'Release Batch 3 ledger preflight failed: expected exact Batch 2 state and no Batch 3 objects. Stop and investigate.'
	SELECT 1 / 0 AS release3_ledger_preflight_abort;
\endif

COMMIT;
