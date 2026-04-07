import { and, db, eq, or, sql } from "@repo/database";
import { logger } from "@repo/logs";
import { parseCloudApiWebhook } from "@repo/whatsapp-core";
import {
	waAccounts,
	waContacts,
	waConversations,
	waEvents,
	waMedia,
	waMessages,
} from "@repo/whatsapp-db";
import {
	decryptWhatsAppSecret,
	hashWebhookVerifyToken,
} from "./lib/account-secrets";
import { verifyWebhookSignature } from "./lib/webhook-security";

const getStatusEventId = (messageId: string, status: string, timestamp: Date) =>
	`${messageId}:${status}:${timestamp.getTime()}`;

const buildWebhookTokenClause = (token: string) => {
	const hashedToken = hashWebhookVerifyToken(token);
	return or(
		eq(waAccounts.webhookVerifyToken, token),
		eq(waAccounts.webhookVerifyToken, hashedToken),
	);
};

const getInboundPreview = (params: {
	messageType: string;
	text?: string;
	caption?: string;
	fileName?: string;
}) =>
	params.text ??
	params.caption ??
	params.fileName ??
	{
		audio: "Voice note",
		document: "Document",
		image: "Photo",
		sticker: "Sticker",
		video: "Video",
	}[params.messageType] ??
	params.messageType;

const resolveAccount = async (phoneNumberId: string, token: string) => {
	const account = await db.query.waAccounts.findFirst({
		where: and(
			eq(waAccounts.phoneNumberId, phoneNumberId),
			buildWebhookTokenClause(token),
		),
	});

	return account;
};

const createEventRecord = async (params: {
	organizationId: string;
	accountId: string;
	providerEventId: string;
	eventType: string;
	payload: unknown;
}) => {
	const [row] = await db
		.insert(waEvents)
		.values({
			organizationId: params.organizationId,
			accountId: params.accountId,
			providerEventId: params.providerEventId,
			eventType: params.eventType,
			payload: params.payload,
		})
		.returning({ id: waEvents.id });

	return row?.id ?? null;
};

const markEventProcessed = async (id: string) => {
	await db
		.update(waEvents)
		.set({ processedAt: new Date(), errorMessage: null })
		.where(eq(waEvents.id, id));
};

const markEventFailed = async (id: string, errorMessage: string) => {
	await db
		.update(waEvents)
		.set({ processedAt: new Date(), errorMessage })
		.where(eq(waEvents.id, id));
};

const ensureContact = async (params: {
	organizationId: string;
	accountId: string;
	waId: string;
}) => {
	const existing = await db.query.waContacts.findFirst({
		where: and(
			eq(waContacts.organizationId, params.organizationId),
			eq(waContacts.waId, params.waId),
		),
	});

	if (existing) {
		return existing.id;
	}

	const [created] = await db
		.insert(waContacts)
		.values({
			organizationId: params.organizationId,
			accountId: params.accountId,
			waId: params.waId,
			phoneNumber: params.waId,
		})
		.returning({ id: waContacts.id });

	return created?.id ?? null;
};

const ensureConversation = async (params: {
	organizationId: string;
	accountId: string;
	contactId: string;
}) => {
	const existing = await db.query.waConversations.findFirst({
		where: and(
			eq(waConversations.organizationId, params.organizationId),
			eq(waConversations.accountId, params.accountId),
			eq(waConversations.contactId, params.contactId),
		),
	});

	if (existing) {
		return existing.id;
	}

	const [created] = await db
		.insert(waConversations)
		.values({
			organizationId: params.organizationId,
			accountId: params.accountId,
			contactId: params.contactId,
		})
		.returning({ id: waConversations.id });

	return created?.id ?? null;
};

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
		where: buildWebhookTokenClause(params.token),
	});

	if (!account) {
		return new Response("Invalid webhook token", { status: 403 });
	}

	if (params.verifyToken !== params.token) {
		return new Response("Invalid verification token", { status: 403 });
	}

	return new Response(params.challenge, { status: 200 });
};

