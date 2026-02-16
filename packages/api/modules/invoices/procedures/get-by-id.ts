import { ORPCError } from "@orpc/server";
import {
	and,
	bookingParticipants,
	bookings,
	clients,
	db,
	eq,
	invoiceLineItems,
	invoices,
	isNull,
	paymentSchedules,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getInvoiceInputSchema,
	getInvoiceOutputSchema,
} from "../../studio/schemas/invoice";

export const getInvoice = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/invoices/{id}",
		tags: ["Invoices"],
		summary: "Get invoice",
		description: "Get detailed information about a specific invoice",
	})
	.input(getInvoiceInputSchema)
	.output(getInvoiceOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "read");

		const { id } = input;

		const result = await db
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
				taxType: invoices.taxType,
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
			.innerJoin(bookings, eq(invoices.bookingId, bookings.id))
			.where(
				and(
					eq(invoices.id, id),
					eq(invoices.organizationId, context.organizationId),
					isNull(invoices.deletedAt),
				),
			)
			.limit(1);

		const invoice = result[0];

		if (!invoice) {
			throw new ORPCError("NOT_FOUND", {
				message: "Invoice not found",
			});
		}

		const lineItems = await db
			.select({
				id: invoiceLineItems.id,
				invoiceId: invoiceLineItems.invoiceId,
				type: invoiceLineItems.type,
				description: invoiceLineItems.description,
				quantity: invoiceLineItems.quantity,
				unitPrice: invoiceLineItems.unitPrice,
				amount: invoiceLineItems.amount,
				sortOrder: invoiceLineItems.sortOrder,
				createdAt: invoiceLineItems.createdAt,
				updatedAt: invoiceLineItems.updatedAt,
			})
			.from(invoiceLineItems)
			.where(eq(invoiceLineItems.invoiceId, id))
			.orderBy(invoiceLineItems.sortOrder);

		let schedule = null;
		if (invoice.paymentScheduleId) {
				const scheduleResult = await db
					.select({
						id: paymentSchedules.id,
						name: paymentSchedules.name,
						amount: paymentSchedules.amount,
						dueDate: paymentSchedules.dueDate,
					})
					.from(paymentSchedules)
					.where(
						and(
							eq(paymentSchedules.id, invoice.paymentScheduleId),
							eq(paymentSchedules.organizationId, context.organizationId),
							isNull(paymentSchedules.deletedAt),
						),
					)
					.limit(1);

			if (scheduleResult[0]) {
				schedule = {
					id: scheduleResult[0].id,
					name: scheduleResult[0].name,
					amount: scheduleResult[0].amount,
					dueDate: scheduleResult[0].dueDate,
				};
			}
		}

		const participant = await db
			.select({
				clientId: clients.id,
				clientName: clients.name,
				clientEmail: clients.email,
			})
			.from(bookingParticipants)
			.innerJoin(clients, eq(bookingParticipants.clientId, clients.id))
			.where(eq(bookingParticipants.bookingId, invoice.bookingId))
			.limit(1);

		const client = participant[0]
			? {
					id: participant[0].clientId,
					name: participant[0].clientName,
					email: participant[0].clientEmail,
				}
			: null;

		return {
			data: {
				id: invoice.id,
				organizationId: invoice.organizationId,
				bookingId: invoice.bookingId,
				invoiceNumber: invoice.invoiceNumber,
				status: invoice.status,
				issueDate: invoice.issueDate,
				dueDate: invoice.dueDate,
				paymentScheduleId: invoice.paymentScheduleId,
				subtotal: invoice.subtotal,
				taxAmount: invoice.taxAmount,
				discountAmount: invoice.discountAmount,
				taxType: invoice.taxType,
				totalAmount: invoice.totalAmount,
				paidAmount: invoice.paidAmount,
				notes: invoice.notes,
				terms: invoice.terms,
				sentAt: invoice.sentAt?.toISOString() ?? null,
				paidAt: invoice.paidAt?.toISOString() ?? null,
				createdBy: invoice.createdBy,
				updatedBy: invoice.updatedBy,
				createdAt: invoice.createdAt.toISOString(),
				updatedAt: invoice.updatedAt.toISOString(),
				deletedAt: invoice.deletedAt?.toISOString() ?? null,
				deletedBy: invoice.deletedBy,
				booking: {
					id: invoice.bookingId,
					name: invoice.bookingName,
					referenceNumber: invoice.bookingReferenceNumber,
				},
				client,
				lineItems: lineItems.map((item) => ({
					id: item.id,
					invoiceId: item.invoiceId,
					type: item.type,
					description: item.description,
					quantity: item.quantity,
					unitPrice: item.unitPrice,
					amount: item.amount,
					sortOrder: item.sortOrder,
					createdAt: item.createdAt.toISOString(),
					updatedAt: item.updatedAt.toISOString(),
				})),
				schedule,
			},
		};
	});
