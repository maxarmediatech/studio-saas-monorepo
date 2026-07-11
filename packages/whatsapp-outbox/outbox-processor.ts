import crypto from "node:crypto";
import {
	and,
	db,
	desc,
	eq,
	gt,
	inArray,
	isNotNull,
	isNull,
	lte,
	or,
	sql,
} from "@repo/database";
import {
	waAccounts,
	waContacts,
	waMedia,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import { transitionWhatsAppMessage } from "@repo/whatsapp-runtime";
import {
	defaultProviderFactory,
	isPermanentProviderError,
	prepareProviderSend,
} from "./provider-send";
import type { ProviderFactory, WhatsAppOutboxItem } from "./types";

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const computeNextAttemptAt = (attempts: number) => {
	const delaySeconds = Math.min(30 * attempts, 15 * 60);
	return new Date(Date.now() + delaySeconds * 1000);
};

const canAttempt = () =>
	sql`coalesce(${waOutbox.attempts}, 0) < coalesce(${waOutbox.maxAttempts}, 3)`;

export const recoverExpiredWhatsAppOutboxLeases = async (now = new Date()) =>
	db.transaction(async (tx) => {
		const unknownRows = await tx
			.update(waOutbox)
			.set({
				status: "delivery_unknown",
				lockedBy: null,
				leaseExpiresAt: null,
				nextAttemptAt: null,
				errorMessage:
					"Delivery outcome unknown after provider dispatch; manual reconciliation required",
			})
			.where(
				and(
					eq(waOutbox.status, "processing"),
					lte(waOutbox.leaseExpiresAt, now),
					isNotNull(waOutbox.dispatchStartedAt),
				),
			)
			.returning({ messageId: waOutbox.messageId });

		if (unknownRows.length > 0) {
			for (const row of unknownRows) {
				await transitionWhatsAppMessage(tx, {
					messageId: row.messageId,
					status: "delivery_unknown",
					at: now,
					errorMessage:
						"Provider dispatch started, but the local delivery result was not committed",
				});
			}
		}

		const recoveredRows = await tx
			.update(waOutbox)
			.set({
				status: "pending",
				attempts: sql`greatest(coalesce(${waOutbox.attempts}, 0) - 1, 0)`,
				lockedBy: null,
				leaseExpiresAt: null,
				nextAttemptAt: now,
				errorMessage: "Recovered expired pre-dispatch processing lease",
			})
			.where(
				and(
					eq(waOutbox.status, "processing"),
					lte(waOutbox.leaseExpiresAt, now),
					isNull(waOutbox.dispatchStartedAt),
				),
			)
			.returning({ id: waOutbox.id });

		return { recovered: recoveredRows.length, unknown: unknownRows.length };
	});

export const fetchDueWhatsAppOutboxItems = async ({
	limit = DEFAULT_BATCH_SIZE,
	now = new Date(),
}: {
	limit?: number;
	now?: Date;
} = {}) => {
	await recoverExpiredWhatsAppOutboxLeases(now);

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
				canAttempt(),
			),
		)
		.orderBy(desc(waOutbox.priority), waOutbox.createdAt)
		.limit(limit);
};

export const processWhatsAppOutboxById = async (outboxId: string) => {
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
	if (!item) {
		return { status: "skipped" as const };
	}
	return processWhatsAppOutboxItem(item, {
		workerId: `trigger:${crypto.randomUUID()}`,
	});
};

const claimOutboxItem = async (params: {
	item: WhatsAppOutboxItem;
	workerId: string;
	leaseMs: number;
	now: Date;
}) => {
	const [claimed] = await db
		.update(waOutbox)
		.set({
			status: "processing",
			attempts: sql`coalesce(${waOutbox.attempts}, 0) + 1`,
			lastAttemptAt: params.now,
			nextAttemptAt: null,
			lockedBy: params.workerId,
			leaseExpiresAt: new Date(params.now.getTime() + params.leaseMs),
			dispatchStartedAt: null,
			errorMessage: null,
		})
		.where(
			and(
				eq(waOutbox.id, params.item.outbox.id),
				inArray(waOutbox.status, ["pending", "failed"]),
				or(
					isNull(waOutbox.nextAttemptAt),
					lte(waOutbox.nextAttemptAt, params.now),
				),
				canAttempt(),
			),
		)
		.returning({
			attempts: waOutbox.attempts,
			maxAttempts: waOutbox.maxAttempts,
		});

	return claimed ?? null;
};

