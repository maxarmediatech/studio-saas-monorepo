\set ON_ERROR_STOP on

BEGIN READ ONLY;

WITH organization_accounts AS (
	SELECT organization_id,
		min(id) AS account_id,
		count(*)::int AS account_count
	FROM wa_accounts
	GROUP BY organization_id
), prospective_null_contacts AS (
	SELECT contact.id,
		contact.organization_id,
		contact.wa_id,
		organization_accounts.account_id AS target_account_id,
		coalesce(organization_accounts.account_count, 0) AS account_count
	FROM wa_contacts AS contact
	LEFT JOIN organization_accounts
		ON organization_accounts.organization_id = contact.organization_id
	WHERE contact.account_id IS NULL
), prospective_identities AS (
	SELECT id, account_id, wa_id
	FROM wa_contacts
	WHERE account_id IS NOT NULL
	UNION ALL
	SELECT id, target_account_id, wa_id
	FROM prospective_null_contacts
	WHERE account_count = 1
), prospective_identity_counts AS (
	SELECT account_id, wa_id, count(*)::int AS identity_count
	FROM prospective_identities
	WHERE account_id IS NOT NULL
	GROUP BY account_id, wa_id
), unsafe_null_contacts AS (
	SELECT prospective.id
	FROM prospective_null_contacts AS prospective
	LEFT JOIN prospective_identity_counts AS identity_counts
		ON identity_counts.account_id = prospective.target_account_id
		AND identity_counts.wa_id = prospective.wa_id
	WHERE prospective.account_count <> 1
		OR coalesce(identity_counts.identity_count, 0) <> 1
), blockers AS (
	SELECT id::text AS identity FROM unsafe_null_contacts
	UNION ALL
	SELECT contact.id::text
	FROM wa_contacts AS contact
	LEFT JOIN wa_accounts AS account ON account.id = contact.account_id
	WHERE contact.account_id IS NOT NULL
		AND (
			account.id IS NULL
			OR account.organization_id <> contact.organization_id
		)
	UNION ALL
	SELECT min(id)::text
	FROM wa_contacts
	WHERE account_id IS NOT NULL
	GROUP BY account_id, wa_id
	HAVING count(*) > 1
	UNION ALL
	SELECT min(id)::text
	FROM wa_messages
	WHERE provider_message_id IS NOT NULL
	GROUP BY account_id, provider_message_id
	HAVING count(*) > 1
	UNION ALL
	SELECT min(id)::text
	FROM wa_outbox
	GROUP BY message_id
	HAVING count(*) > 1
	UNION ALL
	SELECT outbox.id::text
	FROM wa_outbox AS outbox
	LEFT JOIN wa_messages AS message ON message.id = outbox.message_id
	WHERE message.id IS NULL
		OR outbox.organization_id <> message.organization_id
		OR outbox.account_id <> message.account_id
), ledger AS (
	SELECT count(*) AS row_count,
		max(created_at) AS latest_created_at,
		(array_agg(hash ORDER BY created_at DESC))[1] AS latest_hash,
		md5(string_agg(hash, ',' ORDER BY created_at)) AS ledger_digest
	FROM drizzle.__drizzle_migrations
), processing_outbox AS (
	SELECT count(*) AS row_count
	FROM wa_outbox
	WHERE status = 'processing'
), schema_state AS (
	SELECT is_nullable
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'wa_contacts'
		AND column_name = 'account_id'
)
SELECT ledger.row_count = 42
	AND ledger.latest_created_at = 1784136606186
	AND ledger.latest_hash = '6699c731ee9069f3750dccc962b66834fd14ee74a9ff86a08fce43dc89b9a69a'
	AND ledger.ledger_digest = 'c9d1ba546f73e265e7033dcbac3c2009'
	AND (SELECT count(*) FROM blockers) = 0
	AND processing_outbox.row_count = 0
	AND schema_state.is_nullable = 'YES'
	AND to_regclass('public.wa_contacts_account_wa_id_idx') IS NULL
	AND to_regclass('public.wa_messages_account_provider_message_id_idx') IS NULL
	AND to_regclass('public.wa_outbox_message_id_idx') IS NULL
	AS release5_preflight_ok
FROM ledger
CROSS JOIN processing_outbox
CROSS JOIN schema_state
\gset

\if :release5_preflight_ok
	\echo 'Release Batch 5 preflight passed: exact Batch 4 ledger, no manual identity blockers, drained outbox dispatches, and no partial enforcement.'
\else
	\echo 'Release Batch 5 preflight failed. Run "pnpm whatsapp:migration-preflight --all-organizations", complete reviewed one-off cleanup, drain the worker, and verify the exact Batch 4 ledger.'
	SELECT organization_id,
		count(*) AS processing_count,
		min(last_attempt_at) AS oldest_attempt_at
	FROM wa_outbox
	WHERE status = 'processing'
	GROUP BY organization_id
	ORDER BY organization_id;
	SELECT 1 / 0 AS release5_preflight_abort;
\endif

COMMIT;
