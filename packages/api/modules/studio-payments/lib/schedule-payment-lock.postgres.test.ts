import { describe, expect, it } from "vitest";

// Set POSTGRES_CONCURRENCY_DATABASE_URL to an isolated, migrated test database.
const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("schedule payment row-lock concurrency", () => {
	it("allows only one concurrent schedule conversion effect", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;

		const {
			bookings,
			count,
			db,
			eq,
			organizations,
			paymentSchedules,
			receivedAmounts,
		} = await import("@repo/database");
		const {
			getLockedBookingForReceipt,
			getLockedScheduleForReceipt,
		} = await import("../../receipts/lib/locked-invoice-for-receipt");
		const { buildSchedulePaymentTransition } = await import(
			"./schedule-payment-transition"
		);

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `schedule_race_org_${suffix}`;
		const bookingId = `schedule_race_booking_${suffix}`;
		const scheduleId = `schedule_race_schedule_${suffix}`;

		await db.insert(organizations).values({
			id: organizationId,
			name: "Schedule conversion race test",
			slug: `schedule-race-${suffix}`,
		});
		await db.insert(bookings).values({
			id: bookingId,
			organizationId,
			referenceNumber: `SCHEDULE-${suffix}`,
			name: "Schedule conversion race test booking",
			bookingType: "test",
			packageType: "test",
			packageCost: "100.00",
		});
		await db.insert(paymentSchedules).values({
			id: scheduleId,
			organizationId,
			bookingId,
			name: "Final payment",
			amount: "100.00",
			dueDate: "2026-01-01",
		});

		const convert = () =>
			db.transaction(async (tx) => {
				await getLockedBookingForReceipt(tx, { organizationId, bookingId });
				const schedule = await getLockedScheduleForReceipt(tx, {
					organizationId,
					bookingId,
					paymentScheduleId: scheduleId,
				});
				expect(schedule).not.toBeNull();

				if (schedule?.status === "completed") {
					const existing = await tx.query.receivedAmounts.findFirst({
						where: eq(receivedAmounts.paymentScheduleId, scheduleId),
						columns: { id: true },
					});
					return existing?.id;
				}
				const transition = buildSchedulePaymentTransition(
					schedule!,
					"100.00",
					"Cancelled schedule cannot be converted",
				);

				const [payment] = await tx
					.insert(receivedAmounts)
					.values({
						organizationId,
						bookingId,
						paymentScheduleId: scheduleId,
						amount: transition.amount,
						paymentMethod: "cash",
						receivedDate: "2026-01-01",
					})
					.returning({ id: receivedAmounts.id });
				await tx
					.update(paymentSchedules)
					.set({
						paidAmount: transition.paidAmount,
						paidAt: transition.paidAt,
						status: transition.status,
					})
					.where(eq(paymentSchedules.id, scheduleId));
				return payment?.id;
			});

		try {
			const [first, second] = await Promise.all([convert(), convert()]);
			expect(first).toBeTruthy();
			expect(second).toBe(first);

			const [payments] = await db
				.select({ count: count() })
				.from(receivedAmounts)
				.where(eq(receivedAmounts.paymentScheduleId, scheduleId));
			expect(Number(payments?.count)).toBe(1);
		} finally {
			await db.delete(organizations).where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});

	it("rejects the second concurrent payment instead of overpaying", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;

		const { bookings, db, eq, organizations, paymentSchedules } = await import(
			"@repo/database"
		);
		const {
			getLockedBookingForReceipt,
			getLockedScheduleForReceipt,
		} = await import("../../receipts/lib/locked-invoice-for-receipt");
		const { buildSchedulePaymentTransition } = await import(
			"./schedule-payment-transition"
		);

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `schedule_overpay_org_${suffix}`;
		const bookingId = `schedule_overpay_booking_${suffix}`;
		const scheduleId = `schedule_overpay_schedule_${suffix}`;

		await db.insert(organizations).values({
			id: organizationId,
			name: "Schedule overpayment race test",
			slug: `schedule-overpay-${suffix}`,
		});
		await db.insert(bookings).values({
			id: bookingId,
			organizationId,
			referenceNumber: `OVERPAY-${suffix}`,
			name: "Schedule overpayment race test booking",
			bookingType: "test",
			packageType: "test",
			packageCost: "100.00",
		});
		await db.insert(paymentSchedules).values({
			id: scheduleId,
			organizationId,
			bookingId,
			name: "Final payment",
			amount: "100.00",
			dueDate: "2026-01-01",
		});

		const apply = () =>
			db.transaction(async (tx) => {
				await getLockedBookingForReceipt(tx, { organizationId, bookingId });
				const schedule = await getLockedScheduleForReceipt(tx, {
					organizationId,
					bookingId,
					paymentScheduleId: scheduleId,
				});
				const transition = buildSchedulePaymentTransition(
					schedule!,
					"60.00",
					"Cancelled schedule cannot receive payments",
				);
				await tx
					.update(paymentSchedules)
					.set({
						paidAmount: transition.paidAmount,
						paidAt: transition.paidAt,
						status: transition.status,
					})
					.where(eq(paymentSchedules.id, scheduleId));
			});

		try {
			const results = await Promise.allSettled([apply(), apply()]);
			expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
				1,
			);
			expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

			const schedule = await db.query.paymentSchedules.findFirst({
				where: eq(paymentSchedules.id, scheduleId),
				columns: { paidAmount: true, status: true },
			});
			expect(schedule).toEqual({ paidAmount: "60.00", status: "partial" });
		} finally {
			await db.delete(organizations).where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});
});
