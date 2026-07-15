import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("canonical booking expense totals", () => {
	it("includes shoot allocations and preserves concurrent expense writes", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			bookings,
			db,
			eq,
			expenseAssignments,
			expenses,
			organizations,
			shoots,
		} = await import("@repo/database");
		const { refreshBookingExpenseTotalsForExpense } = await import(
			"./booking-expense-totals"
		);
		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `expense_profit_org_${suffix}`;
		const bookingId = `expense_profit_booking_${suffix}`;
		const shootId = `expense_profit_shoot_${suffix}`;

		try {
			await db.insert(organizations).values({
				id: organizationId,
				name: "Expense profitability test",
				slug: `expense-profit-${suffix}`,
			});
			await db.insert(bookings).values({
				id: bookingId,
				organizationId,
				referenceNumber: `EXP-${suffix}`,
				name: "Expense profitability booking",
				bookingType: "test",
				packageType: "test",
				packageCost: "1000.00",
			});
			await db.insert(shoots).values({
				id: shootId,
				organizationId,
				bookingId,
				name: "Expense profitability shoot",
				shootType: "test",
				shootDate: "2026-07-11",
			});

			const addExpense = (index: number, target: "booking" | "shoot") =>
				db.transaction(async (tx) => {
					const expenseId = `expense_profit_${index}_${suffix}`;
					await tx.insert(expenses).values({
						id: expenseId,
						organizationId,
						description: `Concurrent expense ${index}`,
						amount: index === 1 ? "125.00" : "75.00",
						expenseDate: "2026-07-11",
					});
					await tx.insert(expenseAssignments).values({
						expenseId,
						bookingId: target === "booking" ? bookingId : null,
						shootId: target === "shoot" ? shootId : null,
					});
					await refreshBookingExpenseTotalsForExpense(
						tx,
						expenseId,
						null,
					);
				});

			await Promise.all([
				addExpense(1, "booking"),
				addExpense(2, "shoot"),
			]);
			const booking = await db.query.bookings.findFirst({
				where: eq(bookings.id, bookingId),
			});
			expect(booking?.totalExpenses).toBe("200.00");

			const shootExpense = await db.query.expenses.findFirst({
				where: eq(expenses.description, "Concurrent expense 2"),
			});
			await db.transaction(async (tx) => {
				await tx
					.update(shoots)
					.set({ deletedAt: new Date() })
					.where(eq(shoots.id, shootId));
				await refreshBookingExpenseTotalsForExpense(
					tx,
					shootExpense?.id ?? "missing",
					null,
				);
			});
			const afterShootDelete = await db.query.bookings.findFirst({
				where: eq(bookings.id, bookingId),
			});
			expect(afterShootDelete?.totalExpenses).toBe("125.00");

			await db.transaction(async (tx) => {
				await tx
					.update(expenses)
					.set({ deletedAt: new Date() })
					.where(eq(expenses.id, shootExpense?.id ?? "missing"));
				await refreshBookingExpenseTotalsForExpense(
					tx,
					shootExpense?.id ?? "missing",
					null,
				);
			});
			const afterDelete = await db.query.bookings.findFirst({
				where: eq(bookings.id, bookingId),
			});
			expect(afterDelete?.totalExpenses).toBe("125.00");
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});
});
