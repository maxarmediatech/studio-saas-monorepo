import {
	and,
	asc,
	count,
	db,
	desc,
	eq,
	expenseAssignments,
	expenses,
	gte,
	ilike,
	isNull,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	type ExpenseListItem,
	listExpensesInputSchema,
	listExpensesOutputSchema,
} from "../../studio/schemas/expense";

export const listExpenses = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/expenses",
		tags: ["Expenses"],
		summary: "List expenses",
		description: "List expenses with filtering, sorting, and pagination",
	})
	.input(listExpensesInputSchema)
	.output(listExpensesOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "expense", "list");

		const {
			page,
			limit,
			search,
			category,
			billTo,
			paymentMethod,
			dateFrom,
			dateTo,
			bookingId,
			shootId,
			crewId,
			sortBy,
			sortDirection,
			includeDeleted,
		} = input;

		const offset = (page - 1) * limit;

		// Build conditions
		const conditions = [
			eq(expenses.organizationId, context.organizationId),
		];

		if (!includeDeleted) {
			conditions.push(isNull(expenses.deletedAt));
		}

		if (category) {
			conditions.push(eq(expenses.category, category));
		}

		if (billTo) {
			conditions.push(eq(expenses.billTo, billTo));
		}

		if (paymentMethod) {
			conditions.push(eq(expenses.paymentMethod, paymentMethod));
		}

		if (dateFrom) {
			conditions.push(gte(expenses.expenseDate, dateFrom));
		}

		if (dateTo) {
			conditions.push(sql`${expenses.expenseDate} <= ${dateTo}`);
		}

		if (search) {
			conditions.push(
				sql`(${ilike(expenses.description, `%${search}%`)} OR ${ilike(expenses.vendor, `%${search}%`)})`,
			);
		}

		// Filter by assignment target
		if (bookingId || shootId || crewId) {
			const assignedExpenseIds = db
				.select({ expenseId: expenseAssignments.expenseId })
				.from(expenseAssignments)
				.where(
					and(
						bookingId
							? eq(expenseAssignments.bookingId, bookingId)
							: undefined,
						shootId
							? eq(expenseAssignments.shootId, shootId)
							: undefined,
						crewId
							? eq(expenseAssignments.crewId, crewId)
							: undefined,
					),
				);

			conditions.push(sql`${expenses.id} IN ${assignedExpenseIds}`);
		}

		// Get total count
		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(expenses)
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Determine sort column
		const sortColumnMap = {
			expenseDate: expenses.expenseDate,
			amount: expenses.amount,
			category: expenses.category,
			billTo: expenses.billTo,
			vendor: expenses.vendor,
			createdAt: expenses.createdAt,
		};
		const sortColumn =
			sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
			expenses.expenseDate;

		const orderFn = sortDirection === "asc" ? asc : desc;

		// Get expenses
		const rows = await db
			.select({
				id: expenses.id,
				organizationId: expenses.organizationId,
				description: expenses.description,
				amount: expenses.amount,
				category: expenses.category,
				expenseDate: expenses.expenseDate,
				billTo: expenses.billTo,
				paymentMethod: expenses.paymentMethod,
				transactionReference: expenses.transactionReference,
				vendor: expenses.vendor,
				notes: expenses.notes,
				metadata: expenses.metadata,
				createdBy: expenses.createdBy,
				updatedBy: expenses.updatedBy,
				createdAt: expenses.createdAt,
				updatedAt: expenses.updatedAt,
				deletedAt: expenses.deletedAt,
				deletedBy: expenses.deletedBy,
			})
			.from(expenses)
			.where(and(...conditions))
			.orderBy(orderFn(sortColumn))
			.limit(limit)
			.offset(offset);

		// Get assignment counts
		const expenseIds = rows.map((r) => r.id);
		let assignmentCounts: Record<string, number> = {};

		if (expenseIds.length > 0) {
			const counts = await db
				.select({
					expenseId: expenseAssignments.expenseId,
					count: count().mapWith(Number),
				})
				.from(expenseAssignments)
				.where(
					sql`${expenseAssignments.expenseId} IN (${sql.join(
						expenseIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				)
				.groupBy(expenseAssignments.expenseId);

			assignmentCounts = Object.fromEntries(
				counts.map((c) => [c.expenseId, c.count]),
			);
		}

		// Format response
		const data: ExpenseListItem[] = rows.map((row) => ({
			id: row.id,
			organizationId: row.organizationId,
			description: row.description,
			amount: row.amount,
			category: row.category,
			expenseDate: row.expenseDate,
			billTo: row.billTo,
			paymentMethod: row.paymentMethod,
			transactionReference: row.transactionReference,
			vendor: row.vendor,
			notes: row.notes,
			metadata: row.metadata as Record<string, unknown> | null,
			createdBy: row.createdBy,
			updatedBy: row.updatedBy,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			deletedAt: row.deletedAt?.toISOString() ?? null,
			deletedBy: row.deletedBy,
			assignmentsCount: assignmentCounts[row.id] ?? 0,
		}));

		return {
			data,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
