import { ORPCError } from "@orpc/server";
import {
	and,
	bookingEvents,
	db,
	eq,
	shootAssignments,
	shoots,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	detectChanges,
	safeTrackFieldChanges,
	safeTrackStatusChange,
} from "../../activities/lib";
import { safeNotifySubscribers } from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateShootInputSchema,
	updateShootOutputSchema,
} from "../../studio/schemas/shoot";
import {
	enqueueCalendarCancellation,
	ensureAssignmentCalendarDelivery,
} from "../lib/calendar-delivery";
import {
	buildShootPlanningMetadata,
	extractShootPlanningFields,
} from "../lib/shoot-planning";

export const updateShoot = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/shoots/{id}",
		tags: ["Shoots"],
		summary: "Update shoot",
		description: "Update an existing shoot",
	})
	.input(updateShootInputSchema)
	.output(updateShootOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "shoot", "update");

		const {
			id,
			bookingEventId,
			name,
			shootType,
			side,
			shootDate,
			startTime,
			endTime,
			venue,
			venueAddress,
			notes,
			requiredCrewCount,
			additionalServices,
			status,
		} = input;

		// Verify shoot exists and belongs to organization
		const existing = await db.query.shoots.findFirst({
			where: and(
				eq(shoots.id, id),
				eq(shoots.organizationId, context.organizationId),
			),
			with: {
				booking: {
					columns: { id: true, name: true },
				},
			},
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Shoot not found",
			});
		}
		if (bookingEventId) {
			const event = await db.query.bookingEvents.findFirst({
				where: and(
					eq(bookingEvents.id, bookingEventId),
					eq(bookingEvents.bookingId, existing.bookingId),
					eq(bookingEvents.organizationId, context.organizationId),
				),
				columns: { id: true },
			});
			if (!event) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Booking event does not belong to this booking",
				});
			}
		}

		// Build update object
		const updates: Partial<typeof shoots.$inferInsert> = {
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (name !== undefined) {
			updates.name = name;
		}
		if (shootType !== undefined) {
			updates.shootType = shootType;
		}
		if (bookingEventId !== undefined) {
			updates.bookingEventId = bookingEventId;
		}
		if (side !== undefined) {
			updates.side = side;
		}
		if (shootDate !== undefined) {
			updates.shootDate = shootDate;
		}
		if (startTime !== undefined) {
			updates.startTime = startTime;
		}
		if (endTime !== undefined) {
			updates.endTime = endTime;
		}
		if (venue !== undefined) {
			updates.venue = venue;
		}
		if (venueAddress !== undefined) {
			updates.venueAddress = venueAddress;
		}
		if (notes !== undefined) {
			updates.notes = notes;
		}
		if (
			requiredCrewCount !== undefined ||
			additionalServices !== undefined
		) {
			updates.metadata = buildShootPlanningMetadata(existing.metadata, {
				requiredCrewCount,
				additionalServices,
			});
		}
		if (status !== undefined) {
			updates.status = status;
		}

		const shouldSyncCalendar = [
			name,
			shootType,
			shootDate,
			startTime,
			endTime,
			venue,
			venueAddress,
			notes,
		].some((value) => value !== undefined);
		const statusChanged =
			status !== undefined && status !== existing.status;

		// The changed shoot and its calendar intents commit together. A producer
		// error therefore rolls back the mutation instead of leaving a shoot whose
		// external representation can never be recovered deterministically.
		await db.transaction(async (tx) => {
			await tx
				.update(shoots)
				.set(updates)
				.where(
					and(
						eq(shoots.id, id),
						eq(shoots.organizationId, context.organizationId),
					),
				);
			if (!shouldSyncCalendar && !statusChanged) {
				return;
			}
			const assignees = await tx
				.select({ crewId: shootAssignments.crewId })
				.from(shootAssignments)
				.where(eq(shootAssignments.shootId, id));
			for (const assignee of assignees) {
				if (status === "completed" || status === "cancelled") {
					await enqueueCalendarCancellation(tx, {
						organizationId: context.organizationId,
						shootId: id,
						crewId: assignee.crewId,
					});
				} else {
					await ensureAssignmentCalendarDelivery(tx, {
						organizationId: context.organizationId,
						shootId: id,
						crewId: assignee.crewId,
					});
				}
			}
		});

		// Track status change separately (non-blocking)
		if (status !== undefined && status !== existing.status) {
			await safeTrackStatusChange(
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "shoot",
					entityId: id,
					entityName: name ?? existing.name,
					oldStatus: existing.status,
					newStatus: status,
					parentEntityType: "booking",
					parentEntityId: existing.bookingId,
					parentEntityName: existing.booking.name,
				},
			);

			await safeNotifySubscribers({
				organizationId: context.organizationId,
				entityType: "shoot",
				entityId: id,
				entityName: name ?? existing.name,
				type: "status_changed",
				title: `Shoot status updated: ${name ?? existing.name}`,
				body: `${existing.status} -> ${status}`,
				metadata: {
					oldStatus: existing.status,
					newStatus: status,
				},
				actorId: context.user.id,
				actorName: context.user.name,
				excludeUserId: context.user.id,
			});
		}

		// Track other field changes (non-blocking)
		const changes = detectChanges(
			{
				...existing,
				...extractShootPlanningFields(existing.metadata),
			},
			{
				name,
				shootType,
				bookingEventId,
				side,
				shootDate,
				startTime,
				endTime,
				venue,
				venueAddress,
				notes,
				requiredCrewCount,
				additionalServices,
			},
			[
				"name",
				"shootType",
				"bookingEventId",
				"side",
				"shootDate",
				"startTime",
				"endTime",
				"venue",
				"venueAddress",
				"notes",
				"requiredCrewCount",
				"additionalServices",
			],
		);

		if (changes.length > 0) {
			await safeTrackFieldChanges(
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "shoot",
					entityId: id,
					entityName: name ?? existing.name,
					parentEntityType: "booking",
					parentEntityId: existing.bookingId,
					parentEntityName: existing.booking.name,
					changes,
				},
			);
		}

		return {
			data: { id },
			message: "Shoot updated successfully",
		};
	});
