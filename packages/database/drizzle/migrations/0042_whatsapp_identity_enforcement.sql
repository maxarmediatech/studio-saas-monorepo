LOCK TABLE wa_accounts, wa_contacts, wa_messages, wa_outbox
IN SHARE ROW EXCLUSIVE MODE;--> statement-breakpoint
DO $$
DECLARE
	blocking_count integer;
BEGIN
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
	)
	SELECT count(*) INTO blocking_count FROM blockers;

	IF blocking_count > 0 THEN
		RAISE EXCEPTION USING MESSAGE = format(
			'WhatsApp identity enforcement blocked by %s manual condition(s). Run "pnpm whatsapp:migration-preflight --all-organizations", complete reviewed one-off cleanup, and retry migration 0042.',
			blocking_count
		);
	END IF;
END $$;--> statement-breakpoint
WITH organization_accounts AS (
	SELECT organization_id, min(id) AS account_id
	FROM wa_accounts
	GROUP BY organization_id
	HAVING count(*) = 1
)
UPDATE wa_contacts AS contact
SET account_id = organization_accounts.account_id
FROM organization_accounts
WHERE contact.account_id IS NULL
	AND organization_accounts.organization_id = contact.organization_id;--> statement-breakpoint
DO $$
DECLARE
	verification_count integer;
BEGIN
	WITH blockers AS (
		SELECT id::text AS identity
		FROM wa_contacts
		WHERE account_id IS NULL
		UNION ALL
		SELECT contact.id::text
		FROM wa_contacts AS contact
		LEFT JOIN wa_accounts AS account ON account.id = contact.account_id
		WHERE account.id IS NULL
			OR account.organization_id <> contact.organization_id
		UNION ALL
		SELECT min(id)::text
		FROM wa_contacts
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
	)
	SELECT count(*) INTO verification_count FROM blockers;

	IF verification_count > 0 THEN
		RAISE EXCEPTION
			'WhatsApp identity enforcement verification failed. Run "pnpm whatsapp:migration-preflight --all-organizations" and do not bypass migration 0042.';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "wa_contacts" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "wa_contacts_account_wa_id_idx" ON "wa_contacts" USING btree ("account_id","wa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_messages_account_provider_message_id_idx" ON "wa_messages" USING btree ("account_id","provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_outbox_message_id_idx" ON "wa_outbox" USING btree ("message_id");
