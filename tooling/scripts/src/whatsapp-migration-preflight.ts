export type WhatsAppIdentityIssueKind =
	| "contact_missing_account_safe_backfill"
	| "contact_missing_account_manual"
	| "contact_account_not_found"
	| "contact_account_organization_mismatch"
	| "contact_wa_id_duplicate"
	| "provider_message_id_duplicate"
	| "outbox_message_id_duplicate"
	| "outbox_message_not_found"
	| "outbox_message_ownership_mismatch";

export type WhatsAppIdentityIssue = {
	kind: WhatsAppIdentityIssueKind;
	repairability: "migration_safe" | "manual";
	organizationIds: string[];
	accountId: string | null;
	evidenceHash: string;
	rowIds: string[];
	count: number;
};

type RawWhatsAppIdentityIssue = Omit<WhatsAppIdentityIssue, "count"> & {
	count: number | string;
};

export type WhatsAppMigrationPreflightArguments = {
	organizationId: string | null;
	allOrganizations: boolean;
};

const argumentError = () =>
	new Error(
		"Use exactly one scope: --organization-id ORGANIZATION_ID or --all-organizations",
	);

export function parseWhatsAppMigrationPreflightArguments(
	args: string[],
): WhatsAppMigrationPreflightArguments {
	let organizationId: string | null = null;
	let allOrganizations = false;

	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--all-organizations") {
			if (allOrganizations) {
				throw argumentError();
			}
			allOrganizations = true;
			continue;
		}
		if (argument === "--organization-id") {
			const value = args[index + 1];
			if (!value || value.startsWith("--") || organizationId) {
				throw argumentError();
			}
			organizationId = value;
			index += 1;
			continue;
		}
		if (argument?.startsWith("--organization-id=")) {
			const value = argument.slice("--organization-id=".length);
			if (!value || value.startsWith("--") || organizationId) {
				throw argumentError();
			}
			organizationId = value;
			continue;
		}
		throw argumentError();
	}

	if (allOrganizations === Boolean(organizationId)) {
		throw argumentError();
	}
	return { organizationId, allOrganizations };
}

