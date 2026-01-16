import { logger } from "@repo/logs";
import { and, db, desc, eq, inArray, isNull, lte, or } from "@repo/database";
import {
	waAccounts,
	waContacts,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import { CloudApiProvider } from "@repo/whatsapp-providers";

const pollIntervalMs = Number(process.env.WHATSAPP_OUTBOX_INTERVAL_MS ?? 5000);
const batchSize = Number(process.env.WHATSAPP_OUTBOX_BATCH_SIZE ?? 10);

const computeNextAttemptAt = (attempts: number) => {
	const delaySeconds = Math.min(30 * attempts, 15 * 60);
	return new Date(Date.now() + delaySeconds * 1000);
};

const fetchOutboxBatch = async () => {
	const now = new Date();
	return db
		.select({
			outbox: waOutbox,
			message: waMessages,
			account: waAccounts,
			contact: waContacts,
		})
		.from(waOutbox)
		.innerJoin(waMessages, eq(waOutbox.messageId, waMessages.id))
		.innerJoin(waAccounts, eq(waOutbox.accountId, waAccounts.id))
		.innerJoin(waContacts, eq(waMessages.contactId, waContacts.id))
		.where(
			and(
				inArray(waOutbox.status, ["pending", "failed"]),
				or(isNull(waOutbox.nextAttemptAt), lte(waOutbox.nextAttemptAt, now)),
			),
		)
		.orderBy(desc(waOutbox.priority))
		.limit(batchSize);
};

const markOutboxAttempt = async (outboxId: string, attempts: number) => {
	await db
		.update(waOutbox)
		.set({
			status: "processing",
			attempts,
			lastAttemptAt: new Date(),
		})
		.where(eq(waOutbox.id, outboxId));
};

const markOutboxSuccess = async (params: {
	outboxId: string;
	messageId: string;
	providerMessageId?: string;
}) => {
	await db
		.update(waOutbox)
		.set({
			status: "sent",
			nextAttemptAt: null,
			errorMessage: null,
		})
		.where(eq(waOutbox.id, params.outboxId));

	await db
		.update(waMessages)
		.set({
			status: "sent",
			statusUpdatedAt: new Date(),
			providerMessageId: params.providerMessageId ?? null,
			errorMessage: null,
			errorCode: null,
		})
		.where(eq(waMessages.id, params.messageId));
};

const markOutboxFailure = async (params: {
	outboxId: string;
	messageId: string;
	attempts: number;
	maxAttempts: number;
	errorMessage: string;
}) => {
	const nextAttemptAt =
		params.attempts >= params.maxAttempts
			? null
			: computeNextAttemptAt(params.attempts);

	await db
		.update(waOutbox)
		.set({
			status: "failed",
			nextAttemptAt,
			errorMessage: params.errorMessage,
		})
		.where(eq(waOutbox.id, params.outboxId));

	await db
		.update(waMessages)
		.set({
			status: "failed",
			statusUpdatedAt: new Date(),
			errorMessage: params.errorMessage,
		})
		.where(eq(waMessages.id, params.messageId));
};

const processOutboxItem = async (item: {
	outbox: typeof waOutbox.$inferSelect;
	message: typeof waMessages.$inferSelect;
	account: typeof waAccounts.$inferSelect;
	contact: typeof waContacts.$inferSelect;
}) => {
	const attempts = (item.outbox.attempts ?? 0) + 1;
	const maxAttempts = item.outbox.maxAttempts ?? 3;
	await markOutboxAttempt(item.outbox.id, attempts);

	if (item.account.provider !== "cloud_api") {
		await markOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: "Unsupported provider",
		});
		return;
	}

	if (!item.account.accessToken || !item.account.phoneNumberId) {
		await markOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: "Missing Cloud API credentials",
		});
		return;
	}

	if (item.message.type !== "text" || !item.message.textBody) {
		await markOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: "Only text messages are supported in outbox worker",
		});
		return;
	}

	const provider = new CloudApiProvider({
		accessToken: item.account.accessToken,
		phoneNumberId: item.account.phoneNumberId,
	});

	const recipient = item.contact.phoneNumber || item.contact.waId;
	if (!recipient) {
		await markOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: "Missing recipient phone number",
		});
		return;
	}

	const result = await provider.messaging.sendText({
		to: recipient,
		text: item.message.textBody,
	});

	if (!result.success) {
		await markOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: result.error?.message ?? "Failed to send message",
		});
		return;
	}

	await markOutboxSuccess({
		outboxId: item.outbox.id,
		messageId: item.message.id,
		providerMessageId: result.providerMessageId,
	});
};

const runBatch = async () => {
	const batch = await fetchOutboxBatch();
	for (const item of batch) {
		try {
			await processOutboxItem(item);
		} catch (error) {
			logger.error("Failed to process outbox item", {
				outboxId: item.outbox.id,
				error,
			});
		}
	}
};

const run = async () => {
	logger.info("WhatsApp outbox worker started", {
		pollIntervalMs,
		batchSize,
	});

	await runBatch();
	setInterval(runBatch, pollIntervalMs);
};

run().catch((error) => {
	logger.error("WhatsApp outbox worker failed", { error });
	process.exit(1);
});
