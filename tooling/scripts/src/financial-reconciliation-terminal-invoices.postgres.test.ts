import assert from "node:assert/strict";
import { describe, it } from "node:test";

const databaseUrl = process.env.POSTGRES_RECONCILIATION_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres(
	"terminal invoice reconciliation on migrated PostgreSQL",
	() => {
		it("reports terminal history without changing it and makes the second safe fix a no-op", async () => {
			const originalDatabaseUrl = process.env.DATABASE_URL;
			process.env.DATABASE_URL = databaseUrl;
			const { bookings, db, eq, inArray, invoices, organizations } =
				await import("@repo/database");
			const { applySafeFinancialFixes, queryFinancialMismatches } =
				await import("./reconcile-financials");
			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `terminal_invoice_org_${suffix}`;
			const bookingId = `terminal_invoice_booking_${suffix}`;
			const invoiceIds = {
				draft: `terminal_invoice_draft_${suffix}`,
				cancelled: `terminal_invoice_cancelled_${suffix}`,
				finalizedPaid: `terminal_invoice_paid_${suffix}`,
				finalizedUnpaid: `terminal_invoice_unpaid_${suffix}`,
				collectible: `terminal_invoice_collectible_${suffix}`,
			};

			try {
				await db.insert(organizations).values({
					id: organizationId,
					name: "Terminal invoice reconciliation",
					slug: `terminal-invoice-${suffix}`,
				});
				await db.insert(bookings).values({
					id: bookingId,
					organizationId,
					referenceNumber: `TERMINAL-${suffix}`,
					name: "Terminal invoice booking",
					bookingType: "test",
					packageType: "test",
					packageCost: "500.00",
				});
				await db.insert(invoices).values([
					{
						id: invoiceIds.draft,
						organizationId,
						bookingId,
						invoiceNumber: `TERMINAL-DRAFT-${suffix}`,
						issueDate: "2026-01-01",
						dueDate: "2026-01-10",
						totalAmount: "100.00",
						paidAmount: "10.00",
						status: "draft",
					},
					{
						id: invoiceIds.cancelled,
						organizationId,
						bookingId,
						invoiceNumber: `TERMINAL-CANCELLED-${suffix}`,
						issueDate: "2026-01-01",
						dueDate: "2026-01-10",
						totalAmount: "100.00",
						paidAmount: "10.00",
						status: "cancelled",
					},
					{
						id: invoiceIds.finalizedPaid,
						organizationId,
						bookingId,
						invoiceNumber: `TERMINAL-PAID-${suffix}`,
						issueDate: "2026-01-01",
						dueDate: "2026-01-10",
						totalAmount: "100.00",
						paidAmount: "100.00",
						status: "paid",
					},
					{
						id: invoiceIds.finalizedUnpaid,
						organizationId,
						bookingId,
						invoiceNumber: `TERMINAL-UNPAID-${suffix}`,
						issueDate: "2026-01-01",
						dueDate: "2026-01-10",
						totalAmount: "100.00",
						paidAmount: "0.00",
						status: "paid",
					},
					{
						id: invoiceIds.collectible,
						organizationId,
						bookingId,
						invoiceNumber: `TERMINAL-COLLECTIBLE-${suffix}`,
						issueDate: "2026-01-01",
						dueDate: "2026-01-10",
						totalAmount: "100.00",
						paidAmount: "0.00",
						status: "sent",
					},
				]);

				const before = await queryFinancialMismatches(
					organizationId,
					"2026-07-15",
				);
				const invoiceMismatches = new Map(
					before.mismatches
						.filter(
							(mismatch) =>
								mismatch.mismatchType ===
								"invoice_paid_status_vs_valid_applications",
						)
						.map((mismatch) => [mismatch.entityId, mismatch]),
				);
				for (const [invoiceId, expectedStatus] of [
					[invoiceIds.draft, "draft"],
					[invoiceIds.cancelled, "cancelled"],
					[invoiceIds.finalizedPaid, "paid"],
					[invoiceIds.finalizedUnpaid, "paid"],
				] as const) {
					const mismatch = invoiceMismatches.get(invoiceId);
					assert.ok(mismatch);
					assert.equal(mismatch.expectedStatus, expectedStatus);
					assert.equal(mismatch.safeFixAvailable, false);
				}
				const collectibleMismatch = invoiceMismatches.get(
					invoiceIds.collectible,
				);
				assert.ok(collectibleMismatch);
				assert.equal(collectibleMismatch.expectedStatus, "overdue");
				assert.equal(collectibleMismatch.safeFixAvailable, true);

				const forcedTerminalFix = await applySafeFinancialFixes(
					organizationId,
					"2026-07-15",
					[
						invoiceMismatches.get(invoiceIds.draft),
						invoiceMismatches.get(invoiceIds.cancelled),
						invoiceMismatches.get(invoiceIds.finalizedPaid),
						invoiceMismatches.get(invoiceIds.finalizedUnpaid),
					]
						.filter((mismatch) => mismatch !== undefined)
						.map((mismatch) => ({
							...mismatch,
							safeFixAvailable: true,
							intendedAction:
								"recalculate_invoice_paid_status" as const,
						})),
				);
				assert.deepEqual(forcedTerminalFix.applied, []);
				assert.equal(forcedTerminalFix.failed.length, 4);

				const firstSafeFix = await applySafeFinancialFixes(
					organizationId,
					"2026-07-15",
					before.mismatches,
				);
				assert.deepEqual(firstSafeFix.applied, [
					collectibleMismatch.id,
				]);

				const after = await queryFinancialMismatches(
					organizationId,
					"2026-07-15",
				);
				assert.equal(
					after.mismatches.some(
						(mismatch) =>
							mismatch.entityId === invoiceIds.collectible,
					),
					false,
				);
				const secondSafeFix = await applySafeFinancialFixes(
					organizationId,
					"2026-07-15",
					after.mismatches,
				);
				assert.deepEqual(secondSafeFix, { applied: [], failed: [] });

				const invoicesAfter = await db.query.invoices.findMany({
					where: inArray(invoices.id, Object.values(invoiceIds)),
					columns: { id: true, paidAmount: true, status: true },
				});
				const byId = new Map(
					invoicesAfter.map((invoice) => [invoice.id, invoice]),
				);
				assert.deepEqual(byId.get(invoiceIds.draft), {
					id: invoiceIds.draft,
					paidAmount: "10.00",
					status: "draft",
				});
				assert.deepEqual(byId.get(invoiceIds.cancelled), {
					id: invoiceIds.cancelled,
					paidAmount: "10.00",
					status: "cancelled",
				});
				assert.equal(
					byId.get(invoiceIds.finalizedPaid)?.status,
					"paid",
				);
				assert.equal(
					byId.get(invoiceIds.finalizedUnpaid)?.status,
					"paid",
				);
				assert.equal(
					byId.get(invoiceIds.collectible)?.status,
					"overdue",
				);
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
