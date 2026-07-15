import { and, db, eq, inArray, isNull, lte, or, sql } from "@repo/database";
import type { CloudApiWebhookEvent } from "@repo/whatsapp-core";
import {
	waAccounts,
	waConversations,
	waEvents,
	waMedia,
	waMessages,
} from "@repo/whatsapp-db";
import { enqueueInboundAutomationRuns } from "./automation-triggers";
import { transitionWhatsAppMessage } from "./delivery-transitions";
import {
	ensureWhatsAppContactIdentity,
	findWhatsAppProviderMessageIdentity,
} from "./identity-compat";
import type { WhatsAppTransaction } from "./types";

type WhatsAppAccount = typeof waAccounts.$inferSelect;
const DEFAULT_LEASE_MS = 5 * 60 * 1000;

const retryAt = (attempts: number, now: Date) =>
	new Date(
		now.getTime() +
			Math.min(30 * 2 ** Math.max(0, attempts - 1), 900) * 1000,
	);

const isWebhookEvent = (value: unknown): value is CloudApiWebhookEvent =>
	typeof value === "object" &&
	value !== null &&
	"type" in value &&
	(value.type === "message.inbound" || value.type === "message.status");

const hydrateWebhookEvent = (
	event: CloudApiWebhookEvent,
): CloudApiWebhookEvent => ({
	...event,
	timestamp:
		event.timestamp instanceof Date
			? event.timestamp
			: new Date(event.timestamp as unknown as string),
});

const storedEventPayload = (payload: unknown) => {
	if (isWebhookEvent(payload)) {
		return { event: hydrateWebhookEvent(payload), rawPayload: payload };
	}
	if (
		typeof payload === "object" &&
		payload !== null &&
		"event" in payload &&
		isWebhookEvent(payload.event)
	) {
		return {
			event: hydrateWebhookEvent(payload.event),
			rawPayload:
				"rawPayload" in payload ? payload.rawPayload : payload.event,
		};
	}
	throw new Error("Stored WhatsApp event payload is invalid");
};

const ensureConversation = async (
	tx: WhatsAppTransaction,
	params: { organizationId: string; accountId: string; contactId: string },
) => {
	const [created] = await tx
		.insert(waConversations)
		.values(params)
		.onConflictDoNothing({
			target: [waConversations.accountId, waConversations.contactId],
		})
		.returning({ id: waConversations.id });
	if (created) {
		return created.id;
	}

	const [existing] = await tx
		.select({ id: waConversations.id })
		.from(waConversations)
		.where(
			and(
				eq(waConversations.organizationId, params.organizationId),
				eq(waConversations.accountId, params.accountId),
				eq(waConversations.contactId, params.contactId),
			),
		)
		.limit(1);
	if (!existing) {
		throw new Error("Failed to resolve WhatsApp conversation");
	}
	return existing.id;
};

const processInbound = async (
	tx: WhatsAppTransaction,
	event: Extract<CloudApiWebhookEvent, { type: "message.inbound" }>,
	account: WhatsAppAccount,
	rawPayload: unknown,
) => {
	const existingMessageId = await findWhatsAppProviderMessageIdentity(tx, {
		accountId: account.id,
		providerMessageId: event.providerMessageId,
	});
	if (existingMessageId) {
		return;
	}

	const contactId = await ensureWhatsAppContactIdentity(tx, {
		organizationId: account.organizationId,
		accountId: account.id,
		waId: event.from,
	});
	const conversationId = await ensureConversation(tx, {
		organizationId: account.organizationId,
		accountId: account.id,
		contactId,
	});

	let mediaId: string | null = null;
	if (event.content.mediaId) {
		const [media] = await tx
			.insert(waMedia)
			.values({
				organizationId: account.organizationId,
				providerMediaId: event.content.mediaId,
				mimeType: event.content.mimeType ?? "application/octet-stream",
				fileName: event.content.fileName ?? null,
				storageType: "s3",
				storageUrl: null,
				ingestStatus: "pending",
				ingestAttempts: 0,
				nextIngestAttemptAt: new Date(),
			})
			.returning({ id: waMedia.id });
		if (!media) {
			throw new Error("Failed to create WhatsApp media");
		}
		mediaId = media.id;
	}

	const [created] = await tx
		.insert(waMessages)
		.values({
			organizationId: account.organizationId,
			accountId: account.id,
			conversationId,
			contactId,
			providerMessageId: event.providerMessageId,
			providerTimestamp: event.timestamp,
			direction: "inbound",
			type: event.messageType,
			textBody: event.content.text ?? null,
			caption: event.content.caption ?? null,
			mediaId,
			status: "delivered",
			statusUpdatedAt: new Date(),
			rawPayload,
		})
		.returning({ id: waMessages.id });
	if (!created) {
		return;
	}

	await tx
		.update(waConversations)
		.set({
			lastMessageId: created.id,
			lastMessageAt: event.timestamp,
			lastMessagePreview: event.content.text ?? event.messageType,
			unreadCount: sql`coalesce(${waConversations.unreadCount}, 0) + 1`,
			updatedAt: new Date(),
		})
		.where(eq(waConversations.id, conversationId));

	await enqueueInboundAutomationRuns(tx, {
		organizationId: account.organizationId,
		accountId: account.id,
		contactId,
		conversationId,
		inboundMessageId: created.id,
		inboundText: event.content.text ?? "",
		triggerIdentity: `inbound:${event.providerMessageId}`,
	});
};

