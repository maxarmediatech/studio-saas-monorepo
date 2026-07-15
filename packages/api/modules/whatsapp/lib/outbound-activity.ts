import { and, db, eq } from "@repo/database";
import { waContacts, waConversations } from "@repo/whatsapp-db";
import type { WhatsAppTransactionClient } from "./transaction-client";

const MAX_PREVIEW_LENGTH = 140;

export function truncateWhatsAppPreview(value: string): string {
	const normalized = value.trim();

	if (normalized.length <= MAX_PREVIEW_LENGTH) {
		return normalized;
	}

	return `${normalized.slice(0, MAX_PREVIEW_LENGTH - 1)}…`;
}

export async function recordOutboundConversationActivity(params: {
	organizationId: string;
	conversationId: string;
	contactId: string;
	messageId: string;
	preview: string;
	at?: Date;
	tx?: WhatsAppTransactionClient;
}) {
	const activityAt = params.at ?? new Date();
	const preview = truncateWhatsAppPreview(params.preview);
	const executor = params.tx ?? db;

	await executor
		.update(waConversations)
		.set({
			lastMessageId: params.messageId,
			lastMessageAt: activityAt,
			lastMessagePreview: preview,
			updatedAt: activityAt,
		})
		.where(
			and(
				eq(waConversations.organizationId, params.organizationId),
				eq(waConversations.id, params.conversationId),
			),
		);

	await executor
		.update(waContacts)
		.set({
			lastMessageAt: activityAt,
			updatedAt: activityAt,
		})
		.where(
			and(
				eq(waContacts.organizationId, params.organizationId),
				eq(waContacts.id, params.contactId),
			),
		);
}
