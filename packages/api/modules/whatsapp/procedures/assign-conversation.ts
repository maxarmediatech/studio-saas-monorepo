import { ORPCError } from "@orpc/server";
import { and, db, eq, members } from "@repo/database";
import { waContacts, waConversations } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { toConversationItem } from "../lib/conversation-presenter";
import {
	assignConversationInputSchema,
	assignConversationOutputSchema,
} from "../types";

export const assignConversation = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/conversations/:conversationId/assign",
		tags: ["WhatsApp"],
		summary: "Assign or unassign a WhatsApp conversation",
	})
	.input(assignConversationInputSchema)
	.output(assignConversationOutputSchema)
	.handler(async ({ input, context }) => {
		if (input.assignedToUserId) {
			const member = await db.query.members.findFirst({
				where: and(
					eq(members.organizationId, context.organizationId),
					eq(members.userId, input.assignedToUserId),
				),
			});

			if (!member) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Assignee is not a member of this organization",
				});
			}
		}

		const [row] = await db
			.update(waConversations)
			.set({
				assignedToUserId: input.assignedToUserId,
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
			message: input.assignedToUserId
				? "Conversation assigned"
				: "Conversation unassigned",
		};
	});