export async function queryWhatsAppIdentityIssues(options: {
	organizationId?: string | null;
}): Promise<WhatsAppIdentityIssue[]> {
	const { db, sql } = await import("@repo/database");
	const scope = options.organizationId
		? sql`${options.organizationId} = ANY(organization_ids)`
		: sql`TRUE`;
	const result = await db.execute<RawWhatsAppIdentityIssue>(sql`
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
			SELECT id, organization_id, account_id, wa_id
			FROM wa_contacts
			WHERE account_id IS NOT NULL
			UNION ALL
			SELECT id, organization_id, target_account_id, wa_id
			FROM prospective_null_contacts
			WHERE account_count = 1
		), prospective_identity_counts AS (
			SELECT account_id, wa_id, count(*)::int AS identity_count
			FROM prospective_identities
			WHERE account_id IS NOT NULL
			GROUP BY account_id, wa_id
		), classified_null_contacts AS (
			SELECT prospective.id,
				prospective.organization_id,
				prospective.target_account_id,
				CASE
					WHEN prospective.account_count = 1
						AND identity_counts.identity_count = 1
					THEN 'migration_safe'
					ELSE 'manual'
				END AS repairability
			FROM prospective_null_contacts AS prospective
			LEFT JOIN prospective_identity_counts AS identity_counts
				ON identity_counts.account_id = prospective.target_account_id
				AND identity_counts.wa_id = prospective.wa_id
		), issues AS (
			SELECT CASE
					WHEN repairability = 'migration_safe'
					THEN 'contact_missing_account_safe_backfill'
					ELSE 'contact_missing_account_manual'
				END AS kind,
				repairability,
				ARRAY[organization_id]::text[] AS organization_ids,
				target_account_id AS account_id,
				md5(string_agg(id::text, ',' ORDER BY id)) AS evidence_hash,
				array_agg(id ORDER BY id)::text[] AS row_ids,
				count(*)::int AS count
			FROM classified_null_contacts
			GROUP BY organization_id, target_account_id, repairability
			UNION ALL
			SELECT 'contact_account_not_found',
				'manual',
				ARRAY[contact.organization_id]::text[],
				contact.account_id,
				md5(string_agg(contact.id::text, ',' ORDER BY contact.id)),
				array_agg(contact.id ORDER BY contact.id)::text[],
				count(*)::int
			FROM wa_contacts AS contact
			LEFT JOIN wa_accounts AS account ON account.id = contact.account_id
			WHERE contact.account_id IS NOT NULL AND account.id IS NULL
			GROUP BY contact.organization_id, contact.account_id
			UNION ALL
			SELECT 'contact_account_organization_mismatch',
				'manual',
				ARRAY[contact.organization_id, account.organization_id]::text[],
				contact.account_id,
				md5(string_agg(contact.id::text, ',' ORDER BY contact.id)),
				array_agg(contact.id ORDER BY contact.id)::text[],
				count(*)::int
			FROM wa_contacts AS contact
			JOIN wa_accounts AS account ON account.id = contact.account_id
			WHERE account.organization_id <> contact.organization_id
			GROUP BY contact.organization_id, account.organization_id, contact.account_id
			UNION ALL
			SELECT 'contact_wa_id_duplicate',
				'manual',
				array_agg(DISTINCT organization_id ORDER BY organization_id)::text[],
				account_id,
				md5(string_agg(id::text, ',' ORDER BY id)),
				array_agg(id ORDER BY id)::text[],
				count(*)::int
			FROM wa_contacts
			WHERE account_id IS NOT NULL
			GROUP BY account_id, wa_id
			HAVING count(*) > 1
			UNION ALL
			SELECT 'provider_message_id_duplicate',
				'manual',
				array_agg(DISTINCT organization_id ORDER BY organization_id)::text[],
				account_id,
				md5(string_agg(id::text, ',' ORDER BY id)),
				array_agg(id ORDER BY id)::text[],
				count(*)::int
			FROM wa_messages
			WHERE provider_message_id IS NOT NULL
			GROUP BY account_id, provider_message_id
			HAVING count(*) > 1
			UNION ALL
			SELECT 'outbox_message_id_duplicate',
				'manual',
				array_agg(DISTINCT organization_id ORDER BY organization_id)::text[],
				min(account_id),
				md5(string_agg(id::text, ',' ORDER BY id)),
				array_agg(id ORDER BY id)::text[],
				count(*)::int
			FROM wa_outbox
			GROUP BY message_id
			HAVING count(*) > 1
			UNION ALL
			SELECT 'outbox_message_not_found',
				'manual',
				ARRAY[outbox.organization_id]::text[],
				outbox.account_id,
				md5(string_agg(outbox.id::text, ',' ORDER BY outbox.id)),
				array_agg(outbox.id ORDER BY outbox.id)::text[],
				count(*)::int
			FROM wa_outbox AS outbox
			LEFT JOIN wa_messages AS message ON message.id = outbox.message_id
			WHERE message.id IS NULL
			GROUP BY outbox.organization_id, outbox.account_id, outbox.message_id
			UNION ALL
			SELECT 'outbox_message_ownership_mismatch',
				'manual',
				ARRAY[outbox.organization_id, message.organization_id]::text[],
				outbox.account_id,
				md5(string_agg(outbox.id::text, ',' ORDER BY outbox.id)),
				array_agg(outbox.id ORDER BY outbox.id)::text[],
				count(*)::int
			FROM wa_outbox AS outbox
			JOIN wa_messages AS message ON message.id = outbox.message_id
			WHERE outbox.organization_id <> message.organization_id
				OR outbox.account_id <> message.account_id
			GROUP BY outbox.organization_id, message.organization_id,
				outbox.account_id, outbox.message_id
		)
		SELECT kind AS "kind",
			repairability AS "repairability",
			organization_ids AS "organizationIds",
			account_id AS "accountId",
			evidence_hash AS "evidenceHash",
			row_ids AS "rowIds",
			count AS "count"
		FROM issues
		WHERE ${scope}
		ORDER BY kind, organization_ids[1], account_id, evidence_hash
	`);

	return result.rows.map((issue) => ({
		...issue,
		count: Number(issue.count),
	}));
}

export function summarizeWhatsAppIdentityIssues(
	issues: WhatsAppIdentityIssue[],
) {
	const safeBackfills = issues.filter(
		(issue) => issue.repairability === "migration_safe",
	);
	const blockers = issues.filter((issue) => issue.repairability === "manual");
	return {
		issueGroupCount: issues.length,
		affectedRowCount: issues.reduce(
			(total, issue) => total + issue.count,
			0,
		),
		safeBackfillGroupCount: safeBackfills.length,
		safeBackfillRowCount: safeBackfills.reduce(
			(total, issue) => total + issue.count,
			0,
		),
		blockingIssueGroupCount: blockers.length,
		blockingRowCount: blockers.reduce(
			(total, issue) => total + issue.count,
			0,
		),
	};
}

export async function main(args = process.argv.slice(2)) {
	const options = parseWhatsAppMigrationPreflightArguments(args);
	const issues = await queryWhatsAppIdentityIssues({
		organizationId: options.organizationId,
	});
	const summary = summarizeWhatsAppIdentityIssues(issues);
	console.log(
		JSON.stringify(
			{
				mode: "report",
				scope: options.allOrganizations
					? { allOrganizations: true }
					: { organizationId: options.organizationId },
				...summary,
				issues,
			},
			null,
			2,
		),
	);
	return summary.blockingIssueGroupCount > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main()
		.then((code) => {
			process.exitCode = code;
		})
		.catch((error) => {
			console.error(
				error instanceof Error ? error.message : String(error),
			);
			process.exitCode = 2;
		});
}
