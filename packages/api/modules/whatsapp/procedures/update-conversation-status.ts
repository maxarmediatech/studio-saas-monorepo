import { ORPCError } from "@orpc/server";
import { and, db, eq } from "@repo/database";
import { waContacts, waConversations } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { toConversationItem } from "../lib/conversation-presenter";
import {
	updateConversationStatusInputSchema,
	updateConversationStatusOutputSchema,
} from "../types";

export const updateConversationStatus = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/conversations/:conversationId/status",
		tags: ["WhatsApp"],
		summary: "Update WhatsApp conversation status",
	})
	.input(updateConversationStatusInputSchema)
	.output(updateConversationStatusOutputSchema)
	.handler(async ({ input, context }) => {
		const [row] = await db
			.update(waConversations)
			.set({
				status: input.status,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(waConversations.organizationId, context.organizationId),
					eq(waConversations.id, input.conversationId),
				),
			)
			.returning();

		if (!row) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found",
			});
		}

		const [conversation] = await db
			.select({
				conversation: waConversations,
				contact: waContacts,
			})
			.from(waConversations)
			.innerJoin(waContacts, eq(waConversations.contactId, waContacts.id))
			.where(eq(waConversations.id, row.id));

		if (!conversation) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to load updated conversation",
			});
		}

		return {
			data: toConversationItem(
				conversation.conversation,
				conversation.contact,
			),
			message: `Conversation marked ${input.status}`,
		};
	});
