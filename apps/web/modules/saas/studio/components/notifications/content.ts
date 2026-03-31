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

function formatDisplayDate(value: string) {
	const parsed = new Date(`${value}T00:00:00`);

	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(parsed);
}

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

	if (
		notification.type === "review_requested" &&
		notification.metadata &&
		"submittedByName" in notification.metadata
	) {
		return `Submitted by ${notification.metadata.submittedByName}`;
	}

	if (
		(notification.type === "review_approved" ||
			notification.type === "review_rejected" ||
			notification.type === "review_revision_requested") &&
		notification.metadata &&
		"outcome" in notification.metadata
	) {
		const actor =
			notification.metadata.reviewerName ??
			notification.actorName ??
			"Reviewer";
		const prefix =
			notification.metadata.outcome === "approved"
				? `Approved by ${actor}`
				: notification.metadata.outcome === "rejected"
					? `Rejected by ${actor}`
					: `Changes requested by ${actor}`;

		return notification.metadata.reviewNote
			? `${prefix}: ${notification.metadata.reviewNote}`
			: prefix;
	}

	if (
		(notification.type === "due_soon" || notification.type === "overdue") &&
		notification.metadata &&
		"kind" in notification.metadata &&
		"dueDate" in notification.metadata
	) {
		const formattedDueDate = formatDisplayDate(
			notification.metadata.dueDate,
		);

		if (notification.metadata.kind === "due_soon") {
			return notification.metadata.daysUntilDue === 1
				? `Due tomorrow, ${formattedDueDate}`
				: `Due on ${formattedDueDate}`;
		}

		return `Overdue since ${formattedDueDate}`;
	}

	return notification.body;
}

export function getNotificationTypeLabel(notification: NotificationItem) {
	switch (notification.type) {
		case "assigned":
			return "Assignment";
		case "status_changed":
			return "Status";
		case "review_requested":
			return "Review";
		case "review_approved":
		case "review_rejected":
		case "review_revision_requested":
			return "Decision";
		case "due_soon":
		case "overdue":
			return "Reminder";
		default:
			return "Update";
	}
}

export function getNotificationTypeTone(notification: NotificationItem) {
	switch (notification.type) {
		case "assigned":
			return "bg-blue-50 text-blue-700";
		case "review_requested":
		case "due_soon":
			return "bg-amber-50 text-amber-700";
		case "review_approved":
			return "bg-emerald-50 text-emerald-700";
		case "review_rejected":
		case "review_revision_requested":
		case "overdue":
			return "bg-red-50 text-red-700";
		default:
			return "bg-neutral-100 text-neutral-700";
	}
}
