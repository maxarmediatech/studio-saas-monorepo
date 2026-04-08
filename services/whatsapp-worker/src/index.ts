import crypto from "node:crypto";
import {
	and,
	db,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	lte,
	or,
	sql,
} from "@repo/database";
import { logger } from "@repo/logs";
import {
	waAccounts,
	waContacts,
	waMedia,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import { CloudApiProvider } from "@repo/whatsapp-providers";
import { getUploadsBucketName } from "../../../packages/env";
import { getSignedUrl } from "../../../packages/storage";
import { ingestCloudApiMediaAsset } from "./cloud-api-media";

const pollIntervalMs = Number(process.env.WHATSAPP_OUTBOX_INTERVAL_MS ?? 5000);
const batchSize = Number(process.env.WHATSAPP_OUTBOX_BATCH_SIZE ?? 10);
const DEFAULT_CLOUD_API_VERSION = "v22.0";
const inboundMediaMaxAttempts = Number(
	process.env.WHATSAPP_MEDIA_MAX_ATTEMPTS ?? 5,
);
const outboundMediaUrlExpirySeconds = Number(
	process.env.WHATSAPP_MEDIA_SEND_URL_TTL_SECONDS ?? 15 * 60,
);

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

const fetchInboundMediaBatch = async () =>
	db
		.select({
			account: waAccounts,
			media: waMedia,
			message: waMessages,
		})
		.from(waMedia)
		.innerJoin(waMessages, eq(waMessages.mediaId, waMedia.id))
		.innerJoin(waAccounts, eq(waMessages.accountId, waAccounts.id))
		.where(
			and(
				eq(waMessages.direction, "inbound"),
				eq(waAccounts.provider, "cloud_api"),
				isNotNull(waMedia.providerMediaId),
				eq(waMedia.ingestStatus, "pending"),
				or(
					isNull(waMedia.nextIngestAttemptAt),
					lte(waMedia.nextIngestAttemptAt, new Date()),
				),
			),
		)
		.orderBy(desc(waMessages.createdAt))
		.limit(batchSize);

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

const markInboundMediaReady = async (params: {
	mediaId: string;
	fileName: string | null;
	fileSize: number | null;
	mimeType: string;
	storageUrl: string;
}) => {
	await db
		.update(waMedia)
		.set({
			fileName: params.fileName,
			fileSize: params.fileSize,
			ingestStatus: "ready",
			ingestErrorMessage: null,
			mimeType: params.mimeType,
			nextIngestAttemptAt: null,
			storageType: "s3",
			storageUrl: params.storageUrl,
		})
		.where(eq(waMedia.id, params.mediaId));
};

const claimInboundMedia = async (mediaId: string) => {
	const [claimed] = await db
		.update(waMedia)
		.set({
			ingestStatus: "processing",
			ingestAttempts: sql`coalesce(${waMedia.ingestAttempts}, 0) + 1`,
			lastIngestAttemptAt: new Date(),
			nextIngestAttemptAt: null,
			ingestErrorMessage: null,
		})
		.where(
			and(eq(waMedia.id, mediaId), eq(waMedia.ingestStatus, "pending")),
		)
		.returning({
			id: waMedia.id,
			ingestAttempts: waMedia.ingestAttempts,
		});

	return claimed ?? null;
};

const markInboundMediaFailure = async (params: {
	mediaId: string;
	attempts: number;
	errorMessage: string;
}) => {
	const exhausted = params.attempts >= inboundMediaMaxAttempts;

	await db
		.update(waMedia)
		.set({
			ingestStatus: exhausted ? "failed" : "pending",
			ingestErrorMessage: params.errorMessage,
			nextIngestAttemptAt: exhausted
				? null
				: computeNextAttemptAt(params.attempts),
			storageUrl: null,
		})
		.where(eq(waMedia.id, params.mediaId));
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
						const subTypeValue = component.subType;
						const indexValue = component.index;

						const next: {
							type: string;
							parameters?: Array<Record<string, unknown>>;
							subType?: string;
							index?: number;
						} = { type: componentType };

						if (parameters) {
							next.parameters = parameters;
						}

						if (
							typeof subTypeValue === "string" &&
							subTypeValue.length > 0
						) {
							next.subType = subTypeValue;
						}

						if (
							typeof indexValue === "number" &&
							Number.isInteger(indexValue) &&
							indexValue >= 0
						) {
							next.index = indexValue;
						}

						return next;
					})
					.filter(
						(
							component,
						): component is {
							type: string;
							parameters?: Array<Record<string, unknown>>;
							subType?: string;
							index?: number;
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

	let resolvedMediaUrl = mediaUrl;
	if (item.media?.storageType === "s3") {
		resolvedMediaUrl = await getSignedUrl(mediaUrl, {
			bucket: getUploadsBucketName(),
			expiresIn: outboundMediaUrlExpirySeconds,
		});
	}

	const result = await provider.messaging.sendMedia({
		to: recipient,
		mediaUrl: resolvedMediaUrl,
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

const processInboundMediaItem = async (item: {
	account: typeof waAccounts.$inferSelect;
	media: typeof waMedia.$inferSelect;
	message: typeof waMessages.$inferSelect;
}) => {
	if (!item.media.providerMediaId) {
		return;
	}

	if (!item.account.accessToken) {
		throw new Error("Missing WhatsApp access token for inbound media");
	}

	const claimed = await claimInboundMedia(item.media.id);
	if (!claimed) {
		return;
	}

	try {
		const mediaAsset = await ingestCloudApiMediaAsset({
			accessToken: decryptStoredSecret(item.account.accessToken),
			accountId: item.account.id,
			organizationId: item.account.organizationId,
			apiVersion:
				item.account.apiVersion?.trim() || DEFAULT_CLOUD_API_VERSION,
			fileName: item.media.fileName,
			mediaId: item.media.providerMediaId,
			messageType: item.message.type,
			mimeType: item.media.mimeType,
		});

		await markInboundMediaReady({
			mediaId: item.media.id,
			fileName: mediaAsset.fileName,
			fileSize: mediaAsset.fileSize,
			mimeType: mediaAsset.mimeType,
			storageUrl: mediaAsset.storageUrl,
		});
	} catch (error) {
		await markInboundMediaFailure({
			mediaId: item.media.id,
			attempts: claimed.ingestAttempts ?? 1,
			errorMessage:
				error instanceof Error
					? error.message
					: "Unknown media ingest error",
		});
		throw error;
	}
};

const runBatch = async () => {
	const mediaBatch = await fetchInboundMediaBatch();
	for (const item of mediaBatch) {
		try {
			await processInboundMediaItem(item);
		} catch (error) {
			logger.error("Failed to ingest inbound WhatsApp media", {
				accountId: item.account.id,
				mediaId: item.media.id,
				providerMediaId: item.media.providerMediaId,
				error,
			});
		}
	}

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
	logger.error("WhatsApp outbox worker failed", { error });
	process.exit(1);
});
