import crypto from "node:crypto";
import { logger } from "@repo/logs";
import {
	fetchDueWhatsAppOutboxItems,
	processWhatsAppOutboxItem,
} from "@repo/whatsapp-outbox";
import { fetchDueInboundMedia, processInboundMediaItem } from "./media-worker";

const pollIntervalMs = Number(process.env.WHATSAPP_OUTBOX_INTERVAL_MS ?? 5000);
const batchSize = Number(process.env.WHATSAPP_OUTBOX_BATCH_SIZE ?? 10);
const workerId =
	process.env.WHATSAPP_WORKER_ID ?? `whatsapp-${crypto.randomUUID()}`;

const runBatch = async () => {
	const mediaBatch = await fetchDueInboundMedia({ limit: batchSize });
	for (const item of mediaBatch) {
		const result = await processInboundMediaItem(item, { workerId });
		if (result.status === "failed") {
			logger.warn("WhatsApp inbound media ingest failed", {
				mediaId: item.media.id,
			});
		}
	}

	const outboxBatch = await fetchDueWhatsAppOutboxItems({ limit: batchSize });
	for (const item of outboxBatch) {
		const result = await processWhatsAppOutboxItem(item, { workerId });
		if (result.status === "delivery_unknown") {
			logger.error("WhatsApp delivery outcome requires reconciliation", {
				outboxId: item.outbox.id,
				messageId: item.message.id,
			});
		}
	}
};

const run = async () => {
	logger.info("WhatsApp worker started", {
		pollIntervalMs,
		batchSize,
		workerId,
	});
	while (true) {
		try {
			await runBatch();
		} catch (error) {
			logger.error("WhatsApp worker batch failed", { error });
		}
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
	}
};

run().catch((error) => {
	logger.error("WhatsApp worker failed", { error });
	process.exit(1);
});
