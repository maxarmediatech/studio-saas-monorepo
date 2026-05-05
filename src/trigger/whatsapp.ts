import {
	fetchDueWhatsAppOutboxItems,
	markWhatsAppOutboxFailure,
	processWhatsAppOutboxById,
	processWhatsAppOutboxItem,
} from "@repo/whatsapp-outbox";
import { logger, schedules, schemaTask, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

const processWhatsAppOutboxSchema = z.object({
	outboxId: z.string().min(1),
});

export const processWhatsAppOutbox = schemaTask({
	id: "whatsapp-process-outbox",
	schema: processWhatsAppOutboxSchema,
	maxDuration: 60,
	queue: {
		concurrencyLimit: 5,
	},
	run: async ({ outboxId }) => {
		const result = await processWhatsAppOutboxById(outboxId);
		logger.info("Processed WhatsApp outbox item", {
			outboxId,
			status: result.status,
		});

		return result;
	},
});

export const recoverWhatsAppOutbox = schedules.task({
	id: "whatsapp-recover-outbox",
	cron: "*/1 * * * *",
	maxDuration: 60,
	run: async () => {
		const items = await fetchDueWhatsAppOutboxItems({ limit: 25 });

		await Promise.all(
			items.map(async (item) => {
				try {
					await tasks.trigger("whatsapp-process-outbox", {
						outboxId: item.outbox.id,
					});
				} catch (error) {
					const attempts = (item.outbox.attempts ?? 0) + 1;
					const maxAttempts = item.outbox.maxAttempts ?? 3;
					const errorMessage =
						error instanceof Error
							? error.message
							: "Failed to trigger WhatsApp outbox task";

					logger.error("Failed to trigger WhatsApp recovery item", {
						outboxId: item.outbox.id,
						error,
					});

					await markWhatsAppOutboxFailure({
						outboxId: item.outbox.id,
						messageId: item.message.id,
						attempts,
						maxAttempts,
						errorMessage,
					});
				}
			}),
		);

		return { triggered: items.length };
	},
});

export const processWhatsAppOutboxBatch = schemaTask({
	id: "whatsapp-process-outbox-batch",
	schema: z.object({
		limit: z.number().int().min(1).max(100).default(25),
	}),
	maxDuration: 60,
	queue: {
		concurrencyLimit: 1,
	},
	run: async ({ limit }) => {
		const items = await fetchDueWhatsAppOutboxItems({ limit });

		for (const item of items) {
			await processWhatsAppOutboxItem(item);
		}

		return { processed: items.length };
	},
});
