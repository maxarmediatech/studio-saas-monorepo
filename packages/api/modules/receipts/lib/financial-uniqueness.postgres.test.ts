import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("migrated financial uniqueness constraints", () => {
	it("enforces one active invoice per schedule and receipt per payment", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			bookings,
			db,
			eq,
			invoices,
			organizations,
			paymentSchedules,
			receipts,
			receivedAmounts,
		} = await import("@repo/database");
		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `financial_unique_org_${suffix}`;
		const bookingId = `financial_unique_booking_${suffix}`;
		const scheduleId = `financial_unique_schedule_${suffix}`;
		const firstInvoiceId = `financial_unique_invoice_1_${suffix}`;
		const secondInvoiceId = `financial_unique_invoice_2_${suffix}`;
		const paymentId = `financial_unique_payment_${suffix}`;
		const firstReceiptId = `financial_unique_receipt_1_${suffix}`;

		await db.insert(organizations).values({
			id: organizationId,
			name: "Financial uniqueness constraint test",
			slug: `financial-unique-${suffix}`,
		});
		await db.insert(bookings).values({
			id: bookingId,
			organizationId,
			referenceNumber: `FIN-UNIQUE-${suffix}`,
			name: "Financial uniqueness constraint test booking",
			bookingType: "test",
			packageType: "test",
			packageCost: "100.00",
		});
		await db.insert(paymentSchedules).values({
			id: scheduleId,
			organizationId,
			bookingId,
			name: "Unique schedule",
			amount: "100.00",
			dueDate: "2026-01-01",
		});
		const invoiceValues = {
			organizationId,
			bookingId,
			paymentScheduleId: scheduleId,
			issueDate: "2026-01-01",
			totalAmount: "100.00",
			status: "sent" as const,
		};
		await db.insert(invoices).values({
			...invoiceValues,
			id: firstInvoiceId,
			invoiceNumber: `FIN-UNIQUE-INV-1-${suffix}`,
		});

		try {
			await expect(
				db.insert(invoices).values({
					...invoiceValues,
					id: secondInvoiceId,
					invoiceNumber: `FIN-UNIQUE-INV-2-${suffix}`,
				}),
			).rejects.toMatchObject({
				code: "23505",
				constraint: "invoices_active_payment_schedule_idx",
			});

			await db
				.update(invoices)
				.set({ deletedAt: new Date() })
				.where(eq(invoices.id, firstInvoiceId));
			await db.insert(invoices).values({
				...invoiceValues,
				id: secondInvoiceId,
				invoiceNumber: `FIN-UNIQUE-INV-2-${suffix}`,
			});

			await db.insert(receivedAmounts).values({
				id: paymentId,
				organizationId,
				bookingId,
				invoiceId: secondInvoiceId,
				paymentScheduleId: scheduleId,
				amount: "100.00",
				paymentMethod: "cash",
				receivedDate: "2026-01-01",
			});
			const receiptValues = {
				organizationId,
				bookingId,
				invoiceId: secondInvoiceId,
				receivedAmountId: paymentId,
				amount: "100.00",
				paymentMethod: "cash",
				receiptDate: "2026-01-01",
			};
			await db.insert(receipts).values({
				...receiptValues,
				id: firstReceiptId,
				receiptNumber: `FIN-UNIQUE-RCPT-1-${suffix}`,
			});
			await expect(
				db.insert(receipts).values({
					...receiptValues,
					receiptNumber: `FIN-UNIQUE-RCPT-2-${suffix}`,
				}),
			).rejects.toMatchObject({
				code: "23505",
				constraint: "receipts_active_received_amount_idx",
			});

			await db
				.update(receipts)
				.set({ deletedAt: new Date() })
				.where(eq(receipts.id, firstReceiptId));
			await expect(
				db.insert(receipts).values({
					...receiptValues,
					receiptNumber: `FIN-UNIQUE-RCPT-2-${suffix}`,
				}),
			).resolves.toBeDefined();
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});
});
