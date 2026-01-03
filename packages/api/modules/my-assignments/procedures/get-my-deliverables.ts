import {
	and,
	asc,
	assignmentSubmissions,
	bookings,
	count,
	crews,
	db,
	deliverableAssignments,
	deliverables,
	desc,
	eq,
	gte,
	isNull,
	ne,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	getMyDeliverablesInputSchema,
	getMyDeliverablesOutputSchema,
} from "../../studio/schemas/my-assignments";
import { getMyCrewId } from "../lib/get-my-crew";

export const getMyDeliverables = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/me/assignments/deliverables",
		tags: ["My Assignments"],
		summary: "Get my deliverables",
		description: "Get deliverable assignments for the current crew member",
	})
	.input(getMyDeliverablesInputSchema)
	.output(getMyDeliverablesOutputSchema)
	.handler(async ({ input, context }) => {
		const {
			page,
			limit,
			sortBy,
			sortDirection,
			dueDateFrom,
			dueDateTo,
			status,
			priority,
			workflowStatus,
			bookingId,
			includeCompleted,
		} = input;

		const offset = (page - 1) * limit;

		// Get crew ID for current user
		const crewId = await getMyCrewId(
			context.user.id,
			context.organizationId,
		);

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Build where conditions
		const conditions = [
			eq(deliverableAssignments.crewId, crewId),
			eq(deliverables.organizationId, context.organizationId),
			isNull(deliverables.deletedAt),
		];

		if (dueDateFrom) {
			conditions.push(gte(deliverables.dueDate, dueDateFrom));
		}

		if (dueDateTo) {
			conditions.push(sql`${deliverables.dueDate} <= ${dueDateTo}`);
		}

		if (status) {
			conditions.push(eq(deliverables.status, status));
		}

		if (priority) {
			conditions.push(eq(deliverables.priority, priority));
		}

		if (workflowStatus) {
			conditions.push(eq(deliverables.workflowStatus, workflowStatus));
		}

		if (bookingId) {
			conditions.push(eq(deliverables.bookingId, bookingId));
		}

		if (!includeCompleted) {
			conditions.push(sql`${deliverables.workflowStatus} != 'approved'`);
		}

		// Sorting
		const sortColumnMap = {
			dueDate: deliverables.dueDate,
			priority: deliverables.priority,
			workflowStatus: deliverables.workflowStatus,
			createdAt: deliverables.createdAt,
		};
		const sortColumn =
			sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
			deliverables.dueDate;

		// Handle null due dates (put them at the end when sorting ascending)
		const orderBy =
			sortBy === "dueDate" && sortDirection === "asc"
				? [
						sql`CASE WHEN ${deliverables.dueDate} IS NULL THEN 1 ELSE 0 END`,
						asc(sortColumn),
					]
				: [
						sortDirection === "asc"
							? asc(sortColumn)
							: desc(sortColumn),
					];

		// Get assignments with deliverable info
		const assignmentsList = await db
			.select({
				assignmentId: deliverableAssignments.id,
				isLead: deliverableAssignments.isLead,
				deliverableId: deliverables.id,
				name: deliverables.name,
				description: deliverables.description,
				deliverableType: deliverables.deliverableType,
				status: deliverables.status,
				priority: deliverables.priority,
				workflowStatus: deliverables.workflowStatus,
				dueDate: deliverables.dueDate,
				bookingId: deliverables.bookingId,
			})
			.from(deliverableAssignments)
			.innerJoin(
				deliverables,
				eq(deliverableAssignments.deliverableId, deliverables.id),
			)
			.where(and(...conditions))
			.orderBy(...orderBy)
			.limit(limit)
			.offset(offset);

		// Get total count
		const [countResult] = await db
			.select({ count: count() })
			.from(deliverableAssignments)
			.innerJoin(
				deliverables,
				eq(deliverableAssignments.deliverableId, deliverables.id),
			)
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Enrich with booking info, submissions, and other crew
		const enrichedAssignments = await Promise.all(
			assignmentsList.map(async (assignment) => {
				// Get booking info
				const booking = await db.query.bookings.findFirst({
					where: eq(bookings.id, assignment.bookingId),
					columns: {
						id: true,
						name: true,
						referenceNumber: true,
						status: true,
					},
				});

				// Get latest submission by this crew member
				const latestSubmission =
					await db.query.assignmentSubmissions.findFirst({
						where: and(
							eq(
								assignmentSubmissions.deliverableId,
								assignment.deliverableId,
							),
							eq(assignmentSubmissions.submittedBy, crewId),
						),
						orderBy: [desc(assignmentSubmissions.submittedAt)],
						columns: {
							id: true,
							status: true,
							submittedAt: true,
							reviewNote: true,
						},
					});

				// Get other crew on this deliverable
				const otherCrew = await db
					.select({
						crewId: deliverableAssignments.crewId,
						name: crews.name,
					})
					.from(deliverableAssignments)
					.innerJoin(
						crews,
						eq(deliverableAssignments.crewId, crews.id),
					)
					.where(
						and(
							eq(
								deliverableAssignments.deliverableId,
								assignment.deliverableId,
							),
							ne(deliverableAssignments.crewId, crewId),
						),
					);

				const isOverdue = assignment.dueDate
					? new Date(assignment.dueDate) < today
					: false;

				return {
					id: assignment.assignmentId,
					deliverableId: assignment.deliverableId,
					name: assignment.name,
					description: assignment.description,
					deliverableType: assignment.deliverableType,
					status: assignment.status,
					priority: assignment.priority,
					workflowStatus: assignment.workflowStatus,
					dueDate: assignment.dueDate,
					isOverdue,
					isLead: assignment.isLead,
					booking: {
						id: booking?.id ?? "",
						name: booking?.name ?? "Unknown",
						referenceNumber: booking?.referenceNumber ?? "",
						status: booking?.status ?? "new",
					},
					latestSubmission: latestSubmission
						? {
								id: latestSubmission.id,
								status: latestSubmission.status,
								submittedAt:
									latestSubmission.submittedAt?.toISOString() ??
									null,
								reviewNote: latestSubmission.reviewNote,
							}
						: null,
					otherCrew: otherCrew.map((c) => ({
						id: c.crewId,
						name: c.name,
					})),
				};
			}),
		);

		return {
			data: enrichedAssignments,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
