import { db, eq } from "@repo/database";
import { waAccounts, waContacts, waConversations } from "@repo/whatsapp-db";
import { afterAll, describe, expect, it } from "vitest";
import { ensureWhatsAppContactConversation } from "./contact-conversation";

const organizationId = "whatsapp-contact-conversation-pg-test";
const accountId = "whatsapp-contact-conversation-account";
const describePostgres = process.env.POSTGRES_CONCURRENCY_DATABASE_URL
	? describe
	: describe.skip;

describePostgres("WhatsApp contact and conversation identity", () => {
	afterAll(async () => {
		await db
			.delete(waConversations)
			.where(eq(waConversations.organizationId, organizationId));
		await db
			.delete(waContacts)
			.where(eq(waContacts.organizationId, organizationId));
		await db.delete(waAccounts).where(eq(waAccounts.id, accountId));
	});

	it("resolves concurrent outbound sends to one contact and conversation", async () => {
		await db.insert(waAccounts).values({
			id: accountId,
			organizationId,
			name: "Identity test",
			provider: "cloud_api",
		});
		const results = await Promise.all(
			Array.from({ length: 8 }, () =>
				ensureWhatsAppContactConversation({
					organizationId,
					accountId,
					waId: "919999999999",
					contactName: "Concurrent contact",
				}),
			),
		);

		expect(new Set(results.map((result) => result.contactId)).size).toBe(1);
		expect(
			new Set(results.map((result) => result.conversationId)).size,
		).toBe(1);
		expect(
			await db
				.select()
				.from(waContacts)
				.where(eq(waContacts.accountId, accountId)),
		).toHaveLength(1);
		expect(
			await db
				.select()
				.from(waConversations)
				.where(eq(waConversations.accountId, accountId)),
		).toHaveLength(1);
	});
});
