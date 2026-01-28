import { and, db, eq, isNull, lte, or, smsOutbox } from "@repo/database";
import { logger } from "@repo/logs";
import { createMsg91Provider } from "@repo/sms/src/provider/msg91";

const pollIntervalMs = Number(process.env.SMS_OUTBOX_INTERVAL_MS ?? 5000);
const batchSize = Number(process.env.SMS_OUTBOX_BATCH_SIZE ?? 10);

let isShuttingDown = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;

function computeNextAttemptAt(attempts: number): Date {
	const delaySeconds = Math.min(30 * attempts, 15 * 60);
	return new Date(Date.now() + delaySeconds * 1000);
}

async function fetchOutboxBatch() {
	const now = new Date();
	return db
		.select()
		.from(smsOutbox)
		.where(
			and(
				eq(smsOutbox.status, "pending"),
				or(
					isNull(smsOutbox.nextAttemptAt),
					lte(smsOutbox.nextAttemptAt, now),
				),
			),
		)
		.limit(batchSize);
}

async function markOutboxProcessing(outboxId: string, attempts: number) {
	await db
		.update(smsOutbox)
		.set({
			status: "processing",
			attempts,
			updatedAt: new Date(),
		})
		.where(eq(smsOutbox.id, outboxId));
}

async function markOutboxSuccess(params: {
	outboxId: string;
	providerMessageId?: string;
}) {
	await db
		.update(smsOutbox)
		.set({
			status: "sent",
			providerMessageId: params.providerMessageId ?? null,
			nextAttemptAt: null,
			errorMessage: null,
			updatedAt: new Date(),
		})
		.where(eq(smsOutbox.id, params.outboxId));
}

async function markOutboxFailure(params: {
	outboxId: string;
	attempts: number;
	maxAttempts: number;
	errorMessage: string;
}) {
	const shouldRetry = params.attempts < params.maxAttempts;
	const nextAttemptAt = shouldRetry
		? computeNextAttemptAt(params.attempts)
		: null;

	await db
		.update(smsOutbox)
		.set({
			status: shouldRetry ? "pending" : "failed",
			nextAttemptAt,
			errorMessage: params.errorMessage,
			updatedAt: new Date(),
		})
		.where(eq(smsOutbox.id, params.outboxId));
}

async function processOutboxItem(item: typeof smsOutbox.$inferSelect) {
	const attempts = (item.attempts ?? 0) + 1;
	const maxAttempts = item.maxAttempts ?? 3;

	await markOutboxProcessing(item.id, attempts);

	try {
		const provider = createMsg91Provider();

		const variables = item.variables as Record<string, string> | null;
		const message = variables?.message ?? variables?.VAR1 ?? "";

		const result = await provider.send({
			to: item.phoneNumber,
			message,
			templateId: item.templateId,
		});

		if (!result.success) {
			logger.warn(
				{ outboxId: item.id, error: result.error },
				"SMS send failed",
			);
			await markOutboxFailure({
				outboxId: item.id,
				attempts,
				maxAttempts,
				errorMessage: result.error ?? "Failed to send SMS",
			});
			return;
		}

		logger.info(
			{ outboxId: item.id, messageId: result.messageId },
			"SMS sent successfully",
		);
		await markOutboxSuccess({
			outboxId: item.id,
			providerMessageId: result.messageId,
		});
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		logger.error({ outboxId: item.id, error }, "SMS processing error");
		await markOutboxFailure({
			outboxId: item.id,
			attempts,
			maxAttempts,
			errorMessage,
		});
	}
}

async function runBatch() {
	if (isShuttingDown) return;

	const batch = await fetchOutboxBatch();
	for (const item of batch) {
		if (isShuttingDown) break;
		try {
			await processOutboxItem(item);
		} catch (error) {
			logger.error(
				{ outboxId: item.id, error },
				"Failed to process outbox item",
			);
		}
	}
}

function handleShutdown(signal: string) {
	logger.info({ signal }, "Received shutdown signal, stopping worker...");
	isShuttingDown = true;

	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}

	setTimeout(() => {
		logger.info("SMS worker shutdown complete");
		process.exit(0);
	}, 1000);
}

async function run() {
	logger.info(
		{ pollIntervalMs, batchSize },
		`SMS worker started, polling every ${pollIntervalMs}ms`,
	);

	process.on("SIGTERM", () => handleShutdown("SIGTERM"));
	process.on("SIGINT", () => handleShutdown("SIGINT"));

	await runBatch();
	pollInterval = setInterval(runBatch, pollIntervalMs);
}

run().catch((error) => {
	logger.error({ error }, "SMS worker failed to start");
	process.exit(1);
});
