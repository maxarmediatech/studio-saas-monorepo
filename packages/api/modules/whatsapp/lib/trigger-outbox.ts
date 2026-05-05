import { db, eq } from "@repo/database";
import { logger } from "@repo/logs";
import { waMessages, waOutbox } from "@repo/whatsapp-db";
import { tasks } from "@trigger.dev/sdk/v3";

const WHATSAPP_OUTBOX_TASK_ID = "whatsapp-process-outbox";

export async function triggerWhatsAppOutbox(params: {
	outboxId: string;
	messageId: string;
}) {
	try {
		await tasks.trigger(WHATSAPP_OUTBOX_TASK_ID, {
			outboxId: params.outboxId,
		});
	} catch (error) {
		const errorMessage =
			error instanceof Error
				? error.message
				: "Failed to queue WhatsApp send task";

		logger.warn("Failed to trigger WhatsApp outbox task", {
			outboxId: params.outboxId,
			error,
		});

		await db.transaction(async (tx) => {
			await tx
				.update(waOutbox)
				.set({
					status: "failed",
					attempts: 0,
					nextAttemptAt: null,
					errorMessage,
				})
				.where(eq(waOutbox.id, params.outboxId));

			await tx
				.update(waMessages)
				.set({
					status: "failed",
					statusUpdatedAt: new Date(),
					errorMessage,
				})
				.where(eq(waMessages.id, params.messageId));
		});

		throw new Error(errorMessage);
	}
}
