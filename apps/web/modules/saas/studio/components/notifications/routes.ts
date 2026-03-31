import type { NotificationItem } from "@repo/api/modules/studio/schemas/notification";

export function getNotificationEntityHref(
	organizationSlug: string | undefined,
	item: Pick<NotificationItem, "entityType" | "entityId">,
) {
	if (!organizationSlug) {
		return null;
	}

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
