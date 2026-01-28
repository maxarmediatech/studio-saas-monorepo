import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	invoices,
	isNull,
	receipts,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getReceiptInputSchema,
	getReceiptOutputSchema,
} from "../../studio/schemas/receipt";

export const getReceipt = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/receipts/{id}",
		tags: ["Receipts"],
		summary: "Get receipt",
		description: "Get detailed information about a specific receipt",
	})
	.input(getReceiptInputSchema)
	.output(getReceiptOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "read");

		const { id } = input;

		const result = await db
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
			})
			.from(receipts)
			.innerJoin(bookings, eq(receipts.bookingId, bookings.id))
			.where(
				and(
					eq(receipts.id, id),
					eq(receipts.organizationId, context.organizationId),
					isNull(receipts.deletedAt),
				),
			)
			.limit(1);

		const receipt = result[0];

		if (!receipt) {
			throw new ORPCError("NOT_FOUND", {
				message: "Receipt not found",
			});
		}

		let invoice = null;
		if (receipt.invoiceId) {
			const invoiceResult = await db
				.select({
					id: invoices.id,
					invoiceNumber: invoices.invoiceNumber,
					totalAmount: invoices.totalAmount,
				})
				.from(invoices)
				.where(eq(invoices.id, receipt.invoiceId))
				.limit(1);

			if (invoiceResult[0]) {
				invoice = {
					id: invoiceResult[0].id,
					invoiceNumber: invoiceResult[0].invoiceNumber,
					totalAmount: invoiceResult[0].totalAmount,
				};
			}
		}

		return {
			data: {
				id: receipt.id,
				organizationId: receipt.organizationId,
				bookingId: receipt.bookingId,
				invoiceId: receipt.invoiceId,
				receivedAmountId: receipt.receivedAmountId,
				receiptNumber: receipt.receiptNumber,
				amount: receipt.amount,
				paymentMethod: receipt.paymentMethod,
				receiptDate: receipt.receiptDate,
				notes: receipt.notes,
				createdBy: receipt.createdBy,
				updatedBy: receipt.updatedBy,
				createdAt: receipt.createdAt.toISOString(),
				updatedAt: receipt.updatedAt.toISOString(),
				deletedAt: receipt.deletedAt?.toISOString() ?? null,
				deletedBy: receipt.deletedBy,
				booking: {
					id: receipt.bookingId,
					name: receipt.bookingName,
					referenceNumber: receipt.bookingReferenceNumber,
				},
				invoice,
			},
		};
	});
