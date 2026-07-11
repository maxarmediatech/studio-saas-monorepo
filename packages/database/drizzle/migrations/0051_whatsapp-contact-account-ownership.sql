DO $$
DECLARE
	unsafe_count integer;
BEGIN
	WITH organization_accounts AS (
		SELECT organization_id, min(id) AS account_id, count(*) AS account_count
		FROM wa_accounts
		GROUP BY organization_id
	), prospective AS (
		SELECT c.id, c.wa_id, a.account_id, a.account_count
		FROM wa_contacts c
		LEFT JOIN organization_accounts a ON a.organization_id = c.organization_id
		WHERE c.account_id IS NULL
	), duplicate_identities AS (
		SELECT account_id, wa_id
		FROM prospective
		WHERE account_count = 1
		GROUP BY account_id, wa_id
		HAVING count(*) > 1
	)
	SELECT count(*) INTO unsafe_count
	FROM prospective p
	WHERE p.account_count IS DISTINCT FROM 1
		OR EXISTS (
			SELECT 1 FROM duplicate_identities d
			WHERE d.account_id = p.account_id AND d.wa_id = p.wa_id
		);

	IF unsafe_count > 0 THEN
		RAISE EXCEPTION USING
			MESSAGE = format(
				'WhatsApp contact ownership preflight failed for %s NULL-account contact(s). Assign an unambiguous account and resolve prospective duplicate wa_id values before migration 0051.',
				unsafe_count
			);
	END IF;
END $$;
--> statement-breakpoint
UPDATE wa_contacts AS contact
SET account_id = account.id
FROM (
	SELECT organization_id, min(id) AS id
	FROM wa_accounts
	GROUP BY organization_id
	HAVING count(*) = 1
) AS account
WHERE contact.account_id IS NULL
	AND contact.organization_id = account.organization_id;
--> statement-breakpoint
ALTER TABLE "wa_contacts" ALTER COLUMN "account_id" SET NOT NULL;
