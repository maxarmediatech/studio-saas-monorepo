import { z } from "zod";

export const entityTypeSchema = z.enum([
	"booking",
	"shoot",
	"task",
	"deliverable",
]);

export const entityTypeFilterSchema = z.enum([
	"booking",
	"shoot",
	"task",
	"deliverable",
	"all",
]);

export const trackVisitInputSchema = z.object({
	entityType: entityTypeSchema,
	entityId: z.string().min(1),
});

export const trackVisitOutputSchema = z.object({
	success: z.boolean(),
});

export const listRecentVisitsInputSchema = z.object({
	entityType: entityTypeFilterSchema.optional().default("all"),
	limit: z.number().min(1).max(20).optional().default(10),
});

export const recentVisitItemSchema = z.object({
	id: z.string(),
	entityType: z.string(),
	entityId: z.string(),
	visitedAt: z.string(),
	entityData: z
		.object({
			id: z.string(),
			name: z.string(),
			status: z.string().optional(),
			referenceNumber: z.string().optional(),
			bookingId: z.string().optional(),
		})
		.nullable(),
});

export const listRecentVisitsOutputSchema = z.object({
	data: z.array(recentVisitItemSchema),
});

export type EntityType = z.infer<typeof entityTypeSchema>;
export type RecentVisitItem = z.infer<typeof recentVisitItemSchema>;
