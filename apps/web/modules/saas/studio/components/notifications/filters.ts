import type { NotificationTypeFilter } from "@repo/api/modules/studio/schemas/notification";

export const notificationTypeFilterOptions = [
	{ value: "all", label: "All types" },
	{ value: "assignments", label: "Assignments" },
	{ value: "status", label: "Status" },
	{ value: "reviews", label: "Reviews" },
	{ value: "reminders", label: "Reminders" },
] as const;

export type NotificationTypeFilterValue =
	(typeof notificationTypeFilterOptions)[number]["value"];

const notificationTypeFilters: Record<
	NotificationTypeFilterValue,
	NotificationTypeFilter[] | undefined
> = {
	all: undefined,
	assignments: ["assigned"],
	status: ["status_changed"],
	reviews: [
		"review_requested",
		"review_approved",
		"review_rejected",
		"review_revision_requested",
	],
	reminders: ["due_soon", "overdue"],
};

export function getNotificationTypesForFilter(
	filter: NotificationTypeFilterValue,
) {
	return notificationTypeFilters[filter];
}

export function getNotificationEmptyStateCopy(
	readFilter: "all" | "unread",
	typeFilter: NotificationTypeFilterValue,
) {
	if (readFilter === "unread") {
		return {
			title:
				typeFilter === "all"
					? "No unread notifications."
					: "No unread notifications in this type.",
			description: "You’re all caught up.",
		};
	}

	return {
		title:
			typeFilter === "all"
				? "No notifications yet."
				: "No notifications in this type yet.",
		description:
			"New updates from tasks, shoots, and deliverables will appear here.",
	};
}
