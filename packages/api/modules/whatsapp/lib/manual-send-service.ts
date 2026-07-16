import { ORPCError } from "@orpc/server";
import { and, db, eq } from "@repo/database";
import {
	waManualSendIdempotency,
	waMedia,
	waMessages,
	waOutbox,
	waTemplates,
} from "@repo/whatsapp-db";
import { findActiveWhatsAppAccount } from "./account-repository";
import { ensureWhatsAppContactConversation } from "./contact-conversation";
import {
	type ManualWhatsAppSendPayload,
	manualWhatsAppSendFingerprint,
} from "./manual-send-fingerprint";
import { recordOutboundConversationActivity } from "./outbound-activity";
import { inspectWhatsAppTemplate } from "./template-inspector";
import { renderWhatsAppTemplateMessage } from "./template-renderer";
import type { WhatsAppTransactionClient } from "./transaction-client";

export const MANUAL_SEND_IDEMPOTENCY_CONFLICT_MESSAGE =
	"This idempotency key was already used for a different WhatsApp send";

export type ManualSendPersistenceStep =
	| "idempotency_claim"
	| "contact"
	| "conversation"
	| "media"
	| "message"
	| "activity"
	| "outbox"
	| "idempotency_completion";

interface ManualSendOptions {
	/** Internal fault-injection seam used by transaction rollback tests. */
	afterPersist?: (step: ManualSendPersistenceStep) => void | Promise<void>;
}

export interface ManualSendRequest {
	organizationId: string;
	actorId: string;
	idempotencyKey: string;
	payload: ManualWhatsAppSendPayload;
}

export interface ManualSendResult {
	messageId: string;
	outboxId: string;
	replayed: boolean;
}

function persistenceError(message: string): never {
	throw new ORPCError("INTERNAL_SERVER_ERROR", { message });
}

async function resolveCompletedClaim(
	tx: WhatsAppTransactionClient,
	request: ManualSendRequest,
	requestFingerprint: string,
): Promise<ManualSendResult> {
	const existing = await tx.query.waManualSendIdempotency.findFirst({
		where: and(
			eq(waManualSendIdempotency.organizationId, request.organizationId),
			eq(waManualSendIdempotency.actorId, request.actorId),
			eq(waManualSendIdempotency.accountId, request.payload.accountId),
			eq(waManualSendIdempotency.idempotencyKey, request.idempotencyKey),
		),
	});

	if (!existing) {
		throw new ORPCError("CONFLICT", {
			message: "WhatsApp send claim changed. Retry the request.",
		});
	}
	if (existing.requestFingerprint !== requestFingerprint) {
		throw new ORPCError("CONFLICT", {
			message: MANUAL_SEND_IDEMPOTENCY_CONFLICT_MESSAGE,
		});
	}
	if (
		existing.status !== "completed" ||
		!existing.messageId ||
		!existing.outboxId
	) {
		throw new ORPCError("CONFLICT", {
			message: "WhatsApp send is still processing. Retry the request.",
		});
	}

	const [message, outbox] = await Promise.all([
		tx.query.waMessages.findFirst({
			where: and(
				eq(waMessages.id, existing.messageId),
				eq(waMessages.organizationId, request.organizationId),
				eq(waMessages.accountId, request.payload.accountId),
			),
			columns: { id: true },
		}),
		tx.query.waOutbox.findFirst({
			where: and(
				eq(waOutbox.id, existing.outboxId),
				eq(waOutbox.organizationId, request.organizationId),
				eq(waOutbox.accountId, request.payload.accountId),
				eq(waOutbox.messageId, existing.messageId),
			),
			columns: { id: true },
		}),
	]);
	if (!message || !outbox) {
		throw new ORPCError("CONFLICT", {
			message: "The original WhatsApp send is no longer available",
		});
	}

	return {
		messageId: existing.messageId,
		outboxId: existing.outboxId,
		replayed: true,
	};
}

async function validateTemplate(
	tx: WhatsAppTransactionClient,
	request: Extract<ManualWhatsAppSendPayload, { kind: "template" }>,
	organizationId: string,
) {
	const template = await tx.query.waTemplates.findFirst({
		where: and(
			eq(waTemplates.organizationId, organizationId),
			eq(waTemplates.accountId, request.accountId),
			eq(waTemplates.name, request.templateName),
			eq(waTemplates.language, request.language),
		),
	});
	if (!template) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Template is not synced for this account yet. Sync templates and try again.",
		});
	}
	if (template.status.toLowerCase() !== "approved") {
		throw new ORPCError("BAD_REQUEST", {
			message: `Template ${template.name} is ${template.status.toLowerCase()} and cannot be sent.`,
		});
	}

	const inspection = inspectWhatsAppTemplate(template.components);
	if (!inspection.isSupported) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				inspection.unsupportedReason ??
				"Template is not supported by the inbox sender yet.",
		});
	}
	if (
		inspection.variables.length > 0 &&
		(!request.components || request.components.length === 0)
	) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Template requires variables before it can be sent. Fill them in and try again.",
		});
	}

	return template;
}

