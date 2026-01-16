import { parseCloudApiWebhook } from "@repo/whatsapp-core";
import { logger } from "@repo/logs";
import { and, db, eq } from "@repo/database";
import {
	waAccounts,
	waContacts,
	waConversations,
	waEvents,
	waMessages,
} from "@repo/whatsapp-db";

const getStatusEventId = (
	messageId: string,
	status: string,
	timestamp: Date,
) => `${messageId}:${status}:${timestamp.getTime()}`;

const resolveAccount = async (phoneNumberId: string, token: string) => {
	const account = await db.query.waAccounts.findFirst({
		where: and(
			eq(waAccounts.phoneNumberId, phoneNumberId),
			eq(waAccounts.webhookVerifyToken, token),
		),
	});

	if (account) {
		return account;
	}

	return db.query.waAccounts.findFirst({
		where: eq(waAccounts.webhookVerifyToken, token),
	});
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
		where: eq(waAccounts.webhookVerifyToken, params.token),
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
						lastMessagePreview:
							event.content.text ?? event.messageType,
					})
					.where(eq(waConversations.id, conversationId));
			} else {
				const existingMessage = await db.query.waMessages.findFirst({
					where: and(
						eq(waMessages.providerMessageId, event.providerMessageId),
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
		} catch (error) {
			logger.error("Failed to process WhatsApp webhook event", { error });
			if (eventId) {
				await markEventFailed(
					eventId,
					error instanceof Error ? error.message : "Unknown error",
				);
			}
		}
	}

	return new Response(null, { status: 200 });
};
