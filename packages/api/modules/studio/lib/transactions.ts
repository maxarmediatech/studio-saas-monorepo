/**
 * Transaction Helper for Studio Domain
 *
 * Provides utilities for executing database operations within transactions.
 * Use for operations that:
 * 1. Create/update multiple related entities
 * 2. Must succeed or fail atomically
 * 3. Depend on consistent reads during the operation
 */

import { db } from "@repo/database";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Transaction client type - same as db but within a transaction
 */
export type TransactionClient = Parameters<
	Parameters<typeof db.transaction>[0]
>[0];

/**
 * Function that executes within a transaction
 */
type TransactionFn<T> = (tx: TransactionClient) => Promise<T>;

// ============================================================================
// TRANSACTION HELPERS
// ============================================================================

/**
 * Execute a function within a database transaction.
 *
 * If the function throws, the transaction is rolled back.
 * If the function returns, the transaction is committed.
 *
 * @example
 * const result = await withTransaction(async (tx) => {
 *   const [booking] = await tx.insert(bookings).values({ ... }).returning();
 *   await tx.insert(participants).values({ bookingId: booking.id, ... });
 *   return booking;
 * });
 */
export async function withTransaction<T>(fn: TransactionFn<T>): Promise<T> {
	return db.transaction(fn);
}

/**
 * Execute a function within a transaction with custom isolation level.
 *
 * Use "serializable" for operations that require the highest consistency,
 * such as financial calculations or unique constraint checks.
 *
 * @example
 * const result = await withSerializableTransaction(async (tx) => {
 *   // Check current balance
 *   const schedule = await tx.query.paymentSchedules.findFirst({ ... });
 *   // Create received amount
 *   await tx.insert(receivedAmounts).values({ ... });
 *   // Update schedule status
 *   await tx.update(paymentSchedules).set({ status: "completed" });
 *   return received;
 * });
 */
export async function withSerializableTransaction<T>(
	fn: TransactionFn<T>,
): Promise<T> {
	return db.transaction(fn, {
		isolationLevel: "serializable",
	});
}

// ============================================================================
// IDEMPOTENCY HELPERS
// ============================================================================

/**
 * Result of an idempotent operation
 */
export interface IdempotentResult<T> {
	data: T;
	created: boolean;
	message: string;
}

/**
 * Execute an idempotent create operation.
 *
 * Checks for existing record before creating. If exists, returns the existing
 * record without creating a duplicate.
 *
 * @example
 * const result = await idempotentCreate({
 *   tx,
 *   findExisting: async () => {
 *     return tx.query.receivedAmounts.findFirst({
 *       where: eq(receivedAmounts.scheduleId, scheduleId),
 *     });
 *   },
 *   create: async () => {
 *     const [received] = await tx.insert(receivedAmounts).values({ ... }).returning();
 *     return received;
 *   },
 *   entityName: "payment",
 * });
 */
export async function idempotentCreate<T extends { id: string }>({
	tx,
	findExisting,
	create,
	entityName,
}: {
	tx: TransactionClient;
	findExisting: () => Promise<T | undefined>;
	create: () => Promise<T>;
	entityName: string;
}): Promise<IdempotentResult<T>> {
	// Check for existing
	const existing = await findExisting();

	if (existing) {
		return {
			data: existing,
			created: false,
			message: `${entityName} already exists`,
		};
	}

	// Create new
	const created = await create();
	return {
		data: created,
		created: true,
		message: `${entityName} created`,
	};
}