async function persistAcceptedSend(
	tx: WhatsAppTransactionClient,
	request: ManualSendRequest,
	options: ManualSendOptions,
): Promise<{ messageId: string; outboxId: string }> {
	const payload = request.payload;
	if (
		payload.kind === "media" &&
		payload.mediaKey &&
		!payload.mediaKey.startsWith(
			`orgs/${request.organizationId}/whatsapp-media/`,
		)
	) {
		throw new ORPCError("FORBIDDEN", { message: "Invalid media key" });
	}

	const account = await findActiveWhatsAppAccount(
		request.organizationId,
		payload.accountId,
		tx,
	);
	if (!account) {
		throw new ORPCError("NOT_FOUND", {
			message: "WhatsApp account not found",
		});
	}

	const template =
		payload.kind === "template"
			? await validateTemplate(tx, payload, request.organizationId)
			: null;
	const { contactId, conversationId } =
		await ensureWhatsAppContactConversation(
			{
				organizationId: request.organizationId,
				accountId: account.id,
				waId: payload.to,
				contactName:
					payload.kind === "text" ? payload.contactName : undefined,
			},
			{
				tx,
				afterPersist: options.afterPersist,
			},
		);

	let mediaId: string | null = null;
	if (payload.kind === "media") {
		const [media] = await tx
			.insert(waMedia)
			.values({
				organizationId: request.organizationId,
				mimeType: payload.mimeType,
				fileName: payload.fileName ?? null,
				storageType: payload.mediaKey ? "s3" : "provider",
				storageUrl: payload.mediaKey ?? payload.mediaUrl ?? null,
			})
			.returning({ id: waMedia.id });
		if (!media) {
			persistenceError("Failed to create media");
		}
		mediaId = media.id;
		await options.afterPersist?.("media");
	}

	const [message] = await tx
		.insert(waMessages)
		.values({
			organizationId: request.organizationId,
			accountId: account.id,
			conversationId,
			contactId,
			direction: "outbound",
			type: payload.kind === "media" ? payload.mediaType : payload.kind,
			textBody: payload.kind === "text" ? payload.text : null,
			caption:
				payload.kind === "media" ? (payload.caption ?? null) : null,
			mediaId,
			templateName:
				payload.kind === "template" ? payload.templateName : null,
			templateParams:
				payload.kind === "template"
					? {
							language: payload.language,
							components: payload.components ?? [],
						}
					: null,
			status: "pending",
			sentByUserId: request.actorId,
		})
		.returning({ id: waMessages.id, createdAt: waMessages.createdAt });
	if (!message) {
		persistenceError("Failed to create message");
	}
	await options.afterPersist?.("message");

	const preview =
		payload.kind === "text"
			? payload.text
			: payload.kind === "template"
				? (renderWhatsAppTemplateMessage({
						components: template?.components,
						params: {
							language: payload.language,
							components: payload.components ?? [],
						},
					}) ?? `Template: ${payload.templateName}`)
				: payload.caption?.trim() ||
					({
						image: "Photo sent",
						video: "Video sent",
						audio: "Audio sent",
						document: "Document sent",
						sticker: "Sticker sent",
					}[payload.mediaType] ??
						"Media sent");

	await recordOutboundConversationActivity({
		organizationId: request.organizationId,
		conversationId,
		contactId,
		messageId: message.id,
		preview,
		at: message.createdAt,
		tx,
	});
	await options.afterPersist?.("activity");

	const [outbox] = await tx
		.insert(waOutbox)
		.values({
			organizationId: request.organizationId,
			accountId: account.id,
			messageId: message.id,
		})
		.returning({ id: waOutbox.id });
	if (!outbox) {
		persistenceError("Failed to enqueue message");
	}
	await options.afterPersist?.("outbox");

	return { messageId: message.id, outboxId: outbox.id };
}

export async function acceptManualWhatsAppSend(
	request: ManualSendRequest,
	options: ManualSendOptions = {},
): Promise<ManualSendResult> {
	const requestFingerprint = manualWhatsAppSendFingerprint(request.payload);

	return db.transaction(async (tx) => {
		const [claim] = await tx
			.insert(waManualSendIdempotency)
			.values({
				organizationId: request.organizationId,
				actorId: request.actorId,
				accountId: request.payload.accountId,
				idempotencyKey: request.idempotencyKey,
				requestFingerprint,
				status: "processing",
			})
			.onConflictDoNothing({
				target: [
					waManualSendIdempotency.organizationId,
					waManualSendIdempotency.actorId,
					waManualSendIdempotency.accountId,
					waManualSendIdempotency.idempotencyKey,
				],
			})
			.returning({ id: waManualSendIdempotency.id });

		if (!claim) {
			return resolveCompletedClaim(tx, request, requestFingerprint);
		}
		await options.afterPersist?.("idempotency_claim");

		const result = await persistAcceptedSend(tx, request, options);
		const completedAt = new Date();
		const [completed] = await tx
			.update(waManualSendIdempotency)
			.set({
				status: "completed",
				messageId: result.messageId,
				outboxId: result.outboxId,
				completedAt,
				updatedAt: completedAt,
			})
			.where(eq(waManualSendIdempotency.id, claim.id))
			.returning({ id: waManualSendIdempotency.id });
		if (!completed) {
			persistenceError("Failed to complete WhatsApp send claim");
		}
		await options.afterPersist?.("idempotency_completion");

		return { ...result, replayed: false };
	});
}
