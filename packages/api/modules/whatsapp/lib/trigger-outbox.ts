import { logger } from "@repo/logs";
import { tasks } from "@trigger.dev/sdk/v3";

const WHATSAPP_OUTBOX_TASK_ID = "whatsapp-process-outbox";

export async function triggerWhatsAppOutbox(params: {
	outboxId: string;
	/** Kept optional for existing retry callers; wake-up only needs the outbox id. */
	messageId?: string;
}): Promise<boolean> {
	try {
		await tasks.trigger(WHATSAPP_OUTBOX_TASK_ID, {
			outboxId: params.outboxId,
		});
		return true;
	} catch (error) {
		logger.warn("Failed to trigger WhatsApp outbox task", {
			outboxId: params.outboxId,
			error,
		});
		return false;
	}
}
