import { createHash } from "node:crypto";
import {
	and,
	assignmentSubmissions,
	db,
	deliverableAssignments,
	deliverables,
	eq,
	isNull,
	taskAssignments,
	tasks,
} from "@repo/database";
import { deriveParentReviewProjection } from "./parent-review-aggregate";
import type { AggregateWorkflowStatus } from "./parent-review-state";

export interface ParentReviewMismatch {
	parentType: "task" | "deliverable";
	parentId: string;
	parentName: string;
	actualStatus: AggregateWorkflowStatus;
	expectedStatus: AggregateWorkflowStatus;
	actualApprovalTime: string | null;
	expectedApprovalTime: string | null;
	approvalTimeEvidence: "complete" | "incomplete" | "not_applicable";
	repairable: boolean;
	reason: string;
}

export interface ParentReviewReconciliationReport {
	reportVersion: 1;
	organizationId: string;
	generatedAt: string;
	reportHash: string;
	summary: {
		total: number;
		repairable: number;
		requiresManualReview: number;
	};
	mismatches: ParentReviewMismatch[];
}

function buildMismatch(input: {
	parentType: "task" | "deliverable";
	parentId: string;
	parentName: string;
	actualStatus: AggregateWorkflowStatus;
	actualApprovalTime: Date | null;
	expectedStatus: AggregateWorkflowStatus;
	expectedApprovalTime: Date | null;
	approvalTimeEvidenceComplete: boolean;
}): ParentReviewMismatch | null {
	const approvalEvidenceFloor =
		input.expectedStatus === "approved" &&
		input.approvalTimeEvidenceComplete
			? input.expectedApprovalTime
			: null;
	const approvalTimePrecedesEvidence = Boolean(
		input.expectedStatus === "approved" &&
			input.actualStatus === "approved" &&
			input.actualApprovalTime &&
			approvalEvidenceFloor &&
			input.actualApprovalTime < approvalEvidenceFloor,
	);
	const expectedApprovalTime =
		approvalTimePrecedesEvidence && approvalEvidenceFloor
			? approvalEvidenceFloor
			: input.expectedStatus === "approved" &&
					input.actualStatus === "approved" &&
					input.actualApprovalTime
				? input.actualApprovalTime
				: null;
	const statusMismatch = input.actualStatus !== input.expectedStatus;
	const missingApprovalTime =
		input.expectedStatus === "approved" &&
		input.actualApprovalTime === null;
	const staleApprovalTime =
		input.expectedStatus !== "approved" &&
		input.actualApprovalTime !== null;
	const approvalEvidenceIncomplete =
		input.expectedStatus === "approved" &&
		!input.approvalTimeEvidenceComplete;
	if (
		!statusMismatch &&
		!missingApprovalTime &&
		!staleApprovalTime &&
		!approvalEvidenceIncomplete &&
		!approvalTimePrecedesEvidence
	) {
		return null;
	}
	const approvalTimeEvidence =
		input.expectedStatus !== "approved"
			? ("not_applicable" as const)
			: input.approvalTimeEvidenceComplete
				? ("complete" as const)
				: ("incomplete" as const);
	// Submission review times prove the aggregate status, but they cannot prove
	// when an assignment change made the aggregate approved. They are only a
	// lower bound: equal/later approval timestamps are preserved, while earlier
	// or missing transition times require manual historical review.
	const repairable = input.expectedStatus !== "approved";
	const reasons = [
		statusMismatch ? "workflow_status_mismatch" : null,
		missingApprovalTime ? "approval_timestamp_missing" : null,
		staleApprovalTime ? "approval_timestamp_stale" : null,
		approvalTimePrecedesEvidence
			? "approval_timestamp_precedes_evidence"
			: null,
		approvalEvidenceIncomplete ? "approval_evidence_incomplete" : null,
	].filter((reason): reason is string => reason !== null);
	return {
		parentType: input.parentType,
		parentId: input.parentId,
		parentName: input.parentName,
		actualStatus: input.actualStatus,
		expectedStatus: input.expectedStatus,
		actualApprovalTime: input.actualApprovalTime?.toISOString() ?? null,
		expectedApprovalTime: expectedApprovalTime?.toISOString() ?? null,
		approvalTimeEvidence,
		repairable,
		reason: reasons.join(","),
	};
}

