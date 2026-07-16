import { describe, expect, it, vi } from "vitest";

interface ProcedureOptions {
	context: {
		organizationId: string;
		user: { id: string; name: string };
	};
	input: Record<string, unknown>;
}

type ProcedureHandler = (options: ProcedureOptions) => Promise<unknown>;

const mocks = vi.hoisted(() => {
	const handlers = new Map<string, ProcedureHandler>();
	let currentPath = "";
	const chain = {
		route: vi.fn((route: { path: string }) => {
			currentPath = route.path;
			return chain;
		}),
		input: vi.fn(() => chain),
		output: vi.fn(() => chain),
		handler: vi.fn((handler: ProcedureHandler) => {
			handlers.set(currentPath, handler);
			return chain;
		}),
	};

	return {
		chain,
		getHandler: (path: string) => handlers.get(path),
		mockRequirePermission: vi.fn(),
	};
});

vi.mock("../../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.chain,
}));

vi.mock("../../../studio/lib/permissions", () => ({
	requirePermission: mocks.mockRequirePermission,
}));

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
const postgresTestTimeout = 20_000;

describePostgres("convert schedule procedure idempotency", () => {
	it(
		"replays exactly once and rolls every transition back when activity creation fails",
		async () => {
			const originalDatabaseUrl = process.env.DATABASE_URL;
			process.env.DATABASE_URL = databaseUrl;
			const {
				activities,
				and,
				bookings,
				count,
				db,
				eq,
				invoices,
				organizations,
				paymentIdempotencyRecords,
				paymentSchedules,
				receipts,
				receivedAmounts,
				sql,
				users,
			} = await import("@repo/database");
			await import("./convert-schedule");

			const handler = mocks.getHandler(
				"/studio-payments/schedules/{scheduleId}/convert",
			);
			expect(handler).toBeDefined();
			if (!handler) {
				throw new Error(
					"Convert schedule procedure handler was not registered",
				);
			}

			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `convert_idem_org_${suffix}`;
			const bookingId = `convert_idem_booking_${suffix}`;
			const rollbackBookingId = `convert_rollback_booking_${suffix}`;
			const scheduleId = `convert_idem_schedule_${suffix}`;
			const rollbackScheduleId = `convert_rollback_schedule_${suffix}`;
			const invoiceId = `convert_idem_invoice_${suffix}`;
			const rollbackInvoiceId = `convert_rollback_invoice_${suffix}`;
			const userId = `convert_idem_user_${suffix}`;
			const idempotencyKey = `convert-payment-idempotency-${suffix}`;
			const rollbackKey = `convert-payment-rollback-${suffix}`;
			const failureActorName = `FAIL_CONVERT_ACTIVITY_${suffix}`;
			const functionName = `fail_convert_activity_${suffix}`;
			const triggerName = `fail_convert_activity_trigger_${suffix}`;
			let triggerCreated = false;

			await db.insert(users).values({
				id: userId,
				name: "Convert idempotency actor",
				email: `convert-idempotency-${suffix}@example.com`,
			});
			await db.insert(organizations).values({
				id: organizationId,
				name: "Convert idempotency test",
				slug: `convert-idempotency-${suffix}`,
			});
			await db.insert(bookings).values([
				{
					id: bookingId,
					organizationId,
					referenceNumber: `CONVERT-IDEM-${suffix}`,
					name: "Convert idempotency booking",
					bookingType: "test",
					packageType: "test",
					packageCost: "100.00",
				},
				{
					id: rollbackBookingId,
					organizationId,
					referenceNumber: `CONVERT-ROLLBACK-${suffix}`,
					name: "Convert rollback booking",
					bookingType: "test",
					packageType: "test",
					packageCost: "100.00",
				},
			]);
			await db.insert(paymentSchedules).values([
				{
					id: scheduleId,
					organizationId,
					bookingId,
					name: "Final payment",
					amount: "100.00",
					dueDate: "2026-07-10",
				},
				{
					id: rollbackScheduleId,
					organizationId,
					bookingId: rollbackBookingId,
					name: "Rollback final payment",
					amount: "100.00",
					dueDate: "2026-07-10",
				},
			]);
			await db.insert(invoices).values([
				{
					id: invoiceId,
					organizationId,
					bookingId,
					paymentScheduleId: scheduleId,
					invoiceNumber: `CONVERT-IDEM-INV-${suffix}`,
					issueDate: "2026-07-10",
					totalAmount: "100.00",
					status: "sent",
				},
				{
					id: rollbackInvoiceId,
					organizationId,
					bookingId: rollbackBookingId,
					paymentScheduleId: rollbackScheduleId,
					invoiceNumber: `CONVERT-ROLLBACK-INV-${suffix}`,
					issueDate: "2026-07-10",
					totalAmount: "100.00",
					status: "sent",
				},
			]);

			const context = {
				organizationId,
				user: { id: userId, name: "Convert idempotency actor" },
			};
			const input = {
				idempotencyKey,
				scheduleId,
				amount: "100.00",
				paymentMethod: "cash",
				receivedDate: "2026-07-10",
			};

			try {
				const first = (await handler({ context, input })) as {
					data: {
						receivedId: string;
						receiptId: string | null;
						scheduleId: string;
					};
					message: string;
				};
				expect(first).toEqual({
					data: {
						receivedId: expect.any(String),
						receiptId: expect.any(String),
						scheduleId,
					},
					message: "Payment schedule converted successfully",
				});
				expect(await handler({ context, input })).toEqual(first);

				for (const table of [receivedAmounts, receipts, activities]) {
					const [rows] = await db
						.select({ count: count() })
						.from(table)
						.where(eq(table.organizationId, organizationId));
					expect(Number(rows?.count)).toBe(1);
				}
				const completedSchedule =
					await db.query.paymentSchedules.findFirst({
						where: eq(paymentSchedules.id, scheduleId),
						columns: { paidAmount: true, status: true },
					});
				expect(completedSchedule).toEqual({
					paidAmount: "100.00",
					status: "completed",
				});
				const completedBooking = await db.query.bookings.findFirst({
					where: eq(bookings.id, bookingId),
					columns: { totalReceived: true },
				});
				expect(completedBooking?.totalReceived).toBe("100.00");
				const completedInvoice = await db.query.invoices.findFirst({
					where: eq(invoices.id, invoiceId),
					columns: { status: true },
				});
				expect(completedInvoice?.status).toBe("paid");

				await db.execute(
					sql.raw(`
						CREATE FUNCTION "${functionName}"() RETURNS trigger
						LANGUAGE plpgsql AS $function$
						BEGIN
							IF NEW.actor_name = '${failureActorName}' THEN
								RAISE EXCEPTION 'forced conversion activity failure';
							END IF;
							RETURN NEW;
						END;
						$function$
					`),
				);
				await db.execute(
					sql.raw(`
						CREATE TRIGGER "${triggerName}"
						BEFORE INSERT ON activities
						FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
					`),
				);
				triggerCreated = true;

				const rollbackContext = {
					organizationId,
					user: { id: userId, name: failureActorName },
				};
				const rollbackInput = {
					...input,
					idempotencyKey: rollbackKey,
					scheduleId: rollbackScheduleId,
				};
				await expect(
					handler({
						context: rollbackContext,
						input: rollbackInput,
					}),
				).rejects.toThrow('Failed query: insert into "activities"');

				const [
					[rollbackClaims],
					[rollbackPayments],
					[rollbackReceipts],
					[rollbackActivities],
				] = await Promise.all([
					db
						.select({ count: count() })
						.from(paymentIdempotencyRecords)
						.where(
							and(
								eq(
									paymentIdempotencyRecords.organizationId,
									organizationId,
								),
								eq(
									paymentIdempotencyRecords.idempotencyKey,
									rollbackKey,
								),
							),
						),
					db
						.select({ count: count() })
						.from(receivedAmounts)
						.where(
							eq(receivedAmounts.bookingId, rollbackBookingId),
						),
					db
						.select({ count: count() })
						.from(receipts)
						.where(eq(receipts.bookingId, rollbackBookingId)),
					db
						.select({ count: count() })
						.from(activities)
						.where(
							eq(activities.parentEntityId, rollbackBookingId),
						),
				]);
				for (const rows of [
					rollbackClaims,
					rollbackPayments,
					rollbackReceipts,
					rollbackActivities,
				]) {
					expect(Number(rows?.count)).toBe(0);
				}
				const rolledBackSchedule =
					await db.query.paymentSchedules.findFirst({
						where: eq(paymentSchedules.id, rollbackScheduleId),
						columns: { paidAmount: true, status: true },
					});
				expect(rolledBackSchedule).toEqual({
					paidAmount: "0.00",
					status: "pending",
				});
				const rolledBackBooking = await db.query.bookings.findFirst({
					where: eq(bookings.id, rollbackBookingId),
					columns: { totalReceived: true },
				});
				expect(rolledBackBooking?.totalReceived).toBe("0.00");
				const rolledBackInvoice = await db.query.invoices.findFirst({
					where: eq(invoices.id, rollbackInvoiceId),
					columns: { status: true },
				});
				expect(rolledBackInvoice?.status).toBe("sent");

				await db.execute(
					sql.raw(`DROP TRIGGER "${triggerName}" ON activities`),
				);
				await db.execute(sql.raw(`DROP FUNCTION "${functionName}"()`));
				triggerCreated = false;

				const retry = await handler({
					context: rollbackContext,
					input: rollbackInput,
				});
				expect(retry).toEqual({
					data: {
						receivedId: expect.any(String),
						receiptId: expect.any(String),
						scheduleId: rollbackScheduleId,
					},
					message: "Payment schedule converted successfully",
				});
				for (const table of [receivedAmounts, receipts, activities]) {
					const [rows] = await db
						.select({ count: count() })
						.from(table)
						.where(eq(table.organizationId, organizationId));
					expect(Number(rows?.count)).toBe(2);
				}
				expect(mocks.mockRequirePermission).toHaveBeenCalledWith(
					context,
					"payment",
					"create",
				);
			} finally {
				if (triggerCreated) {
					await db.execute(
						sql.raw(
							`DROP TRIGGER IF EXISTS "${triggerName}" ON activities`,
						),
					);
					await db.execute(
						sql.raw(`DROP FUNCTION IF EXISTS "${functionName}"()`),
					);
				}
				await db
					.delete(organizations)
					.where(eq(organizations.id, organizationId));
				await db.delete(users).where(eq(users.id, userId));
				process.env.DATABASE_URL = originalDatabaseUrl;
			}
		},
		postgresTestTimeout,
	);
});
