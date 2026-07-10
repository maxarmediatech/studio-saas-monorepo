import { ORPCError } from "@orpc/server";
import {
	and,
	crews,
	db,
	eq,
	isNull,
	shootAssignments,
	shoots,
} from "@repo/database";
import { logger } from "@repo/logs";
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
import { isTerminalShootStatus } from "../calendar-sync";
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
			name,
			shootType,
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

		await db.update(shoots).set(updates).where(eq(shoots.id, id));

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

		// Calendar delivery intent follows the current shoot and assignment truth.
		const calendarRelevantFields = new Set([
			"name",
			"shootType",
			"shootDate",
			"startTime",
			"endTime",
			"venue",
			"venueAddress",
			"notes",
		]);

		const shouldSyncCalendar = changes.some((c) =>
			calendarRelevantFields.has(c.field),
		);
		const statusChanged =
			status !== undefined && status !== existing.status;
		if (shouldSyncCalendar || statusChanged) {
			try {
				const effectiveStatus = status ?? existing.status;
				const assignees = await db
					.select({ crewId: shootAssignments.crewId })
					.from(shootAssignments)
					.innerJoin(
						crews,
						and(
							eq(shootAssignments.crewId, crews.id),
							eq(crews.organizationId, context.organizationId),
							isNull(crews.deletedAt),
						),
					)
					.where(eq(shootAssignments.shootId, id));

				for (const assignee of assignees) {
					await db.transaction(async (tx) => {
						if (isTerminalShootStatus(effectiveStatus)) {
							await enqueueCalendarCancellation(tx, {
								organizationId: context.organizationId,
								shootId: id,
								crewId: assignee.crewId,
							});
							return;
						}
						await ensureAssignmentCalendarDelivery(tx, {
							organizationId: context.organizationId,
							shootId: id,
							crewId: assignee.crewId,
						});
					});
				}
			} catch (error) {
				logger.error(
					"Failed to enqueue calendar jobs on shoot update",
					{
						shootId: id,
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
				);
			}
		}

		return {
			data: { id },
			message: "Shoot updated successfully",
		};
	});
