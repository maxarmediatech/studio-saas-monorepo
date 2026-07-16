import {
	and,
	asc,
	assignmentSubmissions,
	deliverableAssignments,
	deliverables,
	eq,
	isNull,
	taskAssignments,
	tasks,
} from "@repo/database";
import { createActivityWithExecutor } from "../../activities/lib";
import type { TransactionClient } from "../../studio/lib/transactions";
import {
	type AggregateWorkflowStatus,
	deriveParentReviewStatus,
} from "./parent-review-state";
import type {
	ReviewActorContext,
	SubmissionParent,
} from "./review-transition-helpers";

export interface LockedSubmissionParent extends SubmissionParent {
	completedAt: Date | null;
	workflowStatus: AggregateWorkflowStatus;
}

interface AggregateTransition {
	changed: boolean;
	from: AggregateWorkflowStatus;
	to: AggregateWorkflowStatus;
}

export interface ParentReviewProjection {
	workflowStatus: AggregateWorkflowStatus;
	approvalTime: Date | null;
	approvalTimeEvidenceComplete: boolean;
}

interface ParentReviewAssignment {
	crewId: string;
}

interface ParentReviewSubmission {
	id: string;
	submittedBy: string;
	status: typeof assignmentSubmissions.$inferSelect.status;
	reviewedAt: Date | null;
	submittedAt: Date | null;
	createdAt: Date;
}

export async function lockSubmissionParent(
	tx: TransactionClient,
	organizationId: string,
	parent: Pick<SubmissionParent, "id" | "type">,
): Promise<LockedSubmissionParent | null> {
	if (parent.type === "task") {
		const [task] = await tx
			.select({
				id: tasks.id,
				name: tasks.name,
				workflowStatus: tasks.workflowStatus,
				completedAt: tasks.completedAt,
			})
			.from(tasks)
			.where(
				and(
					eq(tasks.id, parent.id),
					eq(tasks.organizationId, organizationId),
					isNull(tasks.deletedAt),
				),
			)
			.for("update");
		return task ? { ...task, type: "task" } : null;
	}

	const [deliverable] = await tx
		.select({
			id: deliverables.id,
			name: deliverables.name,
			workflowStatus: deliverables.workflowStatus,
			completedAt: deliverables.deliveredAt,
		})
		.from(deliverables)
		.where(
			and(
				eq(deliverables.id, parent.id),
				eq(deliverables.organizationId, organizationId),
				isNull(deliverables.deletedAt),
			),
		)
		.for("update");
	return deliverable ? { ...deliverable, type: "deliverable" } : null;
}

export async function lockParentReviewEvidence(
	tx: TransactionClient,
	organizationId: string,
	parent: Pick<SubmissionParent, "id" | "type">,
): Promise<void> {
	if (parent.type === "task") {
		await tx
			.select({ id: taskAssignments.id })
			.from(taskAssignments)
			.where(eq(taskAssignments.taskId, parent.id))
			.orderBy(asc(taskAssignments.id))
			.for("update");
	} else {
		await tx
			.select({ id: deliverableAssignments.id })
			.from(deliverableAssignments)
			.where(eq(deliverableAssignments.deliverableId, parent.id))
			.orderBy(asc(deliverableAssignments.id))
			.for("update");
	}

	const parentFilter =
		parent.type === "task"
			? eq(assignmentSubmissions.taskId, parent.id)
			: eq(assignmentSubmissions.deliverableId, parent.id);
	await tx
		.select({ id: assignmentSubmissions.id })
		.from(assignmentSubmissions)
		.where(
			and(
				eq(assignmentSubmissions.organizationId, organizationId),
				parentFilter,
			),
		)
		.orderBy(asc(assignmentSubmissions.id))
		.for("update");
}

export async function readParentReviewProjection(
	tx: TransactionClient,
	organizationId: string,
	parent: Pick<SubmissionParent, "id" | "type">,
): Promise<ParentReviewProjection> {
	const assignments =
		parent.type === "task"
			? await tx
					.select({ crewId: taskAssignments.crewId })
					.from(taskAssignments)
					.where(eq(taskAssignments.taskId, parent.id))
					.orderBy(asc(taskAssignments.id))
			: await tx
					.select({ crewId: deliverableAssignments.crewId })
					.from(deliverableAssignments)
					.where(eq(deliverableAssignments.deliverableId, parent.id))
					.orderBy(asc(deliverableAssignments.id));

	if (assignments.length === 0) {
		return {
			workflowStatus: "not_started",
			approvalTime: null,
			approvalTimeEvidenceComplete: true,
		};
	}

	const parentFilter =
		parent.type === "task"
			? eq(assignmentSubmissions.taskId, parent.id)
			: eq(assignmentSubmissions.deliverableId, parent.id);
	const submissions = await tx
		.select({
			id: assignmentSubmissions.id,
			submittedBy: assignmentSubmissions.submittedBy,
			status: assignmentSubmissions.status,
			reviewedAt: assignmentSubmissions.reviewedAt,
			submittedAt: assignmentSubmissions.submittedAt,
			createdAt: assignmentSubmissions.createdAt,
		})
		.from(assignmentSubmissions)
		.where(
			and(
				eq(assignmentSubmissions.organizationId, organizationId),
				parentFilter,
			),
		);

	return deriveParentReviewProjection(assignments, submissions);
}

