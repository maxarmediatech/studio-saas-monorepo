import { db, sql } from "@repo/database";

type DuplicateIdentity = {
	kind: "contact_wa_id" | "provider_message_id";
	accountId: string;
	identity: string;
	count: number | string;
};

export async function queryWhatsAppIdentityDuplicates() {
	const result = await db.execute<DuplicateIdentity>(sql`
		SELECT 'contact_wa_id' AS kind,
			account_id AS "accountId",
			wa_id AS identity,
			COUNT(*)::int AS count
		FROM wa_contacts
		GROUP BY account_id, wa_id
		HAVING COUNT(*) > 1
		UNION ALL
		SELECT 'provider_message_id' AS kind,
			account_id AS "accountId",
			provider_message_id AS identity,
			COUNT(*)::int AS count
		FROM wa_messages
		WHERE provider_message_id IS NOT NULL
		GROUP BY account_id, provider_message_id
		HAVING COUNT(*) > 1
		ORDER BY kind, "accountId", identity
	`);
	return result.rows;
}

export async function main() {
	const duplicates = await queryWhatsAppIdentityDuplicates();
	console.log(
		JSON.stringify(
			{
				mode: "report",
				duplicateCount: duplicates.length,
				duplicates,
			},
			null,
			2,
		),
	);
	return duplicates.length > 0 ? 1 : 0;
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
