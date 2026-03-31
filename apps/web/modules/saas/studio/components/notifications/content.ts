import type {
	NotificationItem,
	StatusChangedNotificationMetadata,
} from "@repo/api/modules/studio/schemas/notification";

type NotificationConfigType =
	| "task_status"
	| "deliverable_status"
	| "shoot_status";

export type NotificationStatusLabelMaps = Partial<
	Record<NotificationConfigType, Record<string, string>>
>;

function humanizeKey(value: string) {
	return value
		.split("_")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function getConfigTypeForEntityType(
	entityType: NotificationItem["entityType"],
): NotificationConfigType {
	switch (entityType) {
		case "task":
			return "task_status";
		case "deliverable":
			return "deliverable_status";
		case "shoot":
			return "shoot_status";
	}
}

function parseLegacyStatusTransition(
	body: string | null,
): StatusChangedNotificationMetadata | null {
	if (!body) {
		return null;
	}

	const parts = body.split("->").map((part) => part.trim());

	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		return null;
	}

	return {
		oldStatus: parts[0],
		newStatus: parts[1],
	};
}

function getStatusTransition(
	notification: NotificationItem,
): StatusChangedNotificationMetadata | null {
	if (
		notification.type === "status_changed" &&
		notification.metadata &&
		"oldStatus" in notification.metadata &&
		"newStatus" in notification.metadata
	) {
		return {
			oldStatus: notification.metadata.oldStatus,
			newStatus: notification.metadata.newStatus,
		};
	}

	return parseLegacyStatusTransition(notification.body);
}

function resolveStatusLabel(
	entityType: NotificationItem["entityType"],
	status: string,
	statusLabelMaps: NotificationStatusLabelMaps,
) {
	const configType = getConfigTypeForEntityType(entityType);
	return statusLabelMaps[configType]?.[status] ?? humanizeKey(status);
}

export function getNotificationBodyText(
	notification: NotificationItem,
	statusLabelMaps: NotificationStatusLabelMaps,
) {
	if (notification.type === "status_changed") {
		const transition = getStatusTransition(notification);

		if (transition) {
			return `${resolveStatusLabel(notification.entityType, transition.oldStatus, statusLabelMaps)} -> ${resolveStatusLabel(notification.entityType, transition.newStatus, statusLabelMaps)}`;
		}
	}

	if (
		notification.type === "assigned" &&
		notification.metadata &&
		"assigneeName" in notification.metadata
	) {
		return `Assigned to ${notification.metadata.assigneeName}`;
	}

	return notification.body;
}
