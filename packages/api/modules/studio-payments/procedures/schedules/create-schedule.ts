import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	isNull,
	paymentSchedules,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../../activities/lib";
import { centsToMoney, moneyToCents } from "../../../studio/lib/money";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	createScheduleInputSchema,
	createScheduleOutputSchema,
} from "../../../studio/schemas/payment";

export const createSchedule = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/studio-payments/schedules",
		tags: ["Studio Payments"],
		summary: "Create payment schedule",
		description: "Create a new payment schedule for a booking",
	})
	.input(createScheduleInputSchema)
	.output(createScheduleOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "create");

		const { bookingId, name, amount, dueDate, taxType, notes, sortOrder } =
			input;

		// Verify booking exists and belongs to organization
		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, bookingId),
				eq(bookings.organizationId, context.organizationId),
				isNull(bookings.deletedAt),
			),
		});

		if (!booking) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		const [pendingOutstandingResult] = await db
			.select({
				sum: sql<string>`COALESCE(SUM(${paymentSchedules.amount} - ${paymentSchedules.paidAmount}), 0)`,
			})
			.from(paymentSchedules)
			.where(
				and(
					eq(paymentSchedules.organizationId, context.organizationId),
					eq(paymentSchedules.bookingId, bookingId),
					isNull(paymentSchedules.deletedAt),
					sql`${paymentSchedules.status} NOT IN ('completed', 'cancelled')`,
				),
			);

		const packageCostCents = moneyToCents(booking.packageCost);
		const totalReceivedCents = moneyToCents(booking.totalReceived);
		const totalPendingCents = moneyToCents(
			pendingOutstandingResult?.sum ?? "0",
		);
		const leftToScheduleCents = Math.max(
			packageCostCents - totalReceivedCents - totalPendingCents,
			0,
		);
		const amountCents = moneyToCents(amount);

		if (leftToScheduleCents <= 0) {
			throw new ORPCError("CONFLICT", {
				message: "No amount left to schedule for this booking",
			});
		}

		if (amountCents > leftToScheduleCents) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Amount cannot exceed left to schedule (${centsToMoney(leftToScheduleCents)})`,
			});
		}

		// Create payment schedule
		const [created] = await db
			.insert(paymentSchedules)
			.values({
				organizationId: context.organizationId,
				bookingId,
				name,
				amount,
				dueDate,
				taxType: taxType ?? "no_gst",
				status: "pending",
				paidAmount: "0",
				notes: notes ?? null,
				sortOrder: sortOrder ?? 0,
				createdBy: context.user.id,
				updatedBy: context.user.id,
			})
			.returning({ id: paymentSchedules.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create payment schedule",
			});
		}

		// Track activity (non-blocking)
		await safeTrackActivity(context, {
			entityType: "payment_schedule",
			entityId: created.id,
			entityName: `${name} (${formatAmount(amount)})`,
			action: "created",
			parentEntityType: "booking",
			parentEntityId: bookingId,
			parentEntityName: booking.name,
			metadata: { amount, dueDate },
		});

		return {
			data: { id: created.id },
			message: "Payment schedule created successfully",
		};
	});
