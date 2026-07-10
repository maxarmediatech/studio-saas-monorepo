import { db, sql } from "@repo/database";
import { waContacts, waConversations } from "@repo/whatsapp-db";

export async function ensureWhatsAppContactConversation(input: {
	organizationId: string;
	accountId: string;
	waId: string;
	contactName?: string;
}) {
	return db.transaction(async (tx) => {
		const [contact] = await tx
			.insert(waContacts)
			.values({
				organizationId: input.organizationId,
				accountId: input.accountId,
				waId: input.waId,
				phoneNumber: input.waId,
				name: input.contactName ?? null,
			})
			.onConflictDoUpdate({
				target: [waContacts.accountId, waContacts.waId],
				set: {
					name: sql`coalesce(${waContacts.name}, excluded.name)`,
					updatedAt: new Date(),
				},
			})
			.returning({ id: waContacts.id });
		if (!contact) {
			throw new Error("Failed to resolve WhatsApp contact");
		}

		const [conversation] = await tx
			.insert(waConversations)
			.values({
				organizationId: input.organizationId,
				accountId: input.accountId,
				contactId: contact.id,
			})
			.onConflictDoUpdate({
				target: [waConversations.accountId, waConversations.contactId],
				set: { updatedAt: new Date() },
			})
			.returning({ id: waConversations.id });
		if (!conversation) {
			throw new Error("Failed to resolve WhatsApp conversation");
		}

		return { contactId: contact.id, conversationId: conversation.id };
	});
}
