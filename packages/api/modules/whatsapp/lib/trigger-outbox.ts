import { logger } from "@repo/logs";
import { tasks } from "@trigger.dev/sdk/v3";

const WHATSAPP_OUTBOX_TASK_ID = "whatsapp-process-outbox";

export async function triggerWhatsAppOutbox(outboxId: string) {
	try {
		await tasks.trigger(WHATSAPP_OUTBOX_TASK_ID, { outboxId });
	} catch (error) {
		logger.warn("Failed to trigger WhatsApp outbox task", {
			outboxId,
			error,
		});
	}
}
