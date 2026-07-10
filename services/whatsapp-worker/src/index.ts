import crypto from "node:crypto";
import {
	and,
	db,
	desc,
	eq,
	isNotNull,
	isNull,
	lte,
	or,
	sql,
} from "@repo/database";
import { logger } from "@repo/logs";
import { waAccounts, waMedia, waMessages } from "@repo/whatsapp-db";
import {
	fetchDueWhatsAppOutboxItems,
	markWhatsAppOutboxFailure,
	processWhatsAppOutboxItem,
} from "@repo/whatsapp-outbox";
import { ingestCloudApiMediaAsset } from "./cloud-api-media";

const pollIntervalMs = Number(process.env.WHATSAPP_OUTBOX_INTERVAL_MS ?? 5000);
const batchSize = Number(process.env.WHATSAPP_OUTBOX_BATCH_SIZE ?? 10);
const DEFAULT_CLOUD_API_VERSION = "v22.0";
const inboundMediaMaxAttempts = Number(
	process.env.WHATSAPP_MEDIA_MAX_ATTEMPTS ?? 5,
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

	const batch = await fetchDueWhatsAppOutboxItems({ limit: batchSize });
	for (const item of batch) {
		try {
			await processWhatsAppOutboxItem(item);
		} catch (error) {
			const attempts = (item.outbox.attempts ?? 0) + 1;
			const maxAttempts = item.outbox.maxAttempts ?? 3;
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			logger.error("Failed to process outbox item", {
				outboxId: item.outbox.id,
				error,
			});

			await markWhatsAppOutboxFailure({
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
