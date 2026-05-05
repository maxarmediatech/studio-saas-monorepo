import { ORPCError } from "@orpc/server";
import { and, db, eq } from "@repo/database";
import {
	waContacts,
	waConversations,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { findActiveWhatsAppAccount } from "../lib/account-repository";
import { recordOutboundConversationActivity } from "../lib/outbound-activity";
import { triggerWhatsAppOutbox } from "../lib/trigger-outbox";
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
		const account = await findActiveWhatsAppAccount(
			context.organizationId,
			input.accountId,
		);

		if (!account) {
			throw new ORPCError("NOT_FOUND", {
				message: "WhatsApp account not found",
			});
		}

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
							accountId: account.id,
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
				eq(waConversations.accountId, account.id),
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
							accountId: account.id,
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
				accountId: account.id,
				conversationId,
				contactId,
				direction: "outbound",
				type: "text",
				textBody: input.text,
				status: "pending",
			})
			.returning({ id: waMessages.id, createdAt: waMessages.createdAt });

		if (!createdMessage) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create message",
			});
		}

		await recordOutboundConversationActivity({
			organizationId: context.organizationId,
			conversationId,
			contactId,
			messageId: createdMessage.id,
			preview: input.text,
			at: createdMessage.createdAt,
		});

		const [outbox] = await db
			.insert(waOutbox)
			.values({
				organizationId: context.organizationId,
				accountId: account.id,
				messageId: createdMessage.id,
			})
			.returning({ id: waOutbox.id });

		if (!outbox) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to enqueue message",
			});
		}

		await triggerWhatsAppOutbox({
			outboxId: outbox.id,
			messageId: createdMessage.id,
		});

		return {
			data: { messageId: createdMessage.id, outboxId: outbox.id },
			message: "Message queued",
		};
	});
