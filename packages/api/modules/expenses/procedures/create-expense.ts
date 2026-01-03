import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	crews,
	db,
	eq,
	expenseAssignments,
	expenses,
	isNull,
	shoots,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createExpenseInputSchema,
	createExpenseOutputSchema,
} from "../../studio/schemas/expense";
import {
	getAllocatedExpenseAmount,
	validateExpenseAllocations,
} from "../lib/expense-allocations";

export const createExpense = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/expenses",
		tags: ["Expenses"],
		summary: "Create expense",
		description: "Record a new expense with optional assignments",
	})
	.input(createExpenseInputSchema)
	.output(createExpenseOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "expense", "create");

		const {
			description,
			amount,
			category,
			expenseDate,
			billTo,
			paymentMethod,
			transactionReference,
			vendor,
			notes,
			metadata,
			assignments,
		} = input;

		const amountValue = Number.parseFloat(amount);
		const allocationMode =
			assignments && assignments.length > 0
				? validateExpenseAllocations(assignments, amountValue)
				: "none";

		// Validate assignments if provided
		if (assignments && assignments.length > 0) {
			for (const assignment of assignments) {
				if (assignment.bookingId) {
					const booking = await db.query.bookings.findFirst({
						where: and(
							eq(bookings.id, assignment.bookingId),
							eq(bookings.organizationId, context.organizationId),
							isNull(bookings.deletedAt),
						),
					});
					if (!booking) {
						throw new ORPCError("NOT_FOUND", {
							message: `Booking not found: ${assignment.bookingId}`,
						});
					}
				}

				if (assignment.shootId) {
					const shoot = await db.query.shoots.findFirst({
						where: and(
							eq(shoots.id, assignment.shootId),
							eq(shoots.organizationId, context.organizationId),
							isNull(shoots.deletedAt),
						),
					});
					if (!shoot) {
						throw new ORPCError("NOT_FOUND", {
							message: `Shoot not found: ${assignment.shootId}`,
						});
					}
				}

				if (assignment.crewId) {
					const crew = await db.query.crews.findFirst({
						where: and(
							eq(crews.id, assignment.crewId),
							eq(crews.organizationId, context.organizationId),
							isNull(crews.deletedAt),
						),
					});
					if (!crew) {
						throw new ORPCError("NOT_FOUND", {
							message: `Crew member not found: ${assignment.crewId}`,
						});
					}
				}
			}
		}

		// Use transaction if assignments are provided
		if (assignments && assignments.length > 0) {
			return await db.transaction(async (tx) => {
				// Create expense
				const [created] = await tx
					.insert(expenses)
					.values({
						organizationId: context.organizationId,
						description,
						amount,
						category: category ?? null,
						expenseDate,
						billTo: billTo ?? "studio",
						paymentMethod: paymentMethod ?? null,
						transactionReference: transactionReference ?? null,
						vendor: vendor ?? null,
						notes: notes ?? null,
						metadata: metadata ?? null,
						createdBy: context.user.id,
						updatedBy: context.user.id,
					})
					.returning({ id: expenses.id });

				if (!created) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to create expense",
					});
				}

				// Create assignments
				await tx.insert(expenseAssignments).values(
					assignments.map((a) => ({
						expenseId: created.id,
						bookingId: a.bookingId ?? null,
						shootId: a.shootId ?? null,
						crewId: a.crewId ?? null,
						allocationPercentage: a.allocationPercentage ?? null,
						allocationAmount: a.allocationAmount ?? null,
					})),
				);

				// Update booking total expenses if assigned to bookings
				const bookingAssignments = assignments.filter(
					(a) => a.bookingId,
				);
				for (const assignment of bookingAssignments) {
					const allocatedAmount = getAllocatedExpenseAmount(
						amountValue,
						assignment,
						allocationMode,
					);

					await tx
						.update(bookings)
						.set({
							totalExpenses: sql`${bookings.totalExpenses} + ${allocatedAmount.toFixed(2)}`,
							updatedAt: new Date(),
							updatedBy: context.user.id,
						})
						.where(eq(bookings.id, assignment.bookingId!));
				}

				return {
					data: { id: created.id },
					message: "Expense created successfully",
				};
			});
		}

		// Simple create without assignments
		const [created] = await db
			.insert(expenses)
			.values({
				organizationId: context.organizationId,
				description,
				amount,
				category: category ?? null,
				expenseDate,
				billTo: billTo ?? "studio",
				paymentMethod: paymentMethod ?? null,
				transactionReference: transactionReference ?? null,
				vendor: vendor ?? null,
				notes: notes ?? null,
				metadata: metadata ?? null,
				createdBy: context.user.id,
				updatedBy: context.user.id,
			})
			.returning({ id: expenses.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create expense",
			});
		}

		return {
			data: { id: created.id },
			message: "Expense created successfully",
		};
	});
