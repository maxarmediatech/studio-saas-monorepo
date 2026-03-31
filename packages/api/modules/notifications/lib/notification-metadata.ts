import { z } from "zod";

export const statusChangedNotificationMetadataSchema = z.object({
	oldStatus: z.string(),
	newStatus: z.string(),
});

export const assignedNotificationMetadataSchema = z.object({
	assigneeName: z.string(),
	assigneeId: z.string().nullable().optional(),
});

export const reviewRequestedNotificationMetadataSchema = z.object({
	submittedByName: z.string(),
});

export const reviewDecisionNotificationMetadataSchema = z.object({
	outcome: z.enum(["approved", "rejected", "revision_requested"]),
	reviewerName: z.string().nullable().optional(),
	reviewNote: z.string().nullable().optional(),
});

export const deadlineReminderNotificationMetadataSchema = z.object({
	kind: z.enum(["due_soon", "overdue"]),
	dueDate: z.string(),
	daysUntilDue: z.number().int().nullable().optional(),
});

export const notificationMetadataSchema = z
	.union([
		statusChangedNotificationMetadataSchema,
		assignedNotificationMetadataSchema,
		reviewRequestedNotificationMetadataSchema,
		reviewDecisionNotificationMetadataSchema,
		deadlineReminderNotificationMetadataSchema,
	])
	.nullable();

export type StatusChangedNotificationMetadata = z.infer<
	typeof statusChangedNotificationMetadataSchema
>;
export type AssignedNotificationMetadata = z.infer<
	typeof assignedNotificationMetadataSchema
>;
export type ReviewRequestedNotificationMetadata = z.infer<
	typeof reviewRequestedNotificationMetadataSchema
>;
export type ReviewDecisionNotificationMetadata = z.infer<
	typeof reviewDecisionNotificationMetadataSchema
>;
export type DeadlineReminderNotificationMetadata = z.infer<
	typeof deadlineReminderNotificationMetadataSchema
>;
export type NotificationMetadata = z.infer<typeof notificationMetadataSchema>;

export function parseNotificationMetadata(
	metadata: unknown,
): NotificationMetadata {
	const parsed = notificationMetadataSchema.safeParse(metadata);
	return parsed.success ? parsed.data : null;
}

export function isDeadlineReminderMetadata(
	metadata: NotificationMetadata | undefined,
): metadata is DeadlineReminderNotificationMetadata {
	return Boolean(metadata && "kind" in metadata && "dueDate" in metadata);
}
