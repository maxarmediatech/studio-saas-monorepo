import { ORPCError } from "@orpc/server";
import {
	and,
	crews,
	db,
	deliverableAssignments,
	deliverables,
	eq,
	isNull,
	members,
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
import {
	deriveCrewRoles,
	extractSpecializations,
} from "../lib/crew-presentation";

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
		await requirePermission(context, "crew", "read");

		const { id } = input;

		// Get crew with organization scope
		const [crew] = await db
			.select({
				id: crews.id,
				organizationId: crews.organizationId,
				userId: crews.userId,
				name: crews.name,
				email: crews.email,
				phoneNumber: crews.phoneNumber,
				workerType: crews.workerType,
				status: crews.status,
				dailyRate: crews.dailyRate,
				metadata: crews.metadata,
				createdBy: crews.createdBy,
				updatedBy: crews.updatedBy,
				createdAt: crews.createdAt,
				updatedAt: crews.updatedAt,
				deletedAt: crews.deletedAt,
				deletedBy: crews.deletedBy,
				memberRole: members.role,
			})
			.from(crews)
			.leftJoin(
				members,
				and(
					eq(members.organizationId, crews.organizationId),
					eq(members.userId, crews.userId),
				),
			)
			.where(
				and(
					eq(crews.id, id),
					eq(crews.organizationId, context.organizationId),
				),
			)
			.limit(1);

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

		const metadata = crew.metadata as Record<string, unknown> | null;
		const roleMeta = deriveCrewRoles({
			memberRole: crew.memberRole,
			workerType: crew.workerType,
			userId: crew.userId,
		});

		return {
			data: {
				id: crew.id,
				organizationId: crew.organizationId,
				userId: crew.userId,
				name: crew.name,
				email: crew.email,
				phoneNumber: crew.phoneNumber,
				workerType: roleMeta.workerType,
				hasAppAccess: Boolean(crew.memberRole),
				memberRoles: roleMeta.memberRoles,
				displayRoles: roleMeta.displayRoles,
				isFreelancer: roleMeta.isFreelancer,
				specializations: extractSpecializations(metadata),
				status: crew.status,
				dailyRate: crew.dailyRate,
				metadata,
				createdBy: crew.createdBy,
				updatedBy: crew.updatedBy,
				createdAt: crew.createdAt.toISOString(),
				updatedAt: crew.updatedAt.toISOString(),
				deletedAt: crew.deletedAt?.toISOString() ?? null,
				deletedBy: crew.deletedBy,
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
