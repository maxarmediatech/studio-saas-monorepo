import crypto from "node:crypto";
import { and, db, desc, eq, inArray, isNull, lte, or } from "@repo/database";
import { logger } from "@repo/logs";
import {
	waAccounts,
	waContacts,
	waMedia,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import { CloudApiProvider } from "@repo/whatsapp-providers";

const pollIntervalMs = Number(process.env.WHATSAPP_OUTBOX_INTERVAL_MS ?? 5000);
const batchSize = Number(process.env.WHATSAPP_OUTBOX_BATCH_SIZE ?? 10);

const decryptStoredSecret = (value: string) => {
	if (!value.startsWith("v1:")) {
		return value;
	}

	const rawKey = process.env.INTEGRATIONS_TOKEN_ENCRYPTION_KEY;
	if (!rawKey) {
		throw new Error("Missing INTEGRATIONS_TOKEN_ENCRYPTION_KEY");
	}

	const key = Buffer.from(rawKey, "base64");
	if (key.length !== 32) {
		throw new Error(
			"INTEGRATIONS_TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded)",
		);
	}

	const parts = value.split(":");
	if (parts.length !== 4 || parts[0] !== "v1") {
		throw new Error("Invalid encrypted token format");
	}

	const iv = Buffer.from(parts[1], "base64");
	const ciphertext = Buffer.from(parts[2], "base64");
	const tag = Buffer.from(parts[3], "base64");
	const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
	decipher.setAuthTag(tag);
	const plaintext = Buffer.concat([
		decipher.update(ciphertext),
		decipher.final(),
	]);
	return plaintext.toString("utf8");
};

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
			media: waMedia,
		})
		.from(waOutbox)
		.innerJoin(waMessages, eq(waOutbox.messageId, waMessages.id))
		.innerJoin(waAccounts, eq(waOutbox.accountId, waAccounts.id))
		.innerJoin(waContacts, eq(waMessages.contactId, waContacts.id))
		.leftJoin(waMedia, eq(waMessages.mediaId, waMedia.id))
		.where(
			and(
				inArray(waOutbox.status, ["pending", "failed"]),
				or(
					isNull(waOutbox.nextAttemptAt),
					lte(waOutbox.nextAttemptAt, now),
				),
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

const processOutboxItem = async (item: {
	outbox: typeof waOutbox.$inferSelect;
	message: typeof waMessages.$inferSelect;
	account: typeof waAccounts.$inferSelect;
	contact: typeof waContacts.$inferSelect;
	media: typeof waMedia.$inferSelect | null;
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

	const provider = new CloudApiProvider({
		accessToken: decryptStoredSecret(item.account.accessToken),
		phoneNumberId: item.account.phoneNumberId,
		apiVersion: item.account.apiVersion ?? undefined,
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

	const messageType = item.message.type;

	if (messageType === "text") {
		if (!item.message.textBody) {
			await markOutboxFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				errorMessage: "Missing text body",
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
		return;
	}

	if (messageType === "template") {
		if (!item.message.templateName) {
			await markOutboxFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				errorMessage: "Missing template name",
			});
			return;
		}

		if (!provider.messaging.sendTemplate) {
			await markOutboxFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				errorMessage: "Provider does not support template sending",
			});
			return;
		}

		const templateParams = item.message.templateParams;
		if (!isRecord(templateParams)) {
			await markOutboxFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				errorMessage: "Missing template parameters",
			});
			return;
		}

		const languageValue = templateParams.language;
		const language =
			typeof languageValue === "string" ? languageValue : null;
		if (!language) {
			await markOutboxFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				errorMessage: "Missing template language",
			});
			return;
		}

		const componentsValue = templateParams.components;
		const components = Array.isArray(componentsValue)
			? componentsValue
					.filter(isRecord)
					.map((component) => {
						const componentType = component.type;
						if (
							typeof componentType !== "string" ||
							!componentType
						) {
							return null;
						}

						const parametersValue = component.parameters;
						const parameters = Array.isArray(parametersValue)
							? parametersValue.filter(isRecord)
							: undefined;

						const next: {
							type: string;
							parameters?: Array<Record<string, unknown>>;
						} = { type: componentType };

						if (parameters) {
							next.parameters = parameters;
						}

						return next;
					})
					.filter(
						(
							component,
						): component is {
							type: string;
							parameters?: Array<Record<string, unknown>>;
						} => component !== null,
					)
			: [];

		const result = await provider.messaging.sendTemplate({
			to: recipient,
			templateName: item.message.templateName,
			language,
			components,
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
		return;
	}

	const mediaType =
		messageType === "image" ||
		messageType === "video" ||
		messageType === "audio" ||
		messageType === "document" ||
		messageType === "sticker"
			? messageType
			: null;

	if (!mediaType) {
		await markOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: `Unsupported message type: ${messageType}`,
		});
		return;
	}

	const mediaUrl = item.media?.storageUrl;
	if (typeof mediaUrl !== "string" || !mediaUrl) {
		await markOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: "Missing media URL",
		});
		return;
	}

	const result = await provider.messaging.sendMedia({
		to: recipient,
		mediaUrl,
		mediaType,
		caption: item.message.caption ?? undefined,
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
			const attempts = (item.outbox.attempts ?? 0) + 1;
			const maxAttempts = item.outbox.maxAttempts ?? 3;
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			logger.error("Failed to process outbox item", {
				outboxId: item.outbox.id,
				error,
			});

			await markOutboxFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				errorMessage,
			}).catch((markError) => {
				logger.error("Failed to mark outbox item as failed", {
					outboxId: item.outbox.id,
					error: markError,
				});
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
