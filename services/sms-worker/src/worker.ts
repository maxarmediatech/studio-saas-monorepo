/**
 * SMS Worker - Atomic Claiming, Graceful Shutdown, Exponential Backoff
 *
 * Features:
 * - Atomic message claiming with FOR UPDATE SKIP LOCKED
 * - Stuck message recovery (processing > 5min -> pending)
 * - Graceful shutdown (await in-flight, 30s timeout)
 * - Overlapping batch prevention
 * - Exponential backoff with jitter (30 * 2^(attempt-1), max 15min)
 */

import crypto from "node:crypto";
import { and, db, eq, inArray, lt, smsOutbox, sql } from "@repo/database";
import { logger } from "@repo/logs";
import { createMsg91Provider } from "@repo/sms";

// ============================================================================
// TYPES
// ============================================================================

export interface ClaimMessagesParams {
	workerId: string;
	batchSize: number;
	skipLocked?: boolean;
}

export interface ClaimedMessage {
	id: string;
	status: string;
	lockedAt: Date | null;
	lockedBy: string | null;
	processingStartedAt: Date | null;
}

export interface RecoverStuckMessagesParams {
	staleThresholdMinutes: number;
	useProcessingStartedAt?: boolean;
}

export interface SmsWorkerConfig {
	pollIntervalMs: number;
	batchSize: number;
	workerId?: string;
}

export interface WorkerStats {
	overlapsSkipped: number;
	concurrentBatches: number;
}

export interface SmsWorker {
	start: () => Promise<void>;
	stop: () => Promise<void>;
	shutdown: () => Promise<void>;
	initiateShutdown: () => void;
	getInFlightCount: () => number;
	getBatchCount: () => number;
	isBatchRunning: () => boolean;
	getStats: () => WorkerStats;
	getMaxConcurrentBatches: () => number;
	getWorkerId: () => string;
}

type SmsOutboxRow = typeof smsOutbox.$inferSelect;

// ============================================================================
// EXPONENTIAL BACKOFF
// ============================================================================

/**
 * Compute next retry time using exponential backoff
 * Formula: (30 * 2^(attempts-1)) * jitter seconds, capped at 15 minutes
 * Jitter multiplier range: 0.5 .. 1.0
 */
export function computeNextAttemptAt(
	attempts: number,
	randomValue = Math.random(),
): Date {
	const baseDelaySeconds = 30;
	const maxDelaySeconds = 15 * 60; // 15 minutes

	// Exponential: 30 * 2^(attempts-1), capped at 15m
	const baseDelay = Math.min(
		baseDelaySeconds * 2 ** (attempts - 1),
		maxDelaySeconds,
	);
	const boundedRandom = Math.max(0, Math.min(1, randomValue));
	const jitterMultiplier = 0.5 + boundedRandom * 0.5;
	const delaySeconds = Math.ceil(baseDelay * jitterMultiplier);

	return new Date(Date.now() + delaySeconds * 1000);
}

// ============================================================================
// ATOMIC CLAIMING (FOR UPDATE SKIP LOCKED)
// ============================================================================

/**
 * Atomically claim messages for processing using FOR UPDATE SKIP LOCKED.
 * This prevents race conditions between concurrent workers.
 *
 * Process:
 * 1. SELECT pending messages FOR UPDATE SKIP LOCKED
 * 2. UPDATE selected messages to processing with lock metadata
 * 3. Return claimed messages
 */
export async function claimMessages(
	params: ClaimMessagesParams,
): Promise<ClaimedMessage[]> {
	const { workerId, batchSize } = params;
	const now = new Date();

	// Use transaction for atomic claiming with FOR UPDATE SKIP LOCKED
	const claimed = await db.transaction(async (tx) => {
		// Step 1: Select and lock pending messages atomically
		const pendingQuery = sql`
			SELECT id FROM ${smsOutbox}
			WHERE ${smsOutbox.status} = 'pending'
			AND (${smsOutbox.nextAttemptAt} IS NULL OR ${smsOutbox.nextAttemptAt} <= ${now})
			ORDER BY ${smsOutbox.createdAt} ASC
			LIMIT ${batchSize}
			FOR UPDATE SKIP LOCKED
		`;

		const pendingResult = await tx.execute(pendingQuery);
		const pendingIds = (pendingResult.rows as { id: string }[]).map(
			(r) => r.id,
		);

		if (pendingIds.length === 0) {
			return [];
		}

		// Step 2: Update to processing with lock metadata
		await tx
			.update(smsOutbox)
			.set({
				status: "processing",
				lockedAt: now,
				lockedBy: workerId,
				processingStartedAt: now,
				updatedAt: now,
			})
			.where(inArray(smsOutbox.id, pendingIds));

		// Step 3: Return the updated messages
		const claimed = await tx
			.select()
			.from(smsOutbox)
			.where(inArray(smsOutbox.id, pendingIds));

		return claimed;
	});

	return claimed;
}

// ============================================================================
// STUCK MESSAGE RECOVERY
// ============================================================================

