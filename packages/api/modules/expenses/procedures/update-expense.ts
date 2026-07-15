import { ORPCError } from "@orpc/server";
import {
	and,
	db,
	eq,
	expenseAssignments,
	expenses,
	isNull,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	detectChanges,
	formatAmount,
	safeTrackFieldChanges,
} from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateExpenseInputSchema,
	updateExpenseOutputSchema,
} from "../../studio/schemas/expense";
import { refreshBookingExpenseTotalsForExpense } from "../lib/booking-expense-totals";
import { validateExpenseAllocations } from "../lib/expense-allocations";

export const updateExpense = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/expenses/{id}",
		tags: ["Expenses"],
		summary: "Update expense",
		description: "Update an existing expense",
	})
	.input(updateExpenseInputSchema)
	.output(updateExpenseOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "expense", "update");

		const { id, ...updates } = input;

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

		// Check if amount is changing
		const amountChanged =
			updates.amount !== undefined && updates.amount !== expense.amount;

		// Build update object
		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (updates.description !== undefined) {
			updateData.description = updates.description;
		}

		if (updates.amount !== undefined) {
			updateData.amount = updates.amount;
		}

		if (updates.category !== undefined) {
			updateData.category = updates.category;
		}

		if (updates.expenseDate !== undefined) {
			updateData.expenseDate = updates.expenseDate;
		}

		if (updates.billTo !== undefined) {
			updateData.billTo = updates.billTo;
		}

		if (updates.paymentMethod !== undefined) {
			updateData.paymentMethod = updates.paymentMethod;
		}

		if (updates.transactionReference !== undefined) {
			updateData.transactionReference = updates.transactionReference;
		}

		if (updates.vendor !== undefined) {
			updateData.vendor = updates.vendor;
		}

		if (updates.notes !== undefined) {
			updateData.notes = updates.notes;
		}

		if (updates.metadata !== undefined) {
			updateData.metadata = updates.metadata;
		}

		// If amount changed, need to update booking totals for assigned bookings
		if (amountChanged) {
			return await db.transaction(async (tx) => {
				const assignments = await tx
					.select({
						allocationPercentage:
							expenseAssignments.allocationPercentage,
						allocationAmount: expenseAssignments.allocationAmount,
					})
					.from(expenseAssignments)
					.where(eq(expenseAssignments.expenseId, id));
				if (assignments.length > 0) {
					validateExpenseAllocations(
						assignments,
						Number.parseFloat(updates.amount ?? expense.amount),
					);
				}

				// Update expense
				await tx
					.update(expenses)
					.set(updateData)
					.where(eq(expenses.id, id));

				await refreshBookingExpenseTotalsForExpense(
					tx,
					id,
					context.user.id,
				);

				// Track activity (non-blocking)
				const changes = detectChanges(expense, updates, [
					"description",
					"amount",
					"category",
					"vendor",
					"billTo",
				]);
				if (changes.length > 0) {
					// Format amount changes for readability
					const formattedChanges = changes.map((c) => {
						if (c.field === "amount") {
							return {
								...c,
								oldValue: c.oldValue
									? formatAmount(c.oldValue)
									: null,
								newValue: c.newValue
									? formatAmount(c.newValue)
									: null,
							};
						}
						return c;
					});
					await safeTrackFieldChanges(context, {
						entityType: "expense",
						entityId: id,
						entityName: expense.description,
						changes: formattedChanges,
					});
				}

				return {
					data: { id },
					message: "Expense updated successfully",
				};
			});
		}

		// Simple update without amount change
		await db.update(expenses).set(updateData).where(eq(expenses.id, id));

		// Track activity (non-blocking)
		const changes = detectChanges(expense, updates, [
			"description",
			"amount",
			"category",
			"vendor",
			"billTo",
		]);
		if (changes.length > 0) {
			// Format amount changes for readability
			const formattedChanges = changes.map((c) => {
				if (c.field === "amount") {
					return {
						...c,
						oldValue: c.oldValue ? formatAmount(c.oldValue) : null,
						newValue: c.newValue ? formatAmount(c.newValue) : null,
					};
				}
				return c;
			});
			await safeTrackFieldChanges(context, {
				entityType: "expense",
				entityId: id,
				entityName: expense.description,
				changes: formattedChanges,
			});
		}

		return {
			data: { id },
			message: "Expense updated successfully",
		};
	});
