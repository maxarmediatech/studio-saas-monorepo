import crypto from "node:crypto";
import {
	and,
	db,
	desc,
	eq,
	inArray,
	isNull,
	lte,
	or,
	sql,
} from "@repo/database";
import { getUploadsBucketName } from "@repo/env";
import { getSignedUrl } from "@repo/storage";
import {
	waAccounts,
	waContacts,
	waMedia,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import { CloudApiProvider } from "@repo/whatsapp-providers";

const DEFAULT_BATCH_SIZE = 10;
const OUTBOUND_MEDIA_URL_EXPIRY_SECONDS = Number(
	process.env.WHATSAPP_MEDIA_SEND_URL_TTL_SECONDS ?? 15 * 60,
);

type OutboxItem = {
	outbox: typeof waOutbox.$inferSelect;
	message: typeof waMessages.$inferSelect;
	account: typeof waAccounts.$inferSelect;
	contact: typeof waContacts.$inferSelect;
	media: typeof waMedia.$inferSelect | null;
};

type ProviderSendError = {
	code?: string;
	message?: string;
};

function decryptStoredSecret(value: string) {
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
}

function computeNextAttemptAt(attempts: number) {
	const delaySeconds = Math.min(30 * attempts, 15 * 60);
	return new Date(Date.now() + delaySeconds * 1000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: "Unknown WhatsApp send error";
}

function isPermanentProviderError(error: ProviderSendError | undefined) {
	const code = error?.code;
	const message = error?.message?.toLowerCase() ?? "";

	if (code && ["10", "100", "190", "200", "368", "131031"].includes(code)) {
		return true;
	}

	return (
		message.includes("authentication") ||
		message.includes("access token") ||
		message.includes("permission") ||
		message.includes("unsupported post request") ||
		message.includes("does not exist") ||
		message.includes("recipient phone number not in allowed list")
	);
}

function canAttemptOutboxItem() {
	return sql`coalesce(${waOutbox.attempts}, 0) < coalesce(${waOutbox.maxAttempts}, 3)`;
}

async function claimOutboxItem(item: OutboxItem) {
	const now = new Date();
	const [claimed] = await db
		.update(waOutbox)
		.set({
			status: "processing",
			attempts: sql`coalesce(${waOutbox.attempts}, 0) + 1`,
			lastAttemptAt: now,
			nextAttemptAt: null,
			errorMessage: null,
		})
		.where(
			and(
				eq(waOutbox.id, item.outbox.id),
				inArray(waOutbox.status, ["pending", "failed"]),
				or(
					isNull(waOutbox.nextAttemptAt),
					lte(waOutbox.nextAttemptAt, now),
				),
				canAttemptOutboxItem(),
			),
		)
		.returning({
			attempts: waOutbox.attempts,
			maxAttempts: waOutbox.maxAttempts,
		});

	return claimed ?? null;
}

async function markOutboxSuccess(params: {
	outboxId: string;
	messageId: string;
	providerMessageId?: string;
}) {
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
}

export async function markWhatsAppOutboxFailure(params: {
	outboxId: string;
	messageId: string;
	attempts: number;
	maxAttempts: number;
	errorMessage: string;
	retryable?: boolean;
}) {
	const nextAttemptAt =
		params.retryable === false || params.attempts >= params.maxAttempts
			? null
			: computeNextAttemptAt(params.attempts);

	await db
		.update(waOutbox)
		.set({
			status: "failed",
			attempts:
				params.retryable === false
					? params.maxAttempts
					: params.attempts,
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
}

async function markProviderFailure(params: {
	outboxId: string;
	messageId: string;
	attempts: number;
	maxAttempts: number;
	error?: ProviderSendError;
	defaultMessage: string;
}) {
	await markWhatsAppOutboxFailure({
		outboxId: params.outboxId,
		messageId: params.messageId,
		attempts: params.attempts,
		maxAttempts: params.maxAttempts,
		errorMessage: params.error?.message ?? params.defaultMessage,
		retryable: !isPermanentProviderError(params.error),
	});
}

export async function fetchWhatsAppOutboxItem(outboxId: string) {
	const [item] = await db
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
		.where(eq(waOutbox.id, outboxId))
		.limit(1);

	return item ?? null;
}

export async function fetchDueWhatsAppOutboxItems({
	limit = DEFAULT_BATCH_SIZE,
}: {
	limit?: number;
} = {}) {
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
				canAttemptOutboxItem(),
			),
		)
		.orderBy(desc(waOutbox.priority))
		.limit(limit);
}

export async function processWhatsAppOutboxItem(item: OutboxItem) {
	const claim = await claimOutboxItem(item);
	if (!claim) {
		return { status: "skipped" as const };
	}

	const attempts = claim.attempts ?? (item.outbox.attempts ?? 0) + 1;
	const maxAttempts = claim.maxAttempts ?? item.outbox.maxAttempts ?? 3;

	try {
		return await deliverClaimedOutboxItem({
			attempts,
			item,
			maxAttempts,
		});
	} catch (error) {
		await markWhatsAppOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: getErrorMessage(error),
		});

		return { status: "failed" as const };
	}
}

