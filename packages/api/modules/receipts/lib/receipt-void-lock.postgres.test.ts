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
		const { issueReceiptForReceivedPayment } = await import(
			"./receipt-transition-service"
		);

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
				db.transaction((tx) =>
					issueReceiptForReceivedPayment(tx, {
						organizationId,
						receivedAmountId: paymentId,
						expectedBookingId: bookingId,
						expectedInvoiceId: invoiceId,
						userId: "race_test_actor",
					}),
				),
			).rejects.toThrow("Payment total exceeds invoice total");

			const [rows] = await db
				.select({ count: count() })
				.from(receipts)
				.where(eq(receipts.invoiceId, invoiceId));
			expect(Number(rows?.count)).toBe(0);
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});

	it("never reissues a receipt when issuance races void for the same payment", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			bookings,
			and,
			count,
			db,
			eq,
			invoices,
			organizations,
			receipts,
			receivedAmounts,
			isNull,
		} = await import("@repo/database");
		const { issueReceiptForReceivedPayment, voidReceiptTransition } =
			await import("./receipt-transition-service");

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `receipt_void_org_${suffix}`;
		const bookingId = `receipt_void_booking_${suffix}`;
		const invoiceId = `receipt_void_invoice_${suffix}`;
		const oldPaymentId = `receipt_void_old_payment_${suffix}`;
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
		await db.insert(receivedAmounts).values({
			id: oldPaymentId,
			organizationId,
			bookingId,
			invoiceId,
			amount: "100.00",
			paymentMethod: "cash",
			receivedDate: "2026-01-01",
		});
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
			db.transaction((tx) =>
				issueReceiptForReceivedPayment(tx, {
					organizationId,
					receivedAmountId: oldPaymentId,
					expectedBookingId: bookingId,
					expectedInvoiceId: invoiceId,
					userId: "race_test_actor",
				}),
			);
		const voidReceipt = () =>
			db.transaction((tx) =>
				voidReceiptTransition(tx, {
					organizationId,
					receiptId: oldReceiptId,
					userId: "race_test_actor",
				}),
			);

		try {
			const outcomes = await Promise.allSettled([issue(), voidReceipt()]);
			expect(outcomes[1]?.status).toBe("fulfilled");
			if (outcomes[0]?.status === "fulfilled") {
				expect(outcomes[0].value).toMatchObject({
					id: oldReceiptId,
					created: false,
				});
			} else {
				expect(outcomes[0]?.reason).toMatchObject({
					message:
						"A receipt for this payment was voided and cannot be reissued",
				});
			}
			await expect(issue()).rejects.toThrow(
				"A receipt for this payment was voided and cannot be reissued",
			);

			const [activeReceipts] = await db
				.select({ count: count() })
				.from(receipts)
				.where(
					and(
						eq(receipts.receivedAmountId, oldPaymentId),
						isNull(receipts.deletedAt),
					),
				);
			expect(Number(activeReceipts?.count)).toBe(0);
			const [receiptHistory] = await db
				.select({ count: count() })
				.from(receipts)
				.where(eq(receipts.receivedAmountId, oldPaymentId));
			expect(Number(receiptHistory?.count)).toBe(1);
			const invoice = await db.query.invoices.findFirst({
				where: eq(invoices.id, invoiceId),
				columns: { paidAmount: true, status: true },
			});
			expect(invoice).toEqual({
				paidAmount: "0.00",
				status: "sent",
			});
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});

	it("rejects receipt issuance across mismatched payment schedules", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			bookings,
			count,
			db,
			eq,
			invoices,
			organizations,
			paymentSchedules,
			receipts,
			receivedAmounts,
		} = await import("@repo/database");
		const { issueReceiptForReceivedPayment, voidReceiptTransition } =
			await import("./receipt-transition-service");
		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `receipt_schedule_org_${suffix}`;
		const bookingId = `receipt_schedule_booking_${suffix}`;
		const invoiceId = `receipt_schedule_invoice_${suffix}`;
		const invoiceScheduleId = `receipt_invoice_schedule_${suffix}`;
		const paymentScheduleId = `receipt_payment_schedule_${suffix}`;
		const paymentId = `receipt_schedule_payment_${suffix}`;

		await db.insert(organizations).values({
			id: organizationId,
			name: "Receipt schedule relationship test",
			slug: `receipt-schedule-${suffix}`,
		});
		await db.insert(bookings).values({
			id: bookingId,
			organizationId,
			referenceNumber: `RCPT-SCHEDULE-${suffix}`,
			name: "Receipt schedule relationship test booking",
			bookingType: "test",
			packageType: "test",
			packageCost: "200.00",
		});
		await db.insert(paymentSchedules).values([
			{
				id: invoiceScheduleId,
				organizationId,
				bookingId,
				name: "Invoice schedule",
				amount: "100.00",
				dueDate: "2026-01-01",
			},
			{
				id: paymentScheduleId,
				organizationId,
				bookingId,
				name: "Payment schedule",
				amount: "100.00",
				dueDate: "2026-01-02",
			},
		]);
		await db.insert(invoices).values({
			id: invoiceId,
			organizationId,
			bookingId,
			paymentScheduleId: invoiceScheduleId,
			invoiceNumber: `RCPT-SCHEDULE-INV-${suffix}`,
			issueDate: "2026-01-01",
			totalAmount: "100.00",
			status: "sent",
		});
		await db.insert(receivedAmounts).values({
			id: paymentId,
			organizationId,
			bookingId,
			invoiceId,
			paymentScheduleId,
			amount: "100.00",
			paymentMethod: "cash",
			receivedDate: "2026-01-01",
		});

		try {
			await expect(
				db.transaction((tx) =>
					issueReceiptForReceivedPayment(tx, {
						organizationId,
						userId: "race_test_actor",
						receivedAmountId: paymentId,
						expectedBookingId: bookingId,
						expectedInvoiceId: invoiceId,
					}),
				),
			).rejects.toThrow(
				"Payment and invoice belong to different payment schedules",
			);
			const [receiptRows] = await db
				.select({ count: count() })
				.from(receipts)
				.where(eq(receipts.receivedAmountId, paymentId));
			expect(Number(receiptRows?.count)).toBe(0);
			const [corruptedReceipt] = await db
				.insert(receipts)
				.values({
					organizationId,
					bookingId,
					invoiceId,
					receivedAmountId: paymentId,
					receiptNumber: `RCPT-SCHEDULE-${suffix}`,
					amount: "100.00",
					paymentMethod: "cash",
					receiptDate: "2026-01-01",
				})
				.returning({ id: receipts.id });
			await expect(
				db.transaction((tx) =>
					voidReceiptTransition(tx, {
						organizationId,
						userId: "race_test_actor",
						receiptId: corruptedReceipt?.id ?? "missing",
					}),
				),
			).rejects.toThrow(
				"Payment and invoice belong to different payment schedules",
			);
			const unchangedReceipt = await db.query.receipts.findFirst({
				where: eq(receipts.id, corruptedReceipt?.id ?? "missing"),
				columns: { deletedAt: true },
			});
			expect(unchangedReceipt?.deletedAt).toBeNull();
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});
});
