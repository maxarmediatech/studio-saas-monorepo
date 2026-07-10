import { and, db, eq, sql } from "@repo/database";
import { logger } from "@repo/logs";
import {
	type CloudApiWebhookEvent,
	parseCloudApiWebhook,
} from "@repo/whatsapp-core";
import {
	waAccounts,
	waContacts,
	waConversations,
	waEvents,
	waMedia,
	waMessages,
} from "@repo/whatsapp-db";
import {
	enqueueInboundAutomationRuns,
	transitionWhatsAppMessage,
} from "@repo/whatsapp-runtime";

type WhatsAppAccount = typeof waAccounts.$inferSelect;
type WhatsAppTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const getStatusEventId = (messageId: string, status: string, timestamp: Date) =>
	`${messageId}:${status}:${timestamp.getTime()}`;

const resolveAccount = (phoneNumberId: string, token: string) =>
	db.query.waAccounts.findFirst({
		where: and(
			eq(waAccounts.phoneNumberId, phoneNumberId),
			eq(waAccounts.webhookVerifyToken, token),
		),
	});

const ensureStoredEvent = async (params: {
	organizationId: string;
	accountId: string;
	providerEventId: string;
	eventType: string;
	payload: unknown;
}) => {
	const [created] = await db
		.insert(waEvents)
		.values(params)
		.onConflictDoNothing({
			target: [waEvents.accountId, waEvents.providerEventId],
		})
		.returning({ id: waEvents.id });

	if (created) {
		return created.id;
	}

	const existing = await db.query.waEvents.findFirst({
		columns: { id: true },
		where: and(
			eq(waEvents.accountId, params.accountId),
			eq(waEvents.providerEventId, params.providerEventId),
		),
	});

	if (!existing) {
		throw new Error("Failed to find stored WhatsApp event after conflict");
	}

	return existing.id;
};

const ensureContact = async (
	tx: WhatsAppTransaction,
	params: { organizationId: string; accountId: string; waId: string },
) => {
	const [created] = await tx
		.insert(waContacts)
		.values({
			organizationId: params.organizationId,
			accountId: params.accountId,
			waId: params.waId,
			phoneNumber: params.waId,
		})
		.onConflictDoNothing({
			target: [waContacts.accountId, waContacts.waId],
		})
		.returning({ id: waContacts.id });

	if (created) {
		return created.id;
	}

	const [existing] = await tx
		.select({ id: waContacts.id })
		.from(waContacts)
		.where(
			and(
				eq(waContacts.organizationId, params.organizationId),
				eq(waContacts.accountId, params.accountId),
				eq(waContacts.waId, params.waId),
			),
		)
		.limit(1);

	if (!existing) {
		throw new Error("Failed to find WhatsApp contact after conflict");
	}

	return existing.id;
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
		throw new Error("Failed to find WhatsApp conversation after conflict");
	}

	return existing.id;
};

const processInboundEvent = async (
	tx: WhatsAppTransaction,
	event: Extract<CloudApiWebhookEvent, { type: "message.inbound" }>,
	account: WhatsAppAccount,
	payload: unknown,
) => {
	const [existingMessage] = await tx
		.select({ id: waMessages.id })
		.from(waMessages)
		.where(
			and(
				eq(waMessages.accountId, account.id),
				eq(waMessages.providerMessageId, event.providerMessageId),
			),
		)
		.limit(1);
	if (existingMessage) {
		return;
	}

	const contactId = await ensureContact(tx, {
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
			rawPayload: payload,
		})
		.onConflictDoNothing({
			target: [waMessages.accountId, waMessages.providerMessageId],
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

const processStatusEvent = async (
	tx: WhatsAppTransaction,
	event: Extract<CloudApiWebhookEvent, { type: "message.status" }>,
	account: WhatsAppAccount,
) => {
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

const processStoredEvent = async (params: {
	eventId: string;
	event: CloudApiWebhookEvent;
	account: WhatsAppAccount;
	payload: unknown;
}) =>
	db.transaction(async (tx) => {
		const [stored] = await tx
			.select({ processedAt: waEvents.processedAt })
			.from(waEvents)
			.where(eq(waEvents.id, params.eventId))
			.for("update");

		if (!stored) {
			throw new Error("Stored WhatsApp event disappeared");
		}
		if (stored.processedAt) {
			return "already_processed" as const;
		}

		if (params.event.type === "message.inbound") {
			await processInboundEvent(
				tx,
				params.event,
				params.account,
				params.payload,
			);
		} else {
			await processStatusEvent(tx, params.event, params.account);
		}

		await tx
			.update(waEvents)
			.set({ processedAt: new Date(), errorMessage: null })
			.where(eq(waEvents.id, params.eventId));

		return "processed" as const;
	});

export const verifyCloudWebhook = async (params: {
	token: string;
	mode?: string;
	verifyToken?: string;
	challenge?: string;
}) => {
	if (params.mode !== "subscribe") {
		return new Response("Invalid mode", { status: 400 });
	}
	if (!params.challenge || !params.verifyToken) {
		return new Response("Missing verification parameters", { status: 400 });
	}

	const account = await db.query.waAccounts.findFirst({
		where: eq(waAccounts.webhookVerifyToken, params.token),
	});
	if (!account || params.verifyToken !== params.token) {
		return new Response("Invalid verification token", { status: 403 });
	}

	return new Response(params.challenge, { status: 200 });
};

export const handleCloudWebhook = async (req: Request, token: string) => {
	if (!req.body) {
		return new Response("Missing request body", { status: 400 });
	}

	const rawBody = await req.text();
	if (!rawBody.length) {
		return new Response("Empty webhook body", { status: 400 });
	}

	let payload: unknown;
	try {
		payload = JSON.parse(rawBody) as unknown;
	} catch (error) {
		logger.error("Failed to parse WhatsApp webhook payload", { error });
		return new Response("Invalid JSON", { status: 400 });
	}

	for (const event of parseCloudApiWebhook(payload)) {
		const account = await resolveAccount(event.phoneNumberId, token);
		if (!account) {
			logger.warn("WhatsApp webhook account not found", {
				phoneNumberId: event.phoneNumberId,
			});
			continue;
		}

		const providerEventId =
			event.type === "message.status"
				? getStatusEventId(
						event.providerMessageId,
						event.status,
						event.timestamp,
					)
				: event.providerMessageId;

		let eventId: string | null = null;
		try {
			eventId = await ensureStoredEvent({
				organizationId: account.organizationId,
				accountId: account.id,
				providerEventId,
				eventType: event.type,
				payload: event,
			});
			await db
				.update(waEvents)
				.set({
					attempts: sql`coalesce(${waEvents.attempts}, 0) + 1`,
					lastAttemptAt: new Date(),
				})
				.where(eq(waEvents.id, eventId));

			await processStoredEvent({ eventId, event, account, payload });
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			logger.error("Failed to process WhatsApp webhook event", {
				eventId,
				error,
			});

			if (eventId) {
				await db
					.update(waEvents)
					.set({ processedAt: null, errorMessage })
					.where(eq(waEvents.id, eventId))
					.catch((markError) => {
						logger.error(
							"Failed to mark WhatsApp event retryable",
							{
								eventId,
								error: markError,
							},
						);
					});
			}
		}
	}

	return new Response(null, { status: 200 });
};
