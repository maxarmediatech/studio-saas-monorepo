import { z } from "zod";

export const statusChangedNotificationMetadataSchema = z.object({
	oldStatus: z.string(),
	newStatus: z.string(),
});

export const assignedNotificationMetadataSchema = z.object({
	assigneeName: z.string(),
	assigneeId: z.string().nullable().optional(),
});

export const notificationMetadataSchema = z
	.union([
		statusChangedNotificationMetadataSchema,
		assignedNotificationMetadataSchema,
	])
	.nullable();

export type StatusChangedNotificationMetadata = z.infer<
	typeof statusChangedNotificationMetadataSchema
>;
export type AssignedNotificationMetadata = z.infer<
	typeof assignedNotificationMetadataSchema
>;
export type NotificationMetadata = z.infer<typeof notificationMetadataSchema>;

export function parseNotificationMetadata(
	metadata: unknown,
): NotificationMetadata {
	const parsed = notificationMetadataSchema.safeParse(metadata);
	return parsed.success ? parsed.data : null;
}
