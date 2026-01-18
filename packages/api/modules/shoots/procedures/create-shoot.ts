import { ORPCError } from "@orpc/server";
import { and, bookings, db, eq, isNull, shoots } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { safeAutoSubscribe } from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createShootInputSchema,
	createShootOutputSchema,
} from "../../studio/schemas/shoot";

export const createShoot = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/shoots",
		tags: ["Shoots"],
		summary: "Create shoot",
		description: "Create a new shoot for a booking",
	})
	.input(createShootInputSchema)
	.output(createShootOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "shoot", "create");

		const {
			bookingId,
			name,
			shootType,
			shootDate,
			startTime,
			endTime,
			venue,
			venueAddress,
			notes,
			status,
		} = input;

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

		// Create shoot
		const [created] = await db
			.insert(shoots)
			.values({
				organizationId: context.organizationId,
				bookingId,
				name,
				shootType,
				shootDate,
				startTime: startTime ?? null,
				endTime: endTime ?? null,
				venue: venue ?? null,
				venueAddress: venueAddress ?? null,
				notes: notes ?? null,
				status: status ?? "scheduled",
				createdBy: context.user.id,
			})
			.returning({ id: shoots.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create shoot",
			});
		}

		// Track activity (non-blocking)
		await safeTrackActivity(
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "shoot",
				entityId: created.id,
				entityName: name,
				action: "created",
				parentEntityType: "booking",
				parentEntityId: bookingId,
				parentEntityName: booking.name,
				metadata: { shootType, shootDate },
			},
		);

		await safeAutoSubscribe({
			organizationId: context.organizationId,
			userId: context.user.id,
			entityType: "shoot",
			entityId: created.id,
		});

		return {
			data: { id: created.id },
			message: "Shoot created successfully",
		};
	});
