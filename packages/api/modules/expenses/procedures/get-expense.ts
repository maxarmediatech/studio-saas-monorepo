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
	type ExpenseAssignmentWithDetails,
	getExpenseInputSchema,
	getExpenseOutputSchema,
} from "../../studio/schemas/expense";

export const getExpense = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/expenses/{id}",
		tags: ["Expenses"],
		summary: "Get expense",
		description: "Get detailed information about a specific expense",
	})
	.input(getExpenseInputSchema)
	.output(getExpenseOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "expense", "read");

		const { id } = input;

		// Get expense
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

		// Get assignments with related entity details
		const assignmentRows = await db
			.select({
				id: expenseAssignments.id,
				expenseId: expenseAssignments.expenseId,
				bookingId: expenseAssignments.bookingId,
				shootId: expenseAssignments.shootId,
				crewId: expenseAssignments.crewId,
				allocationPercentage: expenseAssignments.allocationPercentage,
				allocationAmount: expenseAssignments.allocationAmount,
				createdAt: expenseAssignments.createdAt,
			})
			.from(expenseAssignments)
			.where(eq(expenseAssignments.expenseId, id));

		// Fetch related entity names
		const bookingIds = assignmentRows
			.filter((a) => a.bookingId)
			.map((a) => a.bookingId as string);
		const shootIds = assignmentRows
			.filter((a) => a.shootId)
			.map((a) => a.shootId as string);
		const crewIds = assignmentRows
			.filter((a) => a.crewId)
			.map((a) => a.crewId as string);

		let bookingMap: Record<
			string,
			{ name: string; referenceNumber: string }
		> = {};
		let shootMap: Record<
			string,
			{ name: string | null; bookingId: string | null }
		> = {};
		let crewMap: Record<string, string> = {};

		if (bookingIds.length > 0) {
			const bookingRows = await db
				.select({
					id: bookings.id,
					name: bookings.name,
					referenceNumber: bookings.referenceNumber,
				})
				.from(bookings)
				.where(
					and(
						eq(bookings.organizationId, context.organizationId),
						isNull(bookings.deletedAt),
					),
				);

			bookingMap = Object.fromEntries(
				bookingRows.map((b) => [
					b.id,
					{ name: b.name, referenceNumber: b.referenceNumber },
				]),
			);
		}

		if (shootIds.length > 0) {
			const shootRows = await db
				.select({
					id: shoots.id,
					name: shoots.name,
					bookingId: shoots.bookingId,
				})
				.from(shoots)
				.where(
					and(
						eq(shoots.organizationId, context.organizationId),
						isNull(shoots.deletedAt),
					),
				);

			shootMap = Object.fromEntries(
				shootRows.map((s) => [
					s.id,
					{ name: s.name, bookingId: s.bookingId },
				]),
			);

			const missingBookingIds = shootRows
				.map((s) => s.bookingId)
				.filter((id): id is string => id !== null && !bookingMap[id]);

			if (missingBookingIds.length > 0) {
				const additionalBookings = await db
					.select({
						id: bookings.id,
						name: bookings.name,
						referenceNumber: bookings.referenceNumber,
					})
					.from(bookings)
					.where(
						and(
							sql`${bookings.id} IN ${missingBookingIds}`,
							eq(bookings.organizationId, context.organizationId),
							isNull(bookings.deletedAt),
						),
					);

				for (const b of additionalBookings) {
					bookingMap[b.id] = {
						name: b.name,
						referenceNumber: b.referenceNumber,
					};
				}
			}
		}

		if (crewIds.length > 0) {
			const crewRows = await db
				.select({
					id: crews.id,
					name: crews.name,
				})
				.from(crews)
				.where(
					and(
						eq(crews.organizationId, context.organizationId),
						isNull(crews.deletedAt),
					),
				);

			crewMap = Object.fromEntries(crewRows.map((c) => [c.id, c.name]));
		}

		const assignments: ExpenseAssignmentWithDetails[] = assignmentRows.map(
			(row) => {
				const shootData = row.shootId ? shootMap[row.shootId] : null;
				const shootName = shootData?.name ?? null;
				const shootBookingId = shootData?.bookingId ?? null;
				const bookingIdForRow = row.bookingId ?? shootBookingId;
				const booking = bookingIdForRow
					? bookingMap[bookingIdForRow]
					: null;

				return {
					id: row.id,
					expenseId: row.expenseId,
					bookingId: bookingIdForRow,
					shootId: row.shootId,
					crewId: row.crewId,
					allocationPercentage: row.allocationPercentage,
					allocationAmount: row.allocationAmount,
					createdAt: row.createdAt.toISOString(),
					bookingName: booking?.name ?? null,
					bookingReferenceNumber: booking?.referenceNumber ?? null,
					shootName: shootName,
					crewName: row.crewId ? (crewMap[row.crewId] ?? null) : null,
				};
			},
		);

		return {
			data: {
				id: expense.id,
				organizationId: expense.organizationId,
				description: expense.description,
				amount: expense.amount,
				category: expense.category,
				expenseDate: expense.expenseDate,
				billTo: expense.billTo,
				paymentMethod: expense.paymentMethod,
				transactionReference: expense.transactionReference,
				vendor: expense.vendor,
				notes: expense.notes,
				metadata: expense.metadata as Record<string, unknown> | null,
				createdBy: expense.createdBy,
				updatedBy: expense.updatedBy,
				createdAt: expense.createdAt.toISOString(),
				updatedAt: expense.updatedAt.toISOString(),
				deletedAt: expense.deletedAt?.toISOString() ?? null,
				deletedBy: expense.deletedBy,
				assignments,
			},
		};
	});
