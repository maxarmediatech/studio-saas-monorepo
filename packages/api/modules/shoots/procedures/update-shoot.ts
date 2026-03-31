import { ORPCError } from "@orpc/server";
import {
	and,
	calendarSyncJobs,
	crews,
	db,
	eq,
	googleCalendarConnections,
	inArray,
	isNotNull,
	isNull,
	shootAssignments,
	shootCalendarEvents,
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
import {
	getCalendarDeleteJobType,
	isTerminalShootStatus,
} from "../calendar-sync";
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

		// Calendar sync (non-blocking)
		// Sync rules:
		// - User crew with Google connected: create/update event
		// - Non-user crew with email: send .ics update (or invite if missing mapping)
		const calendarRelevantFields = new Set([
			"name",
			"shootType",
			"shootDate",
			"startTime",
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
				const shouldDeleteCalendarEvents =
					isTerminalShootStatus(effectiveStatus);

				const assignees = await db
					.select({
						crewId: shootAssignments.crewId,
						userId: crews.userId,
						email: crews.email,
					})
					.from(shootAssignments)
					.innerJoin(crews, eq(shootAssignments.crewId, crews.id))
					.where(eq(shootAssignments.shootId, id));

				if (assignees.length > 0) {
					const mappings = await db
						.select({
							id: shootCalendarEvents.id,
							crewId: shootCalendarEvents.crewId,
							deliveryMethod: shootCalendarEvents.deliveryMethod,
							googleEventId: shootCalendarEvents.googleEventId,
							icalUid: shootCalendarEvents.icalUid,
						})
						.from(shootCalendarEvents)
						.where(
							and(
								eq(
									shootCalendarEvents.organizationId,
									context.organizationId,
								),
								eq(shootCalendarEvents.shootId, id),
							),
						);

					const mappingByCrewId = new Map(
						mappings.map((m) => [m.crewId, m]),
					);

					const userIds = assignees
						.map((a) => a.userId)
						.filter((v): v is string => Boolean(v));

					const connections = userIds.length
						? await db
								.select({
									userId: googleCalendarConnections.userId,
								})
								.from(googleCalendarConnections)
								.where(
									and(
										eq(
											googleCalendarConnections.organizationId,
											context.organizationId,
										),
										inArray(
											googleCalendarConnections.userId,
											userIds,
										),
										isNull(
											googleCalendarConnections.disconnectedAt,
										),
										isNotNull(
											googleCalendarConnections.refreshToken,
										),
									),
								)
						: [];

					const connectedUserIds = new Set(
						connections.map((c) => c.userId),
					);

					for (const assignee of assignees) {
						const mapping = mappingByCrewId.get(assignee.crewId);

						if (shouldDeleteCalendarEvents) {
							if (!mapping) {
								continue;
							}

							await db.insert(calendarSyncJobs).values({
								organizationId: context.organizationId,
								status: "pending",
								jobType: getCalendarDeleteJobType(
									mapping.deliveryMethod,
								),
								shootId: id,
								crewId: assignee.crewId,
								updatedAt: new Date(),
							});
							continue;
						}

						if (
							assignee.userId &&
							connectedUserIds.has(assignee.userId)
						) {
							if (!mapping) {
								await db.insert(shootCalendarEvents).values({
									organizationId: context.organizationId,
									shootId: id,
									crewId: assignee.crewId,
									deliveryMethod: "google",
									syncStatus: "pending",
									updatedAt: new Date(),
								});
							}

							await db.insert(calendarSyncJobs).values({
								organizationId: context.organizationId,
								status: "pending",
								jobType: mapping?.googleEventId
									? "google_update"
									: "google_create",
								shootId: id,
								crewId: assignee.crewId,
								updatedAt: new Date(),
							});
							continue;
						}

						if (!assignee.userId && assignee.email) {
							const icalUid =
								mapping?.icalUid ??
								`shoot-${id}-crew-${assignee.crewId}@studio-saas.invalid`;
							if (!mapping) {
								await db.insert(shootCalendarEvents).values({
									organizationId: context.organizationId,
									shootId: id,
									crewId: assignee.crewId,
									deliveryMethod: "ics",
									recipientEmail: assignee.email,
									icalUid,
									syncStatus: "pending",
									updatedAt: new Date(),
								});
								await db.insert(calendarSyncJobs).values({
									organizationId: context.organizationId,
									status: "pending",
									jobType: "ics_send_invite",
									shootId: id,
									crewId: assignee.crewId,
									updatedAt: new Date(),
								});
							} else {
								await db
									.update(shootCalendarEvents)
									.set({
										deliveryMethod: "ics",
										recipientEmail: assignee.email,
										icalUid,
										updatedAt: new Date(),
									})
									.where(
										eq(shootCalendarEvents.id, mapping.id),
									);

								await db.insert(calendarSyncJobs).values({
									organizationId: context.organizationId,
									status: "pending",
									jobType: "ics_send_update",
									shootId: id,
									crewId: assignee.crewId,
									updatedAt: new Date(),
								});
							}
						}
					}
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
