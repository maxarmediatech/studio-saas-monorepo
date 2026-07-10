import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres(
	"schedule payment production orchestration concurrency",
	() => {
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
			const { convertSchedulePaymentTransition } = await import(
				"./schedule-payment-service"
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
				db.transaction((tx) =>
					convertSchedulePaymentTransition(tx, {
						organizationId,
						userId: "race_test_actor",
						scheduleId,
						amount: "100.00",
						paymentMethod: "cash",
						receivedDate: "2026-01-01",
					}),
				);

			try {
				const [first, second] = await Promise.all([
					convert(),
					convert(),
				]);
				expect(first.receivedId).toBeTruthy();
				expect(second.receivedId).toBe(first.receivedId);
				const [payments] = await db
					.select({ count: count() })
					.from(receivedAmounts)
					.where(eq(receivedAmounts.paymentScheduleId, scheduleId));
				expect(Number(payments?.count)).toBe(1);
			} finally {
				await db
					.delete(organizations)
					.where(eq(organizations.id, organizationId));
				process.env.DATABASE_URL = originalDatabaseUrl;
			}
		});

		it("rejects the second competing payment without a partial write", async () => {
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
			const { createReceivedPaymentTransition } = await import(
				"./schedule-payment-service"
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

			const pay = () =>
				db.transaction((tx) =>
					createReceivedPaymentTransition(tx, {
						organizationId,
						userId: "race_test_actor",
						bookingId,
						paymentScheduleId: scheduleId,
						amount: "60.00",
						paymentMethod: "cash",
						receivedDate: "2026-01-01",
					}),
				);

			try {
				const results = await Promise.allSettled([pay(), pay()]);
				expect(
					results.filter((result) => result.status === "fulfilled"),
				).toHaveLength(1);
				expect(
					results.filter((result) => result.status === "rejected"),
				).toHaveLength(1);
				const schedule = await db.query.paymentSchedules.findFirst({
					where: eq(paymentSchedules.id, scheduleId),
					columns: { paidAmount: true, status: true },
				});
				expect(schedule).toEqual({
					paidAmount: "60.00",
					status: "partial",
				});
				const [payments] = await db
					.select({ count: count() })
					.from(receivedAmounts)
					.where(eq(receivedAmounts.paymentScheduleId, scheduleId));
				expect(Number(payments?.count)).toBe(1);
			} finally {
				await db
					.delete(organizations)
					.where(eq(organizations.id, organizationId));
				process.env.DATABASE_URL = originalDatabaseUrl;
			}
		});

		it("keeps conversion and invoice creation mutually consistent", async () => {
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
			const { createInvoiceFromScheduleTransition } = await import(
				"../../invoices/lib/create-from-schedule-service"
			);
			const { convertSchedulePaymentTransition } = await import(
				"./schedule-payment-service"
			);
			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `schedule_invoice_org_${suffix}`;
			const bookingId = `schedule_invoice_booking_${suffix}`;
			const scheduleId = `schedule_invoice_schedule_${suffix}`;

			await db.insert(organizations).values({
				id: organizationId,
				name: "Schedule invoice race test",
				slug: `schedule-invoice-${suffix}`,
			});
			await db.insert(bookings).values({
				id: bookingId,
				organizationId,
				referenceNumber: `INV-RACE-${suffix}`,
				name: "Schedule invoice race test booking",
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

			try {
				await Promise.allSettled([
					db.transaction((tx) =>
						convertSchedulePaymentTransition(tx, {
							organizationId,
							userId: "race_test_actor",
							scheduleId,
							amount: "100.00",
							paymentMethod: "cash",
							receivedDate: "2026-01-01",
						}),
					),
					db.transaction((tx) =>
						createInvoiceFromScheduleTransition(tx, {
							organizationId,
							userId: "race_test_actor",
							bookingId,
							paymentScheduleId: scheduleId,
						}),
					),
				]);

				const [payments] = await db
					.select({ count: count() })
					.from(receivedAmounts)
					.where(eq(receivedAmounts.paymentScheduleId, scheduleId));
				expect(Number(payments?.count)).toBe(1);
				const linkedInvoice = await db.query.invoices.findFirst({
					where: eq(invoices.paymentScheduleId, scheduleId),
					columns: { id: true },
				});
				if (linkedInvoice) {
					const [activeReceipts] = await db
						.select({ count: count() })
						.from(receipts)
						.where(eq(receipts.invoiceId, linkedInvoice.id));
					expect(Number(activeReceipts?.count)).toBe(1);
				}
			} finally {
				await db
					.delete(organizations)
					.where(eq(organizations.id, organizationId));
				process.env.DATABASE_URL = originalDatabaseUrl;
			}
		});
	},
);
