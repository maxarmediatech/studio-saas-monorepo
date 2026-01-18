import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	expenseAssignments,
	expenses,
	isNull,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
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

		const amount = Number.parseFloat(expense.amount);

		// Get booking assignments to update totals (also get booking name for activity context)
		const assignments = await db
			.select({
				bookingId: expenseAssignments.bookingId,
				bookingName: bookings.name,
				allocationPercentage: expenseAssignments.allocationPercentage,
				allocationAmount: expenseAssignments.allocationAmount,
			})
			.from(expenseAssignments)
			.leftJoin(bookings, eq(expenseAssignments.bookingId, bookings.id))
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
				if (!assignment.bookingId) {
					continue;
				}

				const allocated = assignment.allocationAmount
					? Number.parseFloat(assignment.allocationAmount)
					: assignment.allocationPercentage
						? (amount *
								Number.parseFloat(
									assignment.allocationPercentage,
								)) /
							100
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

			// Track activity (non-blocking) - use first booking as parent context if available
			const firstBooking = assignments.find(
				(a): a is typeof a & { bookingId: string; bookingName: string } =>
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
