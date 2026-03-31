import { ORPCError } from "@orpc/server";
import {
	and,
	calendarSyncJobs,
	crews,
	db,
	eq,
	googleCalendarConnections,
	isNull,
	shootAssignments,
	shootCalendarEvents,
	shoots,
	smsOutbox,
} from "@repo/database";
import { logger } from "@repo/logs";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackAssignment } from "../../activities/lib";
import {
	safeAutoSubscribe,
	safeNotifySubscribers,
} from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	assignCrewInputSchema,
	assignCrewOutputSchema,
} from "../../studio/schemas/shoot";
import { isTerminalShootStatus } from "../calendar-sync";

export const assignCrew = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/shoots/{shootId}/assignments",
		tags: ["Shoots"],
		summary: "Assign crew to shoot",
		description: "Assign a crew member to a shoot",
	})
	.input(assignCrewInputSchema)
	.output(assignCrewOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "shoot", "assign");

		const { shootId, crewId, role, isLead, rate } = input;

		// Verify shoot exists and belongs to organization
		const shoot = await db.query.shoots.findFirst({
			where: and(
				eq(shoots.id, shootId),
				eq(shoots.organizationId, context.organizationId),
				isNull(shoots.deletedAt),
			),
		});

		if (!shoot) {
			throw new ORPCError("NOT_FOUND", {
				message: "Shoot not found",
			});
		}

		// Verify crew exists and belongs to organization
		const crew = await db.query.crews.findFirst({
			where: and(
				eq(crews.id, crewId),
				eq(crews.organizationId, context.organizationId),
				isNull(crews.deletedAt),
			),
		});

		if (!crew) {
			throw new ORPCError("NOT_FOUND", {
				message: "Crew member not found",
			});
		}

		// Check if already assigned
		const existing = await db.query.shootAssignments.findFirst({
			where: and(
				eq(shootAssignments.shootId, shootId),
				eq(shootAssignments.crewId, crewId),
			),
		});

		if (existing) {
			throw new ORPCError("CONFLICT", {
				message: "Crew member is already assigned to this shoot",
			});
		}

		const assignmentRole = role || "Crew";

		const [created] = await db
			.insert(shootAssignments)
			.values({
				shootId,
				crewId,
				role: assignmentRole,
				isLead: isLead ?? false,
				rate: rate ?? null,
				assignedBy: context.user.id,
			})
			.returning({ id: shootAssignments.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to assign crew",
			});
		}

		// Track activity (non-blocking)
		// entityName = target of assignment (shoot), crewName in metadata
		await safeTrackAssignment(context, {
			entityType: "shoot_assignment",
			entityId: created.id,
			entityName: shoot.name,
			action: "assigned",
			parentEntityType: "shoot",
			parentEntityId: shoot.id,
			parentEntityName: shoot.name,
			metadata: {
				crewId: crew.id,
				crewName: crew.name,
				role: assignmentRole,
			},
		});

		if (crew.userId) {
			await safeAutoSubscribe({
				organizationId: context.organizationId,
				userId: crew.userId,
				entityType: "shoot",
				entityId: shoot.id,
			});
		}

		await safeNotifySubscribers({
			organizationId: context.organizationId,
			entityType: "shoot",
			entityId: shoot.id,
			entityName: shoot.name,
			type: "assigned",
			title: `Shoot assigned: ${shoot.name}`,
			body: `Assigned to ${crew.name}`,
			metadata: {
				assigneeName: crew.name,
				assigneeId: crew.userId ?? null,
			},
			actorId: context.user.id,
			actorName: context.user.name,
			excludeUserId: context.user.id,
		});

		if (crew.phoneNumber) {
			const location = shoot.venue ?? shoot.venueAddress ?? "TBD";
			const crewAssignmentFlowId = process.env.MSG91_FLOW_CREW_ASSIGNMENT;
			const parsedShootDate = new Date(
				typeof shoot.shootDate === "string"
					? `${shoot.shootDate}T00:00:00`
					: shoot.shootDate,
			);
			const shootDate = Number.isNaN(parsedShootDate.getTime())
				? String(shoot.shootDate)
				: new Intl.DateTimeFormat("en-IN", {
						dateStyle: "medium",
					}).format(parsedShootDate);
			const message = `Assigned to "${shoot.name}" on ${shootDate} as ${assignmentRole} at ${location}.`;

			if (!crewAssignmentFlowId) {
				logger.warn(
					"Skipping crew assignment SMS: flow ID not configured",
					{
						shootId: shoot.id,
						crewId: crew.id,
					},
				);
			} else {
				try {
					await db.insert(smsOutbox).values({
						organizationId: context.organizationId,
						phoneNumber: crew.phoneNumber,
						templateId: crewAssignmentFlowId,
						variables: {
							crewName: crew.name,
							shootDate,
							role: assignmentRole,
							location,
							message,
						},
						status: "pending",
						attempts: 0,
						maxAttempts: 3,
					});
				} catch (error) {
					logger.error("Failed to queue crew assignment SMS", {
						shootId: shoot.id,
						crewId: crew.id,
						error:
							error instanceof Error
								? error.message
								: String(error),
					});
				}
			}
		}

		// Calendar side-effects (non-blocking):
		// - Connected user crew -> enqueue Google create
		// - Non-user crew with email -> enqueue .ics invite
		try {
			const terminalShootStatus = isTerminalShootStatus(shoot.status);
			if (!terminalShootStatus && crew.userId) {
				const connection =
					await db.query.googleCalendarConnections.findFirst({
						where: and(
							eq(
								googleCalendarConnections.organizationId,
								context.organizationId,
							),
							eq(googleCalendarConnections.userId, crew.userId),
							isNull(googleCalendarConnections.disconnectedAt),
						),
						columns: { id: true, refreshToken: true },
					});

				if (connection?.refreshToken) {
					const mapping =
						await db.query.shootCalendarEvents.findFirst({
							where: and(
								eq(
									shootCalendarEvents.organizationId,
									context.organizationId,
								),
								eq(shootCalendarEvents.shootId, shoot.id),
								eq(shootCalendarEvents.crewId, crew.id),
							),
							columns: { id: true },
						});

					if (!mapping) {
						await db.insert(shootCalendarEvents).values({
							organizationId: context.organizationId,
							shootId: shoot.id,
							crewId: crew.id,
							deliveryMethod: "google",
							syncStatus: "pending",
							updatedAt: new Date(),
						});
					}

					await db.insert(calendarSyncJobs).values({
						organizationId: context.organizationId,
						status: "pending",
						jobType: "google_create",
						shootId: shoot.id,
						crewId: crew.id,
						updatedAt: new Date(),
					});
				}
			} else if (!terminalShootStatus && crew.email) {
				const mapping = await db.query.shootCalendarEvents.findFirst({
					where: and(
						eq(
							shootCalendarEvents.organizationId,
							context.organizationId,
						),
						eq(shootCalendarEvents.shootId, shoot.id),
						eq(shootCalendarEvents.crewId, crew.id),
					),
				});

				const icalUid =
					mapping?.icalUid ??
					`shoot-${shoot.id}-crew-${crew.id}@studio-saas.invalid`;

				if (!mapping) {
					await db.insert(shootCalendarEvents).values({
						organizationId: context.organizationId,
						shootId: shoot.id,
						crewId: crew.id,
						deliveryMethod: "ics",
						recipientEmail: crew.email,
						icalUid,
						syncStatus: "pending",
						updatedAt: new Date(),
					});
				} else {
					await db
						.update(shootCalendarEvents)
						.set({
							deliveryMethod: "ics",
							recipientEmail: crew.email,
							icalUid,
							updatedAt: new Date(),
						})
						.where(eq(shootCalendarEvents.id, mapping.id));
				}

				await db.insert(calendarSyncJobs).values({
					organizationId: context.organizationId,
					status: "pending",
					jobType: "ics_send_invite",
					shootId: shoot.id,
					crewId: crew.id,
					updatedAt: new Date(),
				});
			}
		} catch (error) {
			logger.error("Failed to enqueue calendar job on assignment", {
				shootId: shoot.id,
				crewId: crew.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return {
			data: { id: created.id },
			message: `${crew.name} assigned to shoot`,
		};
	});