const applyEvent = async (
	tx: WhatsAppTransaction,
	event: CloudApiWebhookEvent,
	account: WhatsAppAccount,
	rawPayload: unknown,
) => {
	if (event.type === "message.inbound") {
		await processInbound(tx, event, account, rawPayload);
		return;
	}
	const result = await transitionWhatsAppMessage(tx, {
		accountId: account.id,
		lookupProviderMessageId: event.providerMessageId,
		status: event.status,
		at: event.timestamp,
		errorCode: event.error?.code ?? null,
		errorMessage: event.error?.message ?? null,
	});
	if (result.reason === "not_found") {
		throw new Error("Message not found for WhatsApp status update");
	}
};

export const reconcileStoredWhatsAppStatusEvents = async (
	tx: WhatsAppTransaction,
	params: {
		accountId: string;
		messageId: string;
		providerMessageId: string;
		now?: Date;
	},
) => {
	const storedEvents = await tx
		.select()
		.from(waEvents)
		.where(
			and(
				eq(waEvents.accountId, params.accountId),
				eq(waEvents.eventType, "message.status"),
				isNull(waEvents.processedAt),
				sql`coalesce(
					${waEvents.payload}->'event'->>'providerMessageId',
					${waEvents.payload}->>'providerMessageId'
				) = ${params.providerMessageId}`,
			),
		)
		.orderBy(waEvents.createdAt, waEvents.id)
		.for("update");

	const processedAt = params.now ?? new Date();
	for (const stored of storedEvents) {
		const payload = storedEventPayload(stored.payload);
		if (
			payload.event.type !== "message.status" ||
			payload.event.providerMessageId !== params.providerMessageId
		) {
			continue;
		}
		await transitionWhatsAppMessage(tx, {
			messageId: params.messageId,
			status: payload.event.status,
			at: payload.event.timestamp,
			errorCode: payload.event.error?.code ?? null,
			errorMessage: payload.event.error?.message ?? null,
		});
		await tx
			.update(waEvents)
			.set({
				processingStatus: "processed",
				processedAt,
				nextAttemptAt: processedAt,
				lockedBy: null,
				leaseExpiresAt: null,
				errorMessage: null,
			})
			.where(eq(waEvents.id, stored.id));
	}

	return storedEvents.length;
};

export const processWhatsAppEventById = async (params: {
	eventId: string;
	workerId: string;
	now?: Date;
	leaseMs?: number;
}) => {
	const now = params.now ?? new Date();
	const [claimed] = await db
		.update(waEvents)
		.set({
			processingStatus: "processing",
			attempts: sql`${waEvents.attempts} + 1`,
			lastAttemptAt: now,
			lockedBy: params.workerId,
			leaseExpiresAt: new Date(
				now.getTime() + (params.leaseMs ?? DEFAULT_LEASE_MS),
			),
			errorMessage: null,
		})
		.where(
			and(
				eq(waEvents.id, params.eventId),
				isNull(waEvents.processedAt),
				or(
					and(
						inArray(waEvents.processingStatus, [
							"pending",
							"failed",
						]),
						lte(waEvents.nextAttemptAt, now),
					),
					and(
						eq(waEvents.processingStatus, "processing"),
						lte(waEvents.leaseExpiresAt, now),
					),
				),
				sql`${waEvents.attempts} < ${waEvents.maxAttempts}`,
			),
		)
		.returning({
			attempts: waEvents.attempts,
			maxAttempts: waEvents.maxAttempts,
		});
	if (!claimed) {
		return { status: "skipped" as const };
	}

	try {
		await db.transaction(async (tx) => {
			const [stored] = await tx
				.select()
				.from(waEvents)
				.where(
					and(
						eq(waEvents.id, params.eventId),
						eq(waEvents.processingStatus, "processing"),
						eq(waEvents.lockedBy, params.workerId),
					),
				)
				.for("update");
			if (!stored) {
				throw new Error("WhatsApp event lease was lost");
			}
			const [account] = await tx
				.select()
				.from(waAccounts)
				.where(eq(waAccounts.id, stored.accountId))
				.limit(1);
			if (!account) {
				throw new Error("WhatsApp event account no longer exists");
			}
			const payload = storedEventPayload(stored.payload);
			await applyEvent(tx, payload.event, account, payload.rawPayload);
			await tx
				.update(waEvents)
				.set({
					processingStatus: "processed",
					processedAt: new Date(),
					nextAttemptAt: now,
					lockedBy: null,
					leaseExpiresAt: null,
					errorMessage: null,
				})
				.where(eq(waEvents.id, stored.id));
		});
		return { status: "processed" as const };
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		const exhausted = claimed.attempts >= claimed.maxAttempts;
		await db
			.update(waEvents)
			.set({
				processingStatus: "failed",
				nextAttemptAt: exhausted ? now : retryAt(claimed.attempts, now),
				lockedBy: null,
				leaseExpiresAt: null,
				errorMessage,
			})
			.where(
				and(
					eq(waEvents.id, params.eventId),
					eq(waEvents.lockedBy, params.workerId),
				),
			);
		return { status: "failed" as const, exhausted, errorMessage };
	}
};

export const processDueWhatsAppEvents = async (params: {
	workerId: string;
	limit?: number;
	now?: Date;
}) => {
	const now = params.now ?? new Date();
	const due = await db
		.select({ id: waEvents.id })
		.from(waEvents)
		.where(
			and(
				isNull(waEvents.processedAt),
				or(
					and(
						inArray(waEvents.processingStatus, [
							"pending",
							"failed",
						]),
						lte(waEvents.nextAttemptAt, now),
					),
					and(
						eq(waEvents.processingStatus, "processing"),
						lte(waEvents.leaseExpiresAt, now),
					),
				),
				sql`${waEvents.attempts} < ${waEvents.maxAttempts}`,
			),
		)
		.limit(params.limit ?? 10);

	for (const event of due) {
		await processWhatsAppEventById({
			eventId: event.id,
			workerId: params.workerId,
			now,
		});
	}
	return due.length;
};
