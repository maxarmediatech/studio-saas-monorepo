import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("receipt issue and void concurrency", () => {
	it("rolls back a receipt insert when invoice aggregation rejects it", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			bookings,
			count,
			db,
			eq,
			invoices,
			organizations,
			receipts,
			receivedAmounts,
		} = await import("@repo/database");
		const { getLockedBookingForReceipt, getLockedInvoiceForReceipt } =
			await import("./locked-invoice-for-receipt");
		const { getLockedReceivedPayment } = await import(
			"../../studio-payments/lib/received-payment-lock"
		);
		const { updateInvoicePaymentStatus } = await import("./receipt-helpers");

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `receipt_rollback_org_${suffix}`;
		const bookingId = `receipt_rollback_booking_${suffix}`;
		const invoiceId = `receipt_rollback_invoice_${suffix}`;
		const paymentId = `receipt_rollback_payment_${suffix}`;
		await db.insert(organizations).values({
			id: organizationId,
			name: "Receipt rollback test",
			slug: `receipt-rollback-${suffix}`,
		});
		await db.insert(bookings).values({
			id: bookingId,
			organizationId,
			referenceNumber: `ROLLBACK-${suffix}`,
			name: "Receipt rollback test booking",
			bookingType: "test",
			packageType: "test",
			packageCost: "100.00",
		});
		await db.insert(invoices).values({
			id: invoiceId,
			organizationId,
			bookingId,
			invoiceNumber: `ROLLBACK-INV-${suffix}`,
			issueDate: "2026-01-01",
			totalAmount: "50.00",
			status: "sent",
		});
		await db.insert(receivedAmounts).values({
			id: paymentId,
			organizationId,
			bookingId,
			invoiceId,
			amount: "100.00",
			paymentMethod: "cash",
			receivedDate: "2026-01-01",
		});

		try {
			await expect(
				db.transaction(async (tx) => {
					await getLockedBookingForReceipt(tx, { organizationId, bookingId });
					await getLockedInvoiceForReceipt(tx, {
						organizationId,
						bookingId,
						invoiceId,
					});
					await getLockedReceivedPayment(tx, {
						organizationId,
						receivedAmountId: paymentId,
					});
					await tx.insert(receipts).values({
						organizationId,
						bookingId,
						invoiceId,
						receivedAmountId: paymentId,
						receiptNumber: `ROLLBACK-RCPT-${suffix}`,
						amount: "100.00",
						paymentMethod: "cash",
						receiptDate: "2026-01-01",
					});
					await updateInvoicePaymentStatus(tx, invoiceId, "race_test_actor");
				}),
			).rejects.toThrow("Payment total exceeds invoice total");

			const [rows] = await db
				.select({ count: count() })
				.from(receipts)
				.where(eq(receipts.invoiceId, invoiceId));
			expect(Number(rows?.count)).toBe(0);
		} finally {
			await db.delete(organizations).where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});

	it("leaves the invoice aggregate equal to active receipts", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			bookings,
			db,
			eq,
			invoices,
			organizations,
			receipts,
			receivedAmounts,
		} = await import("@repo/database");
		const {
			getLockedBookingForReceipt,
			getLockedInvoiceForReceipt,
			getLockedReceiptForVoid,
		} = await import("./locked-invoice-for-receipt");
		const { getLockedReceivedPayment } = await import(
			"../../studio-payments/lib/received-payment-lock"
		);
		const { updateInvoicePaymentStatus } = await import("./receipt-helpers");

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `receipt_void_org_${suffix}`;
		const bookingId = `receipt_void_booking_${suffix}`;
		const invoiceId = `receipt_void_invoice_${suffix}`;
		const oldPaymentId = `receipt_void_old_payment_${suffix}`;
		const newPaymentId = `receipt_void_new_payment_${suffix}`;
		const oldReceiptId = `receipt_void_old_receipt_${suffix}`;

		await db.insert(organizations).values({
			id: organizationId,
			name: "Receipt issue/void race test",
			slug: `receipt-void-${suffix}`,
		});
		await db.insert(bookings).values({
			id: bookingId,
			organizationId,
			referenceNumber: `VOID-${suffix}`,
			name: "Receipt issue/void race test booking",
			bookingType: "test",
			packageType: "test",
			packageCost: "200.00",
		});
		await db.insert(invoices).values({
			id: invoiceId,
			organizationId,
			bookingId,
			invoiceNumber: `VOID-INV-${suffix}`,
			issueDate: "2026-01-01",
			totalAmount: "200.00",
			status: "sent",
		});
		await db.insert(receivedAmounts).values([
			{
				id: oldPaymentId,
				organizationId,
				bookingId,
				invoiceId,
				amount: "100.00",
				paymentMethod: "cash",
				receivedDate: "2026-01-01",
			},
			{
				id: newPaymentId,
				organizationId,
				bookingId,
				invoiceId,
				amount: "100.00",
				paymentMethod: "cash",
				receivedDate: "2026-01-02",
			},
		]);
		await db.insert(receipts).values({
			id: oldReceiptId,
			organizationId,
			bookingId,
			invoiceId,
			receivedAmountId: oldPaymentId,
			receiptNumber: `VOID-RCPT-OLD-${suffix}`,
			amount: "100.00",
			paymentMethod: "cash",
			receiptDate: "2026-01-01",
		});

		const issue = () =>
			db.transaction(async (tx) => {
				await getLockedBookingForReceipt(tx, { organizationId, bookingId });
				await getLockedInvoiceForReceipt(tx, {
					organizationId,
					bookingId,
					invoiceId,
				});
				const payment = await getLockedReceivedPayment(tx, {
					organizationId,
					receivedAmountId: newPaymentId,
				});
				await tx.insert(receipts).values({
					organizationId,
					bookingId,
					invoiceId,
					receivedAmountId: payment?.id,
					receiptNumber: `VOID-RCPT-NEW-${suffix}`,
					amount: "100.00",
					paymentMethod: "cash",
					receiptDate: "2026-01-02",
				});
				await updateInvoicePaymentStatus(tx, invoiceId, "race_test_actor");
			});
		const voidReceipt = () =>
			db.transaction(async (tx) => {
				await getLockedBookingForReceipt(tx, { organizationId, bookingId });
				await getLockedInvoiceForReceipt(tx, {
					organizationId,
					bookingId,
					invoiceId,
				});
				await getLockedReceivedPayment(tx, {
					organizationId,
					receivedAmountId: oldPaymentId,
				});
				const receipt = await getLockedReceiptForVoid(tx, {
					organizationId,
					receiptId: oldReceiptId,
				});
				await tx
					.update(receipts)
					.set({ deletedAt: new Date() })
					.where(eq(receipts.id, receipt?.id ?? oldReceiptId));
				await updateInvoicePaymentStatus(tx, invoiceId, "race_test_actor");
			});

		try {
			await Promise.all([issue(), voidReceipt()]);
			const invoice = await db.query.invoices.findFirst({
				where: eq(invoices.id, invoiceId),
				columns: { paidAmount: true, status: true },
			});
			expect(invoice).toEqual({ paidAmount: "100.00", status: "partial" });
		} finally {
			await db.delete(organizations).where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});
});
