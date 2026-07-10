import { activities } from "@repo/database";
import type { ActionType } from "../../activities/lib";
import type { TransactionClient } from "../../studio/lib/transactions";

export interface ReviewActivityActor {
	organizationId: string;
	user: { id: string; name: string };
}

interface ReviewActivityParent {
	id: string;
	name: string;
	type: "task" | "deliverable";
}

export async function recordReviewActivity(
	tx: TransactionClient,
	actor: ReviewActivityActor,
	input: {
		action: ActionType;
		entityName: string;
		metadata: Record<string, unknown>;
		newIdentifier?: string | null;
		newValue?: string | null;
		oldIdentifier?: string | null;
		oldValue?: string | null;
		parent: ReviewActivityParent;
		submissionId: string;
	},
): Promise<void> {
	await tx.insert(activities).values({
		organizationId: actor.organizationId,
		actorId: actor.user.id,
		actorType: "user",
		actorName: actor.user.name || "Unknown User",
		entityType: "submission",
		entityId: input.submissionId,
		entityName: input.entityName,
		parentEntityType: input.parent.type,
		parentEntityId: input.parent.id,
		parentEntityName: input.parent.name,
		action: input.action,
		field: input.oldIdentifier !== undefined ? "reviewedBy" : "status",
		oldValue: input.oldValue ?? null,
		newValue: input.newValue ?? null,
		oldIdentifier: input.oldIdentifier ?? null,
		newIdentifier: input.newIdentifier ?? null,
		metadata: input.metadata,
	});
}
