import type { waContacts, waConversations } from "@repo/whatsapp-db";

type ConversationRecord = typeof waConversations.$inferSelect;
type ContactRecord = typeof waContacts.$inferSelect;

export const toConversationItem = (
	conversation: ConversationRecord,
	contact: ContactRecord,
) => ({
	id: conversation.id,
	accountId: conversation.accountId,
	contactId: conversation.contactId,
	status: conversation.status,
	assignedToUserId: conversation.assignedToUserId ?? null,
	unreadCount: conversation.unreadCount ?? 0,
	lastMessageId: conversation.lastMessageId ?? null,
	lastMessageAt: conversation.lastMessageAt ?? null,
	lastMessagePreview: conversation.lastMessagePreview ?? null,
	createdAt: conversation.createdAt,
	updatedAt: conversation.updatedAt,
	contact: {
		id: contact.id,
		waId: contact.waId,
		phoneNumber: contact.phoneNumber,
		pushName: contact.pushName ?? null,
		name: contact.name ?? null,
		lastMessageAt: contact.lastMessageAt ?? null,
	},
});
