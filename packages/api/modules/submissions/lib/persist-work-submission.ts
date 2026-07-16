import { ORPCError } from "@orpc/server";
import {
	and,
	assignmentSubmissions,
	db,
	deliverableAssignments,
	desc,
	eq,
	sql,
	submissionFiles,
	taskAssignments,
} from "@repo/database";
import type { StudioContext } from "../../studio/lib/permissions";
import {
	lockParentReviewEvidence,
	lockSubmissionParent,
	recomputeParentReviewAggregate,
} from "./parent-review-aggregate";
import { recordReviewActivity } from "./review-activity";

interface SubmissionFileInput {
	key: string;
	name: string;
	size: number;
	type: string;
}

interface PersistWorkSubmissionInput {
	crew: { id: string; name: string };
	entity: { id: string; name: string; type: "task" | "deliverable" };
	files?: SubmissionFileInput[];
	submissionLinks?: string[];
	submissionNote?: string;
}

export async function persistWorkSubmission(
	context: Pick<StudioContext, "organizationId" | "user">,
	input: PersistWorkSubmissionInput,
) {
	return db.transaction(async (tx) => {
		const parent = await lockSubmissionParent(
			tx,
			context.organizationId,
			input.entity,
		);
		if (!parent) {
			throw new ORPCError("CONFLICT", {
				message: `The ${input.entity.type} is no longer available`,
			});
		}
		await lockParentReviewEvidence(tx, context.organizationId, parent);

		const [currentAssignment] =
			input.entity.type === "task"
				? await tx
						.select({ id: taskAssignments.id })
						.from(taskAssignments)
						.where(
							and(
								eq(taskAssignments.taskId, input.entity.id),
								eq(taskAssignments.crewId, input.crew.id),
							),
						)
						.limit(1)
				: await tx
						.select({ id: deliverableAssignments.id })
						.from(deliverableAssignments)
						.where(
							and(
								eq(
									deliverableAssignments.deliverableId,
									input.entity.id,
								),
								eq(
									deliverableAssignments.crewId,
									input.crew.id,
								),
							),
						)
						.limit(1);
		if (!currentAssignment) {
			throw new ORPCError("FORBIDDEN", {
				message: `You are not assigned to this ${input.entity.type}`,
			});
		}

		const entityFilter =
			input.entity.type === "task"
				? eq(assignmentSubmissions.taskId, input.entity.id)
				: eq(assignmentSubmissions.deliverableId, input.entity.id);
		const active = await tx.query.assignmentSubmissions.findFirst({
			where: and(
				eq(
					assignmentSubmissions.organizationId,
					context.organizationId,
				),
				entityFilter,
				eq(assignmentSubmissions.submittedBy, input.crew.id),
				sql`${assignmentSubmissions.status} IN ('submitted', 'in_review')`,
			),
			columns: { id: true },
		});
		if (active) {
			throw new ORPCError("CONFLICT", {
				message: `You already have a pending submission for this ${input.entity.type}`,
			});
		}

		const revision = await tx.query.assignmentSubmissions.findFirst({
			where: and(
				eq(
					assignmentSubmissions.organizationId,
					context.organizationId,
				),
				entityFilter,
				eq(assignmentSubmissions.submittedBy, input.crew.id),
				eq(assignmentSubmissions.status, "revision_requested"),
			),
			columns: {
				id: true,
				reviewedBy: true,
				reviewClaimedAt: true,
			},
			orderBy: [desc(assignmentSubmissions.reviewedAt)],
		});
		const actionTime = new Date();
		let submissionId: string;
		let wasResubmitted = false;

		if (revision) {
			const [resubmitted] = await tx
				.update(assignmentSubmissions)
				.set({
					status: "submitted",
					submissionNote: input.submissionNote ?? null,
					submissionLinks: input.submissionLinks?.length
						? input.submissionLinks
						: null,
					submittedAt: actionTime,
					reviewedBy: null,
					reviewClaimedAt: null,
					reviewedAt: null,
					reviewNote: null,
					updatedAt: actionTime,
				})
				.where(
					and(
						eq(assignmentSubmissions.id, revision.id),
						eq(
							assignmentSubmissions.organizationId,
							context.organizationId,
						),
						eq(assignmentSubmissions.status, "revision_requested"),
						eq(assignmentSubmissions.submittedBy, input.crew.id),
						entityFilter,
					),
				)
				.returning({ id: assignmentSubmissions.id });
			if (!resubmitted) {
				throw new ORPCError("CONFLICT", {
					message:
						"Submission changed before it could be resubmitted",
				});
			}
			submissionId = resubmitted.id;
			wasResubmitted = true;
			await tx
				.delete(submissionFiles)
				.where(eq(submissionFiles.submissionId, submissionId));
		} else {
			const [created] = await tx
				.insert(assignmentSubmissions)
				.values({
					organizationId: context.organizationId,
					taskId:
						input.entity.type === "task" ? input.entity.id : null,
					deliverableId:
						input.entity.type === "deliverable"
							? input.entity.id
							: null,
					submittedBy: input.crew.id,
					status: "submitted",
					submissionNote: input.submissionNote ?? null,
					submissionLinks: input.submissionLinks?.length
						? input.submissionLinks
						: null,
					submittedAt: actionTime,
				})
				.returning({ id: assignmentSubmissions.id });
			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create submission",
				});
			}
			submissionId = created.id;
		}

		if (input.files?.length) {
			await tx.insert(submissionFiles).values(
				input.files.map((file) => ({
					submissionId,
					fileName: file.name,
					fileUrl: file.key,
					fileSize: file.size,
					mimeType: file.type,
				})),
			);
		}

		await recordReviewActivity(tx, context, {
			submissionId,
			entityName: parent.name,
			parent,
			action: "submitted",
			oldValue: wasResubmitted ? "revision_requested" : null,
			newValue: "submitted",
			metadata: {
				transition: wasResubmitted ? "resubmit" : "submit",
				actorCrewId: input.crew.id,
				actorCrewName: input.crew.name,
				priorReviewerId: revision?.reviewedBy ?? null,
				priorClaimTimestamp:
					revision?.reviewClaimedAt?.toISOString() ?? null,
				actionTime: actionTime.toISOString(),
			},
		});
		const parentTransition = await recomputeParentReviewAggregate(
			tx,
			context,
			parent,
			{
				actionTime,
				cause: wasResubmitted ? "resubmit" : "submit",
			},
		);
		return { id: submissionId, wasResubmitted, parentTransition };
	});
}
