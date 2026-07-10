import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("payment correction on migrated PostgreSQL", () => {
	it("atomically reverses financial effects and idempotently creates one replacement", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			and,
			bookings,
			db,
			eq,
			invoices,
			isNull,
			organizations,
			paymentSchedules,
			receipts,
			receivedAmounts,
			users,
		} = await import("@repo/database");
		const { correctReceivedPaymentIdempotently } = await import(
			"./payment-idempotency"
		);
		const suffix = `${process.pid}_${Date.now()}`;
		const ids = {
			user: `correction_user_${suffix}`,
			organization: `correction_org_${suffix}`,
			booking: `correction_booking_${suffix}`,
			schedule: `correction_schedule_${suffix}`,
			invoice: `correction_invoice_${suffix}`,
			payment: `correction_payment_${suffix}`,
			receipt: `correction_receipt_${suffix}`,
		};
		await db.insert(users).values({
			id: ids.user,
			name: "Correction actor",
			email: `correction-${suffix}@example.invalid`,
		});
		await db.insert(organizations).values({
			id: ids.organization,
			name: "Correction test",
			slug: `correction-${suffix}`,
		});
		await db.insert(bookings).values({
			id: ids.booking,
			organizationId: ids.organization,
			referenceNumber: `COR-${suffix}`,
			name: "Correction booking",
			bookingType: "test",
			packageType: "test",
			packageCost: "100.00",
			totalReceived: "100.00",
		});
		await db.insert(paymentSchedules).values({
			id: ids.schedule,
			organizationId: ids.organization,
			bookingId: ids.booking,
			name: "Final payment",
			amount: "100.00",
			dueDate: "2026-01-01",
			paidAmount: "100.00",
			status: "completed",
			paidAt: new Date(),
		});
		await db.insert(invoices).values({
			id: ids.invoice,
			organizationId: ids.organization,
			bookingId: ids.booking,
			paymentScheduleId: ids.schedule,
			invoiceNumber: `COR-INV-${suffix}`,
			issueDate: "2026-01-01",
			totalAmount: "100.00",
			paidAmount: "100.00",
			status: "paid",
			paidAt: new Date(),
		});
		await db.insert(receivedAmounts).values({
			id: ids.payment,
			organizationId: ids.organization,
			bookingId: ids.booking,
			invoiceId: ids.invoice,
			paymentScheduleId: ids.schedule,
			amount: "100.00",
			paymentMethod: "cash",
			receivedDate: "2026-01-01",
			createdBy: ids.user,
		});
		await db.insert(receipts).values({
			id: ids.receipt,
			organizationId: ids.organization,
			bookingId: ids.booking,
			invoiceId: ids.invoice,
			receivedAmountId: ids.payment,
			receiptNumber: `COR-RCPT-${suffix}`,
			amount: "100.00",
			paymentMethod: "cash",
			receiptDate: "2026-01-01",
			createdBy: ids.user,
		});

		const request = {
			id: ids.payment,
			idempotencyKey: `payment-correction:${suffix}`,
			amount: "80.00",
			paymentMethod: "bank_transfer" as const,
			receivedDate: "2026-01-02",
			transactionReference: "BANK-CORRECTED",
			notes: "Corrected from statement",
			reason: "The original amount was entered incorrectly",
			actorName: "Correction actor",
			organizationId: ids.organization,
			userId: ids.user,
		};
		await expect(
			db.transaction((tx) =>
				correctReceivedPaymentIdempotently(tx, {
					...request,
					idempotencyKey: `payment-correction-invalid:${suffix}`,
					amount: "120.00",
				}),
			),
		).rejects.toThrow("Amount cannot exceed remaining scheduled balance");
		const unchangedOriginal = await db.query.receivedAmounts.findFirst({
			where: and(
				eq(receivedAmounts.id, ids.payment),
				isNull(receivedAmounts.deletedAt),
			),
		});
		const unchangedReceipt = await db.query.receipts.findFirst({
			where: and(
				eq(receipts.id, ids.receipt),
				isNull(receipts.deletedAt),
			),
		});
		expect(unchangedOriginal?.replacementPaymentId).toBeNull();
		expect(unchangedReceipt?.id).toBe(ids.receipt);

		const first = await db.transaction((tx) =>
			correctReceivedPaymentIdempotently(tx, request),
		);
		const replay = await db.transaction((tx) =>
			correctReceivedPaymentIdempotently(tx, request),
		);
		expect(replay).toEqual({ result: first.result, replayed: true });

		const replacementId = first.result.data.replacementId;
		const original = await db.query.receivedAmounts.findFirst({
			where: eq(receivedAmounts.id, ids.payment),
		});
		expect(original).toMatchObject({
			replacementPaymentId: replacementId,
			reversalReason: request.reason,
		});
		expect(original?.deletedAt).toBeInstanceOf(Date);
		const replacement = await db.query.receivedAmounts.findFirst({
			where: and(
				eq(receivedAmounts.id, replacementId),
				isNull(receivedAmounts.deletedAt),
			),
		});
		expect(replacement).toMatchObject({
			amount: "80.00",
			paymentMethod: "bank_transfer",
			replacesPaymentId: ids.payment,
		});
		const oldReceipt = await db.query.receipts.findFirst({
			where: eq(receipts.id, ids.receipt),
		});
		expect(oldReceipt?.deletedAt).toBeInstanceOf(Date);
		expect(oldReceipt?.notes).toContain(request.reason);
		const newReceipt = await db.query.receipts.findFirst({
			where: and(
				eq(receipts.receivedAmountId, replacementId),
				isNull(receipts.deletedAt),
			),
		});
		expect(newReceipt).toMatchObject({ amount: "80.00" });
		const booking = await db.query.bookings.findFirst({
			where: eq(bookings.id, ids.booking),
		});
		const invoice = await db.query.invoices.findFirst({
			where: eq(invoices.id, ids.invoice),
		});
		const schedule = await db.query.paymentSchedules.findFirst({
			where: eq(paymentSchedules.id, ids.schedule),
		});
		expect(booking?.totalReceived).toBe("80.00");
		expect(invoice).toMatchObject({
			paidAmount: "80.00",
			status: "partial",
		});
		expect(schedule).toMatchObject({
			paidAmount: "80.00",
			status: "partial",
		});

		await db
			.delete(organizations)
			.where(eq(organizations.id, ids.organization));
		process.env.DATABASE_URL = originalDatabaseUrl;
	});
});
