import type { YourWorkItem } from "@repo/api/modules/studio/schemas/your-work";

export function getYourWorkEntityHref(
	organizationSlug: string,
	item: Pick<YourWorkItem, "entityType" | "entityId">,
) {
	switch (item.entityType) {
		case "task":
			return `/app/${organizationSlug}/tasks/${item.entityId}`;
		case "deliverable":
			return `/app/${organizationSlug}/deliverables/${item.entityId}`;
		case "shoot":
			return `/app/${organizationSlug}/shoots/${item.entityId}`;
		default:
			return `/app/${organizationSlug}/home`;
	}
}
