import { ORPCError } from "@orpc/server";
import { and, db, eq } from "@repo/database";
import { waContacts, waConversations } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { getConversationInputSchema, getConversationOutputSchema } from "../types";

export const getConversation = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/whatsapp/conversations/:conversationId",
		tags: ["WhatsApp"],
		summary: "Get WhatsApp conversation",
	})
	.input(getConversationInputSchema)
	.output(getConversationOutputSchema)
	.handler(async ({ input, context }) => {
		const [row] = await db
			.select({ conversation: waConversations, contact: waContacts })
			.from(waConversations)
			.innerJoin(waContacts, eq(waConversations.contactId, waContacts.id))
			.where(
				and(
					eq(waConversations.organizationId, context.organizationId),
					eq(waConversations.id, input.conversationId),
				),
			);

		if (!row) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found",
			});
		}

		return {
			data: {
				id: row.conversation.id,
				accountId: row.conversation.accountId,
				contactId: row.conversation.contactId,
				status: row.conversation.status,
				unreadCount: row.conversation.unreadCount ?? 0,
				lastMessageId: row.conversation.lastMessageId ?? null,
				lastMessageAt: row.conversation.lastMessageAt ?? null,
				lastMessagePreview: row.conversation.lastMessagePreview ?? null,
				createdAt: row.conversation.createdAt,
				updatedAt: row.conversation.updatedAt,
				contact: {
					id: row.contact.id,
					waId: row.contact.waId,
					phoneNumber: row.contact.phoneNumber,
					pushName: row.contact.pushName ?? null,
					name: row.contact.name ?? null,
					lastMessageAt: row.contact.lastMessageAt ?? null,
				},
			},
		};
	});
