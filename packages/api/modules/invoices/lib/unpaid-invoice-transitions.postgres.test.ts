import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("unpaid invoice transition concurrency", () => {
	it("does not delete an invoice after a competing payment commits", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;

		const { bookings, db, eq, invoices, organizations, sql } = await import(
			"@repo/database"
		);
		const { softDeleteUnpaidInvoice } = await import(
			"./unpaid-invoice-transitions"
		);
		const { getLockedInvoiceForReceipt } = await import(
			"../../receipts/lib/locked-invoice-for-receipt"
		);

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `invoice_race_org_${suffix}`;
		const bookingId = `invoice_race_booking_${suffix}`;
		const invoiceId = `invoice_race_invoice_${suffix}`;

		await db.insert(organizations).values({
			id: organizationId,
			name: "Invoice payment race test",
			slug: `invoice-payment-race-${suffix}`,
		});
		await db.insert(bookings).values({
			id: bookingId,
			organizationId,
			referenceNumber: `RACE-${suffix}`,
			name: "Invoice payment race test booking",
			bookingType: "test",
			packageType: "test",
			packageCost: "100.00",
		});
		await db.insert(invoices).values({
			id: invoiceId,
			organizationId,
			bookingId,
			invoiceNumber: `RACE-INV-${suffix}`,
			issueDate: "2026-01-01",
			totalAmount: "100.00",
			paidAmount: "0.00",
			status: "sent",
		});

		let releasePayment = () => {};
		const paymentGate = new Promise<void>((resolve) => {
			releasePayment = resolve;
		});
		let reportPaymentLock = () => {};
		const paymentLockAcquired = new Promise<void>((resolve) => {
			reportPaymentLock = resolve;
		});

		const paymentTransaction = db.transaction(async (tx) => {
			const lockedInvoice = await getLockedInvoiceForReceipt(tx, {
				organizationId,
				bookingId,
				invoiceId,
			});
			expect(lockedInvoice?.id).toBe(invoiceId);
			await tx
				.update(invoices)
				.set({ paidAmount: "100.00", status: "paid" })
				.where(eq(invoices.id, invoiceId));
			reportPaymentLock();
			await paymentGate;
		});

		try {
			await paymentLockAcquired;

			let reportDeletePid = (_pid: number) => {};
			const deletePid = new Promise<number>((resolve) => {
				reportDeletePid = resolve;
			});
			const deleteTransaction = db.transaction(async (tx) => {
				const result = await tx.execute<{ pid: number }>(
					sql`SELECT pg_backend_pid() AS pid`,
				);
				reportDeletePid(result.rows[0]?.pid ?? 0);
				return softDeleteUnpaidInvoice(tx, {
					organizationId,
					invoiceId,
					actorId: "race_test_actor",
				});
			});

			const pid = await deletePid;
			const deadline = Date.now() + 2_000;
			let isWaitingForLock = false;
			while (Date.now() < deadline) {
				const activity = await db.execute<{
					wait_event_type: string | null;
				}>(
					sql`
						SELECT wait_event_type
						FROM pg_stat_activity
						WHERE pid = ${pid}
					`,
				);
				if (activity.rows[0]?.wait_event_type === "Lock") {
					isWaitingForLock = true;
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			expect(isWaitingForLock).toBe(true);
			releasePayment();
			await paymentTransaction;
			await expect(deleteTransaction).resolves.toBeNull();

			const invoice = await db.query.invoices.findFirst({
				where: eq(invoices.id, invoiceId),
				columns: { deletedAt: true, paidAmount: true, status: true },
			});
			expect(invoice).toEqual({
				deletedAt: null,
				paidAmount: "100.00",
				status: "paid",
			});
		} finally {
			releasePayment();
			await Promise.allSettled([paymentTransaction]);
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});

	it("completes existing-payment and new-payment lock sequences without deadlock", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;

		const {
			bookings,
			db,
			eq,
			invoices,
			organizations,
			receivedAmounts,
			sql,
		} = await import("@repo/database");
		const { getLockedBookingForReceipt, getLockedInvoiceForReceipt } =
			await import("../../receipts/lib/locked-invoice-for-receipt");
		const { getLockedReceivedPayment } = await import(
			"../../studio-payments/lib/received-payment-lock"
		);

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `lock_order_org_${suffix}`;
		const bookingId = `lock_order_booking_${suffix}`;
		const invoiceId = `lock_order_invoice_${suffix}`;
		const receivedAmountId = `lock_order_payment_${suffix}`;

		await db.insert(organizations).values({
			id: organizationId,
			name: "Receipt lock order test",
			slug: `receipt-lock-order-${suffix}`,
		});
		await db.insert(bookings).values({
			id: bookingId,
			organizationId,
			referenceNumber: `ORDER-${suffix}`,
			name: "Receipt lock order test booking",
			bookingType: "test",
			packageType: "test",
			packageCost: "100.00",
		});
		await db.insert(invoices).values({
			id: invoiceId,
			organizationId,
			bookingId,
			invoiceNumber: `ORDER-INV-${suffix}`,
			issueDate: "2026-01-01",
			totalAmount: "100.00",
			status: "sent",
		});
		await db.insert(receivedAmounts).values({
			id: receivedAmountId,
			organizationId,
			bookingId,
			invoiceId,
			amount: "100.00",
			paymentMethod: "cash",
			receivedDate: "2026-01-01",
		});

		let releaseExistingPayment = () => {};
		const existingPaymentGate = new Promise<void>((resolve) => {
			releaseExistingPayment = resolve;
		});
		let reportBookingLock = () => {};
		const bookingLockAcquired = new Promise<void>((resolve) => {
			reportBookingLock = resolve;
		});

		const existingPaymentTransaction = db.transaction(async (tx) => {
			await getLockedBookingForReceipt(tx, {
				organizationId,
				bookingId,
			});
			reportBookingLock();
			await existingPaymentGate;
			await getLockedInvoiceForReceipt(tx, {
				organizationId,
				bookingId,
				invoiceId,
			});
			await getLockedReceivedPayment(tx, {
				organizationId,
				receivedAmountId,
			});
		});
		let newPaymentTransaction: Promise<unknown> | null = null;

		try {
			await bookingLockAcquired;
			let reportNewPaymentPid = (_pid: number) => {};
			const newPaymentPid = new Promise<number>((resolve) => {
				reportNewPaymentPid = resolve;
			});
			newPaymentTransaction = db.transaction(async (tx) => {
				const result = await tx.execute<{ pid: number }>(
					sql`SELECT pg_backend_pid() AS pid`,
				);
				reportNewPaymentPid(result.rows[0]?.pid ?? 0);
				await getLockedBookingForReceipt(tx, {
					organizationId,
					bookingId,
				});
				await getLockedInvoiceForReceipt(tx, {
					organizationId,
					bookingId,
					invoiceId,
				});
			});

			const pid = await newPaymentPid;
			const deadline = Date.now() + 2_000;
			let isWaitingForBooking = false;
			while (Date.now() < deadline) {
				const activity = await db.execute<{
					wait_event_type: string | null;
				}>(
					sql`
						SELECT wait_event_type
						FROM pg_stat_activity
						WHERE pid = ${pid}
					`,
				);
				if (activity.rows[0]?.wait_event_type === "Lock") {
					isWaitingForBooking = true;
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			expect(isWaitingForBooking).toBe(true);
			releaseExistingPayment();
			await expect(
				Promise.race([
					Promise.all([
						existingPaymentTransaction,
						newPaymentTransaction,
					]),
					new Promise((_, reject) =>
						setTimeout(
							() =>
								reject(
									new Error("receipt lock order deadlocked"),
								),
							2_000,
						),
					),
				]),
			).resolves.toBeDefined();
		} finally {
			releaseExistingPayment();
			await Promise.allSettled([
				existingPaymentTransaction,
				...(newPaymentTransaction ? [newPaymentTransaction] : []),
			]);
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});
});
