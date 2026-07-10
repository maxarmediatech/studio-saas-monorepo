import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
const postgresTestTimeout = 15_000;

describePostgres("payment idempotency production orchestration", () => {
	it(
		"deduplicates concurrent and sequential retries while preserving operation and tenant scope",
		async () => {
			const originalDatabaseUrl = process.env.DATABASE_URL;
			process.env.DATABASE_URL = databaseUrl;
			const {
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
				users,
			} = await import("@repo/database");
			const {
				convertSchedulePaymentIdempotently,
				createReceivedPaymentIdempotently,
			} = await import("./payment-idempotency");
			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `idem_org_${suffix}`;
			const otherOrganizationId = `idem_other_org_${suffix}`;
			const bookingId = `idem_booking_${suffix}`;
			const otherBookingId = `idem_other_booking_${suffix}`;
			const scheduleId = `idem_schedule_${suffix}`;
			const createInvoiceId = `idem_create_invoice_${suffix}`;
			const conversionInvoiceId = `idem_convert_invoice_${suffix}`;
			const key = `payment-idempotency-${suffix}`;
			const actorId = `idem_actor_${suffix}`;

			await db.insert(users).values({
				id: actorId,
				name: "Payment idempotency actor",
				email: `payment-idempotency-${suffix}@example.com`,
			});
			await db.insert(organizations).values([
				{
					id: organizationId,
					name: "Payment idempotency test",
					slug: `payment-idempotency-${suffix}`,
				},
				{
					id: otherOrganizationId,
					name: "Payment idempotency other tenant",
					slug: `payment-idempotency-other-${suffix}`,
				},
			]);
			await db.insert(bookings).values([
				{
					id: bookingId,
					organizationId,
					referenceNumber: `IDEM-${suffix}`,
					name: "Payment idempotency booking",
					bookingType: "test",
					packageType: "test",
					packageCost: "300.00",
				},
				{
					id: otherBookingId,
					organizationId: otherOrganizationId,
					referenceNumber: `IDEM-OTHER-${suffix}`,
					name: "Other tenant booking",
					bookingType: "test",
					packageType: "test",
					packageCost: "100.00",
				},
			]);
			await db.insert(paymentSchedules).values({
				id: scheduleId,
				organizationId,
				bookingId,
				name: "Final payment",
				amount: "100.00",
				dueDate: "2026-07-10",
			});
			await db.insert(invoices).values([
				{
					id: createInvoiceId,
					organizationId,
					bookingId,
					invoiceNumber: `IDEM-CREATE-INV-${suffix}`,
					issueDate: "2026-07-10",
					totalAmount: "100.00",
					status: "sent",
				},
				{
					id: conversionInvoiceId,
					organizationId,
					bookingId,
					paymentScheduleId: scheduleId,
					invoiceNumber: `IDEM-CONVERT-INV-${suffix}`,
					issueDate: "2026-07-10",
					totalAmount: "100.00",
					status: "sent",
				},
			]);

			const createRequest = {
				idempotencyKey: key,
				organizationId,
				userId: actorId,
				bookingId,
				amount: "100.00",
				paymentMethod: "cash" as const,
				receivedDate: "2026-07-10",
				invoiceId: createInvoiceId,
			};
			const create = () =>
				db.transaction((tx) =>
					createReceivedPaymentIdempotently(tx, createRequest),
				);

			try {
				const concurrent = await Promise.all([create(), create()]);
				expect(
					new Set(concurrent.map(({ result }) => result.id)).size,
				).toBe(1);
				expect(
					concurrent.map(({ replayed }) => replayed).sort(),
				).toEqual([false, true]);
				await db
					.update(bookings)
					.set({ name: "Mutated after payment" })
					.where(eq(bookings.id, bookingId));

				const sequential = await create();
				expect(sequential.replayed).toBe(true);
				expect(sequential.result).toEqual(concurrent[0]?.result);
				await expect(
					db.transaction((tx) =>
						createReceivedPaymentIdempotently(tx, {
							...createRequest,
							amount: "101.00",
						}),
					),
				).rejects.toThrow(
					"This idempotency key was already used for a different payment request",
				);
				for (const changedRequest of [
					{ ...createRequest, paymentMethod: "upi" as const },
					{ ...createRequest, receivedDate: "2026-07-11" },
					{ ...createRequest, invoiceId: undefined },
				]) {
					await expect(
						db.transaction((tx) =>
							createReceivedPaymentIdempotently(
								tx,
								changedRequest,
							),
						),
					).rejects.toThrow(
						"This idempotency key was already used for a different payment request",
					);
				}

				const conversion = await db.transaction((tx) =>
					convertSchedulePaymentIdempotently(tx, {
						idempotencyKey: key,
						organizationId,
						userId: actorId,
						scheduleId,
						amount: "100.00",
						paymentMethod: "cash",
						receivedDate: "2026-07-10",
					}),
				);
				expect(conversion.replayed).toBe(false);
				await db
					.update(paymentSchedules)
					.set({ name: "Mutated after conversion" })
					.where(eq(paymentSchedules.id, scheduleId));
				const conversionReplay = await db.transaction((tx) =>
					convertSchedulePaymentIdempotently(tx, {
						idempotencyKey: key,
						organizationId,
						userId: actorId,
						scheduleId,
						amount: "100.00",
						paymentMethod: "cash",
						receivedDate: "2026-07-10",
					}),
				);
				expect(conversionReplay.replayed).toBe(true);
				expect(conversionReplay.result).toEqual(conversion.result);

				await expect(
					db.transaction((tx) =>
						createReceivedPaymentIdempotently(tx, {
							...createRequest,
							organizationId: otherOrganizationId,
							invoiceId: undefined,
						}),
					),
				).rejects.toThrow("Booking not found");
				const [rolledBackTenantClaims] = await db
					.select({ count: count() })
					.from(paymentIdempotencyRecords)
					.where(
						and(
							eq(
								paymentIdempotencyRecords.organizationId,
								otherOrganizationId,
							),
							eq(paymentIdempotencyRecords.idempotencyKey, key),
						),
					);
				expect(Number(rolledBackTenantClaims?.count)).toBe(0);

				const otherTenant = await db.transaction((tx) =>
					createReceivedPaymentIdempotently(tx, {
						...createRequest,
						organizationId: otherOrganizationId,
						bookingId: otherBookingId,
						invoiceId: undefined,
					}),
				);
				expect(otherTenant.replayed).toBe(false);
				expect(otherTenant.result.id).not.toBe(
					concurrent[0]?.result.id,
				);
				await db
					.update(receivedAmounts)
					.set({ deletedAt: new Date() })
					.where(eq(receivedAmounts.id, otherTenant.result.id));
				await expect(
					db.transaction((tx) =>
						createReceivedPaymentIdempotently(tx, {
							...createRequest,
							organizationId: otherOrganizationId,
							bookingId: otherBookingId,
							invoiceId: undefined,
						}),
					),
				).rejects.toThrow(
					"The original payment is no longer available",
				);

				const [originalPayments] = await db
					.select({ count: count() })
					.from(receivedAmounts)
					.where(eq(receivedAmounts.organizationId, organizationId));
				expect(Number(originalPayments?.count)).toBe(2);
				const originalBooking = await db.query.bookings.findFirst({
					where: eq(bookings.id, bookingId),
					columns: { totalReceived: true },
				});
				expect(originalBooking?.totalReceived).toBe("200.00");
				const schedule = await db.query.paymentSchedules.findFirst({
					where: eq(paymentSchedules.id, scheduleId),
					columns: { paidAmount: true, status: true },
				});
				expect(schedule).toEqual({
					paidAmount: "100.00",
					status: "completed",
				});
				const [receiptRows] = await db
					.select({ count: count() })
					.from(receipts)
					.where(eq(receipts.organizationId, organizationId));
				expect(Number(receiptRows?.count)).toBe(2);
				for (const invoiceId of [
					createInvoiceId,
					conversionInvoiceId,
				]) {
					const invoice = await db.query.invoices.findFirst({
						where: eq(invoices.id, invoiceId),
						columns: { status: true },
					});
					expect(invoice?.status).toBe("paid");
				}
				const [scopedClaims] = await db
					.select({ count: count() })
					.from(paymentIdempotencyRecords)
					.where(
						and(
							eq(
								paymentIdempotencyRecords.organizationId,
								organizationId,
							),
							eq(paymentIdempotencyRecords.idempotencyKey, key),
						),
					);
				expect(Number(scopedClaims?.count)).toBe(2);
			} finally {
				await db
					.delete(organizations)
					.where(eq(organizations.id, organizationId));
				await db
					.delete(organizations)
					.where(eq(organizations.id, otherOrganizationId));
				await db.delete(users).where(eq(users.id, actorId));
				process.env.DATABASE_URL = originalDatabaseUrl;
			}
		},
		postgresTestTimeout,
	);

	it(
		"rolls back the claim with payment effects so the same key can retry",
		async () => {
			const originalDatabaseUrl = process.env.DATABASE_URL;
			process.env.DATABASE_URL = databaseUrl;
			const {
				and,
				bookings,
				count,
				db,
				eq,
				organizations,
				paymentIdempotencyRecords,
				receivedAmounts,
				users,
			} = await import("@repo/database");
			const { createReceivedPaymentIdempotently } = await import(
				"./payment-idempotency"
			);
			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `idem_rollback_org_${suffix}`;
			const bookingId = `idem_rollback_booking_${suffix}`;
			const key = `payment-idempotency-rollback-${suffix}`;
			const actorId = `idem_rollback_actor_${suffix}`;
			await db.insert(users).values({
				id: actorId,
				name: "Payment idempotency rollback actor",
				email: `payment-idempotency-rollback-${suffix}@example.com`,
			});
			await db.insert(organizations).values({
				id: organizationId,
				name: "Payment idempotency rollback test",
				slug: `payment-idempotency-rollback-${suffix}`,
			});
			await db.insert(bookings).values({
				id: bookingId,
				organizationId,
				referenceNumber: `IDEM-ROLLBACK-${suffix}`,
				name: "Payment idempotency rollback booking",
				bookingType: "test",
				packageType: "test",
				packageCost: "100.00",
			});
			const request = {
				idempotencyKey: key,
				organizationId,
				userId: actorId,
				bookingId,
				amount: "100.00",
				paymentMethod: "cash" as const,
				receivedDate: "2026-07-10",
			};

			try {
				await expect(
					db.transaction(async (tx) => {
						await createReceivedPaymentIdempotently(tx, request);
						throw new Error("force transaction rollback");
					}),
				).rejects.toThrow("force transaction rollback");

				for (const table of [
					paymentIdempotencyRecords,
					receivedAmounts,
				]) {
					const [rows] = await db
						.select({ count: count() })
						.from(table)
						.where(eq(table.organizationId, organizationId));
					expect(Number(rows?.count)).toBe(0);
				}
				const bookingAfterRollback = await db.query.bookings.findFirst({
					where: and(
						eq(bookings.id, bookingId),
						eq(bookings.organizationId, organizationId),
					),
					columns: { totalReceived: true },
				});
				expect(bookingAfterRollback?.totalReceived).toBe("0.00");

				const retry = await db.transaction((tx) =>
					createReceivedPaymentIdempotently(tx, request),
				);
				expect(retry.replayed).toBe(false);
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