export function deriveParentReviewProjection(
	assignments: ParentReviewAssignment[],
	submissions: ParentReviewSubmission[],
): ParentReviewProjection {
	if (assignments.length === 0) {
		return {
			workflowStatus: "not_started",
			approvalTime: null,
			approvalTimeEvidenceComplete: true,
		};
	}

	const latestByCrew = new Map<string, ParentReviewSubmission>();
	for (const submission of submissions) {
		const existing = latestByCrew.get(submission.submittedBy);
		if (!existing || isLaterSubmission(submission, existing)) {
			latestByCrew.set(submission.submittedBy, submission);
		}
	}

	const latestEvidence = assignments.map(
		(assignment) => latestByCrew.get(assignment.crewId) ?? null,
	);
	const workflowStatus = deriveParentReviewStatus(
		latestEvidence.map((evidence) => evidence?.status ?? null),
	);
	if (workflowStatus !== "approved") {
		return {
			workflowStatus,
			approvalTime: null,
			approvalTimeEvidenceComplete: true,
		};
	}
	const approvalTimes = latestEvidence.map(
		(evidence) => evidence?.reviewedAt ?? null,
	);
	const approvalTimeEvidenceComplete = approvalTimes.every(
		(time): time is Date => time instanceof Date,
	);
	return {
		workflowStatus,
		approvalTime: approvalTimeEvidenceComplete
			? new Date(Math.max(...approvalTimes.map((time) => time.getTime())))
			: null,
		approvalTimeEvidenceComplete,
	};
}

function isLaterSubmission(
	candidate: {
		createdAt: Date;
		id: string;
		submittedAt: Date | null;
	},
	existing: {
		createdAt: Date;
		id: string;
		submittedAt: Date | null;
	},
): boolean {
	const candidateTime =
		candidate.submittedAt?.getTime() ?? candidate.createdAt.getTime();
	const existingTime =
		existing.submittedAt?.getTime() ?? existing.createdAt.getTime();
	if (candidateTime !== existingTime) {
		return candidateTime > existingTime;
	}
	if (candidate.createdAt.getTime() !== existing.createdAt.getTime()) {
		return candidate.createdAt > existing.createdAt;
	}
	return candidate.id > existing.id;
}

export async function recomputeParentReviewAggregate(
	tx: TransactionClient,
	context: ReviewActorContext,
	parent: LockedSubmissionParent,
	input: { actionTime: Date; cause: string; approvalTime?: Date },
): Promise<AggregateTransition> {
	const { workflowStatus: nextStatus } = await readParentReviewProjection(
		tx,
		context.organizationId,
		parent,
	);
	if (nextStatus === parent.workflowStatus) {
		return { changed: false, from: parent.workflowStatus, to: nextStatus };
	}

	const timestamp =
		nextStatus === "approved"
			? (input.approvalTime ?? input.actionTime)
			: null;
	const update =
		parent.type === "task"
			? await tx
					.update(tasks)
					.set({
						workflowStatus: nextStatus,
						completedAt: timestamp,
						updatedAt: input.actionTime,
						updatedBy: context.user.id,
					})
					.where(
						and(
							eq(tasks.id, parent.id),
							eq(tasks.organizationId, context.organizationId),
							isNull(tasks.deletedAt),
							eq(tasks.workflowStatus, parent.workflowStatus),
						),
					)
					.returning({ id: tasks.id })
			: await tx
					.update(deliverables)
					.set({
						workflowStatus: nextStatus,
						deliveredAt: timestamp,
						updatedAt: input.actionTime,
						updatedBy: context.user.id,
					})
					.where(
						and(
							eq(deliverables.id, parent.id),
							eq(
								deliverables.organizationId,
								context.organizationId,
							),
							isNull(deliverables.deletedAt),
							eq(
								deliverables.workflowStatus,
								parent.workflowStatus,
							),
						),
					)
					.returning({ id: deliverables.id });
	if (update.length !== 1) {
		throw new Error(
			"Submission parent changed while aggregation was locked",
		);
	}

	await createActivityWithExecutor(tx, {
		organizationId: context.organizationId,
		actorId: context.user.id,
		actorType: "user",
		actorName: context.user.name || "Unknown User",
		entityType: parent.type,
		entityId: parent.id,
		entityName: parent.name,
		action: "workflow_changed",
		field: "workflowStatus",
		oldValue: parent.workflowStatus,
		newValue: nextStatus,
		metadata: {
			transition: "submission_aggregate",
			cause: input.cause,
			actionTime: input.actionTime.toISOString(),
		},
	});

	return { changed: true, from: parent.workflowStatus, to: nextStatus };
}
