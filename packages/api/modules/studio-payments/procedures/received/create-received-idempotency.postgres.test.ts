import { describe, expect, it, vi } from "vitest";

interface ProcedureContext {
	organizationId: string;
	user: { id: string; name: string };
}

interface ProcedureOptions {
	context: ProcedureContext;
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

describePostgres("create received procedure idempotency", () => {
	it(
		"commits one payment, receipt, activity, and response or rolls all effects back",
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
				receipts,
				receivedAmounts,
				sql,
				users,
			} = await import("@repo/database");
			await import("./create-received");

			const handler = mocks.getHandler("/studio-payments/received");
			expect(handler).toBeDefined();
			if (!handler) {
				throw new Error(
					"Create received procedure handler was not registered",
				);
			}

			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `procedure_idem_org_${suffix}`;
			const bookingId = `procedure_idem_booking_${suffix}`;
			const rollbackBookingId = `procedure_idem_rollback_booking_${suffix}`;
			const invoiceId = `procedure_idem_invoice_${suffix}`;
			const rollbackInvoiceId = `procedure_idem_rollback_invoice_${suffix}`;
			const userId = `procedure_idem_user_${suffix}`;
			const idempotencyKey = `procedure-payment-idempotency-${suffix}`;
			const rollbackKey = `procedure-payment-rollback-${suffix}`;
			const failureActorName = `FAIL_PAYMENT_ACTIVITY_${suffix}`;
			const functionName = `fail_payment_activity_${suffix}`;
			const triggerName = `fail_payment_activity_trigger_${suffix}`;
			let triggerCreated = false;

			await db.insert(users).values({
				id: userId,
				name: "Procedure idempotency actor",
				email: `procedure-idempotency-${suffix}@example.com`,
			});
			await db.insert(organizations).values({
				id: organizationId,
				name: "Procedure idempotency test",
				slug: `procedure-idempotency-${suffix}`,
			});
			await db.insert(bookings).values([
				{
					id: bookingId,
					organizationId,
					referenceNumber: `PROCEDURE-IDEM-${suffix}`,
					name: "Procedure idempotency booking",
					bookingType: "test",
					packageType: "test",
					packageCost: "100.00",
				},
				{
					id: rollbackBookingId,
					organizationId,
					referenceNumber: `PROCEDURE-ROLLBACK-${suffix}`,
					name: "Procedure rollback booking",
					bookingType: "test",
					packageType: "test",
					packageCost: "100.00",
				},
			]);
			await db.insert(invoices).values([
				{
					id: invoiceId,
					organizationId,
					bookingId,
					invoiceNumber: `PROCEDURE-IDEM-INV-${suffix}`,
					issueDate: "2026-07-10",
					totalAmount: "100.00",
					status: "sent",
				},
				{
					id: rollbackInvoiceId,
					organizationId,
					bookingId: rollbackBookingId,
					invoiceNumber: `PROCEDURE-ROLLBACK-INV-${suffix}`,
					issueDate: "2026-07-10",
					totalAmount: "100.00",
					status: "sent",
				},
			]);

			const context = {
				organizationId,
				user: { id: userId, name: "Procedure idempotency actor" },
			};
			const input = {
				idempotencyKey,
				bookingId,
				invoiceId,
				amount: "100.00",
				paymentMethod: "cash",
				receivedDate: "2026-07-10",
			};

			try {
				const first = (await handler({ context, input })) as {
					data: { id: string };
					message: string;
				};
				expect(first).toEqual({
					data: { id: expect.any(String) },
					message: "Payment recorded successfully",
				});
				const replay = await handler({ context, input });
				expect(replay).toEqual(first);

				for (const table of [receivedAmounts, receipts, activities]) {
					const [rows] = await db
						.select({ count: count() })
						.from(table)
						.where(eq(table.organizationId, organizationId));
					expect(Number(rows?.count)).toBe(1);
				}
				const [claimRows] = await db
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
								idempotencyKey,
							),
						),
					);
				expect(Number(claimRows?.count)).toBe(1);

				await expect(
					handler({
						context,
						input: { ...input, amount: "99.00" },
					}),
				).rejects.toThrow(
					"This idempotency key was already used for a different payment request",
				);

				const storedMessage =
					"Stored response from an earlier deployment";
				await db
					.update(paymentIdempotencyRecords)
					.set({
						resultPayload: {
							data: first.data,
							message: storedMessage,
						},
					})
					.where(
						and(
							eq(
								paymentIdempotencyRecords.organizationId,
								organizationId,
							),
							eq(
								paymentIdempotencyRecords.idempotencyKey,
								idempotencyKey,
							),
						),
					);
				expect(await handler({ context, input })).toEqual({
					data: first.data,
					message: storedMessage,
				});

				await db.execute(
					sql.raw(`
						CREATE FUNCTION "${functionName}"() RETURNS trigger
						LANGUAGE plpgsql AS $function$
						BEGIN
							IF NEW.actor_name = '${failureActorName}' THEN
								RAISE EXCEPTION 'forced payment activity failure';
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
					bookingId: rollbackBookingId,
					invoiceId: rollbackInvoiceId,
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
				const rolledBackBooking = await db.query.bookings.findFirst({
					where: eq(bookings.id, rollbackBookingId),
					columns: { totalReceived: true },
				});
				expect(rolledBackBooking?.totalReceived).toBe("0.00");

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
					data: { id: expect.any(String) },
					message: "Payment recorded successfully",
				});
				const [
					[retryClaims],
					[retryPayments],
					[retryReceipts],
					[retryActivities],
				] = await Promise.all([
					db
						.select({ count: count() })
						.from(paymentIdempotencyRecords)
						.where(
							eq(
								paymentIdempotencyRecords.idempotencyKey,
								rollbackKey,
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
					retryClaims,
					retryPayments,
					retryReceipts,
					retryActivities,
				]) {
					expect(Number(rows?.count)).toBe(1);
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
