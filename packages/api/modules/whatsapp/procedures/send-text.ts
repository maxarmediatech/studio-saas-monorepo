import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { waMessages, waOutbox } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { findActiveWhatsAppAccount } from "../lib/account-repository";
import { ensureWhatsAppContactConversation } from "../lib/contact-conversation";
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

		const { contactId, conversationId } =
			await ensureWhatsAppContactConversation({
				organizationId: context.organizationId,
				accountId: account.id,
				waId: input.to,
				contactName: input.contactName,
			});

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
