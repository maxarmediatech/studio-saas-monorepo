import { ORPCError } from "@orpc/server";
import { and, db, eq, inArray, ne } from "@repo/database";
import { waAccounts, waConversations, waMessages } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { decryptWhatsAppSecret } from "../lib/account-secrets";
import { markCloudApiMessagesRead } from "../lib/cloud-api-admin";
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
		const conversation = await db.query.waConversations.findFirst({
			where: and(
				eq(waConversations.organizationId, context.organizationId),
				eq(waConversations.id, input.conversationId),
			),
		});

		if (!conversation) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found",
			});
		}

		const account = await db.query.waAccounts.findFirst({
			where: and(
				eq(waAccounts.organizationId, context.organizationId),
				eq(waAccounts.id, conversation.accountId),
			),
		});

		if (!account) {
			throw new ORPCError("NOT_FOUND", {
				message: "WhatsApp account not found",
			});
		}

		const inboundMessages = await db
			.select({
				id: waMessages.id,
				providerMessageId: waMessages.providerMessageId,
			})
			.from(waMessages)
			.where(
				and(
					eq(waMessages.organizationId, context.organizationId),
					eq(waMessages.conversationId, conversation.id),
					eq(waMessages.direction, "inbound"),
					ne(waMessages.status, "read"),
				),
			)
			.orderBy(waMessages.createdAt);

		const providerMessageIds = [
			...new Set(
				inboundMessages
					.map((message) => message.providerMessageId)
					.filter((value): value is string => Boolean(value)),
			),
		];

		if (
			account.provider === "cloud_api" &&
			account.phoneNumberId &&
			account.accessToken &&
			providerMessageIds.length
		) {
			const accessToken = decryptWhatsAppSecret(account.accessToken);
			if (!accessToken) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Missing WhatsApp Cloud API credentials",
				});
			}

			await markCloudApiMessagesRead({
				accessToken,
				phoneNumberId: account.phoneNumberId,
				messageIds: providerMessageIds,
				apiVersion: account.apiVersion ?? undefined,
			});
		}

		const [updated] = await db
			.update(waConversations)
			.set({ unreadCount: 0 })
			.where(eq(waConversations.id, conversation.id))
			.returning({ id: waConversations.id });

		if (inboundMessages.length) {
			await db
				.update(waMessages)
				.set({
					status: "read",
					statusUpdatedAt: new Date(),
				})
				.where(
					inArray(
						waMessages.id,
						inboundMessages.map((message) => message.id),
					),
				);
		}

		return {
			data: { id: updated?.id ?? conversation.id },
			message: "Conversation marked as read",
		};
	});
