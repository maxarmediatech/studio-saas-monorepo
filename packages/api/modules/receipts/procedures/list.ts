import {
	and,
	asc,
	bookingParticipants,
	bookings,
	count,
	db,
	desc,
	eq,
	gte,
	ilike,
	invoices,
	isNull,
	lte,
	receivedAmounts,
	receipts,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	listReceiptsInputSchema,
	listReceiptsOutputSchema,
	type ReceiptListItem,
} from "../../studio/schemas/receipt";

export const listReceipts = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/receipts",
		tags: ["Receipts"],
		summary: "List receipts",
		description: "List receipts with filtering, sorting, and pagination",
	})
	.input(listReceiptsInputSchema)
	.output(listReceiptsOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "list");

		const {
			page,
			limit,
			search,
			bookingId,
			clientId,
			invoiceId,
			paymentScheduleId,
			dateFrom,
			dateTo,
			amountMin,
			amountMax,
			sortBy,
			sortDirection,
			includeDeleted,
		} = input;

		const offset = (page - 1) * limit;

		const conditions = [
			eq(receipts.organizationId, context.organizationId),
		];

		if (!includeDeleted) {
			conditions.push(isNull(receipts.deletedAt));
		}

		if (bookingId) {
			conditions.push(eq(receipts.bookingId, bookingId));
		}

		if (invoiceId) {
			conditions.push(eq(receipts.invoiceId, invoiceId));
		}

		if (paymentScheduleId) {
			conditions.push(
				eq(receivedAmounts.paymentScheduleId, paymentScheduleId),
			);
		}

		if (clientId) {
			conditions.push(eq(bookingParticipants.clientId, clientId));
		}

		if (dateFrom) {
			conditions.push(gte(receipts.receiptDate, dateFrom));
		}

		if (dateTo) {
			conditions.push(lte(receipts.receiptDate, dateTo));
		}

		if (amountMin) {
			conditions.push(gte(receipts.amount, amountMin));
		}

		if (amountMax) {
			conditions.push(lte(receipts.amount, amountMax));
		}

		if (search) {
			conditions.push(
				sql`(${ilike(receipts.receiptNumber, `%${search}%`)} OR ${ilike(bookings.name, `%${search}%`)})`,
			);
		}

		const baseQuery = db
			.select({ count: count().mapWith(Number) })
			.from(receipts)
			.innerJoin(bookings, eq(receipts.bookingId, bookings.id))
			.leftJoin(invoices, eq(receipts.invoiceId, invoices.id))
			.leftJoin(
				receivedAmounts,
				and(
					eq(receipts.receivedAmountId, receivedAmounts.id),
					eq(receivedAmounts.organizationId, context.organizationId),
				),
			);

		const queryWithClientJoin = clientId
			? baseQuery.innerJoin(
					bookingParticipants,
					eq(bookings.id, bookingParticipants.bookingId),
				)
			: baseQuery;

		const [countResult] = await queryWithClientJoin.where(
			and(...conditions),
		);

		const total = countResult?.count ?? 0;

		const sortColumnMap = {
			receiptDate: receipts.receiptDate,
			amount: receipts.amount,
			receiptNumber: receipts.receiptNumber,
			createdAt: receipts.createdAt,
		};
		const sortColumn =
			sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
			receipts.receiptDate;

		const orderFn = sortDirection === "asc" ? asc : desc;

		const selectQuery = db
			.select({
				id: receipts.id,
				organizationId: receipts.organizationId,
				bookingId: receipts.bookingId,
				invoiceId: receipts.invoiceId,
				receivedAmountId: receipts.receivedAmountId,
				receiptNumber: receipts.receiptNumber,
				amount: receipts.amount,
				paymentMethod: receipts.paymentMethod,
				receiptDate: receipts.receiptDate,
				notes: receipts.notes,
				createdBy: receipts.createdBy,
				updatedBy: receipts.updatedBy,
				createdAt: receipts.createdAt,
				updatedAt: receipts.updatedAt,
				deletedAt: receipts.deletedAt,
				deletedBy: receipts.deletedBy,
				bookingName: bookings.name,
				bookingReferenceNumber: bookings.referenceNumber,
				invoiceNumber: invoices.invoiceNumber,
			})
			.from(receipts)
			.innerJoin(bookings, eq(receipts.bookingId, bookings.id))
			.leftJoin(invoices, eq(receipts.invoiceId, invoices.id))
			.leftJoin(
				receivedAmounts,
				and(
					eq(receipts.receivedAmountId, receivedAmounts.id),
					eq(receivedAmounts.organizationId, context.organizationId),
				),
			);

		const selectWithClientJoin = clientId
			? selectQuery.innerJoin(
					bookingParticipants,
					eq(bookings.id, bookingParticipants.bookingId),
				)
			: selectQuery;

		const rows = await selectWithClientJoin
			.where(and(...conditions))
			.orderBy(orderFn(sortColumn))
			.limit(limit)
			.offset(offset);

		const data: ReceiptListItem[] = rows.map((row) => ({
			id: row.id,
			organizationId: row.organizationId,
			bookingId: row.bookingId,
			invoiceId: row.invoiceId,
			receivedAmountId: row.receivedAmountId,
			receiptNumber: row.receiptNumber,
			amount: row.amount,
			paymentMethod: row.paymentMethod,
			receiptDate: row.receiptDate,
			notes: row.notes,
			createdBy: row.createdBy,
			updatedBy: row.updatedBy,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			deletedAt: row.deletedAt?.toISOString() ?? null,
			deletedBy: row.deletedBy,
			bookingName: row.bookingName,
			bookingReferenceNumber: row.bookingReferenceNumber,
			invoiceNumber: row.invoiceNumber ?? null,
		}));

		return {
			data,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