const checkDeliveryEligibility = async (params: {
	outboxId: string;
	workerId: string;
	now: Date;
	markDispatch: boolean;
}) => {
	return db.transaction(async (tx) => {
		const [outbox] = await tx
			.select()
			.from(waOutbox)
			.where(
				and(
					eq(waOutbox.id, params.outboxId),
					eq(waOutbox.status, "processing"),
					eq(waOutbox.lockedBy, params.workerId),
					gt(waOutbox.leaseExpiresAt, params.now),
					isNull(waOutbox.dispatchStartedAt),
				),
			)
			.for("update");
		if (!outbox) {
			return { status: "lost_lease" as const };
		}

		const [message] = await tx
			.select()
			.from(waMessages)
			.where(eq(waMessages.id, outbox.messageId))
			.for("update");
		if (!message) {
			throw new Error("WhatsApp outbox message not found");
		}
		const [account] = await tx
			.select()
			.from(waAccounts)
			.where(eq(waAccounts.id, outbox.accountId))
			.for("update");
		const [contact] = await tx
			.select()
			.from(waContacts)
			.where(eq(waContacts.id, message.contactId))
			.for("update");

		let suppressionReason: string | null = null;
		if (!account || account.deletedAt) {
			suppressionReason = "WhatsApp account is disabled";
		} else if (account.connectionStatus !== "connected") {
			suppressionReason = "WhatsApp account is not connected";
		} else if (!contact) {
			suppressionReason = "WhatsApp contact no longer exists";
		} else if (contact.isBlocked) {
			suppressionReason = "WhatsApp contact is blocked";
		} else if (contact.isOptedOut) {
			suppressionReason = "WhatsApp contact opted out";
		}

		if (suppressionReason) {
			await transitionWhatsAppMessage(tx, {
				messageId: message.id,
				status: "suppressed",
				at: params.now,
				errorMessage: suppressionReason,
				suppressionReason,
			});
			return { status: "suppressed" as const, reason: suppressionReason };
		}

		if (params.markDispatch) {
			await tx
				.update(waOutbox)
				.set({ dispatchStartedAt: params.now })
				.where(eq(waOutbox.id, outbox.id));
		}
		return { status: "eligible" as const };
	});
};

const markOutboxSuccess = (params: {
	outboxId: string;
	messageId: string;
	workerId: string;
	providerMessageId?: string;
}) =>
	db.transaction(async (tx) => {
		const [updated] = await tx
			.update(waOutbox)
			.set({
				status: "sent",
				nextAttemptAt: null,
				lockedBy: null,
				leaseExpiresAt: null,
				errorMessage: null,
			})
			.where(
				and(
					eq(waOutbox.id, params.outboxId),
					eq(waOutbox.status, "processing"),
					eq(waOutbox.lockedBy, params.workerId),
					isNotNull(waOutbox.dispatchStartedAt),
				),
			)
			.returning({ id: waOutbox.id });

		if (!updated) {
			throw new Error(
				"WhatsApp outbox lease lost after provider acceptance",
			);
		}

		await transitionWhatsAppMessage(tx, {
			messageId: params.messageId,
			status: "sent",
			at: new Date(),
			acceptedProviderMessageId: params.providerMessageId,
		});
	});

const markOutboxFailure = (params: {
	outboxId: string;
	messageId: string;
	workerId: string;
	attempts: number;
	maxAttempts: number;
	errorMessage: string;
	retryable: boolean;
}) =>
	db.transaction(async (tx) => {
		const nextAttemptAt =
			params.retryable && params.attempts < params.maxAttempts
				? computeNextAttemptAt(params.attempts)
				: null;
		const [updated] = await tx
			.update(waOutbox)
			.set({
				status: "failed",
				attempts: params.retryable
					? params.attempts
					: params.maxAttempts,
				nextAttemptAt,
				lockedBy: null,
				leaseExpiresAt: null,
				dispatchStartedAt: null,
				errorMessage: params.errorMessage,
			})
			.where(
				and(
					eq(waOutbox.id, params.outboxId),
					eq(waOutbox.status, "processing"),
					eq(waOutbox.lockedBy, params.workerId),
				),
			)
			.returning({ id: waOutbox.id });

		if (updated && nextAttemptAt) {
			await tx
				.update(waMessages)
				.set({
					status: "queued",
					errorMessage: params.errorMessage,
				})
				.where(eq(waMessages.id, params.messageId));
		} else if (updated) {
			await transitionWhatsAppMessage(tx, {
				messageId: params.messageId,
				status: "failed",
				at: new Date(),
				errorMessage: params.errorMessage,
			});
		}
	});

