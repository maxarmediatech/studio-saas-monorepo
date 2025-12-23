import { ORPCError } from "@orpc/server";
import {
	and,
	eq,
	ne,
	isNull,
	desc,
	assignmentSubmissions,
	submissionFiles,
	tasks,
	deliverables,
	bookings,
	crews,
	users,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { hasPermission } from "../../studio/lib/permissions";
import {
	getSubmissionInputSchema,
	getSubmissionOutputSchema,
} from "../../studio/schemas/submission";

export const getSubmission = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/submissions/{id}",
		tags: ["Submissions"],
		summary: "Get submission",
		description: "Get detailed submission information including files and history",
	})
	.input(getSubmissionInputSchema)
	.output(getSubmissionOutputSchema)
	.handler(async ({ input, context }) => {
		const { id } = input;

		// Fetch submission
		const submission = await db.query.assignmentSubmissions.findFirst({
			where: and(
				eq(assignmentSubmissions.id, id),
				eq(assignmentSubmissions.organizationId, context.organizationId),
			),
		});

		if (!submission) {
			throw new ORPCError("NOT_FOUND", {
				message: "Submission not found",
			});
		}

		const canReview = hasPermission(context, "review", "list");
		if (!canReview) {
			const crew = await db.query.crews.findFirst({
				where: and(
					eq(crews.userId, context.user.id),
					eq(crews.organizationId, context.organizationId),
					isNull(crews.deletedAt),
				),
				columns: { id: true },
			});

			if (!crew || crew.id !== submission.submittedBy) {
				throw new ORPCError("FORBIDDEN", {
					message: "You do not have access to this submission",
				});
			}
		}

		// Determine entity type and get entity details
		let entityType: "task" | "deliverable";
		let entityId: string;
		let entityName: string;
		let entityDescription: string | null;
		let entityDueDate: string | null;
		let entityWorkflowStatus: string;
		let bookingId: string;

		if (submission.taskId) {
			entityType = "task";
			entityId = submission.taskId;
			const task = await db.query.tasks.findFirst({
				where: eq(tasks.id, submission.taskId),
				columns: {
					name: true,
					description: true,
					dueDate: true,
					workflowStatus: true,
					bookingId: true,
				},
			});
			if (!task) {
				throw new ORPCError("NOT_FOUND", {
					message: "Associated task not found",
				});
			}
			entityName = task.name;
			entityDescription = task.description;
			entityDueDate = task.dueDate;
			entityWorkflowStatus = task.workflowStatus;
			bookingId = task.bookingId;
		} else if (submission.deliverableId) {
			entityType = "deliverable";
			entityId = submission.deliverableId;
			const deliverable = await db.query.deliverables.findFirst({
				where: eq(deliverables.id, submission.deliverableId),
				columns: {
					name: true,
					description: true,
					dueDate: true,
					workflowStatus: true,
					bookingId: true,
				},
			});
			if (!deliverable) {
				throw new ORPCError("NOT_FOUND", {
					message: "Associated deliverable not found",
				});
			}
			entityName = deliverable.name;
			entityDescription = deliverable.description;
			entityDueDate = deliverable.dueDate;
			entityWorkflowStatus = deliverable.workflowStatus;
			bookingId = deliverable.bookingId;
		} else {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Submission has no associated entity",
			});
		}

		// Get booking info
		const booking = await db.query.bookings.findFirst({
			where: eq(bookings.id, bookingId),
			columns: { id: true, name: true, referenceNumber: true },
		});

		if (!booking) {
			throw new ORPCError("NOT_FOUND", {
				message: "Associated booking not found",
			});
		}

		// Get crew info
		const crew = await db.query.crews.findFirst({
			where: eq(crews.id, submission.submittedBy),
			columns: { id: true, name: true, role: true, phoneNumber: true },
		});

		if (!crew) {
			throw new ORPCError("NOT_FOUND", {
				message: "Submitting crew member not found",
			});
		}

		// Get reviewer info
		let reviewer: { id: string; name: string; email: string } | null = null;
		if (submission.reviewedBy) {
			const reviewerUser = await db.query.users.findFirst({
				where: eq(users.id, submission.reviewedBy),
				columns: { id: true, name: true, email: true },
			});
			if (reviewerUser) {
				reviewer = {
					id: reviewerUser.id,
					name: reviewerUser.name,
					email: reviewerUser.email,
				};
			}
		}

		// Get files
		const files = await db.query.submissionFiles.findMany({
			where: eq(submissionFiles.submissionId, id),
			orderBy: [desc(submissionFiles.createdAt)],
		});

		// Get previous submissions for the same entity
		const previousSubmissions = await db.query.assignmentSubmissions.findMany({
			where: and(
				eq(assignmentSubmissions.organizationId, context.organizationId),
				submission.taskId
					? eq(assignmentSubmissions.taskId, submission.taskId)
					: eq(assignmentSubmissions.deliverableId, submission.deliverableId!),
				ne(assignmentSubmissions.id, id),
			),
			orderBy: [desc(assignmentSubmissions.submittedAt)],
			columns: {
				id: true,
				status: true,
				submittedAt: true,
				reviewedAt: true,
				reviewNote: true,
			},
		});

		return {
			data: {
				id: submission.id,
				organizationId: submission.organizationId,
				taskId: submission.taskId,
				deliverableId: submission.deliverableId,
				submittedBy: submission.submittedBy,
				status: submission.status,
				submissionNote: submission.submissionNote,
				submittedAt: submission.submittedAt?.toISOString() ?? null,
				reviewedBy: submission.reviewedBy,
				reviewedAt: submission.reviewedAt?.toISOString() ?? null,
				reviewNote: submission.reviewNote,
				createdAt: submission.createdAt.toISOString(),
				updatedAt: submission.updatedAt.toISOString(),
				entityType,
				entityId,
				entityName,
				entityDescription,
				entityDueDate,
				entityWorkflowStatus: entityWorkflowStatus as "not_started" | "assigned" | "submitted" | "in_review" | "revision_requested" | "approved",
				booking: {
					id: booking.id,
					name: booking.name,
					referenceNumber: booking.referenceNumber,
				},
				submittedByCrew: {
					id: crew.id,
					name: crew.name,
					role: crew.role,
					phoneNumber: crew.phoneNumber,
				},
				reviewer,
				files: files.map((f) => ({
					id: f.id,
					fileName: f.fileName,
					fileUrl: f.fileUrl,
					fileSize: f.fileSize,
					mimeType: f.mimeType,
					createdAt: f.createdAt.toISOString(),
				})),
				previousSubmissions: previousSubmissions.map((s) => ({
					id: s.id,
					status: s.status,
					submittedAt: s.submittedAt?.toISOString() ?? null,
					reviewedAt: s.reviewedAt?.toISOString() ?? null,
					reviewNote: s.reviewNote,
				})),
			},
		};
	});
