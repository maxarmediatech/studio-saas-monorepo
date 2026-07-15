import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("schedule completion history during correction", () => {
	it("preserves continuous completion and dates newly completed schedules from active payments", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			bookings,
			db,
			eq,
			organizations,
			paymentSchedules,
			receivedAmounts,
			users,
		} = await import("@repo/database");
		const { correctReceivedPaymentIdempotently } = await import(
			"./payment-idempotency"
		);
		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `completion_history_org_${suffix}`;
		const actorId = `completion_history_actor_${suffix}`;
		const completedBookingId = `completion_history_booking_done_${suffix}`;
		const partialBookingId = `completion_history_booking_partial_${suffix}`;
		const completedScheduleId = `completion_history_schedule_done_${suffix}`;
		const partialScheduleId = `completion_history_schedule_partial_${suffix}`;
		const completedOriginalId = `completion_history_payment_done_${suffix}`;
		const partialOriginalId = `completion_history_payment_partial_${suffix}`;
		const historicalPaidAt = new Date("2025-12-20T08:15:00.000Z");

		try {
			await db.insert(users).values({
				id: actorId,
				name: "Completion history actor",
				email: `completion-history-${suffix}@example.com`,
			});
			await db.insert(organizations).values({
				id: organizationId,
				name: "Completion history test",
				slug: `completion-history-${suffix}`,
			});
			await db.insert(bookings).values([
				{
					id: completedBookingId,
					organizationId,
					referenceNumber: `HISTORY-DONE-${suffix}`,
					name: "Continuously completed booking",
					bookingType: "test",
					packageType: "test",
					packageCost: "100.00",
					totalReceived: "100.00",
				},
				{
					id: partialBookingId,
					organizationId,
					referenceNumber: `HISTORY-PARTIAL-${suffix}`,
					name: "Newly completed booking",
					bookingType: "test",
					packageType: "test",
					packageCost: "100.00",
					totalReceived: "40.00",
				},
			]);
			await db.insert(paymentSchedules).values([
				{
					id: completedScheduleId,
					organizationId,
					bookingId: completedBookingId,
					name: "Continuously completed schedule",
					amount: "100.00",
					dueDate: "2026-01-01",
					paidAmount: "100.00",
					status: "completed",
					paidAt: historicalPaidAt,
				},
				{
					id: partialScheduleId,
					organizationId,
					bookingId: partialBookingId,
					name: "Newly completed schedule",
					amount: "100.00",
					dueDate: "2026-01-01",
					paidAmount: "40.00",
					status: "partial",
				},
			]);
			await db.insert(receivedAmounts).values([
				{
					id: completedOriginalId,
					organizationId,
					bookingId: completedBookingId,
					paymentScheduleId: completedScheduleId,
					amount: "40.00",
					paymentMethod: "cash",
					receivedDate: "2026-01-01",
					createdBy: actorId,
				},
				{
					organizationId,
					bookingId: completedBookingId,
					paymentScheduleId: completedScheduleId,
					amount: "60.00",
					paymentMethod: "cash",
					receivedDate: "2026-01-02",
					createdBy: actorId,
				},
				{
					id: partialOriginalId,
					organizationId,
					bookingId: partialBookingId,
					paymentScheduleId: partialScheduleId,
					amount: "20.00",
					paymentMethod: "cash",
					receivedDate: "2026-01-05",
					createdBy: actorId,
				},
				{
					organizationId,
					bookingId: partialBookingId,
					paymentScheduleId: partialScheduleId,
					amount: "20.00",
					paymentMethod: "cash",
					receivedDate: "2026-01-06",
					createdBy: actorId,
				},
			]);

			const completedRequest = {
				id: completedOriginalId,
				idempotencyKey: `completion-history-done-${suffix}`,
				amount: "40.00",
				paymentMethod: "bank_transfer" as const,
				receivedDate: "2026-01-03",
				reason: "Correct payment method",
				actorName: "Completion history actor",
				organizationId,
				userId: actorId,
			};
			const firstCompletedCorrection = await db.transaction((tx) =>
				correctReceivedPaymentIdempotently(tx, completedRequest),
			);
			const completedReplay = await db.transaction((tx) =>
				correctReceivedPaymentIdempotently(tx, completedRequest),
			);
			expect(completedReplay).toEqual({
				result: firstCompletedCorrection.result,
				replayed: true,
			});

			await db.transaction((tx) =>
				correctReceivedPaymentIdempotently(tx, {
					id: partialOriginalId,
					idempotencyKey: `completion-history-new-${suffix}`,
					amount: "80.00",
					paymentMethod: "bank_transfer",
					receivedDate: "2026-01-10",
					reason: "Correct understated amount",
					actorName: "Completion history actor",
					organizationId,
					userId: actorId,
				}),
			);

			const continuouslyCompleted =
				await db.query.paymentSchedules.findFirst({
					where: eq(paymentSchedules.id, completedScheduleId),
					columns: { paidAmount: true, paidAt: true, status: true },
				});
			expect(continuouslyCompleted).toEqual({
				paidAmount: "100.00",
				paidAt: historicalPaidAt,
				status: "completed",
			});

			const newlyCompleted = await db.query.paymentSchedules.findFirst({
				where: eq(paymentSchedules.id, partialScheduleId),
				columns: { paidAmount: true, paidAt: true, status: true },
			});
			expect(newlyCompleted).toEqual({
				paidAmount: "100.00",
				paidAt: new Date("2026-01-10T00:00:00.000Z"),
				status: "completed",
			});
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			await db.delete(users).where(eq(users.id, actorId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	}, 15_000);
});