function hashReport(
	organizationId: string,
	mismatches: ParentReviewMismatch[],
) {
	return createHash("sha256")
		.update(
			JSON.stringify({ reportVersion: 1, organizationId, mismatches }),
		)
		.digest("hex");
}

function appendGrouped<T>(map: Map<string, T[]>, key: string, value: T) {
	const values = map.get(key);
	if (values) {
		values.push(value);
	} else {
		map.set(key, [value]);
	}
}

export async function queryParentReviewMismatches(
	organizationId: string,
): Promise<ParentReviewReconciliationReport> {
	if (!organizationId.trim()) {
		throw new Error("Parent review reconciliation requires organizationId");
	}
	const mismatches = await db.transaction(
		async (tx) => {
			const [
				taskRows,
				deliverableRows,
				taskAssignmentRows,
				deliverableAssignmentRows,
				taskSubmissionRows,
				deliverableSubmissionRows,
			] = await Promise.all([
				tx
					.select({
						id: tasks.id,
						name: tasks.name,
						workflowStatus: tasks.workflowStatus,
						approvalTime: tasks.completedAt,
					})
					.from(tasks)
					.where(
						and(
							eq(tasks.organizationId, organizationId),
							isNull(tasks.deletedAt),
						),
					),
				tx
					.select({
						id: deliverables.id,
						name: deliverables.name,
						workflowStatus: deliverables.workflowStatus,
						approvalTime: deliverables.completedAt,
					})
					.from(deliverables)
					.where(
						and(
							eq(deliverables.organizationId, organizationId),
							eq(deliverables.trackingMode, "direct"),
							isNull(deliverables.deletedAt),
						),
					),
				tx
					.select({
						parentId: taskAssignments.taskId,
						crewId: taskAssignments.crewId,
						progressStatus: taskAssignments.progressStatus,
					})
					.from(taskAssignments)
					.innerJoin(tasks, eq(tasks.id, taskAssignments.taskId))
					.where(
						and(
							eq(tasks.organizationId, organizationId),
							isNull(tasks.deletedAt),
						),
					),
				tx
					.select({
						parentId: deliverableAssignments.deliverableId,
						crewId: deliverableAssignments.crewId,
						progressStatus: deliverableAssignments.progressStatus,
					})
					.from(deliverableAssignments)
					.innerJoin(
						deliverables,
						eq(
							deliverables.id,
							deliverableAssignments.deliverableId,
						),
					)
					.where(
						and(
							eq(deliverables.organizationId, organizationId),
							eq(deliverables.trackingMode, "direct"),
							isNull(deliverables.deletedAt),
						),
					),
				tx
					.select({
						parentId: assignmentSubmissions.taskId,
						id: assignmentSubmissions.id,
						submittedBy: assignmentSubmissions.submittedBy,
						status: assignmentSubmissions.status,
						reviewedAt: assignmentSubmissions.reviewedAt,
						submittedAt: assignmentSubmissions.submittedAt,
						createdAt: assignmentSubmissions.createdAt,
					})
					.from(assignmentSubmissions)
					.innerJoin(
						tasks,
						eq(tasks.id, assignmentSubmissions.taskId),
					)
					.where(
						and(
							eq(
								assignmentSubmissions.organizationId,
								organizationId,
							),
							eq(tasks.organizationId, organizationId),
							isNull(tasks.deletedAt),
						),
					),
				tx
					.select({
						parentId: assignmentSubmissions.deliverableId,
						id: assignmentSubmissions.id,
						submittedBy: assignmentSubmissions.submittedBy,
						status: assignmentSubmissions.status,
						reviewedAt: assignmentSubmissions.reviewedAt,
						submittedAt: assignmentSubmissions.submittedAt,
						createdAt: assignmentSubmissions.createdAt,
					})
					.from(assignmentSubmissions)
					.innerJoin(
						deliverables,
						eq(
							deliverables.id,
							assignmentSubmissions.deliverableId,
						),
					)
					.where(
						and(
							eq(
								assignmentSubmissions.organizationId,
								organizationId,
							),
							eq(deliverables.organizationId, organizationId),
							eq(deliverables.trackingMode, "direct"),
							isNull(deliverables.deletedAt),
						),
					),
			]);
			const taskAssignmentsByParent = new Map<
				string,
				Array<{
					crewId: string;
					progressStatus: "assigned" | "in_progress" | "blocked";
				}>
			>();
			const deliverableAssignmentsByParent = new Map<
				string,
				Array<{
					crewId: string;
					progressStatus: "assigned" | "in_progress" | "blocked";
				}>
			>();
			const taskSubmissionsByParent = new Map<
				string,
				Array<Omit<(typeof taskSubmissionRows)[number], "parentId">>
			>();
			const deliverableSubmissionsByParent = new Map<
				string,
				Array<
					Omit<(typeof deliverableSubmissionRows)[number], "parentId">
				>
			>();
			for (const {
				parentId,
				crewId,
				progressStatus,
			} of taskAssignmentRows) {
				appendGrouped(taskAssignmentsByParent, parentId, {
					crewId,
					progressStatus,
				});
			}
			for (const {
				parentId,
				crewId,
				progressStatus,
			} of deliverableAssignmentRows) {
				appendGrouped(deliverableAssignmentsByParent, parentId, {
					crewId,
					progressStatus,
				});
			}
			for (const { parentId, ...submission } of taskSubmissionRows) {
				if (parentId) {
					appendGrouped(
						taskSubmissionsByParent,
						parentId,
						submission,
					);
				}
			}
			for (const {
				parentId,
				...submission
			} of deliverableSubmissionRows) {
				if (parentId) {
					appendGrouped(
						deliverableSubmissionsByParent,
						parentId,
						submission,
					);
				}
			}
			const rows = [
				...taskRows.map((row) => ({ ...row, type: "task" as const })),
				...deliverableRows.map((row) => ({
					...row,
					type: "deliverable" as const,
				})),
			].sort(
				(left, right) =>
					left.type.localeCompare(right.type) ||
					left.id.localeCompare(right.id),
			);
			const found: ParentReviewMismatch[] = [];
			for (const row of rows) {
				const projection = deriveParentReviewProjection(
					row.type === "task"
						? (taskAssignmentsByParent.get(row.id) ?? [])
						: (deliverableAssignmentsByParent.get(row.id) ?? []),
					row.type === "task"
						? (taskSubmissionsByParent.get(row.id) ?? [])
						: (deliverableSubmissionsByParent.get(row.id) ?? []),
				);
				const mismatch = buildMismatch({
					parentType: row.type,
					parentId: row.id,
					parentName: row.name,
					actualStatus: row.workflowStatus,
					actualApprovalTime: row.approvalTime,
					expectedStatus: projection.workflowStatus,
					expectedApprovalTime: projection.approvalTime,
					approvalTimeEvidenceComplete:
						projection.approvalTimeEvidenceComplete,
				});
				if (mismatch) {
					found.push(mismatch);
				}
			}
			return found;
		},
		{ isolationLevel: "repeatable read", accessMode: "read only" },
	);
	return {
		reportVersion: 1,
		organizationId,
		generatedAt: new Date().toISOString(),
		reportHash: hashReport(organizationId, mismatches),
		summary: {
			total: mismatches.length,
			repairable: mismatches.filter((mismatch) => mismatch.repairable)
				.length,
			requiresManualReview: mismatches.filter(
				(mismatch) => !mismatch.repairable,
			).length,
		},
		mismatches,
	};
}
