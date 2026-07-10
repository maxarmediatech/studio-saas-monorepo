import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

async function expectConstraintError(
	operation: Promise<unknown>,
	expectedMessage: string,
) {
	try {
		await operation;
		expect.unreachable(
			"Expected the database relationship guard to reject",
		);
	} catch (error) {
		const cause = (error as { cause?: Error }).cause;
		expect(cause?.message).toContain(expectedMessage);
	}
}

describePostgres(
	"financial relationship constraints on migrated PostgreSQL",
	() => {
		it("rejects cross-booking financial links while allowing a consistent chain", async () => {
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
			} = await import("@repo/database");
			const suffix = `${process.pid}_${Date.now()}`;
			const ids = {
				organization: `relationship_org_${suffix}`,
				bookingA: `relationship_booking_a_${suffix}`,
				bookingB: `relationship_booking_b_${suffix}`,
				scheduleA: `relationship_schedule_a_${suffix}`,
				scheduleB: `relationship_schedule_b_${suffix}`,
				invoiceA: `relationship_invoice_a_${suffix}`,
				invoiceB: `relationship_invoice_b_${suffix}`,
				paymentA: `relationship_payment_a_${suffix}`,
				paymentB: `relationship_payment_b_${suffix}`,
				receiptA: `relationship_receipt_a_${suffix}`,
			};

			try {
				await db.insert(organizations).values({
					id: ids.organization,
					name: "Relationship constraints",
					slug: `relationship-${suffix}`,
				});
				await db.insert(bookings).values([
					{
						id: ids.bookingA,
						organizationId: ids.organization,
						referenceNumber: `REL-A-${suffix}`,
						name: "Booking A",
						bookingType: "test",
						packageType: "test",
						packageCost: "100.00",
					},
					{
						id: ids.bookingB,
						organizationId: ids.organization,
						referenceNumber: `REL-B-${suffix}`,
						name: "Booking B",
						bookingType: "test",
						packageType: "test",
						packageCost: "100.00",
					},
				]);
				await db.insert(paymentSchedules).values([
					{
						id: ids.scheduleA,
						organizationId: ids.organization,
						bookingId: ids.bookingA,
						name: "Booking A payment",
						amount: "100.00",
						dueDate: "2026-01-01",
					},
					{
						id: ids.scheduleB,
						organizationId: ids.organization,
						bookingId: ids.bookingB,
						name: "Booking B payment",
						amount: "100.00",
						dueDate: "2026-01-01",
					},
				]);

				await expectConstraintError(
					db.insert(invoices).values({
						id: `invalid_invoice_${suffix}`,
						organizationId: ids.organization,
						bookingId: ids.bookingA,
						paymentScheduleId: ids.scheduleB,
						invoiceNumber: `INVALID-${suffix}`,
						issueDate: "2026-01-01",
					}),
					"Invoice payment schedule must belong to the same organization and booking",
				);

				await db.insert(invoices).values([
					{
						id: ids.invoiceA,
						organizationId: ids.organization,
						bookingId: ids.bookingA,
						paymentScheduleId: ids.scheduleA,
						invoiceNumber: `REL-A-${suffix}`,
						issueDate: "2026-01-01",
						totalAmount: "100.00",
					},
					{
						id: ids.invoiceB,
						organizationId: ids.organization,
						bookingId: ids.bookingB,
						paymentScheduleId: ids.scheduleB,
						invoiceNumber: `REL-B-${suffix}`,
						issueDate: "2026-01-01",
						totalAmount: "100.00",
					},
				]);

				await expectConstraintError(
					db.insert(receivedAmounts).values({
						id: `invalid_payment_${suffix}`,
						organizationId: ids.organization,
						bookingId: ids.bookingA,
						paymentScheduleId: ids.scheduleB,
						amount: "10.00",
						paymentMethod: "cash",
						receivedDate: "2026-01-01",
					}),
					"Received payment schedule must belong to the same organization and booking",
				);

				await db.insert(receivedAmounts).values([
					{
						id: ids.paymentA,
						organizationId: ids.organization,
						bookingId: ids.bookingA,
						paymentScheduleId: ids.scheduleA,
						invoiceId: ids.invoiceA,
						amount: "100.00",
						paymentMethod: "cash",
						receivedDate: "2026-01-01",
					},
					{
						id: ids.paymentB,
						organizationId: ids.organization,
						bookingId: ids.bookingB,
						paymentScheduleId: ids.scheduleB,
						invoiceId: ids.invoiceB,
						amount: "100.00",
						paymentMethod: "cash",
						receivedDate: "2026-01-01",
					},
				]);

				await expectConstraintError(
					db.insert(receipts).values({
						id: `invalid_receipt_${suffix}`,
						organizationId: ids.organization,
						bookingId: ids.bookingA,
						receivedAmountId: ids.paymentB,
						receiptNumber: `INVALID-R-${suffix}`,
						amount: "100.00",
						receiptDate: "2026-01-01",
					}),
					"Receipt payment must belong to the same organization and booking",
				);

				await db.insert(receipts).values({
					id: ids.receiptA,
					organizationId: ids.organization,
					bookingId: ids.bookingA,
					invoiceId: ids.invoiceA,
					receivedAmountId: ids.paymentA,
					receiptNumber: `REL-R-${suffix}`,
					amount: "100.00",
					receiptDate: "2026-01-01",
				});

				const receipt = await db.query.receipts.findFirst({
					where: eq(receipts.id, ids.receiptA),
				});
				expect(receipt).toMatchObject({
					bookingId: ids.bookingA,
					invoiceId: ids.invoiceA,
					receivedAmountId: ids.paymentA,
				});

				await expectConstraintError(
					db
						.update(paymentSchedules)
						.set({ bookingId: ids.bookingB })
						.where(eq(paymentSchedules.id, ids.scheduleA)),
					"Payment schedule organization and booking cannot diverge from linked invoices or payments",
				);
			} finally {
				await db
					.delete(organizations)
					.where(eq(organizations.id, ids.organization));
				process.env.DATABASE_URL = originalDatabaseUrl;
			}
		});
	},
);
