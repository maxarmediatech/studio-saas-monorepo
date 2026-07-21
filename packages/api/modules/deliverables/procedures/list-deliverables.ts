import {
	and,
	asc,
	bookings,
	count,
	crews,
	db,
	deliverableAssignments,
	deliverables,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	sql,
	users,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { buildDeliverableSearchCondition } from "../../studio/lib/entity-search";
import { hasPermission, requirePermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	type DeliverableListItem,
	listDeliverablesInputSchema,
	listDeliverablesOutputSchema,
} from "../../studio/schemas/deliverable";

export const listDeliverables = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/deliverables",
		tags: ["Deliverables"],
		summary: "List deliverables",
		description:
			"List deliverables with filtering, sorting, and pagination",
	})
	.input(listDeliverablesInputSchema)
	.output(listDeliverablesOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "deliverable", "list");

		const {
			page,
			limit,
			search,
			bookingId,
			status,
			workflowStatus,
			dueDateFrom,
			dueDateTo,
			crewId,
			sortBy,
			sortDirection,
			includeDeleted,
		} = input;

		const offset = (page - 1) * limit;

		// Build conditions
		const conditions = [
			eq(deliverables.organizationId, context.organizationId),
		];

		if (!includeDeleted) {
			conditions.push(isNull(deliverables.deletedAt));
		}

		if (bookingId) {
			conditions.push(eq(deliverables.bookingId, bookingId));
		}

		const statuses = Array.isArray(status)
			? status
			: status
				? [status]
				: null;
		if (statuses && statuses.length > 0) {
			conditions.push(inArray(deliverables.status, statuses));
		}

		if (workflowStatus) {
			conditions.push(eq(deliverables.workflowStatus, workflowStatus));
		}

		if (dueDateFrom) {
			conditions.push(gte(deliverables.dueDate, dueDateFrom));
		}

		if (dueDateTo) {
			conditions.push(sql`${deliverables.dueDate} <= ${dueDateTo}`);
		}

		if (search) {
			const canSearchClientNames = await hasPermission(
				context,
				"client",
				"list",
			);
			const searchCondition = buildDeliverableSearchCondition(
				search,
				context.organizationId,
				{ includeClientNames: canSearchClientNames },
			);
			if (searchCondition) {
				conditions.push(searchCondition);
			}
		}

		// Filter by crew assignment
		if (crewId) {
			const assignedDeliverableIds = db
				.select({ deliverableId: deliverableAssignments.deliverableId })
				.from(deliverableAssignments)
				.where(eq(deliverableAssignments.crewId, crewId));

			conditions.push(
				sql`${deliverables.id} IN ${assignedDeliverableIds}`,
			);
		}

		// Get total count
		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(deliverables)
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Determine sort column
		const sortColumnMap = {
			name: deliverables.name,
			dueDate: deliverables.dueDate,
			status: deliverables.status,
			workflowStatus: deliverables.workflowStatus,
			createdAt: deliverables.createdAt,
		};
		const sortColumn =
			sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
			deliverables.dueDate;

		const orderFn = sortDirection === "asc" ? asc : desc;

		// Get deliverables with booking info
		const rows = await db
			.select({
				id: deliverables.id,
				organizationId: deliverables.organizationId,
				bookingId: deliverables.bookingId,
				name: deliverables.name,
				description: deliverables.description,
				quantity: deliverables.quantity,
				cost: deliverables.cost,
				isPackageIncluded: deliverables.isPackageIncluded,
				status: deliverables.status,
				workflowStatus: deliverables.workflowStatus,
				dueDate: deliverables.dueDate,
				deliveredAt: deliverables.deliveredAt,
				metadata: deliverables.metadata,
				createdBy: deliverables.createdBy,
				updatedBy: deliverables.updatedBy,
				createdAt: deliverables.createdAt,
				updatedAt: deliverables.updatedAt,
				deletedAt: deliverables.deletedAt,
				deletedBy: deliverables.deletedBy,
				bookingName: bookings.name,
				bookingReferenceNumber: bookings.referenceNumber,
				bookingPackageType: bookings.packageType,
			})
			.from(deliverables)
			.innerJoin(bookings, eq(deliverables.bookingId, bookings.id))
			.where(and(...conditions))
			.orderBy(orderFn(sortColumn))
			.limit(limit)
			.offset(offset);

		// Get assignment counts
		const deliverableIds = rows.map((r) => r.id);
		const assignmentCounts: Record<string, number> = {};
		const assignedCrewByDeliverable: Record<
			string,
			{ id: string; name: string; avatarUrl: string | null }[]
		> = {};

		if (deliverableIds.length > 0) {
			const counts = await db
				.select({
					deliverableId: deliverableAssignments.deliverableId,
					crewId: crews.id,
					crewName: crews.name,
					avatarUrl: users.image,
				})
				.from(deliverableAssignments)
				.innerJoin(crews, eq(deliverableAssignments.crewId, crews.id))
				.leftJoin(users, eq(crews.userId, users.id))
				.where(
					and(
						inArray(
							deliverableAssignments.deliverableId,
							deliverableIds,
						),
						isNull(crews.deletedAt),
					),
				);

			for (const row of counts) {
				assignmentCounts[row.deliverableId] =
					(assignmentCounts[row.deliverableId] ?? 0) + 1;
				if (!assignedCrewByDeliverable[row.deliverableId]) {
					assignedCrewByDeliverable[row.deliverableId] = [];
				}
				assignedCrewByDeliverable[row.deliverableId].push({
					id: row.crewId,
					name: row.crewName,
					avatarUrl: row.avatarUrl,
				});
			}
		}

		// Format response
		const data: DeliverableListItem[] = rows.map((row) => ({
			id: row.id,
			organizationId: row.organizationId,
			bookingId: row.bookingId,
			name: row.name,
			description: row.description,
			quantity: row.quantity,
			cost: row.cost,
			isPackageIncluded: row.isPackageIncluded,
			status: row.status,
			workflowStatus: row.workflowStatus,
			dueDate: row.dueDate,
			deliveredAt: row.deliveredAt?.toISOString() ?? null,
			metadata: row.metadata as Record<string, unknown> | null,
			createdBy: row.createdBy,
			updatedBy: row.updatedBy,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			deletedAt: row.deletedAt?.toISOString() ?? null,
			deletedBy: row.deletedBy,
			assignmentsCount: assignmentCounts[row.id] ?? 0,
			assignedCrew: assignedCrewByDeliverable[row.id] ?? [],
			bookingName: row.bookingName,
			bookingReferenceNumber: row.bookingReferenceNumber,
			bookingPackageType: row.bookingPackageType,
		}));

		return {
			data,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
