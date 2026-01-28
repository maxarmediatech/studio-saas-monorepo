import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	invoiceLineItems,
	invoices,
	isNull,
	paymentSchedules,
} from "@repo/database";
import { format } from "date-fns";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createInvoiceFromScheduleInputSchema,
	createInvoiceFromScheduleOutputSchema,
} from "../../studio/schemas/invoice";
import { calculateGst, generateInvoiceNumber } from "../lib/invoice-helpers";

export const createInvoiceFromSchedule = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/invoices/from-schedule",
		tags: ["Invoices"],
		summary: "Create invoice from payment schedule",
		description:
			"Generate an invoice from an existing payment schedule milestone",
	})
	.input(createInvoiceFromScheduleInputSchema)
	.output(createInvoiceFromScheduleOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "create");

		const { paymentScheduleId, issueDate, dueDate, notes, terms } = input;

		const schedule = await db.query.paymentSchedules.findFirst({
			where: and(
				eq(paymentSchedules.id, paymentScheduleId),
				eq(paymentSchedules.organizationId, context.organizationId),
				isNull(paymentSchedules.deletedAt),
			),
		});

		if (!schedule) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment schedule not found",
			});
		}

		const existingInvoice = await db.query.invoices.findFirst({
			where: and(
				eq(invoices.paymentScheduleId, paymentScheduleId),
				eq(invoices.organizationId, context.organizationId),
				isNull(invoices.deletedAt),
			),
			columns: { id: true, invoiceNumber: true },
		});

		if (existingInvoice) {
			throw new ORPCError("CONFLICT", {
				message: `An invoice (${existingInvoice.invoiceNumber}) already exists for this payment schedule`,
			});
		}

		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, schedule.bookingId),
				eq(bookings.organizationId, context.organizationId),
			),
			columns: { id: true, name: true },
		});

		if (!booking) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		const subtotal = Number.parseFloat(schedule.amount);
		const { taxAmount, totalAmount } = await calculateGst(
			subtotal,
			context.organizationId,
			0,
		);

		return await db.transaction(async (tx) => {
			const invoiceNumber = await generateInvoiceNumber(
				schedule.bookingId,
				context.organizationId,
			);

			const finalIssueDate =
				issueDate ?? format(new Date(), "yyyy-MM-dd");
			const finalDueDate = dueDate ?? schedule.dueDate;

			const [created] = await tx
				.insert(invoices)
				.values({
					organizationId: context.organizationId,
					bookingId: schedule.bookingId,
					paymentScheduleId,
					invoiceNumber,
					status: "draft",
					issueDate: finalIssueDate,
					dueDate: finalDueDate,
					subtotal: subtotal.toFixed(2),
					taxAmount: taxAmount.toFixed(2),
					discountAmount: "0.00",
					totalAmount: totalAmount.toFixed(2),
					paidAmount: "0.00",
					notes: notes ?? null,
					terms: terms ?? null,
					createdBy: context.user.id,
					updatedBy: context.user.id,
				})
				.returning({ id: invoices.id });

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create invoice",
				});
			}

			await tx.insert(invoiceLineItems).values({
				invoiceId: created.id,
				description: schedule.name,
				quantity: "1",
				unitPrice: schedule.amount,
				amount: schedule.amount,
				sortOrder: 0,
			});

			await safeTrackActivity(context, {
				entityType: "invoice",
				entityId: created.id,
				entityName: `${invoiceNumber} (${formatAmount(totalAmount.toFixed(2))})`,
				action: "created",
				parentEntityType: "booking",
				parentEntityId: schedule.bookingId,
				parentEntityName: booking.name,
				metadata: {
					invoiceNumber,
					totalAmount: totalAmount.toFixed(2),
					fromSchedule: schedule.name,
				},
			});

			return {
				data: { id: created.id },
				message: "Invoice created from payment schedule successfully",
			};
		});
	});
