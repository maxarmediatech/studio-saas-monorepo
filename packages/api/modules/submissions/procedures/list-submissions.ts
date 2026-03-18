import {
	and,
	asc,
	assignmentSubmissions,
	bookings,
	count,
	crews,
	db,
	deliverables,
	desc,
	eq,
	ilike,
	or,
	sql,
	tasks,
	users,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	listSubmissionsInputSchema,
	listSubmissionsOutputSchema,
} from "../../studio/schemas/submission";
import { assertListSubmissionsAccess } from "../lib/list-submissions-access";

export const listSubmissions = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/submissions",
		tags: ["Submissions"],
		summary: "List submissions",
		description: "List work submissions for review with filters",
	})
	.input(listSubmissionsInputSchema)
	.output(listSubmissionsOutputSchema)
	.handler(async ({ input, context }) => {
		await assertListSubmissionsAccess(input, context);

		const {
			page,
			limit,
			sortBy,
			sortDirection,
			status,
			submittedBy,
			reviewedBy,
			taskId,
			deliverableId,
			bookingId,
			entityType,
			pendingReviewOnly,
			search,
		} = input;

		const offset = (page - 1) * limit;

		// Build where conditions
		const conditions = [
			eq(assignmentSubmissions.organizationId, context.organizationId),
		];

		if (status) {
			conditions.push(eq(assignmentSubmissions.status, status));
		}

		if (pendingReviewOnly) {
			conditions.push(
				sql`${assignmentSubmissions.status} IN ('submitted', 'in_review')`,
			);
		}

		if (submittedBy) {
			conditions.push(eq(assignmentSubmissions.submittedBy, submittedBy));
		}

		if (reviewedBy) {
			conditions.push(eq(assignmentSubmissions.reviewedBy, reviewedBy));
		}

		if (taskId) {
			conditions.push(eq(assignmentSubmissions.taskId, taskId));
		}

		if (deliverableId) {
			conditions.push(
				eq(assignmentSubmissions.deliverableId, deliverableId),
			);
		}

		if (entityType === "task") {
			conditions.push(sql`${assignmentSubmissions.taskId} IS NOT NULL`);
		} else if (entityType === "deliverable") {
			conditions.push(
				sql`${assignmentSubmissions.deliverableId} IS NOT NULL`,
			);
		}

		if (bookingId) {
			conditions.push(
				sql`COALESCE(${tasks.bookingId}, ${deliverables.bookingId}) = ${bookingId}`,
			);
		}

		if (search) {
			const searchTerm = `%${search}%`;
			const searchCondition = or(
				sql`COALESCE(${tasks.name}, ${deliverables.name}) ILIKE ${searchTerm}`,
				ilike(bookings.name, searchTerm),
				ilike(bookings.referenceNumber, searchTerm),
				ilike(crews.name, searchTerm),
			);
			if (searchCondition) {
				conditions.push(searchCondition);
			}
		}

		// Sorting
		const sortColumnMap = {
			submittedAt: assignmentSubmissions.submittedAt,
			status: assignmentSubmissions.status,
			createdAt: assignmentSubmissions.createdAt,
		};
		const sortColumn =
			sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
			assignmentSubmissions.submittedAt;
		const orderBy =
			sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);

		// Get submissions
		const submissionsList = await db
			.select({
				id: assignmentSubmissions.id,
				organizationId: assignmentSubmissions.organizationId,
				taskId: assignmentSubmissions.taskId,
				deliverableId: assignmentSubmissions.deliverableId,
				submittedBy: assignmentSubmissions.submittedBy,
				status: assignmentSubmissions.status,
				submissionNote: assignmentSubmissions.submissionNote,
				submissionLinks: assignmentSubmissions.submissionLinks,
				submittedAt: assignmentSubmissions.submittedAt,
				reviewedBy: assignmentSubmissions.reviewedBy,
				reviewedAt: assignmentSubmissions.reviewedAt,
				reviewNote: assignmentSubmissions.reviewNote,
				createdAt: assignmentSubmissions.createdAt,
				updatedAt: assignmentSubmissions.updatedAt,
				entityName: sql<string>`COALESCE(${tasks.name}, ${deliverables.name})`,
				entityWorkflowStatus: sql<string>`COALESCE(${tasks.workflowStatus}, ${deliverables.workflowStatus})`,
				bookingId: sql<string>`COALESCE(${tasks.bookingId}, ${deliverables.bookingId})`,
				bookingName: bookings.name,
				bookingReferenceNumber: bookings.referenceNumber,
				submittedByName: crews.name,
				reviewedByName: users.name,
			})
			.from(assignmentSubmissions)
			.leftJoin(tasks, eq(assignmentSubmissions.taskId, tasks.id))
			.leftJoin(
				deliverables,
				eq(assignmentSubmissions.deliverableId, deliverables.id),
			)
			.leftJoin(
				bookings,
				or(
					eq(tasks.bookingId, bookings.id),
					eq(deliverables.bookingId, bookings.id),
				),
			)
			.leftJoin(crews, eq(assignmentSubmissions.submittedBy, crews.id))
			.leftJoin(users, eq(assignmentSubmissions.reviewedBy, users.id))
			.where(and(...conditions))
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset);

		// Get total count
		const [countResult] = await db
			.select({ count: count() })
			.from(assignmentSubmissions)
			.leftJoin(tasks, eq(assignmentSubmissions.taskId, tasks.id))
			.leftJoin(
				deliverables,
				eq(assignmentSubmissions.deliverableId, deliverables.id),
			)
			.leftJoin(
				bookings,
				or(
					eq(tasks.bookingId, bookings.id),
					eq(deliverables.bookingId, bookings.id),
				),
			)
			.leftJoin(crews, eq(assignmentSubmissions.submittedBy, crews.id))
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		const enrichedSubmissions = submissionsList.map((submission) => {
			const entityType: "task" | "deliverable" = submission.taskId
				? "task"
				: "deliverable";
			const entityId =
				submission.taskId ?? submission.deliverableId ?? "";
			const submissionLinks = Array.isArray(submission.submissionLinks)
				? submission.submissionLinks.filter(
						(link): link is string => typeof link === "string",
					)
				: null;

			return {
				id: submission.id,
				organizationId: submission.organizationId,
				taskId: submission.taskId,
				deliverableId: submission.deliverableId,
				submittedBy: submission.submittedBy,
				status: submission.status,
				submissionNote: submission.submissionNote,
				submissionLinks,
				submittedAt: submission.submittedAt?.toISOString() ?? null,
				reviewedBy: submission.reviewedBy,
				reviewedAt: submission.reviewedAt?.toISOString() ?? null,
				reviewNote: submission.reviewNote,
				createdAt: submission.createdAt.toISOString(),
				updatedAt: submission.updatedAt.toISOString(),
				entityType,
				entityId,
				entityName: submission.entityName ?? "Unknown",
				entityWorkflowStatus: (submission.entityWorkflowStatus ??
					"not_started") as
					| "not_started"
					| "assigned"
					| "submitted"
					| "in_review"
					| "revision_requested"
					| "approved",
				bookingId: submission.bookingId ?? "",
				bookingName: submission.bookingName ?? "Unknown",
				bookingReferenceNumber: submission.bookingReferenceNumber ?? "",
				submittedByName: submission.submittedByName ?? "Unknown",
				reviewedByName: submission.reviewedByName ?? null,
			};
		});

		return {
			data: enrichedSubmissions,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
