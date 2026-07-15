import { ORPCError } from "@orpc/server";
import { and, db, eq } from "@repo/database";
import { waContacts, waConversations } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { toConversationItem } from "../lib/conversation-presenter";
import {
	getConversationInputSchema,
	getConversationOutputSchema,
} from "../types";

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
			data: toConversationItem(row.conversation, row.contact),
		};
	});
