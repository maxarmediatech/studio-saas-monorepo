import { and, assignmentSubmissions, eq } from "@repo/database";
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
