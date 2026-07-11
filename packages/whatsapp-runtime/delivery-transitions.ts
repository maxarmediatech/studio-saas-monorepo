import { and, eq, sql } from "@repo/database";
import {
	waCampaignRecipients,
	waCampaigns,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import type { WhatsAppTransaction } from "./types";

type MessageStatus = typeof waMessages.$inferSelect.status;

const SUCCESS_RANK: Partial<Record<MessageStatus, number>> = {
	pending: 0,
	queued: 1,
	sent: 2,
	delivered: 3,
	read: 4,
};

const canTransition = (current: MessageStatus, next: MessageStatus) => {
	if (current === next) {
		return false;
	}
	if (current === "suppressed" || current === "read") {
		return false;
	}
	if (current === "failed") {
		return false;
	}
	if (next === "suppressed") {
		return current === "pending" || current === "queued";
	}
	if (next === "failed") {
		return !["delivered", "read", "suppressed"].includes(current);
	}
	if (next === "delivery_unknown") {
		return ["pending", "queued", "sent"].includes(current);
	}
	if (current === "delivery_unknown") {
		return next === "sent" || next === "delivered" || next === "read";
	}

	const currentRank = SUCCESS_RANK[current];
	const nextRank = SUCCESS_RANK[next];
	return currentRank !== undefined && nextRank !== undefined
		? nextRank > currentRank
		: false;
};

export const refreshCampaignCounts = async (
	tx: WhatsAppTransaction,
	campaignId: string,
) => {
	const [counts] = await tx
		.select({
			totalRecipients: sql<number>`count(*)::int`,
			totalQueued: sql<number>`count(*) filter (where ${waCampaignRecipients.queuedAt} is not null)::int`,
			totalSent: sql<number>`count(*) filter (where ${waCampaignRecipients.sentAt} is not null)::int`,
			totalDelivered: sql<number>`count(*) filter (where ${waCampaignRecipients.deliveredAt} is not null)::int`,
			totalRead: sql<number>`count(*) filter (where ${waCampaignRecipients.readAt} is not null)::int`,
			totalFailed: sql<number>`count(*) filter (where ${waCampaignRecipients.status} = 'failed')::int`,
			totalSuppressed: sql<number>`count(*) filter (where ${waCampaignRecipients.status} = 'suppressed')::int`,
			totalDeliveryUnknown: sql<number>`count(*) filter (where ${waCampaignRecipients.status} = 'delivery_unknown')::int`,
			activeRecipients: sql<number>`count(*) filter (where ${waCampaignRecipients.status} in ('pending', 'queued'))::int`,
		})
		.from(waCampaignRecipients)
		.where(eq(waCampaignRecipients.campaignId, campaignId));

	if (!counts) {
		return;
	}

	const { activeRecipients, ...persistedCounts } = counts;
	const now = new Date();
	await tx
		.update(waCampaigns)
		.set({ ...persistedCounts, updatedAt: now })
		.where(eq(waCampaigns.id, campaignId));

	if (activeRecipients === 0) {
		await tx
			.update(waCampaigns)
			.set({ status: "completed", completedAt: now, updatedAt: now })
			.where(
				and(
					eq(waCampaigns.id, campaignId),
					eq(waCampaigns.status, "running"),
				),
			);
	}
};

const updateRecipient = async (
	tx: WhatsAppTransaction,
	params: {
		recipientId: string;
		status: MessageStatus;
		at: Date;
		errorCode?: string | null;
		errorMessage?: string | null;
		suppressionReason?: string | null;
	},
) => {
	const [recipient] = await tx
		.select()
		.from(waCampaignRecipients)
		.where(eq(waCampaignRecipients.id, params.recipientId))
		.for("update");
	if (!recipient || !canTransition(recipient.status, params.status)) {
		return;
	}

	const reachedSent = ["sent", "delivered", "read"].includes(params.status);
	const reachedDelivered = ["delivered", "read"].includes(params.status);
	await tx
		.update(waCampaignRecipients)
		.set({
			status: params.status,
			queuedAt: recipient.queuedAt ?? params.at,
			sentAt: reachedSent
				? (recipient.sentAt ?? params.at)
				: recipient.sentAt,
			deliveredAt: reachedDelivered
				? (recipient.deliveredAt ?? params.at)
				: recipient.deliveredAt,
			readAt:
				params.status === "read"
					? (recipient.readAt ?? params.at)
					: recipient.readAt,
			failedAt:
				params.status === "failed"
					? (recipient.failedAt ?? params.at)
					: recipient.failedAt,
			suppressedAt:
				params.status === "suppressed"
					? (recipient.suppressedAt ?? params.at)
					: recipient.suppressedAt,
			deliveryUnknownAt:
				params.status === "delivery_unknown"
					? (recipient.deliveryUnknownAt ?? params.at)
					: recipient.deliveryUnknownAt,
			failureCode:
				params.status === "failed" ? (params.errorCode ?? null) : null,
			failureMessage:
				params.status === "failed"
					? (params.errorMessage ?? null)
					: null,
			suppressionReason:
				params.status === "suppressed"
					? (params.suppressionReason ?? "Delivery suppressed")
					: null,
			updatedAt: params.at,
		})
		.where(eq(waCampaignRecipients.id, recipient.id));

	await refreshCampaignCounts(tx, recipient.campaignId);
};

const syncOutbox = async (
	tx: WhatsAppTransaction,
	messageId: string,
	status: MessageStatus,
	errorMessage?: string | null,
) => {
	if (["sent", "delivered", "read"].includes(status)) {
		await tx
			.update(waOutbox)
			.set({
				status: "sent",
				nextAttemptAt: null,
				lockedBy: null,
				leaseExpiresAt: null,
				errorMessage: null,
			})
			.where(eq(waOutbox.messageId, messageId));
		return;
	}

	if (status === "failed") {
		await tx
			.update(waOutbox)
			.set({
				status: "failed",
				attempts: sql`coalesce(${waOutbox.maxAttempts}, 3)`,
				nextAttemptAt: null,
				lockedBy: null,
				leaseExpiresAt: null,
				errorMessage:
					errorMessage ?? "Provider reported delivery failure",
			})
			.where(eq(waOutbox.messageId, messageId));
		return;
	}

	if (status === "delivery_unknown" || status === "suppressed") {
		await tx
			.update(waOutbox)
			.set({
				status,
				nextAttemptAt: null,
				lockedBy: null,
				leaseExpiresAt: null,
				errorMessage: errorMessage ?? null,
			})
			.where(eq(waOutbox.messageId, messageId));
	}
};

export const transitionWhatsAppMessage = async (
	tx: WhatsAppTransaction,
	params: {
		messageId?: string;
		accountId?: string;
		lookupProviderMessageId?: string;
		acceptedProviderMessageId?: string;
		status: MessageStatus;
		at?: Date;
		errorCode?: string | null;
		errorMessage?: string | null;
		suppressionReason?: string | null;
	},
) => {
	const condition = params.messageId
		? eq(waMessages.id, params.messageId)
		: and(
				eq(waMessages.accountId, params.accountId ?? ""),
				eq(
					waMessages.providerMessageId,
					params.lookupProviderMessageId ?? "",
				),
			);
	const [message] = await tx
		.select()
		.from(waMessages)
		.where(condition)
		.for("update");
	if (!message) {
		return { changed: false, reason: "not_found" as const };
	}
	if (!canTransition(message.status, params.status)) {
		return {
			changed: false,
			reason: "ignored_transition" as const,
			message,
		};
	}

	const at = params.at ?? new Date();
	const success = ["sent", "delivered", "read"].includes(params.status);
	const [updated] = await tx
		.update(waMessages)
		.set({
			status: params.status,
			statusUpdatedAt: at,
			providerMessageId:
				params.acceptedProviderMessageId ?? message.providerMessageId,
			errorCode: success ? null : (params.errorCode ?? message.errorCode),
			errorMessage: success
				? null
				: (params.errorMessage ?? message.errorMessage),
		})
		.where(eq(waMessages.id, message.id))
		.returning();

	if (message.campaignRecipientId) {
		await updateRecipient(tx, {
			recipientId: message.campaignRecipientId,
			status: params.status,
			at,
			errorCode: params.errorCode,
			errorMessage: params.errorMessage,
			suppressionReason: params.suppressionReason,
		});
	}
	await syncOutbox(tx, message.id, params.status, params.errorMessage);

	return { changed: true, reason: "transitioned" as const, message: updated };
};
