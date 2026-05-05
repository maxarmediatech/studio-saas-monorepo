import { ORPCError } from "@orpc/server";
import { and, db, eq } from "@repo/database";
import {
	waContacts,
	waConversations,
	waMedia,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { findActiveWhatsAppAccount } from "../lib/account-repository";
import { recordOutboundConversationActivity } from "../lib/outbound-activity";
import { triggerWhatsAppOutbox } from "../lib/trigger-outbox";
import { sendMediaInputSchema, sendMediaOutputSchema } from "../types";

export const sendMedia = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/messages/send-media",
		tags: ["WhatsApp"],
		summary: "Send WhatsApp media message",
	})
	.input(sendMediaInputSchema)
	.output(sendMediaOutputSchema)
	.handler(async ({ input, context }) => {
		if (
			input.mediaKey &&
			!input.mediaKey.startsWith(
				`orgs/${context.organizationId}/whatsapp-media/`,
			)
		) {
			throw new ORPCError("FORBIDDEN", {
				message: "Invalid media key",
			});
		}

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

		const [createdMedia] = await db
			.insert(waMedia)
			.values({
				organizationId: context.organizationId,
				mimeType: input.mimeType,
				fileName: input.fileName ?? null,
				storageType: input.mediaKey ? "s3" : "provider",
				storageUrl: input.mediaKey ?? input.mediaUrl ?? null,
			})
			.returning({ id: waMedia.id });

		if (!createdMedia) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create media",
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
				type: input.mediaType,
				caption: input.caption ?? null,
				mediaId: createdMedia.id,
				status: "pending",
			})
			.returning({ id: waMessages.id, createdAt: waMessages.createdAt });

		if (!createdMessage) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create message",
			});
		}

		const mediaLabel =
			input.caption?.trim() ||
			({
				image: "Photo sent",
				video: "Video sent",
				audio: "Audio sent",
				document: "Document sent",
				sticker: "Sticker sent",
			}[input.mediaType] ??
				"Media sent");

		await recordOutboundConversationActivity({
			organizationId: context.organizationId,
			conversationId,
			contactId,
			messageId: createdMessage.id,
			preview: mediaLabel,
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

		await triggerWhatsAppOutbox(outbox.id);

		return {
			data: { messageId: createdMessage.id, outboxId: outbox.id },
			message: "Message queued",
		};
	});
