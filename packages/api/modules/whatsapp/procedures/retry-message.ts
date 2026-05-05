import { ORPCError } from "@orpc/server";
import { and, db, eq } from "@repo/database";
import { waMessages, waOutbox } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { triggerWhatsAppOutbox } from "../lib/trigger-outbox";
import { retryMessageInputSchema, retryMessageOutputSchema } from "../types";

export const retryMessage = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/messages/:messageId/retry",
		tags: ["WhatsApp"],
		summary: "Retry a failed WhatsApp outbound message",
	})
	.input(retryMessageInputSchema)
	.output(retryMessageOutputSchema)
	.handler(async ({ input, context }) => {
		const message = await db.query.waMessages.findFirst({
			where: and(
				eq(waMessages.id, input.messageId),
				eq(waMessages.organizationId, context.organizationId),
			),
		});

		if (!message) {
			throw new ORPCError("NOT_FOUND", {
				message: "WhatsApp message not found",
			});
		}

		if (message.direction !== "outbound") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only outbound messages can be retried",
			});
		}

		if (["sent", "delivered", "read"].includes(message.status)) {
			throw new ORPCError("CONFLICT", {
				message: "This message was already sent",
			});
		}

		const outbox = await db.query.waOutbox.findFirst({
			where: and(
				eq(waOutbox.messageId, message.id),
				eq(waOutbox.organizationId, context.organizationId),
			),
		});

		if (!outbox) {
			throw new ORPCError("NOT_FOUND", {
				message: "Outbox entry not found for this message",
			});
		}

		if (outbox.status === "sent") {
			throw new ORPCError("CONFLICT", {
				message: "This message was already sent",
			});
		}

		if (outbox.status === "processing") {
			throw new ORPCError("CONFLICT", {
				message: "This message is already being processed",
			});
		}

		await db.transaction(async (tx) => {
			await tx
				.update(waOutbox)
				.set({
					status: "pending",
					attempts: 0,
					lastAttemptAt: null,
					nextAttemptAt: null,
					errorMessage: null,
				})
				.where(eq(waOutbox.id, outbox.id));

			await tx
				.update(waMessages)
				.set({
					status: "pending",
					statusUpdatedAt: new Date(),
					errorCode: null,
					errorMessage: null,
				})
				.where(eq(waMessages.id, message.id));
		});

		await triggerWhatsAppOutbox(outbox.id);

		return {
			data: { messageId: message.id, outboxId: outbox.id },
			message: "Message retry queued",
		};
	});
