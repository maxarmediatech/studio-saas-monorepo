import { db } from "@repo/database";
import { waConversations } from "@repo/whatsapp-db";
import { ensureWhatsAppContactIdentity } from "@repo/whatsapp-runtime";
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
		const contactId = await ensureWhatsAppContactIdentity(tx, input);
		await options.afterPersist?.("contact");

		const [conversation] = await tx
			.insert(waConversations)
			.values({
				organizationId: input.organizationId,
				accountId: input.accountId,
				contactId,
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

		return { contactId, conversationId: conversation.id };
	};

	return options.tx ? persist(options.tx) : db.transaction(persist);
}
