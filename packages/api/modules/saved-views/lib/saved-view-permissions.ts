import type { Resource } from "@repo/auth/lib/permissions";
import type { StudioContext } from "../../studio/lib/permissions";
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

export async function listAuthorizedSavedViewEntityTypes(
	context: Pick<StudioContext, "headers" | "organizationId">,
	action: "create" | "update" | "delete" | "list",
): Promise<SavedViewEntityType[]> {
	const { hasPermission } = await import("../../studio/lib/permissions");

	const entityTypes = Object.keys(
		savedViewEntityResourceMap,
	) as SavedViewEntityType[];
	const resources = [
		...new Set(entityTypes.map(getSavedViewPermissionResource)),
	];

	const allowedResources = new Set<Resource>();
	const results = await Promise.all(
		resources.map(async (resource) => ({
			resource,
			allowed: await hasPermission(context, resource, action),
		})),
	);

	for (const result of results) {
		if (result.allowed) {
			allowedResources.add(result.resource);
		}
	}

	return entityTypes.filter((entityType) =>
		allowedResources.has(getSavedViewPermissionResource(entityType)),
	);
}

export async function requireSavedViewPermission(
	context: Pick<StudioContext, "headers" | "organizationId">,
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
