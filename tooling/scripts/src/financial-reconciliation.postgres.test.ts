import assert from "node:assert/strict";
import { describe, it } from "node:test";

const databaseUrl = process.env.POSTGRES_RECONCILIATION_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("financial reconciliation on migrated PostgreSQL", () => {
	it("reports, safely repairs, and detects receipt/payment invoice disagreement", async () => {
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
		const { main, queryFinancialMismatches } = await import(
			"./reconcile-financials"
		);

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `reconcile_org_${suffix}`;
		const bookingId = `reconcile_booking_${suffix}`;
		const scheduleId = `reconcile_schedule_${suffix}`;
		const invoiceId = `reconcile_invoice_${suffix}`;
		const otherInvoiceId = `reconcile_other_invoice_${suffix}`;
		const receivedAmountId = `reconcile_payment_${suffix}`;
		const receiptId = `reconcile_receipt_${suffix}`;
		const logs: string[] = [];
		const originalLog = console.log;

		try {
			await db.insert(organizations).values({
				id: organizationId,
				name: "Financial reconciliation test",
				slug: `financial-reconciliation-${suffix}`,
			});
			await db.insert(bookings).values({
				id: bookingId,
				organizationId,
				referenceNumber: `RECON-${suffix}`,
				name: "Financial reconciliation booking",
				bookingType: "test",
				packageType: "test",
				packageCost: "100.00",
				totalReceived: "0.00",
			});
			await db.insert(paymentSchedules).values({
				id: scheduleId,
				organizationId,
				bookingId,
				name: "Deposit",
				amount: "100.00",
				dueDate: "2026-12-31",
				paidAmount: "0.00",
				status: "pending",
			});
			await db.insert(invoices).values({
				id: invoiceId,
				organizationId,
				bookingId,
				paymentScheduleId: scheduleId,
				invoiceNumber: `RECON-INV-${suffix}`,
				issueDate: "2026-01-01",
				dueDate: "2026-12-31",
				totalAmount: "100.00",
				paidAmount: "0.00",
				status: "sent",
			});
			await db.insert(receivedAmounts).values({
				id: receivedAmountId,
				organizationId,
				bookingId,
				paymentScheduleId: scheduleId,
				invoiceId,
				amount: "40.00",
				paymentMethod: "cash",
				receivedDate: "2026-01-15",
			});
			await db.insert(receipts).values({
				id: receiptId,
				organizationId,
				bookingId,
				invoiceId,
				receivedAmountId,
				receiptNumber: `RECON-RCPT-${suffix}`,
				amount: "40.00",
				paymentMethod: "cash",
				receiptDate: "2026-01-15",
			});

			console.log = (...values: unknown[]) => {
				logs.push(values.map(String).join(" "));
			};

			const reportCode = await main([
				"--organization-id",
				organizationId,
				"--report",
				"--as-of",
				"2026-07-10",
			]);
			assert.equal(reportCode, 1);
			const reportOutput = JSON.parse(logs[logs.length - 1] ?? "{}") as {
				summary: { actionable: number; safeFixable: number };
			};
			assert.equal(reportOutput.summary.actionable, 3);
			assert.equal(reportOutput.summary.safeFixable, 3);

			const fixCode = await main([
				"--organization-id",
				organizationId,
				"--fix-safe",
				"--as-of",
				"2026-07-10",
			]);
			assert.equal(fixCode, 0);
			const fixOutput = JSON.parse(logs[logs.length - 1] ?? "{}") as {
				applied: string[];
				after: { summary: { actionable: number } };
			};
			assert.equal(fixOutput.applied.length, 3);
			assert.equal(fixOutput.after.summary.actionable, 0);

			const [booking, schedule, invoice] = await Promise.all([
				db.query.bookings.findFirst({
					where: eq(bookings.id, bookingId),
				}),
				db.query.paymentSchedules.findFirst({
					where: eq(paymentSchedules.id, scheduleId),
				}),
				db.query.invoices.findFirst({
					where: eq(invoices.id, invoiceId),
				}),
			]);
			assert.equal(booking?.totalReceived, "40.00");
			assert.equal(schedule?.paidAmount, "40.00");
			assert.equal(invoice?.paidAmount, "40.00");
			assert.equal(invoice?.status, "partial");

			await db.insert(invoices).values({
				id: otherInvoiceId,
				organizationId,
				bookingId,
				invoiceNumber: `RECON-OTHER-${suffix}`,
				issueDate: "2026-01-01",
				dueDate: "2026-12-31",
				totalAmount: "100.00",
				status: "sent",
			});
			await db
				.update(receipts)
				.set({ invoiceId: otherInvoiceId })
				.where(eq(receipts.id, receiptId));

			const disagreement = await queryFinancialMismatches(
				organizationId,
				"2026-07-10",
			);
			assert.ok(
				disagreement.mismatches.some(
					(mismatch) =>
						mismatch.mismatchType ===
							"cross_entity_booking_org_disagreement" &&
						mismatch.entityId === receiptId &&
						mismatch.relatedId === receivedAmountId,
				),
			);

			await db
				.update(receipts)
				.set({ deletedAt: new Date() })
				.where(eq(receipts.id, receiptId));
			await db
				.update(invoices)
				.set({ paidAmount: "99.00", status: "paid" })
				.where(eq(invoices.id, invoiceId));

			const missingReceipt = await queryFinancialMismatches(
				organizationId,
				"2026-07-10",
			);
			const unsafeInvoice = missingReceipt.mismatches.find(
				(mismatch) =>
					mismatch.mismatchType ===
						"invoice_paid_status_vs_valid_applications" &&
					mismatch.entityId === invoiceId,
			);
			assert.equal(unsafeInvoice?.expectedValue, "0");
			assert.equal(unsafeInvoice?.safeFixAvailable, false);
			assert.ok(
				missingReceipt.mismatches.some(
					(mismatch) =>
						mismatch.mismatchType ===
							"cross_entity_booking_org_disagreement" &&
						mismatch.entityId === receivedAmountId,
				),
			);

			const unsafeFixCode = await main([
				"--organization-id",
				organizationId,
				"--fix-safe",
				"--as-of",
				"2026-07-10",
			]);
			assert.equal(unsafeFixCode, 1);
			const unchangedInvoice = await db.query.invoices.findFirst({
				where: eq(invoices.id, invoiceId),
			});
			assert.equal(unchangedInvoice?.paidAmount, "99.00");
			assert.equal(unchangedInvoice?.status, "paid");
		} finally {
			console.log = originalLog;
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
			await (
				db as unknown as { $client: { end(): Promise<void> } }
			).$client.end();
		}
	});
});
