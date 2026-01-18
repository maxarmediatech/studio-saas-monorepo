import { z } from "zod";
import {
	paginationResponseSchema,
	paginationSchema,
	workflowStatusSchema,
} from "./common";

// ============================================================================
// YOUR WORK SCHEMAS
// ============================================================================

export const yourWorkEntityTypeSchema = z.enum([
	"task",
	"deliverable",
	"shoot",
]);

export const yourWorkViewSchema = z.enum([
	"assigned",
	"created",
	"subscribed",
]);

export const listYourWorkInputSchema = paginationSchema.extend({
	view: yourWorkViewSchema.default("assigned"),
	entityType: z.union([z.literal("all"), yourWorkEntityTypeSchema]).default(
		"all",
	),
});

export const yourWorkItemSchema = z.object({
	id: z.string(),
	entityType: yourWorkEntityTypeSchema,
	entityId: z.string(),
	name: z.string(),
	status: z.string().nullable(),
	workflowStatus: workflowStatusSchema.nullable(),
	date: z.string().nullable(),
	bookingId: z.string().nullable(),
	bookingName: z.string().nullable(),
	isSubscribed: z.boolean(),
});

export const listYourWorkOutputSchema = z.object({
	data: z.array(yourWorkItemSchema),
	pagination: paginationResponseSchema,
});

export const subscriptionInputSchema = z.object({
	entityType: yourWorkEntityTypeSchema,
	entityId: z.string().min(1),
});

export const subscriptionStatusOutputSchema = z.object({
	subscribed: z.boolean(),
});

// ============================================================================
// TYPES
// ============================================================================

export type YourWorkView = z.infer<typeof yourWorkViewSchema>;
export type YourWorkEntityType = z.infer<typeof yourWorkEntityTypeSchema>;
export type YourWorkItem = z.infer<typeof yourWorkItemSchema>;