/**
 * Recover messages stuck in processing state for too long.
 * This handles worker crashes or timeouts.
 *
 * Process:
 * 1. Find messages with processingStartedAt/lockedAt > threshold
 * 2. Reset to pending, clear lock fields
 */
export async function recoverStuckMessages(
	params: RecoverStuckMessagesParams,
): Promise<number> {
	const { staleThresholdMinutes, useProcessingStartedAt = false } = params;
	const threshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);

	// Choose which timestamp field to use for staleness check
	const timeField = useProcessingStartedAt
		? smsOutbox.processingStartedAt
		: smsOutbox.lockedAt;

	const result = await db
		.update(smsOutbox)
		.set({
			status: "pending",
			lockedAt: null,
			lockedBy: null,
			processingStartedAt: null,
			updatedAt: new Date(),
		})
		.where(
			and(eq(smsOutbox.status, "processing"), lt(timeField, threshold)),
		)
		.returning({ id: smsOutbox.id });

	const count = result.length;

	if (count > 0) {
		logger.info(
			{ count, staleThresholdMinutes },
			"Recovered stuck messages",
		);
	}

	return count;
}

// ============================================================================
// WORKER FACTORY
// ============================================================================

/**
 * Create an SMS worker instance with graceful shutdown and overlap prevention
 */
