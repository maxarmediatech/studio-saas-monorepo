import { ORPCError } from "@orpc/server";
import {
	and,
	eq,
	isNull,
	sql,
	expenses,
	expenseAssignments,
	bookings,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteExpenseInputSchema,
	deleteExpenseOutputSchema,
} from "../../studio/schemas/expense";

export const deleteExpense = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/expenses/{id}",
		tags: ["Expenses"],
		summary: "Delete expense",
		description: "Soft delete an expense",
	})
	.input(deleteExpenseInputSchema)
	.output(deleteExpenseOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "expense", "delete");

		const { id } = input;

		// Verify expense exists and belongs to organization
		const expense = await db.query.expenses.findFirst({
			where: and(
				eq(expenses.id, id),
				eq(expenses.organizationId, context.organizationId),
				isNull(expenses.deletedAt),
			),
		});

		if (!expense) {
			throw new ORPCError("NOT_FOUND", {
				message: "Expense not found",
			});
		}

		const amount = parseFloat(expense.amount);

		// Get booking assignments to update totals
		const assignments = await db
			.select({
				bookingId: expenseAssignments.bookingId,
				allocationPercentage: expenseAssignments.allocationPercentage,
				allocationAmount: expenseAssignments.allocationAmount,
			})
			.from(expenseAssignments)
			.where(
				and(
					eq(expenseAssignments.expenseId, id),
					sql`${expenseAssignments.bookingId} IS NOT NULL`,
				),
			);

		// Use transaction to soft delete and update booking totals
		return await db.transaction(async (tx) => {
			// Soft delete the expense
			await tx
				.update(expenses)
				.set({
					deletedAt: new Date(),
					deletedBy: context.user.id,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(expenses.id, id));

			// Update each booking's total expenses
			for (const assignment of assignments) {
				if (!assignment.bookingId) continue;

				const allocated = assignment.allocationAmount
					? parseFloat(assignment.allocationAmount)
					: assignment.allocationPercentage
						? (amount * parseFloat(assignment.allocationPercentage)) / 100
						: amount;

				await tx
					.update(bookings)
					.set({
						totalExpenses: sql`${bookings.totalExpenses} - ${allocated.toFixed(2)}`,
						updatedAt: new Date(),
						updatedBy: context.user.id,
					})
					.where(eq(bookings.id, assignment.bookingId));
			}

			return {
				data: { id },
				message: "Expense deleted successfully",
			};
		});
	});
