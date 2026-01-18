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
	receivedAmounts,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { requirePermission } from "../../../studio/lib/permissions";
import { createPaginationResponse } from "../../../studio/schemas/common";
import {
	listReceivedInputSchema,
	listReceivedOutputSchema,
	type ReceivedAmountListItem,
} from "../../../studio/schemas/payment";

export const listReceived = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/studio-payments/received",
		tags: ["Studio Payments"],
		summary: "List received payments",
		description:
			"List received payments with filtering, sorting, and pagination",
	})
	.input(listReceivedInputSchema)
	.output(listReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "list");

		const {
			page,
			limit,
			search,
			bookingId,
			paymentMethod,
			dateFrom,
			dateTo,
			sortBy,
			sortDirection,
			includeDeleted,
		} = input;

		const offset = (page - 1) * limit;

		// Build conditions
		const conditions = [
			eq(receivedAmounts.organizationId, context.organizationId),
		];

		if (!includeDeleted) {
			conditions.push(isNull(receivedAmounts.deletedAt));
		}

		if (bookingId) {
			conditions.push(eq(receivedAmounts.bookingId, bookingId));
		}

		const paymentMethods = Array.isArray(paymentMethod)
			? paymentMethod
			: paymentMethod
				? [paymentMethod]
				: null;

		if (paymentMethods && paymentMethods.length > 0) {
			conditions.push(
				inArray(receivedAmounts.paymentMethod, paymentMethods),
			);
		}

		if (dateFrom) {
			conditions.push(gte(receivedAmounts.receivedDate, dateFrom));
		}

		if (dateTo) {
			conditions.push(sql`${receivedAmounts.receivedDate} <= ${dateTo}`);
		}

		if (search) {
			conditions.push(
				sql`(${ilike(bookings.name, `%${search}%`)} OR ${ilike(receivedAmounts.transactionReference, `%${search}%`)})`,
			);
		}

		// Get total count
		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(receivedAmounts)
			.innerJoin(bookings, eq(receivedAmounts.bookingId, bookings.id))
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Determine sort column
		const sortColumnMap = {
			receivedDate: receivedAmounts.receivedDate,
			amount: receivedAmounts.amount,
			paymentMethod: receivedAmounts.paymentMethod,
			createdAt: receivedAmounts.createdAt,
		};
		const sortColumn =
			sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
			receivedAmounts.receivedDate;

		const orderFn = sortDirection === "asc" ? asc : desc;

		// Get received amounts with booking info
		const rows = await db
			.select({
				id: receivedAmounts.id,
				organizationId: receivedAmounts.organizationId,
				bookingId: receivedAmounts.bookingId,
				amount: receivedAmounts.amount,
				paymentMethod: receivedAmounts.paymentMethod,
				transactionReference: receivedAmounts.transactionReference,
				receivedDate: receivedAmounts.receivedDate,
				notes: receivedAmounts.notes,
				proofAttachment: receivedAmounts.proofAttachment,
				paymentScheduleId: receivedAmounts.paymentScheduleId,
				createdBy: receivedAmounts.createdBy,
				updatedBy: receivedAmounts.updatedBy,
				createdAt: receivedAmounts.createdAt,
				updatedAt: receivedAmounts.updatedAt,
				deletedAt: receivedAmounts.deletedAt,
				deletedBy: receivedAmounts.deletedBy,
				bookingName: bookings.name,
				bookingReferenceNumber: bookings.referenceNumber,
			})
			.from(receivedAmounts)
			.innerJoin(bookings, eq(receivedAmounts.bookingId, bookings.id))
			.where(and(...conditions))
			.orderBy(orderFn(sortColumn))
			.limit(limit)
			.offset(offset);

		// Get schedule names for those with paymentScheduleId
		const scheduleIds = rows
			.filter((r) => r.paymentScheduleId)
			.map((r) => r.paymentScheduleId as string);

		let scheduleNames: Record<string, string> = {};
		if (scheduleIds.length > 0) {
			const schedules = await db
				.select({
					id: paymentSchedules.id,
					name: paymentSchedules.name,
				})
				.from(paymentSchedules)
				.where(
					sql`${paymentSchedules.id} IN (${sql.join(
						scheduleIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				);

			scheduleNames = Object.fromEntries(
				schedules.map((s) => [s.id, s.name]),
			);
		}

		// Format response
		const data: ReceivedAmountListItem[] = rows.map((row) => ({
			id: row.id,
			organizationId: row.organizationId,
			bookingId: row.bookingId,
			amount: row.amount,
			paymentMethod: row.paymentMethod,
			transactionReference: row.transactionReference,
			receivedDate: row.receivedDate,
			notes: row.notes,
			proofAttachment: row.proofAttachment as {
				name: string;
				size: number;
				type: string;
				key: string;
				url: string;
			} | null,
			paymentScheduleId: row.paymentScheduleId,
			createdBy: row.createdBy,
			updatedBy: row.updatedBy,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			deletedAt: row.deletedAt?.toISOString() ?? null,
			deletedBy: row.deletedBy,
			bookingName: row.bookingName,
			bookingReferenceNumber: row.bookingReferenceNumber,
			scheduleName: row.paymentScheduleId
				? (scheduleNames[row.paymentScheduleId] ?? null)
				: null,
		}));

		return {
			data,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
