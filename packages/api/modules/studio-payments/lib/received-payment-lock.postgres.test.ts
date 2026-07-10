import { describe, expect, it } from "vitest";

// Set POSTGRES_CONCURRENCY_DATABASE_URL to an isolated, migrated test database.
const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function postgresErrorCode(error: unknown): string | undefined {
	const directCode = (error as { code?: string })?.code;
	const causeCode = (error as { cause?: { code?: string } })?.cause?.code;
	return directCode ?? causeCode;
}

describePostgres("received payment row-lock concurrency", () => {
	it("makes a competing application lock time out until the first transaction commits", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;

		const { bookings, db, eq, organizations, receivedAmounts, sql } =
			await import("@repo/database");
		const { getLockedReceivedPayment } = await import(
			"./received-payment-lock"
		);

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `lock_org_${suffix}`;
		const bookingId = `lock_booking_${suffix}`;
		const receivedAmountId = `lock_payment_${suffix}`;

		await db.insert(organizations).values({
			id: organizationId,
			name: "Received payment lock test",
			slug: `received-payment-lock-${suffix}`,
		});
		await db.insert(bookings).values({
			id: bookingId,
			organizationId,
			referenceNumber: `LOCK-${suffix}`,
			name: "Received payment lock test booking",
			bookingType: "test",
			packageType: "test",
			packageCost: "100.00",
		});
		await db.insert(receivedAmounts).values({
			id: receivedAmountId,
			organizationId,
			bookingId,
			amount: "100.00",
			paymentMethod: "cash",
			receivedDate: "2026-01-01",
		});

		let releaseFirstTransaction = () => {};
		const releaseGate = new Promise<void>((resolve) => {
			releaseFirstTransaction = resolve;
		});
		let reportFirstLock = () => {};
		const firstLockAcquired = new Promise<void>((resolve) => {
			reportFirstLock = resolve;
		});

		const firstTransaction = db.transaction(async (tx) => {
			const received = await getLockedReceivedPayment(tx, {
				organizationId,
				receivedAmountId,
			});
			expect(received?.id).toBe(receivedAmountId);
			reportFirstLock();
			await releaseGate;
		});

		try {
			await firstLockAcquired;

			let competingError: unknown;
			try {
				await db.transaction(async (tx) => {
					await tx.execute(sql`SET LOCAL lock_timeout = '100ms'`);
					await getLockedReceivedPayment(tx, {
						organizationId,
						receivedAmountId,
					});
				});
			} catch (error) {
				competingError = error;
			}

			expect(postgresErrorCode(competingError)).toBe("55P03");
		} finally {
			releaseFirstTransaction();
			await firstTransaction;
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});
});
