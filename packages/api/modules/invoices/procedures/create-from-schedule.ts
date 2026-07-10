import { ORPCError } from "@orpc/server";
import { and, db, eq, isNull, paymentSchedules } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createInvoiceFromScheduleInputSchema,
	createInvoiceFromScheduleOutputSchema,
} from "../../studio/schemas/invoice";
import { createInvoiceFromScheduleTransition } from "../lib/create-from-schedule-service";

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

		const lockPlan = await db.query.paymentSchedules.findFirst({
			where: and(
				eq(paymentSchedules.id, input.paymentScheduleId),
				eq(paymentSchedules.organizationId, context.organizationId),
				isNull(paymentSchedules.deletedAt),
			),
			columns: { bookingId: true },
		});
		if (!lockPlan) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment schedule not found",
			});
		}

		const result = await db.transaction((tx) =>
			createInvoiceFromScheduleTransition(tx, {
				...input,
				organizationId: context.organizationId,
				userId: context.user.id,
				bookingId: lockPlan.bookingId,
			}),
		);

		await safeTrackActivity(context, {
			entityType: "invoice",
			entityId: result.id,
			entityName: `${result.invoiceNumber} (${formatAmount(result.totalAmount)})`,
			action: "created",
			parentEntityType: "booking",
			parentEntityId: result.schedule.bookingId,
			parentEntityName: result.bookingName,
			metadata: {
				invoiceNumber: result.invoiceNumber,
				totalAmount: result.totalAmount,
				fromSchedule: result.schedule.name,
			},
		});

		return {
			data: { id: result.id },
			message: "Invoice created from payment schedule successfully",
		};
	});
