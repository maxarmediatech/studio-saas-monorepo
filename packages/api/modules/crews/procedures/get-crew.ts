import { ORPCError } from "@orpc/server";
import {
	and,
	crews,
	db,
	deliverableAssignments,
	deliverables,
	eq,
	isNull,
	shootAssignments,
	shoots,
	sql,
	taskAssignments,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getCrewInputSchema,
	getCrewOutputSchema,
} from "../../studio/schemas/crew";

export const getCrew = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/crews/{id}",
		tags: ["Crews"],
		summary: "Get crew",
		description:
			"Get a single crew member by ID with assignment statistics",
	})
	.input(getCrewInputSchema)
	.output(getCrewOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "crew", "read");

		const { id } = input;

		// Get crew with organization scope
		const crew = await db.query.crews.findFirst({
			where: and(
				eq(crews.id, id),
				eq(crews.organizationId, context.organizationId),
			),
		});

		if (!crew) {
			throw new ORPCError("NOT_FOUND", {
				message: "Crew member not found",
			});
		}

		// Active shoot assignments (shoots not deleted and status not completed/cancelled)
		const [activeShootsResult] = await db
			.select({
				count: sql<number>`count(distinct ${shootAssignments.shootId})`.mapWith(
					Number,
				),
			})
			.from(shootAssignments)
			.innerJoin(shoots, eq(shootAssignments.shootId, shoots.id))
			.where(
				and(
					eq(shootAssignments.crewId, id),
					eq(shoots.organizationId, context.organizationId),
					isNull(shoots.deletedAt),
					sql`${shoots.status} NOT IN ('completed', 'cancelled')`,
				),
			);

		// Active task assignments (tasks not deleted and workflow not approved)
		const [activeTasksResult] = await db
			.select({
				count: sql<number>`count(distinct ${taskAssignments.taskId})`.mapWith(
					Number,
				),
			})
			.from(taskAssignments)
			.innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
			.where(
				and(
					eq(taskAssignments.crewId, id),
					eq(tasks.organizationId, context.organizationId),
					isNull(tasks.deletedAt),
					sql`${tasks.workflowStatus} != 'approved'`,
				),
			);

		// Active deliverable assignments (deliverables not deleted and workflow not approved)
		const [activeDeliverablesResult] = await db
			.select({
				count: sql<number>`count(distinct ${deliverableAssignments.deliverableId})`.mapWith(
					Number,
				),
			})
			.from(deliverableAssignments)
			.innerJoin(
				deliverables,
				eq(deliverableAssignments.deliverableId, deliverables.id),
			)
			.where(
				and(
					eq(deliverableAssignments.crewId, id),
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
					sql`${deliverables.workflowStatus} != 'approved'`,
				),
			);

		// Total completed assignments (tasks + deliverables with approved workflow)
		const [completedTasksResult] = await db
			.select({
				count: sql<number>`count(distinct ${taskAssignments.taskId})`.mapWith(
					Number,
				),
			})
			.from(taskAssignments)
			.innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
			.where(
				and(
					eq(taskAssignments.crewId, id),
					eq(tasks.organizationId, context.organizationId),
					isNull(tasks.deletedAt),
					eq(tasks.workflowStatus, "approved"),
				),
			);

		const [completedDeliverablesResult] = await db
			.select({
				count: sql<number>`count(distinct ${deliverableAssignments.deliverableId})`.mapWith(
					Number,
				),
			})
			.from(deliverableAssignments)
			.innerJoin(
				deliverables,
				eq(deliverableAssignments.deliverableId, deliverables.id),
			)
			.where(
				and(
					eq(deliverableAssignments.crewId, id),
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
					eq(deliverables.workflowStatus, "approved"),
				),
			);

		return {
			data: {
				...crew,
				metadata: crew.metadata as Record<string, unknown> | null,
				createdAt: crew.createdAt.toISOString(),
				updatedAt: crew.updatedAt.toISOString(),
				deletedAt: crew.deletedAt?.toISOString() ?? null,
				activeShootAssignments: activeShootsResult?.count ?? 0,
				activeTaskAssignments: activeTasksResult?.count ?? 0,
				activeDeliverableAssignments:
					activeDeliverablesResult?.count ?? 0,
				totalCompletedAssignments:
					(completedTasksResult?.count ?? 0) +
					(completedDeliverablesResult?.count ?? 0),
			},
		};
	});