export function createSmsWorker(config: SmsWorkerConfig): SmsWorker {
	const {
		pollIntervalMs,
		batchSize,
		workerId = `sms-worker-${crypto.randomUUID().slice(0, 8)}`,
	} = config;

	// Worker state
	let isRunning = false;
	let isShuttingDown = false;
	let pollTimeout: ReturnType<typeof setTimeout> | null = null;
	let currentBatchPromise: Promise<void> | null = null;

	// Stats tracking
	let batchCount = 0;
	let overlapsSkipped = 0;
	let maxConcurrentBatches = 0;
	let currentConcurrentBatches = 0;
	let inFlightCount = 0;
	let lastRecoveryRunAt = 0;
	let provider: ReturnType<typeof createMsg91Provider> | null = null;

	function getProvider(): ReturnType<typeof createMsg91Provider> {
		if (!provider) {
			provider = createMsg91Provider();
		}
		return provider;
	}

	/**
	 * Process a single message
	 */
	async function processMessage(item: SmsOutboxRow): Promise<void> {
		const previousAttempts = item.attempts ?? 0;
		const maxAttempts = item.maxAttempts ?? 3;

		try {
			const smsProvider = getProvider();
			const variables = (item.variables ?? {}) as Record<
				string,
				string | number | boolean
			>;
			const message =
				typeof variables.message === "string"
					? variables.message
					: typeof variables.VAR1 === "string"
						? variables.VAR1
						: "";

			const result = await smsProvider.send({
				to: item.phoneNumber,
				message,
				templateId: item.templateId,
				variables,
			});

			if (!result.success) {
				logger.warn(
					{ outboxId: item.id, error: result.error },
					"SMS send failed",
				);
				await markOutboxFailure({
					outboxId: item.id,
					previousAttempts,
					maxAttempts,
					errorMessage: result.error ?? "Failed to send SMS",
					errorCode: result.errorCode,
					providerStatusCode: result.statusCode,
					retryable: result.permanentFailure
						? false
						: (result.retryable ?? true),
				});
				return;
			}

			logger.info(
				{ outboxId: item.id, messageId: result.messageId },
				"SMS sent successfully",
			);
			await markOutboxSuccess({
				outboxId: item.id,
				providerMessageId: result.messageId,
				providerStatusCode: result.statusCode,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			logger.error({ outboxId: item.id, error }, "SMS processing error");
			await markOutboxFailure({
				outboxId: item.id,
				previousAttempts,
				maxAttempts,
				errorMessage,
				errorCode: "PROCESSING_ERROR",
				retryable: true,
			});
		}
	}

	/**
	 * Mark message as successfully sent
	 */
	async function markOutboxSuccess(params: {
		outboxId: string;
		providerMessageId?: string;
		providerStatusCode?: number;
	}): Promise<void> {
		await db
			.update(smsOutbox)
			.set({
				status: "sent",
				providerMessageId: params.providerMessageId ?? null,
				providerStatusCode: params.providerStatusCode ?? null,
				lastAttemptAt: new Date(),
				attempts: sql`COALESCE(${smsOutbox.attempts}, 0) + 1`,
				nextAttemptAt: null,
				errorMessage: null,
				errorCode: null,
				isPermanentFailure: false,
				lockedAt: null,
				lockedBy: null,
				processingStartedAt: null,
				updatedAt: new Date(),
			})
			.where(eq(smsOutbox.id, params.outboxId));
	}

	/**
	 * Mark message as failed (will retry or permanent failure)
	 */
	async function markOutboxFailure(params: {
		outboxId: string;
		previousAttempts: number;
		maxAttempts: number;
		errorMessage: string;
		errorCode?: string;
		providerStatusCode?: number;
		retryable?: boolean;
	}): Promise<void> {
		const retryable = params.retryable ?? true;
		const currentAttempt = params.previousAttempts + 1;
		const shouldRetry = retryable && currentAttempt < params.maxAttempts;
		const nextAttemptAt = shouldRetry
			? computeNextAttemptAt(currentAttempt)
			: null;

		await db
			.update(smsOutbox)
			.set({
				status: shouldRetry ? "pending" : "failed",
				lastAttemptAt: new Date(),
				attempts: sql`COALESCE(${smsOutbox.attempts}, 0) + 1`,
				nextAttemptAt,
				errorMessage: params.errorMessage,
				errorCode: params.errorCode ?? null,
				providerStatusCode: params.providerStatusCode ?? null,
				lockedAt: null,
				lockedBy: null,
				processingStartedAt: null,
				isPermanentFailure: !shouldRetry,
				updatedAt: new Date(),
			})
			.where(eq(smsOutbox.id, params.outboxId));
	}

	/**
	 * Run a single batch of message processing
	 */
	async function runBatch(): Promise<void> {
		if (isShuttingDown) return;

		// Track concurrent batches
		currentConcurrentBatches++;
		maxConcurrentBatches = Math.max(
			maxConcurrentBatches,
			currentConcurrentBatches,
		);

		try {
			batchCount++;

			// Recover stale processing rows once per minute to reduce write load.
			const now = Date.now();
			if (now - lastRecoveryRunAt >= 60_000) {
				await recoverStuckMessages({ staleThresholdMinutes: 5 });
				lastRecoveryRunAt = now;
			}

			// Claim messages atomically
			const messages = await claimMessages({
				workerId,
				batchSize,
				skipLocked: true,
			});

			inFlightCount = messages.length;

			// Process each message
			for (const item of messages) {
				if (isShuttingDown) {
					inFlightCount = 0;
					break;
				}
				try {
					await processMessage(item as SmsOutboxRow);
				} catch (error) {
					logger.error(
						{ outboxId: item.id, error },
						"Failed to process outbox item",
					);
				} finally {
					if (inFlightCount > 0) {
						inFlightCount--;
					}
				}
			}
		} finally {
			inFlightCount = 0;
			currentConcurrentBatches--;
		}
	}

	/**
	 * Schedule next batch with overlap prevention
	 */
	function scheduleNextBatch(): void {
		if (isShuttingDown) return;
		if (pollTimeout) {
			clearTimeout(pollTimeout);
			pollTimeout = null;
		}

		pollTimeout = setTimeout(async () => {
			pollTimeout = null;

			// Prevent overlapping batches
			if (currentBatchPromise) {
				overlapsSkipped++;
				scheduleNextBatch();
				return;
			}

			currentBatchPromise = runBatch();
			try {
				await currentBatchPromise;
			} catch (error) {
				logger.error({ workerId, error }, "SMS batch failed");
			} finally {
				currentBatchPromise = null;
			}

			scheduleNextBatch();
		}, pollIntervalMs);
	}

	// Public interface
	return {
		async start(): Promise<void> {
			if (isRunning) return;
			isRunning = true;
			isShuttingDown = false;

			logger.info(
				{ workerId, pollIntervalMs, batchSize },
				"SMS worker started",
			);

			// Run first batch immediately
			currentBatchPromise = runBatch();
			await currentBatchPromise;
			currentBatchPromise = null;

			// Schedule subsequent batches
			scheduleNextBatch();
		},

		async stop(): Promise<void> {
			isShuttingDown = true;
			isRunning = false;

			if (pollTimeout) {
				clearTimeout(pollTimeout);
				pollTimeout = null;
			}

			// Wait for current batch if running
			if (currentBatchPromise) {
				await currentBatchPromise;
			}

			logger.info({ workerId }, "SMS worker stopped");
		},

		async shutdown(): Promise<void> {
			isShuttingDown = true;
			isRunning = false;

			if (pollTimeout) {
				clearTimeout(pollTimeout);
				pollTimeout = null;
			}

			// Graceful shutdown: wait for in-flight work with 30s timeout
			if (currentBatchPromise) {
				let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
				const timeoutPromise = new Promise<void>((resolve) => {
					timeoutHandle = setTimeout(resolve, 30000);
				});
				await Promise.race([currentBatchPromise, timeoutPromise]);
				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
				}
			}

			inFlightCount = 0;
			logger.info({ workerId }, "SMS worker shutdown complete");
		},

		initiateShutdown(): void {
			isShuttingDown = true;

			if (pollTimeout) {
				clearTimeout(pollTimeout);
				pollTimeout = null;
			}
		},

		getInFlightCount(): number {
			return inFlightCount;
		},

		getBatchCount(): number {
			return batchCount;
		},

		isBatchRunning(): boolean {
			return currentBatchPromise !== null;
		},

		getStats(): WorkerStats {
			return {
				overlapsSkipped,
				concurrentBatches: currentConcurrentBatches,
			};
		},

		getMaxConcurrentBatches(): number {
			return maxConcurrentBatches;
		},

		getWorkerId(): string {
			return workerId;
		},
	};
}