const markDeliveryUnknown = (params: {
	outboxId: string;
	messageId: string;
	workerId: string;
	errorMessage: string;
}) =>
	db.transaction(async (tx) => {
		const [updated] = await tx
			.update(waOutbox)
			.set({
				status: "delivery_unknown",
				nextAttemptAt: null,
				lockedBy: null,
				leaseExpiresAt: null,
				errorMessage: params.errorMessage,
			})
			.where(
				and(
					eq(waOutbox.id, params.outboxId),
					eq(waOutbox.status, "processing"),
					eq(waOutbox.lockedBy, params.workerId),
					isNotNull(waOutbox.dispatchStartedAt),
				),
			)
			.returning({ id: waOutbox.id });

		if (updated) {
			await transitionWhatsAppMessage(tx, {
				messageId: params.messageId,
				status: "delivery_unknown",
				at: new Date(),
				errorMessage: params.errorMessage,
			});
		}
	});

export const processWhatsAppOutboxItem = async (
	item: WhatsAppOutboxItem,
	options: {
		workerId: string;
		leaseMs?: number;
		now?: Date;
		providerFactory?: ProviderFactory;
	},
) => {
	const claim = await claimOutboxItem({
		item,
		workerId: options.workerId,
		leaseMs: options.leaseMs ?? DEFAULT_LEASE_MS,
		now: options.now ?? new Date(),
	});
	if (!claim) {
		return { status: "skipped" as const };
	}

	const attempts = claim.attempts ?? (item.outbox.attempts ?? 0) + 1;
	const maxAttempts = claim.maxAttempts ?? item.outbox.maxAttempts ?? 3;
	let dispatchStarted = false;

	try {
		const initialEligibility = await checkDeliveryEligibility({
			outboxId: item.outbox.id,
			workerId: options.workerId,
			now: new Date(),
			markDispatch: false,
		});
		if (initialEligibility.status === "suppressed") {
			return { status: "suppressed" as const };
		}
		if (initialEligibility.status === "lost_lease") {
			return { status: "skipped" as const };
		}
		if (item.account.provider !== "cloud_api") {
			throw new Error("Unsupported provider");
		}
		const provider = (options.providerFactory ?? defaultProviderFactory)(
			item,
		);
		const send = await prepareProviderSend({ item, provider });
		const admission = await checkDeliveryEligibility({
			outboxId: item.outbox.id,
			workerId: options.workerId,
			now: new Date(),
			markDispatch: true,
		});
		if (admission.status === "suppressed") {
			return { status: "suppressed" as const };
		}
		if (admission.status !== "eligible") {
			throw new Error(
				"WhatsApp outbox lease expired before provider dispatch",
			);
		}
		dispatchStarted = true;
		const result = await send();

		if (!result.success) {
			await markOutboxFailure({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				workerId: options.workerId,
				attempts,
				maxAttempts,
				errorMessage: result.error?.message ?? "Failed to send message",
				retryable: !isPermanentProviderError(result.error),
			});
			return { status: "failed" as const };
		}

		await markOutboxSuccess({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			workerId: options.workerId,
			providerMessageId: result.providerMessageId,
		});
		return { status: "sent" as const };
	} catch (error) {
		const errorMessage =
			error instanceof Error
				? error.message
				: "Unknown WhatsApp send error";
		if (dispatchStarted) {
			await markDeliveryUnknown({
				outboxId: item.outbox.id,
				messageId: item.message.id,
				workerId: options.workerId,
				errorMessage,
			}).catch(() => undefined);
			return { status: "delivery_unknown" as const };
		}

		await markOutboxFailure({
			outboxId: item.outbox.id,
			messageId: item.message.id,
			workerId: options.workerId,
			attempts,
			maxAttempts,
			errorMessage,
			retryable: true,
		});
		return { status: "failed" as const };
	}
};
