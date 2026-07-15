import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
const postgresTestTimeout = 15_000;

function postgresErrorCode(error: unknown): string | undefined {
	return (
		(error as { code?: string })?.code ??
		(error as { cause?: { code?: string } })?.cause?.code
	);
}

describePostgres("payment relationship closure on PostgreSQL", () => {
	it(
		"derives linked sides and rejects mismatches without effects",
		async () => {
			const originalDatabaseUrl = process.env.DATABASE_URL;
			process.env.DATABASE_URL = databaseUrl;
			const {
				and,
				bookings,
				count,
				db,
				eq,
				inArray,
				invoices,
				organizations,
				paymentSchedules,
				receipts,
				receivedAmounts,
				sql,
				users,
			} = await import("@repo/database");
			const { resolveLockedPaymentRelationships } = await import(
				"./payment-relationship-closure"
			);
			const { createReceivedPaymentTransition } = await import(
				"./schedule-payment-service"
			);
			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `closure_org_${suffix}`;
			const actorId = `closure_actor_${suffix}`;
			const bookingId = `closure_booking_${suffix}`;
			const otherBookingId = `closure_other_booking_${suffix}`;
			const scheduleIds = {
				invoiceOnly: `closure_schedule_invoice_${suffix}`,
				scheduleOnly: `closure_schedule_schedule_${suffix}`,
			};
			const invoiceIds = {
				invoiceOnly: `closure_invoice_invoice_${suffix}`,
				scheduleOnly: `closure_invoice_schedule_${suffix}`,
				unlinked: `closure_invoice_unlinked_${suffix}`,
				foreign: `closure_invoice_foreign_${suffix}`,
			};

			try {
				await db.insert(users).values({
					id: actorId,
					name: "Payment closure actor",
					email: `payment-closure-${suffix}@example.com`,
				});
				await db.insert(organizations).values({
					id: organizationId,
					name: "Payment closure test",
					slug: `payment-closure-${suffix}`,
				});
				await db.insert(bookings).values([
					{
						id: bookingId,
						organizationId,
						referenceNumber: `CLOSURE-${suffix}`,
						name: "Payment closure booking",
						bookingType: "test",
						packageType: "test",
						packageCost: "300.00",
					},
					{
						id: otherBookingId,
						organizationId,
						referenceNumber: `CLOSURE-OTHER-${suffix}`,
						name: "Payment closure other booking",
						bookingType: "test",
						packageType: "test",
						packageCost: "100.00",
					},
				]);
				await db.insert(paymentSchedules).values([
					{
						id: scheduleIds.invoiceOnly,
						organizationId,
						bookingId,
						name: "Invoice-only request schedule",
						amount: "100.00",
						dueDate: "2026-07-15",
					},
					{
						id: scheduleIds.scheduleOnly,
						organizationId,
						bookingId,
						name: "Schedule-only request schedule",
						amount: "100.00",
						dueDate: "2026-07-15",
					},
				]);
				await db.insert(invoices).values([
					{
						id: invoiceIds.invoiceOnly,
						organizationId,
						bookingId,
						paymentScheduleId: scheduleIds.invoiceOnly,
						invoiceNumber: `CLOSURE-INV-1-${suffix}`,
						issueDate: "2026-07-15",
						totalAmount: "100.00",
						status: "sent",
					},
					{
						id: invoiceIds.scheduleOnly,
						organizationId,
						bookingId,
						paymentScheduleId: scheduleIds.scheduleOnly,
						invoiceNumber: `CLOSURE-INV-2-${suffix}`,
						issueDate: "2026-07-15",
						totalAmount: "100.00",
						status: "sent",
					},
					{
						id: invoiceIds.unlinked,
						organizationId,
						bookingId,
						invoiceNumber: `CLOSURE-INV-3-${suffix}`,
						issueDate: "2026-07-15",
						totalAmount: "100.00",
						status: "sent",
					},
					{
						id: invoiceIds.foreign,
						organizationId,
						bookingId: otherBookingId,
						invoiceNumber: `CLOSURE-INV-4-${suffix}`,
						issueDate: "2026-07-15",
						totalAmount: "100.00",
						status: "sent",
					},
				]);

				const basePayment = {
					organizationId,
					userId: actorId,
					bookingId,
					paymentMethod: "cash" as const,
					receivedDate: "2026-07-15",
				};
				const invoiceOnly = await db.transaction((tx) =>
					createReceivedPaymentTransition(tx, {
						...basePayment,
						invoiceId: invoiceIds.invoiceOnly,
						amount: "25.00",
					}),
				);
				const scheduleOnly = await db.transaction((tx) =>
					createReceivedPaymentTransition(tx, {
						...basePayment,
						paymentScheduleId: scheduleIds.scheduleOnly,
						amount: "30.00",
					}),
				);
				const unlinked = await db.transaction((tx) =>
					createReceivedPaymentTransition(tx, {
						...basePayment,
						invoiceId: invoiceIds.unlinked,
						amount: "10.00",
					}),
				);

				await expect(
					db.transaction((tx) =>
						createReceivedPaymentTransition(tx, {
							...basePayment,
							invoiceId: invoiceIds.invoiceOnly,
							paymentScheduleId: scheduleIds.scheduleOnly,
							amount: "5.00",
						}),
					),
				).rejects.toThrow(
					"Invoice does not belong to the selected payment schedule",
				);
				await expect(
					db.transaction((tx) =>
						createReceivedPaymentTransition(tx, {
							...basePayment,
							invoiceId: invoiceIds.foreign,
							amount: "5.00",
						}),
					),
				).rejects.toThrow(
					"Invoice not found or does not belong to this booking",
				);

				const paymentRows = await db.query.receivedAmounts.findMany({
					where: inArray(receivedAmounts.id, [
						invoiceOnly.id,
						scheduleOnly.id,
						unlinked.id,
					]),
					columns: {
						id: true,
						invoiceId: true,
						paymentScheduleId: true,
					},
				});
				expect(paymentRows).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							id: invoiceOnly.id,
							invoiceId: invoiceIds.invoiceOnly,
							paymentScheduleId: scheduleIds.invoiceOnly,
						}),
						expect.objectContaining({
							id: scheduleOnly.id,
							invoiceId: invoiceIds.scheduleOnly,
							paymentScheduleId: scheduleIds.scheduleOnly,
						}),
						expect.objectContaining({
							id: unlinked.id,
							invoiceId: invoiceIds.unlinked,
							paymentScheduleId: null,
						}),
					]),
				);

				const schedules = await db.query.paymentSchedules.findMany({
					where: inArray(
						paymentSchedules.id,
						Object.values(scheduleIds),
					),
					columns: { id: true, paidAmount: true, status: true },
				});
				expect(schedules).toEqual(
					expect.arrayContaining([
						{
							id: scheduleIds.invoiceOnly,
							paidAmount: "25.00",
							status: "partial",
						},
						{
							id: scheduleIds.scheduleOnly,
							paidAmount: "30.00",
							status: "partial",
						},
					]),
				);
				const [receiptCount] = await db
					.select({ count: count() })
					.from(receipts)
					.where(
						and(
							eq(receipts.organizationId, organizationId),
							eq(receipts.bookingId, bookingId),
						),
					);
				expect(Number(receiptCount?.count)).toBe(3);
				const booking = await db.query.bookings.findFirst({
					where: eq(bookings.id, bookingId),
					columns: { totalReceived: true },
				});
				expect(booking?.totalReceived).toBe("65.00");

				let releaseRelationshipLocks = () => {};
				const releaseGate = new Promise<void>((resolve) => {
					releaseRelationshipLocks = resolve;
				});
				let reportRelationshipLocks = () => {};
				const relationshipLocksAcquired = new Promise<void>(
					(resolve) => {
						reportRelationshipLocks = resolve;
					},
				);
				const lockingTransaction = db.transaction(async (tx) => {
					await resolveLockedPaymentRelationships(tx, {
						organizationId,
						bookingId,
						invoiceId: invoiceIds.invoiceOnly,
					});
					reportRelationshipLocks();
					await releaseGate;
				});

				try {
					await relationshipLocksAcquired;
					let competingError: unknown;
					try {
						await db.transaction(async (tx) => {
							await tx.execute(
								sql`SET LOCAL lock_timeout = '100ms'`,
							);
							await tx
								.update(invoices)
								.set({ paymentScheduleId: null })
								.where(eq(invoices.id, invoiceIds.invoiceOnly));
						});
					} catch (error) {
						competingError = error;
					}
					expect(postgresErrorCode(competingError)).toBe("55P03");
				} finally {
					releaseRelationshipLocks();
					await lockingTransaction;
				}
			} finally {
				await db
					.delete(organizations)
					.where(eq(organizations.id, organizationId));
				await db.delete(users).where(eq(users.id, actorId));
				process.env.DATABASE_URL = originalDatabaseUrl;
			}
		},
		postgresTestTimeout,
	);
});