export const handleCloudWebhook = async (req: Request, token: string) => {
	if (!req.body) {
		return new Response("Missing request body", { status: 400 });
	}

	const rawBody = await req.text();
	const signatureHeader = req.headers.get("x-hub-signature-256");
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

	const events = parseCloudApiWebhook(payload);
	if (!events.length) {
		return new Response(null, { status: 200 });
	}

	for (const event of events) {
		const account = await resolveAccount(event.phoneNumberId, token);
		if (!account) {
			logger.warn("WhatsApp webhook account not found", {
				phoneNumberId: event.phoneNumberId,
			});
			continue;
		}

		if (account.appSecret && !signatureHeader) {
			logger.warn("WhatsApp webhook signature missing", {
				accountId: account.id,
				phoneNumberId: event.phoneNumberId,
			});
			return new Response("Missing signature", { status: 403 });
		}

		if (signatureHeader && account.appSecret) {
			const appSecret = decryptWhatsAppSecret(account.appSecret);
			if (
				!appSecret ||
				!verifyWebhookSignature(rawBody, signatureHeader, appSecret)
			) {
				logger.warn("WhatsApp webhook signature verification failed", {
					accountId: account.id,
					phoneNumberId: event.phoneNumberId,
				});
				return new Response("Invalid signature", { status: 403 });
			}
		}

		const providerEventId =
			event.type === "message.status"
				? getStatusEventId(
						event.providerMessageId,
						event.status,
						event.timestamp,
					)
				: event.providerMessageId;

		const existing = await db.query.waEvents.findFirst({
			where: and(
				eq(waEvents.accountId, account.id),
				eq(waEvents.providerEventId, providerEventId),
			),
		});

		if (existing) {
			continue;
		}

		let eventId: string | null = null;
		try {
			eventId = await createEventRecord({
				organizationId: account.organizationId,
				accountId: account.id,
				providerEventId,
				eventType: event.type,
				payload: event,
			});
		} catch (error) {
			const code = (error as { code?: string })?.code;
			if (code === "23505") {
				continue;
			}
			logger.error("Failed to store WhatsApp event", { error });
			continue;
		}

		try {
			if (event.type === "message.inbound") {
				const contactId = await ensureContact({
					organizationId: account.organizationId,
					accountId: account.id,
					waId: event.from,
				});

				if (!contactId) {
					throw new Error("Failed to create contact");
				}

				const conversationId = await ensureConversation({
					organizationId: account.organizationId,
					accountId: account.id,
					contactId,
				});

				if (!conversationId) {
					throw new Error("Failed to create conversation");
				}

				let createdMediaId: string | null = null;
				let mediaFileName: string | null = null;

				if (event.content.mediaId) {
					const [createdMedia] = await db
						.insert(waMedia)
						.values({
							organizationId: account.organizationId,
							providerMediaId: event.content.mediaId,
							ingestStatus: "pending",
							ingestAttempts: 0,
							nextIngestAttemptAt: new Date(),
							mimeType:
								event.content.mimeType ??
								"application/octet-stream",
							fileName: event.content.fileName ?? null,
							storageType: "s3",
							storageUrl: null,
						})
						.returning({
							id: waMedia.id,
							fileName: waMedia.fileName,
						});

					if (!createdMedia) {
						throw new Error("Failed to create media");
					}

					createdMediaId = createdMedia.id;
					mediaFileName = createdMedia.fileName ?? null;
				}

				const [created] = await db
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
						mediaId: createdMediaId,
						status: "delivered",
						statusUpdatedAt: new Date(),
						rawPayload: payload,
					})
					.returning({ id: waMessages.id });

				if (!created) {
					throw new Error("Failed to create message");
				}

				await db
					.update(waConversations)
					.set({
						lastMessageId: created.id,
						lastMessageAt: event.timestamp,
						lastMessagePreview: getInboundPreview({
							messageType: event.messageType,
							text: event.content.text,
							caption: event.content.caption,
							fileName: mediaFileName ?? undefined,
						}),
						unreadCount: sql`coalesce(${waConversations.unreadCount}, 0) + 1`,
					})
					.where(eq(waConversations.id, conversationId));
			} else {
				const existingMessage = await db.query.waMessages.findFirst({
					where: and(
						eq(
							waMessages.providerMessageId,
							event.providerMessageId,
						),
						eq(waMessages.accountId, account.id),
					),
				});

				if (!existingMessage) {
					throw new Error("Message not found for status update");
				}

				await db
					.update(waMessages)
					.set({
						status: event.status,
						statusUpdatedAt: new Date(),
						errorCode: event.error?.code ?? null,
						errorMessage: event.error?.message ?? null,
					})
					.where(eq(waMessages.id, existingMessage.id));
			}

			if (eventId) {
				await markEventProcessed(eventId);
			}

			await db
				.update(waAccounts)
				.set({
					lastEventAt: event.timestamp,
					lastErrorMessage: null,
				})
				.where(eq(waAccounts.id, account.id));
		} catch (error) {
			logger.error("Failed to process WhatsApp webhook event", { error });
			if (eventId) {
				await markEventFailed(
					eventId,
					error instanceof Error ? error.message : "Unknown error",
				);
			}

			await db
				.update(waAccounts)
				.set({
					lastErrorMessage:
						error instanceof Error
							? error.message
							: "Unknown error",
					errorCount: sql`coalesce(${waAccounts.errorCount}, 0) + 1`,
				})
				.where(eq(waAccounts.id, account.id));
		}
	}

	return new Response(null, { status: 200 });
};
