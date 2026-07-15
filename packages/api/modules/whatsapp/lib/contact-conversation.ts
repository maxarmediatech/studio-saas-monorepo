import { db, sql } from "@repo/database";
import { waContacts, waConversations } from "@repo/whatsapp-db";
import type { WhatsAppTransactionClient } from "./transaction-client";

export type ContactConversationPersistenceStep = "contact" | "conversation";

interface ContactConversationOptions {
	tx?: WhatsAppTransactionClient;
	afterPersist?: (
		step: ContactConversationPersistenceStep,
	) => void | Promise<void>;
}

export async function ensureWhatsAppContactConversation(
	input: {
		organizationId: string;
		accountId: string;
		waId: string;
		contactName?: string;
	},
	options: ContactConversationOptions = {},
) {
	const persist = async (tx: WhatsAppTransactionClient) => {
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
		await options.afterPersist?.("contact");

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
		await options.afterPersist?.("conversation");

		return { contactId: contact.id, conversationId: conversation.id };
	};

	return options.tx ? persist(options.tx) : db.transaction(persist);
}
