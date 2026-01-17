import { ORPCError } from "@orpc/server";
import { and, db, eq } from "@repo/database";
import { waConversations } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	markConversationReadInputSchema,
	markConversationReadOutputSchema,
} from "../types";

export const markConversationRead = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/conversations/:conversationId/mark-read",
		tags: ["WhatsApp"],
		summary: "Mark WhatsApp conversation as read",
	})
	.input(markConversationReadInputSchema)
	.output(markConversationReadOutputSchema)
	.handler(async ({ input, context }) => {
		const [updated] = await db
			.update(waConversations)
			.set({ unreadCount: 0 })
			.where(
				and(
					eq(waConversations.organizationId, context.organizationId),
					eq(waConversations.id, input.conversationId),
				),
			)
			.returning({ id: waConversations.id });

		if (!updated) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found",
			});
		}

		return {
			data: { id: updated.id },
			message: "Conversation marked as read",
		};
	});
