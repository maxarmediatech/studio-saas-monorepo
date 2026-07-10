import assert from "node:assert/strict";
import { describe, it } from "node:test";

const databaseUrl = process.env.POSTGRES_RECONCILIATION_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("financial reconciliation on migrated PostgreSQL", () => {
	it("executes schedule aggregates, safely repairs, and detects tenant-bound history", async () => {
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
			sql,
		} = await import("@repo/database");
		const { applySafeFinancialFixes, main, queryFinancialMismatches } =
			await import("./reconcile-financials");

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `reconcile_org_${suffix}`;
		const bookingId = `reconcile_booking_${suffix}`;
		const scheduleId = `reconcile_schedule_${suffix}`;
		const invoiceId = `reconcile_invoice_${suffix}`;
		const otherInvoiceId = `reconcile_other_invoice_${suffix}`;
		const draftRaceInvoiceId = `reconcile_draft_race_invoice_${suffix}`;
		const draftRacePaymentId = `reconcile_draft_race_payment_${suffix}`;
		const draftRaceReceiptId = `reconcile_draft_race_receipt_${suffix}`;
		const crossTenantScheduleId = `reconcile_cross_tenant_schedule_${suffix}`;
		const crossTenantInvoiceId = `reconcile_cross_tenant_invoice_${suffix}`;
		const mismatchedInvoiceScheduleId = `reconcile_mismatched_invoice_schedule_${suffix}`;
		const mismatchedInvoiceId = `reconcile_mismatched_invoice_${suffix}`;
		const mismatchedPaymentId = `reconcile_mismatched_payment_${suffix}`;
		const mismatchedReceiptId = `reconcile_mismatched_receipt_${suffix}`;
		const cancelledScheduleId = `reconcile_cancelled_schedule_${suffix}`;
		const cancelledScheduleInvoiceId = `reconcile_cancelled_schedule_invoice_${suffix}`;
		const draftAmountOnlyInvoiceId = `reconcile_draft_amount_only_${suffix}`;
		const deletedChainScheduleId = `reconcile_deleted_chain_schedule_${suffix}`;
		const deletedChainPaymentId = `reconcile_deleted_chain_payment_${suffix}`;
		const crossTenantChainPaymentId = `reconcile_cross_tenant_chain_payment_${suffix}`;
		const receivedAmountId = `reconcile_payment_${suffix}`;
		const receiptId = `reconcile_receipt_${suffix}`;
		const historyReceiptId = `reconcile_history_receipt_${suffix}`;
		const historyInvoiceId = `reconcile_history_invoice_${suffix}`;
		const crossOrganizationReceiptId = `reconcile_cross_receipt_${suffix}`;
		const crossOrganizationInvoiceId = `reconcile_cross_invoice_${suffix}`;
		const failedRepairBookingId = `reconcile_failed_repair_booking_${suffix}`;
		const successfulRepairBookingId = `reconcile_successful_repair_booking_${suffix}`;
		const failedRepairPaymentId = `reconcile_failed_repair_payment_${suffix}`;
		const successfulRepairPaymentId = `reconcile_successful_repair_payment_${suffix}`;
		const overBookingId = `reconcile_over_booking_${suffix}`;
		const overScheduleId = `reconcile_over_schedule_${suffix}`;
		const overInvoiceId = `reconcile_over_invoice_${suffix}`;
		const overPaymentIds = [
			`reconcile_over_payment_a_${suffix}`,
			`reconcile_over_payment_b_${suffix}`,
		];
		const overReceiptIds = [
			`reconcile_over_receipt_a_${suffix}`,
			`reconcile_over_receipt_b_${suffix}`,
		];
		const otherOrganizationId = `reconcile_other_org_${suffix}`;
		const otherBookingId = `reconcile_other_booking_${suffix}`;
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
				paidAt: new Date("2026-01-02T03:04:05.000Z"),
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
			assert.equal(
				invoice?.paidAt?.toISOString(),
				"2026-01-02T03:04:05.000Z",
			);

			await db.insert(paymentSchedules).values({
				id: mismatchedInvoiceScheduleId,
				organizationId,
				bookingId,
				name: "Mismatched invoice schedule",
				amount: "100.00",
				dueDate: "2026-12-31",
				paidAmount: "0.00",
				status: "pending",
			});
			await db.insert(invoices).values({
				id: mismatchedInvoiceId,
				organizationId,
				bookingId,
				paymentScheduleId: mismatchedInvoiceScheduleId,
				invoiceNumber: `RECON-MISMATCHED-SCHEDULE-${suffix}`,
				issueDate: "2026-01-01",
				dueDate: "2026-12-31",
				totalAmount: "100.00",
				paidAmount: "15.00",
				status: "partial",
			});
			await db.transaction(async (tx) => {
				// Model corruption that predates migration 0043. Normal writes must
				// continue through the production relationship guards.
				await tx.execute(
					sql`SET LOCAL session_replication_role = replica`,
				);
				await tx.insert(receivedAmounts).values({
					id: mismatchedPaymentId,
					organizationId,
					bookingId,
					paymentScheduleId: scheduleId,
					invoiceId: mismatchedInvoiceId,
					amount: "15.00",
					paymentMethod: "cash",
					receivedDate: "2026-02-01",
				});
				await tx.insert(receipts).values({
					id: mismatchedReceiptId,
					organizationId,
					bookingId,
					invoiceId: mismatchedInvoiceId,
					receivedAmountId: mismatchedPaymentId,
					receiptNumber: `RECON-MISMATCHED-RCPT-${suffix}`,
					amount: "15.00",
					paymentMethod: "cash",
					receiptDate: "2026-02-01",
				});
			});
			await db.insert(paymentSchedules).values({
				id: cancelledScheduleId,
				organizationId,
				bookingId,
				name: "Cancelled parent schedule",
				amount: "100.00",
				dueDate: "2026-12-31",
				paidAmount: "0.00",
				status: "cancelled",
			});
			await db.insert(invoices).values({
				id: cancelledScheduleInvoiceId,
				organizationId,
				bookingId,
				paymentScheduleId: cancelledScheduleId,
				invoiceNumber: `RECON-CANCELLED-SCHEDULE-${suffix}`,
				issueDate: "2026-01-01",
				dueDate: "2026-12-31",
				totalAmount: "100.00",
				paidAmount: "10.00",
				status: "sent",
			});
			await db.insert(invoices).values({
				id: draftAmountOnlyInvoiceId,
				organizationId,
				bookingId,
				invoiceNumber: `RECON-DRAFT-AMOUNT-ONLY-${suffix}`,
				issueDate: "2026-01-01",
				dueDate: "2026-12-31",
				totalAmount: "100.00",
				paidAmount: "10.00",
				status: "draft",
			});

			await db.insert(invoices).values({
				id: draftRaceInvoiceId,
				organizationId,
				bookingId,
				invoiceNumber: `RECON-DRAFT-RACE-${suffix}`,
				issueDate: "2026-01-01",
				dueDate: "2026-12-31",
				totalAmount: "100.00",
				paidAmount: "0.00",
				status: "sent",
			});
			await db.insert(receivedAmounts).values({
				id: draftRacePaymentId,
				organizationId,
				bookingId,
				invoiceId: draftRaceInvoiceId,
				amount: "20.00",
				paymentMethod: "cash",
				receivedDate: "2026-02-01",
			});
			await db.insert(receipts).values({
				id: draftRaceReceiptId,
				organizationId,
				bookingId,
				invoiceId: draftRaceInvoiceId,
				receivedAmountId: draftRacePaymentId,
				receiptNumber: `RECON-DRAFT-RACE-RCPT-${suffix}`,
				amount: "20.00",
				paymentMethod: "cash",
				receiptDate: "2026-02-01",
			});
			const draftRaceReport = await queryFinancialMismatches(
				organizationId,
				"2026-07-10",
			);
			const draftRaceMismatch = draftRaceReport.mismatches.find(
				(mismatch) =>
					mismatch.mismatchType ===
						"invoice_paid_status_vs_valid_applications" &&
					mismatch.entityId === draftRaceInvoiceId,
			);
			assert.ok(draftRaceMismatch);
			assert.equal(draftRaceMismatch.safeFixAvailable, true);
			await db
				.update(invoices)
				.set({ status: "draft" })
				.where(eq(invoices.id, draftRaceInvoiceId));
			const forcedDraftMutation = await applySafeFinancialFixes(
				organizationId,
				"2026-07-10",
				[
					{
						...draftRaceMismatch,
						safeFixAvailable: true,
						intendedAction: "recalculate_invoice_paid_status",
					},
				],
			);
			assert.deepEqual(forcedDraftMutation.applied, []);
			assert.deepEqual(forcedDraftMutation.failed, [
				{
					mismatchId: draftRaceMismatch.id,
					reason: "repair_guard_prevented_update",
				},
			]);
			const draftRaceInvoice = await db.query.invoices.findFirst({
				where: eq(invoices.id, draftRaceInvoiceId),
			});
			assert.equal(draftRaceInvoice?.paidAmount, "0.00");
			assert.equal(draftRaceInvoice?.status, "draft");

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
			await db.transaction(async (tx) => {
				await tx.execute(
					sql`SET LOCAL session_replication_role = replica`,
				);
				await tx
					.update(receipts)
					.set({ invoiceId: otherInvoiceId })
					.where(eq(receipts.id, receiptId));
			});

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

			await db.insert(receipts).values({
				id: historyReceiptId,
				organizationId,
				bookingId,
				invoiceId,
				receivedAmountId,
				receiptNumber: `RECON-HISTORY-RCPT-${suffix}`,
				amount: "40.00",
				paymentMethod: "cash",
				receiptDate: "2026-01-15",
				deletedAt: new Date(),
			});
			await db.insert(invoices).values({
				id: historyInvoiceId,
				organizationId,
				bookingId,
				paymentScheduleId: scheduleId,
				invoiceNumber: `RECON-HISTORY-INV-${suffix}`,
				issueDate: "2026-01-01",
				totalAmount: "100.00",
				status: "sent",
				deletedAt: new Date(),
			});

			await db.insert(bookings).values({
				id: overBookingId,
				organizationId,
				referenceNumber: `RECON-OVER-${suffix}`,
				name: "Overpayment test booking",
				bookingType: "test",
				packageType: "test",
				packageCost: "50.00",
				totalReceived: "0.00",
			});
			await db.insert(paymentSchedules).values({
				id: overScheduleId,
				organizationId,
				bookingId: overBookingId,
				name: "Overpaid deposit",
				amount: "50.00",
				dueDate: "2026-12-31",
				paidAmount: "0.00",
				status: "pending",
			});
			await db.insert(invoices).values({
				id: overInvoiceId,
				organizationId,
				bookingId: overBookingId,
				paymentScheduleId: overScheduleId,
				invoiceNumber: `RECON-OVER-INV-${suffix}`,
				issueDate: "2026-01-01",
				dueDate: "2026-12-31",
				totalAmount: "50.00",
				paidAmount: "0.00",
				status: "sent",
			});
			for (const [index, paymentId] of overPaymentIds.entries()) {
				await db.insert(receivedAmounts).values({
					id: paymentId,
					organizationId,
					bookingId: overBookingId,
					paymentScheduleId: overScheduleId,
					invoiceId: overInvoiceId,
					amount: "30.00",
					paymentMethod: "cash",
					receivedDate: "2026-02-01",
				});
				await db.insert(receipts).values({
					id: overReceiptIds[index],
					organizationId,
					bookingId: overBookingId,
					invoiceId: overInvoiceId,
					receivedAmountId: paymentId,
					receiptNumber: `RECON-OVER-RCPT-${index}-${suffix}`,
					amount: "30.00",
					paymentMethod: "cash",
					receiptDate: "2026-02-01",
				});
			}

			await db.insert(organizations).values({
				id: otherOrganizationId,
				name: "Unrelated reconciliation tenant",
				slug: `unrelated-financial-reconciliation-${suffix}`,
			});
			await db.insert(bookings).values({
				id: otherBookingId,
				organizationId: otherOrganizationId,
				referenceNumber: `OTHER-${suffix}`,
				name: "Other tenant booking",
				bookingType: "test",
				packageType: "test",
				packageCost: "10.00",
				totalReceived: "9.00",
			});
			await db.transaction(async (tx) => {
				await tx.execute(
					sql`SET LOCAL session_replication_role = replica`,
				);
				await tx.insert(paymentSchedules).values({
					id: crossTenantScheduleId,
					organizationId,
					bookingId: otherBookingId,
					name: "Cross-tenant parent schedule",
					amount: "100.00",
					dueDate: "2026-12-31",
					paidAmount: "10.00",
					status: "pending",
				});
				await tx.insert(invoices).values({
					id: crossTenantInvoiceId,
					organizationId,
					bookingId: otherBookingId,
					paymentScheduleId: crossTenantScheduleId,
					invoiceNumber: `RECON-CROSS-TENANT-${suffix}`,
					issueDate: "2026-01-01",
					dueDate: "2026-12-31",
					totalAmount: "100.00",
					paidAmount: "10.00",
					status: "sent",
				});
				await tx.insert(receipts).values({
					id: crossOrganizationReceiptId,
					organizationId: otherOrganizationId,
					bookingId,
					invoiceId,
					receivedAmountId,
					receiptNumber: `RECON-CROSS-RCPT-${suffix}`,
					amount: "40.00",
					paymentMethod: "cash",
					receiptDate: "2026-01-15",
					deletedAt: new Date(),
				});
				await tx.insert(invoices).values({
					id: crossOrganizationInvoiceId,
					organizationId: otherOrganizationId,
					bookingId,
					paymentScheduleId: scheduleId,
					invoiceNumber: `RECON-CROSS-INV-${suffix}`,
					issueDate: "2026-01-01",
					totalAmount: "100.00",
					status: "sent",
					deletedAt: new Date(),
				});
			});
			await db.insert(paymentSchedules).values({
				id: deletedChainScheduleId,
				organizationId,
				bookingId,
				name: "Deleted payment chain schedule",
				amount: "100.00",
				dueDate: "2026-12-31",
				paidAmount: "0.00",
				status: "pending",
			});
			await db
				.update(paymentSchedules)
				.set({ deletedAt: new Date() })
				.where(eq(paymentSchedules.id, deletedChainScheduleId));
			await db.transaction(async (tx) => {
				await tx.execute(
					sql`SET LOCAL session_replication_role = replica`,
				);
				await tx.insert(receivedAmounts).values([
					{
						id: deletedChainPaymentId,
						organizationId,
						bookingId,
						paymentScheduleId: deletedChainScheduleId,
						amount: "6.00",
						paymentMethod: "cash",
						receivedDate: "2026-02-01",
					},
					{
						id: crossTenantChainPaymentId,
						organizationId,
						bookingId,
						invoiceId: crossOrganizationInvoiceId,
						amount: "7.00",
						paymentMethod: "cash",
						receivedDate: "2026-02-01",
					},
				]);
			});
			await db.insert(bookings).values([
				{
					id: failedRepairBookingId,
					organizationId,
					referenceNumber: `RECON-FAIL-${suffix}`,
					name: "Financial reconciliation forced repair failure",
					bookingType: "test",
					packageType: "test",
					packageCost: "100.00",
					totalReceived: "0.00",
				},
				{
					id: successfulRepairBookingId,
					organizationId,
					referenceNumber: `RECON-SUCCESS-${suffix}`,
					name: "Financial reconciliation independent repair",
					bookingType: "test",
					packageType: "test",
					packageCost: "100.00",
					totalReceived: "0.00",
				},
			]);
			await db.insert(receivedAmounts).values([
				{
					id: failedRepairPaymentId,
					organizationId,
					bookingId: failedRepairBookingId,
					amount: "25.00",
					paymentMethod: "cash",
					receivedDate: "2026-02-01",
				},
				{
					id: successfulRepairPaymentId,
					organizationId,
					bookingId: successfulRepairBookingId,
					amount: "25.00",
					paymentMethod: "cash",
					receivedDate: "2026-02-01",
				},
			]);
			await db.execute(sql`
				CREATE OR REPLACE FUNCTION financial_reconciliation_fail_booking_update()
				RETURNS trigger AS $$
				BEGIN
					IF NEW.name = 'Financial reconciliation forced repair failure' THEN
						RAISE EXCEPTION 'forced reconciliation repair failure';
					END IF;
					RETURN NEW;
				END;
				$$ LANGUAGE plpgsql
			`);
			await db.execute(sql`
				DROP TRIGGER IF EXISTS financial_reconciliation_fail_booking_update ON bookings
			`);
			await db.execute(sql`
				CREATE TRIGGER financial_reconciliation_fail_booking_update
				BEFORE UPDATE OF total_received ON bookings
				FOR EACH ROW EXECUTE FUNCTION financial_reconciliation_fail_booking_update()
			`);

			const repairIsolationReport = await queryFinancialMismatches(
				organizationId,
				"2026-07-10",
			);
			const failedRepairMismatch = repairIsolationReport.mismatches.find(
				(mismatch) => mismatch.entityId === failedRepairBookingId,
			);
			const successfulRepairMismatch =
				repairIsolationReport.mismatches.find(
					(mismatch) =>
						mismatch.entityId === successfulRepairBookingId,
				);
			assert.ok(failedRepairMismatch);
			assert.ok(successfulRepairMismatch);
			assert.equal(failedRepairMismatch.safeFixAvailable, true);
			assert.equal(successfulRepairMismatch.safeFixAvailable, true);
			const repairIsolation = await applySafeFinancialFixes(
				organizationId,
				"2026-07-10",
				[failedRepairMismatch, successfulRepairMismatch],
			);
			assert.deepEqual(repairIsolation.applied, [
				successfulRepairMismatch.id,
			]);
			assert.deepEqual(repairIsolation.failed, [
				{
					mismatchId: failedRepairMismatch.id,
					reason: "repair_transaction_failed",
				},
			]);
			const [failedRepairBooking, successfulRepairBooking] =
				await Promise.all([
					db.query.bookings.findFirst({
						where: eq(bookings.id, failedRepairBookingId),
					}),
					db.query.bookings.findFirst({
						where: eq(bookings.id, successfulRepairBookingId),
					}),
				]);
			assert.equal(failedRepairBooking?.totalReceived, "0.00");
			assert.equal(successfulRepairBooking?.totalReceived, "25.00");
			await db.execute(sql`
				DROP TRIGGER financial_reconciliation_fail_booking_update ON bookings
			`);
			await db.execute(sql`
				DROP FUNCTION financial_reconciliation_fail_booking_update()
			`);

			const guarded = await queryFinancialMismatches(
				organizationId,
				"2026-07-10",
			);
			assert.ok(
				guarded.mismatches.every(
					(mismatch) => mismatch.organizationId === organizationId,
				),
			);
			assert.ok(
				guarded.mismatches.some(
					(mismatch) =>
						mismatch.mismatchType ===
							"multiple_receipts_per_payment" &&
						mismatch.entityId === receivedAmountId,
				),
			);
			assert.ok(
				guarded.mismatches.some(
					(mismatch) =>
						mismatch.mismatchType ===
							"multiple_invoices_per_schedule" &&
						mismatch.entityId === scheduleId,
				),
			);
			for (const entityId of [
				overBookingId,
				overScheduleId,
				overInvoiceId,
			]) {
				const overpayment = guarded.mismatches.find(
					(mismatch) => mismatch.entityId === entityId,
				);
				assert.equal(overpayment?.exceedsUpperBound, true);
				assert.equal(overpayment?.safeFixAvailable, false);
			}
			const receiptHistory = guarded.mismatches.find(
				(mismatch) =>
					mismatch.mismatchType === "multiple_receipts_per_payment" &&
					mismatch.entityId === receivedAmountId,
			);
			const invoiceHistory = guarded.mismatches.find(
				(mismatch) =>
					mismatch.mismatchType ===
						"multiple_invoices_per_schedule" &&
					mismatch.entityId === scheduleId,
			);
			assert.ok(receiptHistory);
			assert.ok(invoiceHistory);
			assert.ok(
				(
					receiptHistory.details as {
						allReceipts: Array<{ organizationId: string }>;
					}
				).allReceipts.some(
					(receipt) => receipt.organizationId === otherOrganizationId,
				),
			);
			assert.ok(
				(
					invoiceHistory.details as {
						allInvoices: Array<{ organizationId: string }>;
					}
				).allInvoices.some(
					(invoice) => invoice.organizationId === otherOrganizationId,
				),
			);

			const crossTenantScheduleMismatch = guarded.mismatches.find(
				(mismatch) =>
					mismatch.mismatchType ===
						"schedule_total_vs_assigned_active_payments" &&
					mismatch.entityId === crossTenantScheduleId,
			);
			const crossTenantInvoiceMismatch = guarded.mismatches.find(
				(mismatch) =>
					mismatch.mismatchType ===
						"invoice_paid_status_vs_valid_applications" &&
					mismatch.entityId === crossTenantInvoiceId,
			);
			assert.ok(crossTenantScheduleMismatch);
			assert.ok(crossTenantInvoiceMismatch);
			assert.equal(crossTenantScheduleMismatch.parentLinksValid, false);
			assert.equal(crossTenantInvoiceMismatch.parentLinksValid, false);
			assert.equal(
				(
					crossTenantScheduleMismatch.details as {
						parentLinks: {
							booking: { valid: boolean; organizationId: string };
						};
					}
				).parentLinks.booking.valid,
				false,
			);
			const crossTenantInvoiceParents = (
				crossTenantInvoiceMismatch.details as {
					parentLinks: {
						booking: { valid: boolean };
						paymentSchedule: { valid: boolean };
					};
				}
			).parentLinks;
			assert.equal(crossTenantInvoiceParents.booking.valid, false);
			assert.equal(
				crossTenantInvoiceParents.paymentSchedule.valid,
				false,
			);
			assert.equal(crossTenantScheduleMismatch.safeFixAvailable, false);
			assert.equal(crossTenantInvoiceMismatch.safeFixAvailable, false);
			const mismatchedScheduleMismatch = guarded.mismatches.find(
				(mismatch) =>
					mismatch.mismatchType ===
						"schedule_total_vs_assigned_active_payments" &&
					mismatch.entityId === scheduleId,
			);
			const mismatchedInvoiceMismatch = guarded.mismatches.find(
				(mismatch) =>
					mismatch.mismatchType ===
						"invoice_paid_status_vs_valid_applications" &&
					mismatch.entityId === mismatchedInvoiceId,
			);
			const cancelledScheduleInvoiceMismatch = guarded.mismatches.find(
				(mismatch) => mismatch.entityId === cancelledScheduleInvoiceId,
			);
			const draftAmountOnlyMismatch = guarded.mismatches.find(
				(mismatch) => mismatch.entityId === draftAmountOnlyInvoiceId,
			);
			const invalidBookingMismatch = guarded.mismatches.find(
				(mismatch) =>
					mismatch.mismatchType ===
						"booking_total_vs_active_payments" &&
					mismatch.entityId === bookingId,
			);
			assert.ok(mismatchedScheduleMismatch);
			assert.ok(mismatchedInvoiceMismatch);
			assert.ok(cancelledScheduleInvoiceMismatch);
			assert.ok(draftAmountOnlyMismatch);
			assert.ok(invalidBookingMismatch);
			assert.equal(mismatchedScheduleMismatch.safeFixAvailable, false);
			assert.equal(mismatchedInvoiceMismatch.safeFixAvailable, false);
			assert.equal(
				cancelledScheduleInvoiceMismatch.safeFixAvailable,
				false,
			);
			assert.equal(draftAmountOnlyMismatch.safeFixAvailable, false);
			assert.equal(draftAmountOnlyMismatch.expectedStatus, "draft");
			assert.equal(draftAmountOnlyMismatch.intendedAction, null);
			assert.equal(invalidBookingMismatch.safeFixAvailable, false);
			assert.equal(invalidBookingMismatch.safeRepairLinksValid, false);

			const forcedParentMutations = await applySafeFinancialFixes(
				organizationId,
				"2026-07-10",
				[
					{
						...crossTenantScheduleMismatch,
						safeFixAvailable: true,
						intendedAction: "recalculate_schedule_paid_amount",
					},
					{
						...crossTenantInvoiceMismatch,
						safeFixAvailable: true,
						intendedAction: "recalculate_invoice_paid_status",
					},
					{
						...mismatchedInvoiceMismatch,
						safeFixAvailable: true,
						intendedAction: "recalculate_invoice_paid_status",
					},
					{
						...cancelledScheduleInvoiceMismatch,
						safeFixAvailable: true,
						intendedAction: "recalculate_invoice_paid_status",
					},
				],
			);
			assert.deepEqual(forcedParentMutations.applied, []);
			assert.deepEqual(forcedParentMutations.failed, [
				{
					mismatchId: crossTenantScheduleMismatch.id,
					reason: "repair_guard_prevented_update",
				},
				{
					mismatchId: crossTenantInvoiceMismatch.id,
					reason: "repair_guard_prevented_update",
				},
				{
					mismatchId: mismatchedInvoiceMismatch.id,
					reason: "repair_guard_prevented_update",
				},
				{
					mismatchId: cancelledScheduleInvoiceMismatch.id,
					reason: "repair_guard_prevented_update",
				},
			]);
			const [
				unchangedCrossTenantSchedule,
				unchangedCrossTenantInvoice,
				unchangedMismatchedInvoice,
				unchangedCancelledScheduleInvoice,
			] = await Promise.all([
				db.query.paymentSchedules.findFirst({
					where: eq(paymentSchedules.id, crossTenantScheduleId),
				}),
				db.query.invoices.findFirst({
					where: eq(invoices.id, crossTenantInvoiceId),
				}),
				db.query.invoices.findFirst({
					where: eq(invoices.id, mismatchedInvoiceId),
				}),
				db.query.invoices.findFirst({
					where: eq(invoices.id, cancelledScheduleInvoiceId),
				}),
			]);
			assert.equal(unchangedCrossTenantSchedule?.paidAmount, "10.00");
			assert.equal(unchangedCrossTenantInvoice?.paidAmount, "10.00");
			assert.equal(unchangedMismatchedInvoice?.paidAmount, "15.00");
			assert.equal(
				unchangedCancelledScheduleInvoice?.paidAmount,
				"10.00",
			);

			const deterministicReport = await queryFinancialMismatches(
				organizationId,
				"2026-07-10",
			);
			const deterministicReportAgain = await queryFinancialMismatches(
				organizationId,
				"2026-07-10",
			);
			assert.deepEqual(deterministicReportAgain, deterministicReport);
			const reportOnlyBefore = await Promise.all([
				db.query.bookings.findFirst({
					where: eq(bookings.id, bookingId),
				}),
				db.query.invoices.findFirst({
					where: eq(invoices.id, draftAmountOnlyInvoiceId),
				}),
			]);
			const reportOnlyCode = await main([
				"--organization-id",
				organizationId,
				"--report",
				"--as-of",
				"2026-07-10",
			]);
			assert.equal(reportOnlyCode, 1);
			const reportOnlyAfter = await Promise.all([
				db.query.bookings.findFirst({
					where: eq(bookings.id, bookingId),
				}),
				db.query.invoices.findFirst({
					where: eq(invoices.id, draftAmountOnlyInvoiceId),
				}),
			]);
			assert.deepEqual(reportOnlyAfter, reportOnlyBefore);

			const overBookingMismatch = guarded.mismatches.find(
				(mismatch) => mismatch.entityId === overBookingId,
			);
			assert.ok(overBookingMismatch);
			const forcedMutation = await applySafeFinancialFixes(
				organizationId,
				"2026-07-10",
				[
					{
						...overBookingMismatch,
						safeFixAvailable: true,
						intendedAction: "recalculate_booking_total",
					},
				],
			);
			assert.deepEqual(forcedMutation.applied, []);
			assert.deepEqual(forcedMutation.failed, [
				{
					mismatchId: overBookingMismatch.id,
					reason: "repair_guard_prevented_update",
				},
			]);

			const guardedFixCode = await main([
				"--organization-id",
				organizationId,
				"--fix-safe",
				"--as-of",
				"2026-07-10",
			]);
			assert.equal(guardedFixCode, 1);
			const [
				unchangedOverBooking,
				unchangedOverSchedule,
				unchangedOverInvoice,
			] = await Promise.all([
				db.query.bookings.findFirst({
					where: eq(bookings.id, overBookingId),
				}),
				db.query.paymentSchedules.findFirst({
					where: eq(paymentSchedules.id, overScheduleId),
				}),
				db.query.invoices.findFirst({
					where: eq(invoices.id, overInvoiceId),
				}),
			]);
			assert.equal(unchangedOverBooking?.totalReceived, "0.00");
			assert.equal(unchangedOverSchedule?.paidAmount, "0.00");
			assert.equal(unchangedOverInvoice?.paidAmount, "0.00");
		} finally {
			console.log = originalLog;
			await db.execute(sql`
				DROP TRIGGER IF EXISTS financial_reconciliation_fail_booking_update ON bookings
			`);
			await db.execute(sql`
				DROP FUNCTION IF EXISTS financial_reconciliation_fail_booking_update()
			`);
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			await db
				.delete(organizations)
				.where(eq(organizations.id, otherOrganizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
			await (
				db as unknown as { $client: { end(): Promise<void> } }
			).$client.end();
		}
	});
});
