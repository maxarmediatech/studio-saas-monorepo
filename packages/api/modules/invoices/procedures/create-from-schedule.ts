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
import { centsToMoney, moneyToCents } from "../../studio/lib/money";
import {
	createInvoiceFromScheduleInputSchema,
	createInvoiceFromScheduleOutputSchema,
} from "../../studio/schemas/invoice";
import {
	calculateGst,
	generateInvoiceNumber,
	getGstConfig,
	type TaxType,
} from "../lib/invoice-helpers";

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

		const { paymentScheduleId, issueDate, dueDate, notes, terms, taxType: inputTaxType } = input;

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

		if (
			schedule.status === "partial" ||
			schedule.status === "completed" ||
			schedule.status === "cancelled"
		) {
			throw new ORPCError("CONFLICT", {
				message:
					"Invoices cannot be generated from partially paid, completed, or cancelled schedules",
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

			const subtotalCents = moneyToCents(schedule.amount);

			// Resolve tax type: use input value or fall back to org default
			let taxType: TaxType = "exclusive";
			if (inputTaxType) {
				taxType = inputTaxType;
			} else {
				const gstConfig = await getGstConfig(context.organizationId);
				taxType = gstConfig.defaultTaxType;
			}

			const { taxAmount, totalAmount } = await calculateGst(
				centsToMoney(subtotalCents),
				context.organizationId,
				"0.00",
				taxType,
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
						subtotal: centsToMoney(subtotalCents),
						taxAmount,
						discountAmount: "0.00",
						taxType,
						totalAmount,
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

				const scheduleAmount = centsToMoney(moneyToCents(schedule.amount));
				await tx.insert(invoiceLineItems).values({
					invoiceId: created.id,
					description: schedule.name,
					quantity: "1",
					unitPrice: scheduleAmount,
					amount: scheduleAmount,
					sortOrder: 0,
				});

				await safeTrackActivity(context, {
					entityType: "invoice",
					entityId: created.id,
					entityName: `${invoiceNumber} (${formatAmount(totalAmount)})`,
					action: "created",
					parentEntityType: "booking",
					parentEntityId: schedule.bookingId,
					parentEntityName: booking.name,
					metadata: {
						invoiceNumber,
						totalAmount,
						fromSchedule: schedule.name,
					},
				});

			return {
				data: { id: created.id },
				message: "Invoice created from payment schedule successfully",
			};
		});
	});
