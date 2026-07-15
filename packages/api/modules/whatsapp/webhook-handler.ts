import crypto from "node:crypto";
import { and, db, eq, isNull, or } from "@repo/database";
import { logger } from "@repo/logs";
import { parseCloudApiWebhook } from "@repo/whatsapp-core";
import { waAccounts, waEvents } from "@repo/whatsapp-db";
import { processWhatsAppEventById } from "@repo/whatsapp-runtime";
import {
	decryptWhatsAppSecret,
	hashWebhookVerifyToken,
} from "./lib/account-secrets";
import { verifyWebhookSignature } from "./lib/webhook-security";

const getStatusEventId = (messageId: string, status: string, timestamp: Date) =>
	`${messageId}:${status}:${timestamp.getTime()}`;

const buildWebhookTokenClause = (token: string) =>
	or(
		eq(waAccounts.webhookVerifyToken, token),
		eq(waAccounts.webhookVerifyToken, hashWebhookVerifyToken(token)),
	);

const resolveAccount = (phoneNumberId: string, token: string) =>
	db.query.waAccounts.findFirst({
		where: and(
			eq(waAccounts.phoneNumberId, phoneNumberId),
			buildWebhookTokenClause(token),
		),
	});

const ensureStoredEvent = async (params: {
	organizationId: string;
	accountId: string;
	providerEventId: string;
	eventType: string;
	event: unknown;
	rawPayload: unknown;
}) => {
	const now = new Date();
	const [created] = await db
		.insert(waEvents)
		.values({
			organizationId: params.organizationId,
			accountId: params.accountId,
			providerEventId: params.providerEventId,
			eventType: params.eventType,
			payload: { event: params.event, rawPayload: params.rawPayload },
			processingStatus: "pending",
			nextAttemptAt: now,
		})
		.onConflictDoNothing({
			target: [waEvents.accountId, waEvents.providerEventId],
		})
		.returning({ id: waEvents.id });
	if (created) {
		return created.id;
	}

	const [existing] = await db
		.update(waEvents)
		.set({ nextAttemptAt: now })
		.where(
			and(
				eq(waEvents.accountId, params.accountId),
				eq(waEvents.providerEventId, params.providerEventId),
				isNull(waEvents.processedAt),
			),
		)
		.returning({ id: waEvents.id });
	if (existing) {
		return existing.id;
	}

	const stored = await db.query.waEvents.findFirst({
		columns: { id: true },
		where: and(
			eq(waEvents.accountId, params.accountId),
			eq(waEvents.providerEventId, params.providerEventId),
		),
	});
	if (!stored) {
		throw new Error("Failed to resolve stored WhatsApp event");
	}
	return stored.id;
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

	for (const event of parseCloudApiWebhook(payload)) {
		const account = await resolveAccount(event.phoneNumberId, token);
		if (!account) {
			logger.warn("WhatsApp webhook account not found", {
				phoneNumberId: event.phoneNumberId,
			});
			continue;
		}
		if (account.appSecret && !signatureHeader) {
			return new Response("Missing signature", { status: 403 });
		}
		if (account.appSecret && signatureHeader) {
			const appSecret = decryptWhatsAppSecret(account.appSecret);
			if (
				!appSecret ||
				!verifyWebhookSignature(rawBody, signatureHeader, appSecret)
			) {
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
		try {
			const eventId = await ensureStoredEvent({
				organizationId: account.organizationId,
				accountId: account.id,
				providerEventId,
				eventType: event.type,
				event,
				rawPayload: payload,
			});
			const result = await processWhatsAppEventById({
				eventId,
				workerId: `webhook-http:${crypto.randomUUID()}`,
			});
			if (result.status === "failed") {
				logger.error("Failed to process stored WhatsApp event", {
					eventId,
					error: result.errorMessage,
				});
			}
		} catch (error) {
			logger.error("Failed to store WhatsApp webhook event", { error });
		}
	}
	return new Response(null, { status: 200 });
};
