import assert from "node:assert/strict";
import { describe, it } from "node:test";

const databaseUrl = process.env.POSTGRES_RECONCILIATION_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres(
	"financial reconciliation relationship validity on migrated PostgreSQL",
	() => {
		it("reports independent schedule defects and blocks forged repairs", async () => {
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
			const { applySafeFinancialFixes, queryFinancialMismatches } =
				await import("./reconcile-financials");

			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `relationship_org_${suffix}`;
			const matchingBookingId = `relationship_matching_booking_${suffix}`;
			const matchingScheduleId = `relationship_matching_schedule_${suffix}`;
			const matchingInvoiceScheduleId = `relationship_matching_invoice_schedule_${suffix}`;
			const matchingInvoiceId = `relationship_matching_invoice_${suffix}`;
			const matchingPaymentId = `relationship_matching_payment_${suffix}`;
			const matchingReceiptId = `relationship_matching_receipt_${suffix}`;
			const scheduledNullBookingId = `relationship_scheduled_null_booking_${suffix}`;
			const scheduledNullScheduleId = `relationship_scheduled_null_schedule_${suffix}`;
			const scheduledNullInvoiceId = `relationship_scheduled_null_invoice_${suffix}`;
			const scheduledNullPaymentId = `relationship_scheduled_null_payment_${suffix}`;
			const scheduledNullReceiptId = `relationship_scheduled_null_receipt_${suffix}`;
			const nullScheduledBookingId = `relationship_null_scheduled_booking_${suffix}`;
			const nullScheduledScheduleId = `relationship_null_scheduled_schedule_${suffix}`;
			const nullScheduledInvoiceId = `relationship_null_scheduled_invoice_${suffix}`;
			const nullScheduledPaymentId = `relationship_null_scheduled_payment_${suffix}`;
			const nullScheduledReceiptId = `relationship_null_scheduled_receipt_${suffix}`;
			const genericBookingId = `relationship_generic_booking_${suffix}`;
			const genericInvoiceId = `relationship_generic_invoice_${suffix}`;
			const genericPaymentId = `relationship_generic_payment_${suffix}`;
			const genericReceiptId = `relationship_generic_receipt_${suffix}`;
			const cancelledScheduleBookingId = `relationship_cancelled_schedule_booking_${suffix}`;
			const cancelledScheduleId = `relationship_cancelled_schedule_${suffix}`;
			const cancelledScheduleInvoiceId = `relationship_cancelled_schedule_invoice_${suffix}`;
			const cancelledSchedulePaymentId = `relationship_cancelled_schedule_payment_${suffix}`;
			const cancelledScheduleReceiptId = `relationship_cancelled_schedule_receipt_${suffix}`;
			const cancelledInvoiceBookingId = `relationship_cancelled_invoice_booking_${suffix}`;
			const cancelledInvoiceId = `relationship_cancelled_invoice_${suffix}`;
			const cancelledInvoicePaymentId = `relationship_cancelled_invoice_payment_${suffix}`;
			const cancelledInvoiceReceiptId = `relationship_cancelled_invoice_receipt_${suffix}`;

			try {
				await db.insert(organizations).values({
					id: organizationId,
					name: "Relationship validity test",
					slug: `relationship-validity-${suffix}`,
				});
				const bookingFixtures = [
					[
						matchingBookingId,
						"MATCHING",
						"Matching aggregate caches",
						"20.00",
					],
					[
						scheduledNullBookingId,
						"SCHEDULED-NULL",
						"Scheduled payment with unscheduled invoice",
						"11.00",
					],
					[
						nullScheduledBookingId,
						"NULL-SCHEDULED",
						"Unscheduled payment with scheduled invoice",
						"12.00",
					],
					[
						genericBookingId,
						"GENERIC",
						"Valid null schedule chain",
						"13.00",
					],
					[
						cancelledScheduleBookingId,
						"CANCELLED-SCHEDULE",
						"Cancelled schedule cache",
						"10.00",
					],
					[
						cancelledInvoiceBookingId,
						"CANCELLED-INVOICE",
						"Cancelled invoice cache",
						"10.00",
					],
				] as const;
				await db.insert(bookings).values(
					bookingFixtures.map(
						([id, reference, name, totalReceived]) => ({
							id,
							organizationId,
							referenceNumber: `REL-${reference}-${suffix}`,
							name,
							bookingType: "test",
							packageType: "test",
							packageCost: "100.00",
							totalReceived,
						}),
					),
				);
				await db.insert(paymentSchedules).values([
					{
						id: matchingScheduleId,
						organizationId,
						bookingId: matchingBookingId,
						name: "Payment schedule one",
						amount: "100.00",
						dueDate: "2026-12-31",
						paidAmount: "20.00",
						status: "pending",
					},
					{
						id: matchingInvoiceScheduleId,
						organizationId,
						bookingId: matchingBookingId,
						name: "Invoice schedule two",
						amount: "100.00",
						dueDate: "2026-12-31",
						paidAmount: "0.00",
						status: "pending",
					},
					{
						id: scheduledNullScheduleId,
						organizationId,
						bookingId: scheduledNullBookingId,
						name: "Scheduled side of null asymmetry",
						amount: "100.00",
						dueDate: "2026-12-31",
						paidAmount: "11.00",
						status: "pending",
					},
					{
						id: nullScheduledScheduleId,
						organizationId,
						bookingId: nullScheduledBookingId,
						name: "Invoice side of null asymmetry",
						amount: "100.00",
						dueDate: "2026-12-31",
						paidAmount: "0.00",
						status: "pending",
					},
					{
						id: cancelledScheduleId,
						organizationId,
						bookingId: cancelledScheduleBookingId,
						name: "Cancelled schedule",
						amount: "100.00",
						dueDate: "2026-12-31",
						paidAmount: "10.00",
						status: "cancelled",
					},
				]);
				await db.insert(invoices).values([
					{
						id: matchingInvoiceId,
						organizationId,
						bookingId: matchingBookingId,
						paymentScheduleId: matchingInvoiceScheduleId,
						invoiceNumber: `REL-MATCHING-INV-${suffix}`,
						issueDate: "2026-01-01",
						dueDate: "2026-12-31",
						totalAmount: "100.00",
						paidAmount: "0.00",
						status: "sent",
					},
					{
						id: scheduledNullInvoiceId,
						organizationId,
						bookingId: scheduledNullBookingId,
						invoiceNumber: `REL-SCHEDULED-NULL-INV-${suffix}`,
						issueDate: "2026-01-01",
						dueDate: "2026-12-31",
						totalAmount: "100.00",
						paidAmount: "11.00",
						status: "partial",
					},
					{
						id: nullScheduledInvoiceId,
						organizationId,
						bookingId: nullScheduledBookingId,
						paymentScheduleId: nullScheduledScheduleId,
						invoiceNumber: `REL-NULL-SCHEDULED-INV-${suffix}`,
						issueDate: "2026-01-01",
						dueDate: "2026-12-31",
						totalAmount: "100.00",
						paidAmount: "12.00",
						status: "partial",
					},
					{
						id: genericInvoiceId,
						organizationId,
						bookingId: genericBookingId,
						invoiceNumber: `REL-GENERIC-INV-${suffix}`,
						issueDate: "2026-01-01",
						dueDate: "2026-12-31",
						totalAmount: "100.00",
						paidAmount: "13.00",
						status: "partial",
					},
					{
						id: cancelledScheduleInvoiceId,
						organizationId,
						bookingId: cancelledScheduleBookingId,
						paymentScheduleId: cancelledScheduleId,
						invoiceNumber: `REL-CANCELLED-SCHEDULE-INV-${suffix}`,
						issueDate: "2026-01-01",
						dueDate: "2026-12-31",
						totalAmount: "100.00",
						paidAmount: "0.00",
						status: "sent",
					},
					{
						id: cancelledInvoiceId,
						organizationId,
						bookingId: cancelledInvoiceBookingId,
						invoiceNumber: `REL-CANCELLED-INV-${suffix}`,
						issueDate: "2026-01-01",
						dueDate: "2026-12-31",
						totalAmount: "100.00",
						paidAmount: "0.00",
						status: "cancelled",
					},
				]);
				await db.transaction(async (tx) => {
					// These rows represent corruption that existed before migration 0043.
					// The bypass is transaction-local; production writes remain guarded.
					await tx.execute(
						sql`SET LOCAL session_replication_role = replica`,
					);
					await tx.insert(receivedAmounts).values([
						{
							id: matchingPaymentId,
							organizationId,
							bookingId: matchingBookingId,
							paymentScheduleId: matchingScheduleId,
							invoiceId: matchingInvoiceId,
							amount: "20.00",
							paymentMethod: "cash",
							receivedDate: "2026-02-01",
						},
						{
							id: scheduledNullPaymentId,
							organizationId,
							bookingId: scheduledNullBookingId,
							paymentScheduleId: scheduledNullScheduleId,
							invoiceId: scheduledNullInvoiceId,
							amount: "11.00",
							paymentMethod: "cash",
							receivedDate: "2026-02-01",
						},
						{
							id: nullScheduledPaymentId,
							organizationId,
							bookingId: nullScheduledBookingId,
							invoiceId: nullScheduledInvoiceId,
							amount: "12.00",
							paymentMethod: "cash",
							receivedDate: "2026-02-01",
						},
						{
							id: genericPaymentId,
							organizationId,
							bookingId: genericBookingId,
							invoiceId: genericInvoiceId,
							amount: "13.00",
							paymentMethod: "cash",
							receivedDate: "2026-02-01",
						},
						{
							id: cancelledSchedulePaymentId,
							organizationId,
							bookingId: cancelledScheduleBookingId,
							paymentScheduleId: cancelledScheduleId,
							amount: "10.00",
							paymentMethod: "cash",
							receivedDate: "2026-02-01",
						},
						{
							id: cancelledInvoicePaymentId,
							organizationId,
							bookingId: cancelledInvoiceBookingId,
							invoiceId: cancelledInvoiceId,
							amount: "10.00",
							paymentMethod: "cash",
							receivedDate: "2026-02-01",
						},
					]);
					await tx.insert(receipts).values([
						{
							id: matchingReceiptId,
							organizationId,
							bookingId: matchingBookingId,
							invoiceId: matchingInvoiceId,
							receivedAmountId: matchingPaymentId,
							receiptNumber: `REL-MATCHING-RCPT-${suffix}`,
							amount: "20.00",
							paymentMethod: "cash",
							receiptDate: "2026-02-01",
						},
						{
							id: scheduledNullReceiptId,
							organizationId,
							bookingId: scheduledNullBookingId,
							invoiceId: scheduledNullInvoiceId,
							receivedAmountId: scheduledNullPaymentId,
							receiptNumber: `REL-SCHEDULED-NULL-RCPT-${suffix}`,
							amount: "11.00",
							paymentMethod: "cash",
							receiptDate: "2026-02-01",
						},
						{
							id: nullScheduledReceiptId,
							organizationId,
							bookingId: nullScheduledBookingId,
							invoiceId: nullScheduledInvoiceId,
							receivedAmountId: nullScheduledPaymentId,
							receiptNumber: `REL-NULL-SCHEDULED-RCPT-${suffix}`,
							amount: "12.00",
							paymentMethod: "cash",
							receiptDate: "2026-02-01",
						},
						{
							id: genericReceiptId,
							organizationId,
							bookingId: genericBookingId,
							invoiceId: genericInvoiceId,
							receivedAmountId: genericPaymentId,
							receiptNumber: `REL-GENERIC-RCPT-${suffix}`,
							amount: "13.00",
							paymentMethod: "cash",
							receiptDate: "2026-02-01",
						},
						{
							id: cancelledScheduleReceiptId,
							organizationId,
							bookingId: cancelledScheduleBookingId,
							receivedAmountId: cancelledSchedulePaymentId,
							receiptNumber: `REL-CANCELLED-SCHEDULE-RCPT-${suffix}`,
							amount: "10.00",
							paymentMethod: "cash",
							receiptDate: "2026-02-01",
						},
						{
							id: cancelledInvoiceReceiptId,
							organizationId,
							bookingId: cancelledInvoiceBookingId,
							invoiceId: cancelledInvoiceId,
							receivedAmountId: cancelledInvoicePaymentId,
							receiptNumber: `REL-CANCELLED-INV-RCPT-${suffix}`,
							amount: "10.00",
							paymentMethod: "cash",
							receiptDate: "2026-02-01",
						},
					]);
				});

				const report = await queryFinancialMismatches(
					organizationId,
					"2026-07-10",
				);
				const findMismatch = (
					predicate: (
						mismatch: (typeof report.mismatches)[number],
					) => boolean,
				) => {
					const mismatch = report.mismatches.find(predicate);
					assert.ok(mismatch);
					return mismatch;
				};
				const matchingRelationship = findMismatch(
					(mismatch) =>
						mismatch.entityId === matchingPaymentId &&
						mismatch.relationKey ===
							"received_amount.invoice_payment_schedule",
				);
				assert.deepEqual(matchingRelationship.details, {
					relation: "invoice_payment_schedule",
					defect: "schedule_identity_disagreement",
					paymentScheduleId: matchingScheduleId,
					invoiceScheduleId: matchingInvoiceScheduleId,
				});
				assert.equal(
					report.mismatches.some(
						(mismatch) =>
							[
								matchingBookingId,
								matchingScheduleId,
								matchingInvoiceId,
							].includes(mismatch.entityId) &&
							mismatch.mismatchType !==
								"cross_entity_booking_org_disagreement",
					),
					false,
				);
				for (const [invoiceId, paymentId] of [
					[scheduledNullInvoiceId, scheduledNullPaymentId],
					[nullScheduledInvoiceId, nullScheduledPaymentId],
				] as const) {
					const invoiceMismatch = findMismatch(
						(mismatch) =>
							mismatch.mismatchType ===
								"invoice_paid_status_vs_valid_applications" &&
							mismatch.entityId === invoiceId,
					);
					assert.equal(invoiceMismatch.safeFixAvailable, false);
					assert.equal(invoiceMismatch.expectedValue, "0");
					findMismatch(
						(mismatch) =>
							mismatch.entityId === paymentId &&
							mismatch.relationKey ===
								"received_amount.invoice_payment_schedule",
					);
				}
				assert.equal(
					report.mismatches.some((mismatch) =>
						[
							genericBookingId,
							genericInvoiceId,
							genericPaymentId,
						].includes(mismatch.entityId),
					),
					false,
				);
				for (const [entityId, relationKey] of [
					[
						cancelledSchedulePaymentId,
						"received_amount.payment_schedule.cancelled",
					],
					[
						cancelledScheduleInvoiceId,
						"invoice.payment_schedule.cancelled",
					],
					[
						cancelledInvoicePaymentId,
						"received_amount.invoice.cancelled",
					],
				] as const) {
					const cancelledRelationship = findMismatch(
						(mismatch) =>
							mismatch.entityId === entityId &&
							mismatch.relationKey === relationKey,
					);
					assert.equal(cancelledRelationship.safeFixAvailable, false);
				}

				const forgedRelationshipMutation =
					await applySafeFinancialFixes(
						organizationId,
						"2026-07-10",
						[
							{
								...matchingRelationship,
								safeFixAvailable: true,
								intendedAction: "recalculate_booking_total",
							},
						],
					);
				assert.deepEqual(forgedRelationshipMutation.applied, []);
				assert.deepEqual(forgedRelationshipMutation.failed, [
					{
						mismatchId: matchingRelationship.id,
						reason: "repair_guard_prevented_update",
					},
				]);
				const scheduledNullMismatch = findMismatch(
					(mismatch) =>
						mismatch.entityId === scheduledNullInvoiceId &&
						mismatch.mismatchType ===
							"invoice_paid_status_vs_valid_applications",
				);
				const nullScheduledMismatch = findMismatch(
					(mismatch) =>
						mismatch.entityId === nullScheduledInvoiceId &&
						mismatch.mismatchType ===
							"invoice_paid_status_vs_valid_applications",
				);
				const forgedNullMutations = await applySafeFinancialFixes(
					organizationId,
					"2026-07-10",
					[
						{
							...scheduledNullMismatch,
							safeFixAvailable: true,
							intendedAction: "recalculate_invoice_paid_status",
						},
						{
							...nullScheduledMismatch,
							safeFixAvailable: true,
							intendedAction: "recalculate_invoice_paid_status",
						},
					],
				);
				assert.deepEqual(forgedNullMutations.applied, []);
				assert.equal(forgedNullMutations.failed.length, 2);
				const [unchangedScheduledNull, unchangedNullScheduled] =
					await Promise.all([
						db.query.invoices.findFirst({
							where: eq(invoices.id, scheduledNullInvoiceId),
						}),
						db.query.invoices.findFirst({
							where: eq(invoices.id, nullScheduledInvoiceId),
						}),
					]);
				assert.equal(unchangedScheduledNull?.paidAmount, "11.00");
				assert.equal(unchangedNullScheduled?.paidAmount, "12.00");
			} finally {
				await db
					.delete(organizations)
					.where(eq(organizations.id, organizationId));
				process.env.DATABASE_URL = originalDatabaseUrl;
				await (
					db as unknown as { $client: { end(): Promise<void> } }
				).$client.end();
			}
		});
	},
);
