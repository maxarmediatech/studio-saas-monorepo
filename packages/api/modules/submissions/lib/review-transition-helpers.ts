import { ORPCError } from "@orpc/server";
import {
	and,
	assignmentSubmissions,
	deliverables,
	eq,
	isNull,
	tasks,
} from "@repo/database";
import type { StudioContext } from "../../studio/lib/permissions";
import type { TransactionClient } from "../../studio/lib/transactions";

export type ReviewActorContext = Pick<StudioContext, "organizationId" | "user">;

export interface SubmissionParent {
	id: string;
	name: string;
	type: "task" | "deliverable";
}

export interface SubmissionRelationship {
	deliverableId: string | null;
	taskId: string | null;
}

export async function getSubmissionParent(
	tx: TransactionClient,
	organizationId: string,
	submission: SubmissionRelationship,
): Promise<SubmissionParent> {
	if (submission.taskId && !submission.deliverableId) {
		const task = await tx.query.tasks.findFirst({
			where: and(
				eq(tasks.id, submission.taskId),
				eq(tasks.organizationId, organizationId),
				isNull(tasks.deletedAt),
			),
			columns: { id: true, name: true },
		});
		if (task) {
			return { id: task.id, name: task.name, type: "task" };
		}
	}

	if (submission.deliverableId && !submission.taskId) {
		const deliverable = await tx.query.deliverables.findFirst({
			where: and(
				eq(deliverables.id, submission.deliverableId),
				eq(deliverables.organizationId, organizationId),
				isNull(deliverables.deletedAt),
			),
			columns: { id: true, name: true },
		});
		if (deliverable) {
			return {
				id: deliverable.id,
				name: deliverable.name,
				type: "deliverable",
			};
		}
	}

	throw new ORPCError("CONFLICT", {
		message:
			"Submission parent is no longer available in this organization",
	});
}

export function findScopedSubmission(
	tx: TransactionClient,
	organizationId: string,
	id: string,
) {
	return tx.query.assignmentSubmissions.findFirst({
		where: and(
			eq(assignmentSubmissions.id, id),
			eq(assignmentSubmissions.organizationId, organizationId),
		),
		columns: {
			id: true,
			status: true,
			reviewedBy: true,
			reviewClaimedAt: true,
			taskId: true,
			deliverableId: true,
		},
	});
}
