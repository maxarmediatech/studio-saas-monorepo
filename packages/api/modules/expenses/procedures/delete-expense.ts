import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	expenseAssignments,
	expenses,
	isNull,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteExpenseInputSchema,
	deleteExpenseOutputSchema,
} from "../../studio/schemas/expense";
import { refreshBookingExpenseTotalsForExpense } from "../lib/booking-expense-totals";

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
		await requirePermission(context, "expense", "delete");

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

		// Get booking assignments to update totals (also get booking name for activity context)
		const assignments = await db
			.select({
				bookingId: expenseAssignments.bookingId,
				bookingName: bookings.name,
			})
			.from(expenseAssignments)
			.leftJoin(bookings, eq(expenseAssignments.bookingId, bookings.id))
			.where(eq(expenseAssignments.expenseId, id));

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

			await refreshBookingExpenseTotalsForExpense(
				tx,
				id,
				context.user.id,
			);

			// Track activity (non-blocking) - use first booking as parent context if available
			const firstBooking = assignments.find(
				(
					a,
				): a is typeof a & { bookingId: string; bookingName: string } =>
					a.bookingId !== null && a.bookingName !== null,
			);
			await safeTrackActivity(context, {
				entityType: "expense",
				entityId: id,
				entityName: `${formatAmount(expense.amount)} - ${expense.description}`,
				action: "deleted",
				...(firstBooking && {
					parentEntityType: "booking" as const,
					parentEntityId: firstBooking.bookingId,
					parentEntityName: firstBooking.bookingName,
				}),
			});

			return {
				data: { id },
				message: "Expense deleted successfully",
			};
		});
	});
