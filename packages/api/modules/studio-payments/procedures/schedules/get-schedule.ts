import { ORPCError } from "@orpc/server";
import {
	and,
	eq,
	isNull,
	paymentSchedules,
	receivedAmounts,
	bookings,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	getScheduleInputSchema,
	getScheduleOutputSchema,
} from "../../../studio/schemas/payment";

export const getSchedule = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/studio-payments/schedules/{id}",
		tags: ["Studio Payments"],
		summary: "Get payment schedule",
		description: "Get detailed information about a specific payment schedule",
	})
	.input(getScheduleInputSchema)
	.output(getScheduleOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "payment", "read");

		const { id } = input;

		// Get schedule with booking info
		const result = await db
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
			.where(
				and(
					eq(paymentSchedules.id, id),
					eq(paymentSchedules.organizationId, context.organizationId),
					isNull(paymentSchedules.deletedAt),
				),
			)
			.limit(1);

		const schedule = result[0];

		if (!schedule) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment schedule not found",
			});
		}

		// Get linked payments
		const linkedPayments = await db
			.select({
				id: receivedAmounts.id,
				amount: receivedAmounts.amount,
				receivedDate: receivedAmounts.receivedDate,
				paymentMethod: receivedAmounts.paymentMethod,
			})
			.from(receivedAmounts)
			.where(
				and(
					eq(receivedAmounts.paymentScheduleId, id),
					isNull(receivedAmounts.deletedAt),
				),
			)
			.orderBy(receivedAmounts.receivedDate);

		return {
			data: {
				id: schedule.id,
				organizationId: schedule.organizationId,
				bookingId: schedule.bookingId,
				name: schedule.name,
				amount: schedule.amount,
				dueDate: schedule.dueDate,
				status: schedule.status,
				paidAmount: schedule.paidAmount,
				paidAt: schedule.paidAt?.toISOString() ?? null,
				notes: schedule.notes,
				sortOrder: schedule.sortOrder,
				createdBy: schedule.createdBy,
				updatedBy: schedule.updatedBy,
				createdAt: schedule.createdAt.toISOString(),
				updatedAt: schedule.updatedAt.toISOString(),
				deletedAt: schedule.deletedAt?.toISOString() ?? null,
				deletedBy: schedule.deletedBy,
				booking: {
					id: schedule.bookingId,
					name: schedule.bookingName,
					referenceNumber: schedule.bookingReferenceNumber,
				},
				linkedPayments: linkedPayments.map((p) => ({
					id: p.id,
					amount: p.amount,
					receivedDate: p.receivedDate,
					paymentMethod: p.paymentMethod,
				})),
			},
		};
	});
