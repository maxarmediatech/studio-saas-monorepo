\set ON_ERROR_STOP on

BEGIN READ ONLY;

WITH ledger AS (
	SELECT
		count(*) AS row_count,
		max(created_at) AS latest_created_at,
		(array_agg(hash ORDER BY created_at DESC))[1] AS latest_hash,
		md5(string_agg(hash, ',' ORDER BY created_at)) AS ledger_digest
	FROM drizzle.__drizzle_migrations
), processing_outbox AS (
	SELECT count(*) AS row_count
	FROM wa_outbox
	WHERE status = 'processing'
)
SELECT
	ledger.row_count = 41
	AND ledger.latest_created_at = 1784135676915
	AND ledger.latest_hash = 'e62798d94efd7cdb0321112b9d1b67c1d3b2cd0479bdc22895c28b734f3ebf6b'
	AND ledger.ledger_digest = '5efd64bb2f3ea3c5815606b938351cc5'
	AND processing_outbox.row_count = 0
	AND to_regclass('public.wa_automation_actions') IS NULL
	AND to_regclass('public.wa_automation_runs') IS NULL
	AND to_regclass('public.wa_campaign_recipients') IS NULL
	AND to_regclass('public.wa_manual_send_idempotency') IS NULL
	AND to_regclass('public.wa_templates') IS NULL
	AND to_regprocedure('public.wa_events_preserve_retryable_failures()') IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM pg_trigger
		WHERE tgname = 'wa_events_preserve_retryable_failures_trigger'
			AND NOT tgisinternal
	)
	AND to_regclass('public.wa_contacts_account_wa_id_idx') IS NULL
	AND to_regclass('public.wa_messages_account_provider_message_id_idx') IS NULL
	AND to_regclass('public.wa_outbox_message_id_idx') IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns AS columns
		JOIN (
			VALUES
				('wa_accounts', 'api_version'),
				('wa_accounts', 'app_secret'),
				('wa_accounts', 'verified_name'),
				('wa_accounts', 'quality_rating'),
				('wa_accounts', 'messaging_limit_tier'),
				('wa_accounts', 'last_validated_at'),
				('wa_media', 'ingest_status'),
				('wa_media', 'ingest_attempts'),
				('wa_media', 'last_ingest_attempt_at'),
				('wa_media', 'next_ingest_attempt_at'),
				('wa_media', 'ingest_locked_by'),
				('wa_media', 'ingest_lease_expires_at'),
				('wa_media', 'ingest_error_message'),
				('wa_messages', 'sent_by_campaign_id'),
				('wa_messages', 'campaign_recipient_id'),
				('wa_messages', 'automation_action_id'),
				('wa_events', 'processing_status'),
				('wa_events', 'attempts'),
				('wa_events', 'max_attempts'),
				('wa_events', 'last_attempt_at'),
				('wa_events', 'next_attempt_at'),
				('wa_events', 'locked_by'),
				('wa_events', 'lease_expires_at'),
				('wa_outbox', 'locked_by'),
				('wa_outbox', 'lease_expires_at'),
				('wa_outbox', 'dispatch_started_at'),
				('wa_outbox', 'dispatch_token'),
				('wa_campaigns', 'audience_captured_at'),
				('wa_campaigns', 'total_recipients'),
				('wa_campaigns', 'total_queued'),
				('wa_campaigns', 'total_suppressed'),
				('wa_campaigns', 'total_delivery_unknown')
		) AS expected(table_name, column_name)
			ON expected.table_name = columns.table_name
			AND expected.column_name = columns.column_name
		WHERE columns.table_schema = 'public'
	)
	AND NOT EXISTS (
		SELECT 1
		FROM pg_type
		JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
		WHERE pg_namespace.nspname = 'public'
			AND pg_type.typname IN (
				'wa_automation_action_status',
				'wa_automation_run_status',
				'wa_campaign_recipient_status',
				'wa_media_ingest_status'
			)
	)
	AND NOT EXISTS (
		SELECT 1
		FROM pg_enum
		JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
		JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
		WHERE pg_namespace.nspname = 'public'
			AND pg_enum.enumlabel IN ('suppressed', 'delivery_unknown')
			AND pg_type.typname IN ('wa_message_status', 'wa_outbox_status')
	) AS release4_preflight_ok
FROM ledger
CROSS JOIN processing_outbox
\gset

\if :release4_preflight_ok
	\echo 'Release Batch 4 preflight passed: exact Batch 3 ledger, drained outbox dispatches, and no partial WhatsApp additive state.'
\else
	\echo 'Release Batch 4 preflight failed: expected exact Batch 3 state, no partial WhatsApp objects, and zero processing outbox rows. Stop and investigate.'
	SELECT
		organization_id,
		count(*) AS processing_count,
		min(last_attempt_at) AS oldest_attempt_at
	FROM wa_outbox
	WHERE status = 'processing'
	GROUP BY organization_id
	ORDER BY organization_id;
	SELECT 1 / 0 AS release4_preflight_abort;
\endif

COMMIT;
