import type { Resource } from "@repo/auth/lib/permissions";
import type { SavedViewEntityType } from "../../studio/schemas/saved-view";

const savedViewEntityResourceMap: Record<SavedViewEntityType, Resource> = {
	booking: "booking",
	task: "task",
	shoot: "shoot",
	deliverable: "deliverable",
	payment: "payment",
	schedule: "payment",
	expense: "expense",
	crew: "crew",
	client: "client",
	invoice: "payment",
};

export function getSavedViewPermissionResource(
	entityType: SavedViewEntityType,
): Resource {
	return savedViewEntityResourceMap[entityType];
}

export async function requireSavedViewPermission(
	context: { headers: Headers },
	entityType: SavedViewEntityType,
	action: "create" | "update" | "delete" | "list",
): Promise<void> {
	const { requirePermission } = await import("../../studio/lib/permissions");

	await requirePermission(
		context,
		getSavedViewPermissionResource(entityType),
		action,
	);
}
