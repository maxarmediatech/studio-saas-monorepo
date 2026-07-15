import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { queryWhatsAppIdentityIssues } from "./whatsapp-migration-preflight";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("WhatsApp migration preflight on PostgreSQL", () => {
	it("classifies safe ownership backfill and every manual identity blocker", async (context) => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const { db, sql } = await import("@repo/database");
		const schemaState = await db.execute<{ isNullable: string }>(sql`
			SELECT is_nullable AS "isNullable"
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'wa_contacts'
				AND column_name = 'account_id'
		`);
		if (schemaState.rows[0]?.isNullable !== "YES") {
			process.env.DATABASE_URL = originalDatabaseUrl;
			context.skip("requires the pre-enforcement Batch 4 schema");
			return;
		}
		const suffix = `${process.pid}_${Date.now()}`;
		const prefix = `wa_preflight_${suffix}`;
		const safeOrganization = `${prefix}_safe`;
		const manualOrganization = `${prefix}_manual`;
		const duplicateOrganization = `${prefix}_duplicate`;
		const otherOrganization = `${prefix}_other`;
		const safeAccount = `${prefix}_safe_account`;
		const manualAccounts = [
			`${prefix}_manual_account_a`,
			`${prefix}_manual_account_b`,
		];
		const duplicateAccount = `${prefix}_duplicate_account`;
		const otherAccount = `${prefix}_other_account`;

		try {
			await db.execute(sql`
				INSERT INTO wa_accounts (id, organization_id, name, provider)
				VALUES
					(${safeAccount}, ${safeOrganization}, 'Safe', 'cloud_api'),
					(${manualAccounts[0]}, ${manualOrganization}, 'Manual A', 'cloud_api'),
					(${manualAccounts[1]}, ${manualOrganization}, 'Manual B', 'cloud_api'),
					(${duplicateAccount}, ${duplicateOrganization}, 'Duplicate', 'cloud_api'),
					(${otherAccount}, ${otherOrganization}, 'Other', 'cloud_api')
			`);
			await db.execute(sql`
				INSERT INTO wa_contacts
					(id, organization_id, account_id, wa_id, phone_number)
				VALUES
					(${`${prefix}_safe_contact`}, ${safeOrganization}, NULL, '919100000001', '919100000001'),
					(${`${prefix}_manual_contact`}, ${manualOrganization}, NULL, '919100000002', '919100000002'),
					(${`${prefix}_duplicate_contact_a`}, ${duplicateOrganization}, ${duplicateAccount}, '919100000003', '919100000003'),
					(${`${prefix}_duplicate_contact_b`}, ${duplicateOrganization}, ${duplicateAccount}, '919100000003', '919100000003'),
					(${`${prefix}_mismatched_contact`}, ${duplicateOrganization}, ${otherAccount}, '919100000004', '919100000004')
			`);
			await db.execute(sql`
				INSERT INTO wa_messages
					(id, organization_id, account_id, conversation_id, contact_id,
						provider_message_id, direction, type, status)
				VALUES
					(${`${prefix}_message_a`}, ${duplicateOrganization}, ${duplicateAccount}, 'conversation-a', ${`${prefix}_duplicate_contact_a`}, 'provider-sensitive-id', 'outbound', 'text', 'sent'),
					(${`${prefix}_message_b`}, ${duplicateOrganization}, ${duplicateAccount}, 'conversation-b', ${`${prefix}_duplicate_contact_b`}, 'provider-sensitive-id', 'outbound', 'text', 'sent'),
					(${`${prefix}_message_other`}, ${otherOrganization}, ${otherAccount}, 'conversation-other', ${`${prefix}_mismatched_contact`}, NULL, 'outbound', 'text', 'sent')
			`);
			await db.execute(sql`
				INSERT INTO wa_outbox
					(id, organization_id, account_id, message_id, status)
				VALUES
					(${`${prefix}_outbox_a`}, ${duplicateOrganization}, ${duplicateAccount}, ${`${prefix}_message_a`}, 'sent'),
					(${`${prefix}_outbox_b`}, ${duplicateOrganization}, ${duplicateAccount}, ${`${prefix}_message_a`}, 'failed'),
					(${`${prefix}_outbox_orphan`}, ${duplicateOrganization}, ${duplicateAccount}, ${`${prefix}_missing_message`}, 'failed'),
					(${`${prefix}_outbox_mismatch`}, ${duplicateOrganization}, ${duplicateAccount}, ${`${prefix}_message_other`}, 'failed')
			`);

			const safeIssues = await queryWhatsAppIdentityIssues({
				organizationId: safeOrganization,
			});
			assert.deepEqual(
				safeIssues.map((issue) => issue.kind),
				["contact_missing_account_safe_backfill"],
			);
			assert.equal(safeIssues[0]?.repairability, "migration_safe");

			const manualIssues = await queryWhatsAppIdentityIssues({
				organizationId: manualOrganization,
			});
			assert.deepEqual(
				manualIssues.map((issue) => issue.kind),
				["contact_missing_account_manual"],
			);

			const duplicateIssues = await queryWhatsAppIdentityIssues({
				organizationId: duplicateOrganization,
			});
			assert.deepEqual(
				duplicateIssues.map((issue) => issue.kind),
				[
					"contact_account_organization_mismatch",
					"contact_wa_id_duplicate",
					"outbox_message_id_duplicate",
					"outbox_message_not_found",
					"outbox_message_ownership_mismatch",
					"provider_message_id_duplicate",
				],
			);
			assert.equal(
				JSON.stringify(duplicateIssues).includes(
					"provider-sensitive-id",
				),
				false,
			);
			assert.equal(
				JSON.stringify(duplicateIssues).includes("919100000003"),
				false,
			);
		} finally {
			await db.execute(
				sql`DELETE FROM wa_outbox WHERE organization_id LIKE ${`${prefix}%`}`,
			);
			await db.execute(
				sql`DELETE FROM wa_messages WHERE organization_id LIKE ${`${prefix}%`}`,
			);
			await db.execute(
				sql`DELETE FROM wa_contacts WHERE organization_id LIKE ${`${prefix}%`}`,
			);
			await db.execute(
				sql`DELETE FROM wa_accounts WHERE organization_id LIKE ${`${prefix}%`}`,
			);
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});
});
