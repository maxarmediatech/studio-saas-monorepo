import {
	and,
	asc,
	bookings,
	count,
	db,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNull,
	paymentSchedules,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { requirePermission } from "../../../studio/lib/permissions";
import { createPaginationResponse } from "../../../studio/schemas/common";
import {
	listSchedulesInputSchema,
	listSchedulesOutputSchema,
	type PaymentScheduleListItem,
} from "../../../studio/schemas/payment";

export const listSchedules = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/studio-payments/schedules",
		tags: ["Studio Payments"],
		summary: "List payment schedules",
		description:
			"List payment schedules with filtering, sorting, and pagination",
	})
	.input(listSchedulesInputSchema)
	.output(listSchedulesOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "list");

		const {
			page,
			limit,
			search,
			bookingId,
			status,
			dueDateFrom,
			dueDateTo,
			sortBy,
			sortDirection,
			includeDeleted,
		} = input;

		const offset = (page - 1) * limit;

		// Build conditions
		const conditions = [
			eq(paymentSchedules.organizationId, context.organizationId),
		];

		if (!includeDeleted) {
			conditions.push(isNull(paymentSchedules.deletedAt));
		}

		if (bookingId) {
			conditions.push(eq(paymentSchedules.bookingId, bookingId));
		}

		if (status) {
			if (Array.isArray(status) && status.length > 0) {
				conditions.push(inArray(paymentSchedules.status, status));
			} else if (!Array.isArray(status)) {
				conditions.push(eq(paymentSchedules.status, status));
			}
		}

		if (dueDateFrom) {
			conditions.push(gte(paymentSchedules.dueDate, dueDateFrom));
		}

		if (dueDateTo) {
			conditions.push(sql`${paymentSchedules.dueDate} <= ${dueDateTo}`);
		}

		if (search) {
			conditions.push(
				sql`(${ilike(paymentSchedules.name, `%${search}%`)} OR ${ilike(bookings.name, `%${search}%`)})`,
			);
		}

		// Get total count
		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(paymentSchedules)
			.innerJoin(bookings, eq(paymentSchedules.bookingId, bookings.id))
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Determine sort column
		const sortColumnMap = {
			dueDate: paymentSchedules.dueDate,
			amount: paymentSchedules.amount,
			status: paymentSchedules.status,
			sortOrder: paymentSchedules.sortOrder,
			createdAt: paymentSchedules.createdAt,
		};
		const sortColumn =
			sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
			paymentSchedules.dueDate;

		const orderFn = sortDirection === "asc" ? asc : desc;

		// Get schedules with booking info
		const rows = await db
			.select({
				id: paymentSchedules.id,
				organizationId: paymentSchedules.organizationId,
				bookingId: paymentSchedules.bookingId,
				name: paymentSchedules.name,
				amount: paymentSchedules.amount,
				dueDate: paymentSchedules.dueDate,
				status: paymentSchedules.status,
				paidAmount: paymentSchedules.paidAmount,
				paidAt: paymentSchedules.paidAt,
				notes: paymentSchedules.notes,
				sortOrder: paymentSchedules.sortOrder,
				createdBy: paymentSchedules.createdBy,
				updatedBy: paymentSchedules.updatedBy,
				createdAt: paymentSchedules.createdAt,
				updatedAt: paymentSchedules.updatedAt,
				deletedAt: paymentSchedules.deletedAt,
				deletedBy: paymentSchedules.deletedBy,
				bookingName: bookings.name,
				bookingReferenceNumber: bookings.referenceNumber,
			})
			.from(paymentSchedules)
			.innerJoin(bookings, eq(paymentSchedules.bookingId, bookings.id))
			.where(and(...conditions))
			.orderBy(orderFn(sortColumn))
			.limit(limit)
			.offset(offset);

		// Format response
		const data: PaymentScheduleListItem[] = rows.map((row) => ({
			id: row.id,
			organizationId: row.organizationId,
			bookingId: row.bookingId,
			name: row.name,
			amount: row.amount,
			dueDate: row.dueDate,
			status: row.status,
			paidAmount: row.paidAmount,
			paidAt: row.paidAt?.toISOString() ?? null,
			notes: row.notes,
			sortOrder: row.sortOrder,
			createdBy: row.createdBy,
			updatedBy: row.updatedBy,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			deletedAt: row.deletedAt?.toISOString() ?? null,
			deletedBy: row.deletedBy,
			bookingName: row.bookingName,
			bookingReferenceNumber: row.bookingReferenceNumber,
		}));

		return {
			data,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
