import type { NotificationMetadata } from "./notification-metadata";
import type { NotificationRecipientReason } from "./notification-preferences";

export type NotificationEntityType = "deliverable" | "shoot" | "task";

export interface NotifyEntityUsersInput {
	organizationId: string;
	entityType: NotificationEntityType;
	entityId: string;
	entityName: string;
	type: string;
	title: string;
	body?: string;
	metadata?: NotificationMetadata;
	actorId?: string;
	actorName?: string;
	excludeUserId?: string;
}

export interface EntityNotificationContext {
	assignerUserIds: string[];
	assigneeUserIds: string[];
	bookingOwnerUserId: string | null;
}

function addRecipientReason(
	recipients: Map<string, Set<NotificationRecipientReason>>,
	userId: string | null | undefined,
	reason: NotificationRecipientReason,
) {
	if (!userId) {
		return;
	}

	const reasons =
		recipients.get(userId) ?? new Set<NotificationRecipientReason>();
	reasons.add(reason);
	recipients.set(userId, reasons);
}

export function buildRecipientReasons(
	input: NotifyEntityUsersInput,
	context: EntityNotificationContext,
	subscriberUserIds: string[],
) {
	const recipients = new Map<string, Set<NotificationRecipientReason>>();

	for (const userId of subscriberUserIds) {
		if (input.type === "due_soon" || input.type === "overdue") {
			addRecipientReason(recipients, userId, "reminder");
		} else {
			addRecipientReason(recipients, userId, "subscriber");
		}
	}

	if (input.type === "assigned") {
		const assigneeId =
			input.metadata && "assigneeId" in input.metadata
				? input.metadata.assigneeId
				: null;

		addRecipientReason(recipients, assigneeId, "assignee");
	}

	if (
		input.type === "status_changed" ||
		input.type === "review_approved" ||
		input.type === "review_rejected" ||
		input.type === "review_revision_requested"
	) {
		for (const userId of context.assigneeUserIds) {
			addRecipientReason(recipients, userId, "assignee");
		}
	}

	if (input.type === "due_soon") {
		for (const userId of context.assigneeUserIds) {
			addRecipientReason(recipients, userId, "reminder");
		}
	}

	if (input.type === "overdue") {
		for (const userId of context.assigneeUserIds) {
			addRecipientReason(recipients, userId, "reminder");
		}

		addRecipientReason(recipients, context.bookingOwnerUserId, "reminder");
	}

	if (
		input.type === "assigned" ||
		input.type === "status_changed" ||
		input.type === "review_requested" ||
		input.type === "review_approved" ||
		input.type === "review_rejected" ||
		input.type === "review_revision_requested"
	) {
		for (const userId of context.assignerUserIds) {
			addRecipientReason(recipients, userId, "assigner");
		}

		addRecipientReason(
			recipients,
			context.bookingOwnerUserId,
			"booking_owner",
		);
	}

	return recipients;
}
