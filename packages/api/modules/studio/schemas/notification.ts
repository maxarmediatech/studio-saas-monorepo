import { z } from "zod";
import { notificationMetadataSchema } from "../../notifications/lib/notification-metadata";
import {
	datetimeSchema,
	paginationResponseSchema,
	paginationSchema,
} from "./common";
import { yourWorkEntityTypeSchema } from "./your-work";

// ============================================================================
// NOTIFICATION SCHEMAS
// ============================================================================

export const notificationSchema = z.object({
	id: z.string(),
	entityType: yourWorkEntityTypeSchema,
	entityId: z.string(),
	entityName: z.string(),
	type: z.string(),
	title: z.string(),
	body: z.string().nullable(),
	metadata: notificationMetadataSchema,
	actorId: z.string().nullable(),
	actorName: z.string().nullable(),
	readAt: datetimeSchema.nullable(),
	createdAt: datetimeSchema,
});

export const listNotificationsInputSchema = paginationSchema.extend({
	unreadOnly: z.boolean().default(false),
});

export const listNotificationsOutputSchema = z.object({
	data: z.array(notificationSchema),
	pagination: paginationResponseSchema,
});

export const markNotificationReadInputSchema = z.object({
	id: z.string().min(1),
});

export const markNotificationReadOutputSchema = z.object({
	data: z.object({ id: z.string() }),
	message: z.string(),
});

export const markAllNotificationsReadOutputSchema = z.object({
	success: z.boolean(),
});

export const unreadNotificationCountOutputSchema = z.object({
	count: z.number(),
});

// ============================================================================
// TYPES
// ============================================================================

export type NotificationItem = z.infer<typeof notificationSchema>;
export type NotificationMetadata = NonNullable<
	z.infer<typeof notificationMetadataSchema>
>;
export type StatusChangedNotificationMetadata =
	z.infer<typeof notificationMetadataSchema> extends infer T
		? Extract<T, { oldStatus: string; newStatus: string }>
		: never;