async function deliverClaimedOutboxItem({
	attempts,
	item,
	maxAttempts,
}: {
	attempts: number;
	item: OutboxItem;
	maxAttempts: number;
}) {
	if (item.account.provider !== "cloud_api") {
		await markWhatsAppOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: "Unsupported provider",
		});
		return { status: "failed" as const };
	}

	if (!item.account.accessToken || !item.account.phoneNumberId) {
		await markWhatsAppOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: "Missing Cloud API credentials",
		});
		return { status: "failed" as const };
	}

	const provider = new CloudApiProvider({
		accessToken: decryptStoredSecret(item.account.accessToken),
		phoneNumberId: item.account.phoneNumberId,
		apiVersion: item.account.apiVersion ?? undefined,
	});

	const recipient = item.contact.phoneNumber || item.contact.waId;
	if (!recipient) {
		await markWhatsAppOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: "Missing recipient phone number",
		});
		return { status: "failed" as const };
	}

	const messageType = item.message.type;

	if (messageType === "text") {
		if (!item.message.textBody) {
			await markWhatsAppOutboxFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				errorMessage: "Missing text body",
			});
			return { status: "failed" as const };
		}

		const result = await provider.messaging.sendText({
			to: recipient,
			text: item.message.textBody,
		});

		if (!result.success) {
			await markProviderFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				error: result.error,
				defaultMessage: "Failed to send message",
			});
			return { status: "failed" as const };
		}

		await markOutboxSuccess({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			providerMessageId: result.providerMessageId,
		});
		return { status: "sent" as const };
	}

	if (messageType === "template") {
		if (!item.message.templateName) {
			await markWhatsAppOutboxFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				errorMessage: "Missing template name",
			});
			return { status: "failed" as const };
		}

		if (!provider.messaging.sendTemplate) {
			await markWhatsAppOutboxFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				errorMessage: "Provider does not support template sending",
			});
			return { status: "failed" as const };
		}

		const templateParams = item.message.templateParams;
		if (!isRecord(templateParams)) {
			await markWhatsAppOutboxFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				errorMessage: "Missing template parameters",
			});
			return { status: "failed" as const };
		}

		const languageValue = templateParams.language;
		const language =
			typeof languageValue === "string" ? languageValue : null;
		if (!language) {
			await markWhatsAppOutboxFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				errorMessage: "Missing template language",
			});
			return { status: "failed" as const };
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
			await markProviderFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				attempts,
				maxAttempts,
				error: result.error,
				defaultMessage: "Failed to send message",
			});
			return { status: "failed" as const };
		}

		await markOutboxSuccess({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			providerMessageId: result.providerMessageId,
		});
		return { status: "sent" as const };
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
		await markWhatsAppOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: `Unsupported message type: ${messageType}`,
		});
		return { status: "failed" as const };
	}

	const mediaUrl = item.media?.storageUrl;
	if (typeof mediaUrl !== "string" || !mediaUrl) {
		await markWhatsAppOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			errorMessage: "Missing media URL",
		});
		return { status: "failed" as const };
	}

	let resolvedMediaUrl = mediaUrl;
	if (item.media?.storageType === "s3") {
		resolvedMediaUrl = await getSignedUrl(mediaUrl, {
			bucket: getUploadsBucketName(),
			expiresIn: OUTBOUND_MEDIA_URL_EXPIRY_SECONDS,
		});
	}

	const result = await provider.messaging.sendMedia({
		to: recipient,
		mediaUrl: resolvedMediaUrl,
		mediaType,
		caption: item.message.caption ?? undefined,
	});

	if (!result.success) {
		await markProviderFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			attempts,
			maxAttempts,
			error: result.error,
			defaultMessage: "Failed to send message",
		});
		return { status: "failed" as const };
	}

	await markOutboxSuccess({
		outboxId: item.outbox.id,
		messageId: item.message.id,
		providerMessageId: result.providerMessageId,
	});
	return { status: "sent" as const };
}

export async function processWhatsAppOutboxById(outboxId: string) {
	const item = await fetchWhatsAppOutboxItem(outboxId);
	if (!item) {
		return { status: "missing" as const };
	}

	if (item.outbox.status === "sent") {
		return { status: "already_sent" as const };
	}

	return processWhatsAppOutboxItem(item);
}
