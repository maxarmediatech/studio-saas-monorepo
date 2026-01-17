import { ORPCError } from "@orpc/server";
import { and, db, eq } from "@repo/database";
import {
	waContacts,
	waConversations,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { sendTextInputSchema, sendTextOutputSchema } from "../types";

export const sendText = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/messages/send",
		tags: ["WhatsApp"],
		summary: "Send WhatsApp text message",
	})
	.input(sendTextInputSchema)
	.output(sendTextOutputSchema)
	.handler(async ({ input, context }) => {
		const existingContact = await db.query.waContacts.findFirst({
			where: and(
				eq(waContacts.organizationId, context.organizationId),
				eq(waContacts.waId, input.to),
			),
		});

		const contactId = existingContact
			? existingContact.id
			: (
				await db
					.insert(waContacts)
					.values({
						organizationId: context.organizationId,
						accountId: input.accountId,
						waId: input.to,
						phoneNumber: input.to,
					})
					.returning({ id: waContacts.id })
			)[0]?.id;

		if (!contactId) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create contact",
			});
		}

		const existingConversation = await db.query.waConversations.findFirst({
			where: and(
				eq(waConversations.organizationId, context.organizationId),
				eq(waConversations.accountId, input.accountId),
				eq(waConversations.contactId, contactId),
			),
		});

		const conversationId = existingConversation
			? existingConversation.id
			: (
				await db
					.insert(waConversations)
					.values({
						organizationId: context.organizationId,
						accountId: input.accountId,
						contactId,
					})
					.returning({ id: waConversations.id })
			)[0]?.id;

		if (!conversationId) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create conversation",
			});
		}

		const [createdMessage] = await db
			.insert(waMessages)
			.values({
				organizationId: context.organizationId,
				accountId: input.accountId,
				conversationId,
				contactId,
				direction: "outbound",
				type: "text",
				textBody: input.text,
				status: "pending",
			})
			.returning({ id: waMessages.id });

		if (!createdMessage) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create message",
			});
		}

		const [outbox] = await db
			.insert(waOutbox)
			.values({
				organizationId: context.organizationId,
				accountId: input.accountId,
				messageId: createdMessage.id,
			})
			.returning({ id: waOutbox.id });

		if (!outbox) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to enqueue message",
			});
		}

		return {
			data: { messageId: createdMessage.id, outboxId: outbox.id },
			message: "Message queued",
		};
	});
