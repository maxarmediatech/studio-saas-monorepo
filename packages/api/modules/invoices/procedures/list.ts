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
	inArray,
	invoices,
	isNull,
	lte,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	type InvoiceListItem,
	listInvoicesInputSchema,
	listInvoicesOutputSchema,
} from "../../studio/schemas/invoice";

export const listInvoices = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/invoices",
		tags: ["Invoices"],
		summary: "List invoices",
		description: "List invoices with filtering, sorting, and pagination",
	})
	.input(listInvoicesInputSchema)
	.output(listInvoicesOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "list");

		const {
			page,
			limit,
			search,
			bookingId,
			clientId,
			status,
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
			eq(invoices.organizationId, context.organizationId),
		];

		if (!includeDeleted) {
			conditions.push(isNull(invoices.deletedAt));
		}

		if (bookingId) {
			conditions.push(eq(invoices.bookingId, bookingId));
		}

		if (clientId) {
			conditions.push(eq(bookingParticipants.clientId, clientId));
		}

		const statuses = Array.isArray(status)
			? status
			: status
				? [status]
				: null;

		if (statuses && statuses.length > 0) {
			conditions.push(inArray(invoices.status, statuses));
		}

		if (dateFrom) {
			conditions.push(gte(invoices.issueDate, dateFrom));
		}

		if (dateTo) {
			conditions.push(lte(invoices.issueDate, dateTo));
		}

		if (amountMin) {
			conditions.push(gte(invoices.totalAmount, amountMin));
		}

		if (amountMax) {
			conditions.push(lte(invoices.totalAmount, amountMax));
		}

		if (search) {
			conditions.push(
				sql`(${ilike(invoices.invoiceNumber, `%${search}%`)} OR ${ilike(bookings.name, `%${search}%`)})`,
			);
		}

		const baseQuery = db
			.select({ count: count().mapWith(Number) })
			.from(invoices)
			.innerJoin(bookings, eq(invoices.bookingId, bookings.id));

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
			issueDate: invoices.issueDate,
			dueDate: invoices.dueDate,
			totalAmount: invoices.totalAmount,
			status: invoices.status,
			invoiceNumber: invoices.invoiceNumber,
			createdAt: invoices.createdAt,
		};
		const sortColumn =
			sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
			invoices.issueDate;

		const orderFn = sortDirection === "asc" ? asc : desc;

		const selectQuery = db
			.select({
				id: invoices.id,
				organizationId: invoices.organizationId,
				bookingId: invoices.bookingId,
				invoiceNumber: invoices.invoiceNumber,
				status: invoices.status,
				issueDate: invoices.issueDate,
				dueDate: invoices.dueDate,
				paymentScheduleId: invoices.paymentScheduleId,
				subtotal: invoices.subtotal,
				taxAmount: invoices.taxAmount,
				discountAmount: invoices.discountAmount,
				totalAmount: invoices.totalAmount,
				paidAmount: invoices.paidAmount,
				notes: invoices.notes,
				terms: invoices.terms,
				sentAt: invoices.sentAt,
				paidAt: invoices.paidAt,
				createdBy: invoices.createdBy,
				updatedBy: invoices.updatedBy,
				createdAt: invoices.createdAt,
				updatedAt: invoices.updatedAt,
				deletedAt: invoices.deletedAt,
				deletedBy: invoices.deletedBy,
				bookingName: bookings.name,
				bookingReferenceNumber: bookings.referenceNumber,
			})
			.from(invoices)
			.innerJoin(bookings, eq(invoices.bookingId, bookings.id));

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

		const data: InvoiceListItem[] = rows.map((row) => ({
			id: row.id,
			organizationId: row.organizationId,
			bookingId: row.bookingId,
			invoiceNumber: row.invoiceNumber,
			status: row.status,
			issueDate: row.issueDate,
			dueDate: row.dueDate,
			paymentScheduleId: row.paymentScheduleId,
			subtotal: row.subtotal,
			taxAmount: row.taxAmount,
			discountAmount: row.discountAmount,
			totalAmount: row.totalAmount,
			paidAmount: row.paidAmount,
			notes: row.notes,
			terms: row.terms,
			sentAt: row.sentAt?.toISOString() ?? null,
			paidAt: row.paidAt?.toISOString() ?? null,
			createdBy: row.createdBy,
			updatedBy: row.updatedBy,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			deletedAt: row.deletedAt?.toISOString() ?? null,
			deletedBy: row.deletedBy,
			bookingName: row.bookingName,
			bookingReferenceNumber: row.bookingReferenceNumber,
			clientName: null,
		}));

		return {
			data,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
