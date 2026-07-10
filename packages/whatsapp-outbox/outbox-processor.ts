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
			await tx
				.update(waMessages)
				.set({
					status: "delivery_unknown",
					statusUpdatedAt: now,
					errorMessage:
						"Provider dispatch started, but the local delivery result was not committed",
				})
				.where(
					inArray(
						waMessages.id,
						unknownRows.map((row) => row.messageId),
					),
				);
		}

		const recoveredRows = await tx
			.update(waOutbox)
			.set({
				status: "pending",
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

const markDispatchStarted = async (params: {
	outboxId: string;
	workerId: string;
	now: Date;
}) => {
	const [row] = await db
		.update(waOutbox)
		.set({ dispatchStartedAt: params.now })
		.where(
			and(
				eq(waOutbox.id, params.outboxId),
				eq(waOutbox.status, "processing"),
				eq(waOutbox.lockedBy, params.workerId),
				gt(waOutbox.leaseExpiresAt, params.now),
				isNull(waOutbox.dispatchStartedAt),
			),
		)
		.returning({ id: waOutbox.id });

	return Boolean(row);
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

		await tx
			.update(waMessages)
			.set({
				status: "sent",
				statusUpdatedAt: new Date(),
				providerMessageId: params.providerMessageId ?? null,
				errorMessage: null,
				errorCode: null,
			})
			.where(eq(waMessages.id, params.messageId));
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

		if (updated) {
			await tx
				.update(waMessages)
				.set({
					status: "failed",
					statusUpdatedAt: new Date(),
					errorMessage: params.errorMessage,
				})
				.where(eq(waMessages.id, params.messageId));
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
			await tx
				.update(waMessages)
				.set({
					status: "delivery_unknown",
					statusUpdatedAt: new Date(),
					errorMessage: params.errorMessage,
				})
				.where(eq(waMessages.id, params.messageId));
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
		if (item.account.provider !== "cloud_api") {
			throw new Error("Unsupported provider");
		}
		const provider = (options.providerFactory ?? defaultProviderFactory)(
			item,
		);
		const send = await prepareProviderSend({ item, provider });
		const started = await markDispatchStarted({
			outboxId: item.outbox.id,
			workerId: options.workerId,
			now: new Date(),
		});
		if (!started) {
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
