import { ORPCError } from "@orpc/server";
import type { StudioContext } from "../../studio/lib/permissions";
import { hasPermission } from "../../studio/lib/permissions";
import type { ListSubmissionsInput } from "../../studio/schemas/submission";

function isTaskScopedRequest(input: ListSubmissionsInput): boolean {
	return (
		!!input.taskId &&
		!input.deliverableId &&
		!input.bookingId &&
		(input.entityType === undefined || input.entityType === "task")
	);
}

function isDeliverableScopedRequest(input: ListSubmissionsInput): boolean {
	return (
		!!input.deliverableId &&
		!input.taskId &&
		!input.bookingId &&
		(input.entityType === undefined || input.entityType === "deliverable")
	);
}

export async function assertListSubmissionsAccess(
	input: ListSubmissionsInput,
	context: Pick<StudioContext, "headers" | "organizationId">,
): Promise<void> {
	if (await hasPermission(context, "review", "list")) {
		return;
	}

	if (isTaskScopedRequest(input)) {
		const canReadTask =
			(await hasPermission(context, "task", "read")) ||
			(await hasPermission(context, "task", "list"));
		if (canReadTask) {
			return;
		}
	}

	if (isDeliverableScopedRequest(input)) {
		const canReadDeliverable =
			(await hasPermission(context, "deliverable", "read")) ||
			(await hasPermission(context, "deliverable", "list"));
		if (canReadDeliverable) {
			return;
		}
	}

	throw new ORPCError("FORBIDDEN", {
		message: "Permission denied: cannot list submissions",
	});
}
