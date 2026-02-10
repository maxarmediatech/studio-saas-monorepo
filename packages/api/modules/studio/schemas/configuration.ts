/**
 * Configuration Schemas
 *
 * Schemas for managing per-organization customizable settings.
 * Config types: task_status, task_priority, deliverable_status, deliverable_priority,
 * crew_status, shoot_status, booking_type, package_type, relation_type, expense_category
 */

import { z } from "zod";
import {
	configTypeSchema,
	idSchema,
	paginationSchema,
	sortDirectionSchema,
} from "./common";

// ============================================================================
// CONFIGURATION ITEM SCHEMA
// ============================================================================

/**
 * Configuration item as returned from API
 */
export const configurationSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	type: configTypeSchema,
	key: z.string(),
	label: z.string(),
	description: z.string().nullable(),
	color: z.string().nullable(),
	icon: z.string().nullable(),
	sortOrder: z.number(),
	isDefault: z.boolean(),
	isSystem: z.boolean(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Configuration = z.infer<typeof configurationSchema>;

// ============================================================================
// LIST CONFIGURATIONS
// ============================================================================

/**
 * Filters for listing configurations
 */
export const listConfigurationsInputSchema = z
	.object({
		type: configTypeSchema.optional(),
		search: z.string().max(100).optional(),
		sortBy: z
			.enum(["label", "sortOrder", "createdAt"])
			.default("sortOrder"),
		sortDirection: sortDirectionSchema,
	})
	.merge(paginationSchema);

export type ListConfigurationsInput = z.infer<
	typeof listConfigurationsInputSchema
>;

/**
 * List response
 */
export const listConfigurationsOutputSchema = z.object({
	data: z.array(configurationSchema),
	pagination: z.object({
		page: z.number(),
		limit: z.number(),
		total: z.number(),
		pageCount: z.number(),
	}),
});

export type ListConfigurationsOutput = z.infer<
	typeof listConfigurationsOutputSchema
>;

// ============================================================================
// GET CONFIGURATION
// ============================================================================

export const getConfigurationInputSchema = z.object({
	id: idSchema,
});

export type GetConfigurationInput = z.infer<typeof getConfigurationInputSchema>;

export const getConfigurationOutputSchema = z.object({
	data: configurationSchema,
});

export type GetConfigurationOutput = z.infer<
	typeof getConfigurationOutputSchema
>;

// ============================================================================
// CREATE CONFIGURATION
// ============================================================================

export const createConfigurationInputSchema = z.object({
	type: configTypeSchema,
	key: z
		.string()
		.min(1)
		.max(100)
		.regex(
			/^[a-z][a-z0-9_]*$/,
			"Key must start with lowercase letter and contain only lowercase letters, numbers, and underscores",
		),
	label: z.string().min(1).max(255),
	description: z.string().max(1000).optional(),
	color: z
		.string()
		.regex(
			/^#[0-9A-Fa-f]{6}$/,
			"Color must be a valid hex color (e.g., #FF5733)",
		)
		.optional(),
	icon: z.string().max(50).optional(),
	sortOrder: z.number().int().min(0).optional(),
	isDefault: z.boolean().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateConfigurationInput = z.infer<
	typeof createConfigurationInputSchema
>;

export const createConfigurationOutputSchema = z.object({
	data: z.object({
		id: idSchema,
	}),
	message: z.string(),
});

export type CreateConfigurationOutput = z.infer<
	typeof createConfigurationOutputSchema
>;

// ============================================================================
// UPDATE CONFIGURATION
// ============================================================================

export const updateConfigurationInputSchema = z.object({
	id: idSchema,
	label: z.string().min(1).max(255).optional(),
	description: z.string().max(1000).optional().nullable(),
	color: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color")
		.optional()
		.nullable(),
	icon: z.string().max(50).optional().nullable(),
	sortOrder: z.number().int().min(0).optional(),
	isDefault: z.boolean().optional(),
	metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type UpdateConfigurationInput = z.infer<
	typeof updateConfigurationInputSchema
>;

export const updateConfigurationOutputSchema = z.object({
	data: z.object({
		id: idSchema,
	}),
	message: z.string(),
});

export type UpdateConfigurationOutput = z.infer<
	typeof updateConfigurationOutputSchema
>;

// ============================================================================
// DELETE CONFIGURATION
// ============================================================================

export const deleteConfigurationInputSchema = z.object({
	id: idSchema,
});

export type DeleteConfigurationInput = z.infer<
	typeof deleteConfigurationInputSchema
>;

export const deleteConfigurationOutputSchema = z.object({
	data: z.object({
		id: idSchema,
	}),
	message: z.string(),
});

export type DeleteConfigurationOutput = z.infer<
	typeof deleteConfigurationOutputSchema
>;

// ============================================================================
// SEED CONFIGURATIONS
// ============================================================================

/**
 * Seed default configurations for a new organization
 */
export const seedConfigurationsInputSchema = z.object({
	types: z.array(configTypeSchema).optional(),
});

export type SeedConfigurationsInput = z.infer<
	typeof seedConfigurationsInputSchema
>;

export const seedConfigurationsOutputSchema = z.object({
	data: z.object({
		seededCount: z.number(),
		types: z.array(configTypeSchema),
	}),
	message: z.string(),
});

export type SeedConfigurationsOutput = z.infer<
	typeof seedConfigurationsOutputSchema
>;

// ============================================================================
// DEFAULT CONFIGURATIONS
// Per-type default values to seed for new organizations
// ============================================================================

export type DefaultConfigItem = {
	key: string;
	label: string;
	description?: string;
	color?: string;
	icon?: string;
	isDefault?: boolean;
};

export const defaultConfigurations: Record<
	z.infer<typeof configTypeSchema>,
	DefaultConfigItem[]
> = {
	task_status: [
		{ key: "pending", label: "Pending", color: "#6B7280", isDefault: true },
		{ key: "in_progress", label: "In Progress", color: "#3B82F6" },
		{ key: "completed", label: "Completed", color: "#10B981" },
		{ key: "on_hold", label: "On Hold", color: "#F59E0B" },
	],
	task_priority: [
		{ key: "low", label: "Low", color: "#6B7280" },
		{ key: "normal", label: "Normal", color: "#3B82F6", isDefault: true },
		{ key: "high", label: "High", color: "#F59E0B" },
		{ key: "urgent", label: "Urgent", color: "#EF4444" },
	],
	deliverable_status: [
		{ key: "pending", label: "Pending", color: "#6B7280", isDefault: true },
		{ key: "in_progress", label: "In Progress", color: "#3B82F6" },
		{ key: "completed", label: "Completed", color: "#10B981" },
		{ key: "delivered", label: "Delivered", color: "#8B5CF6" },
	],
	deliverable_priority: [
		{ key: "low", label: "Low", color: "#6B7280" },
		{ key: "normal", label: "Normal", color: "#3B82F6", isDefault: true },
		{ key: "high", label: "High", color: "#F59E0B" },
		{ key: "urgent", label: "Urgent", color: "#EF4444" },
	],
	crew_status: [
		{ key: "active", label: "Active", color: "#10B981", isDefault: true },
		{ key: "inactive", label: "Inactive", color: "#6B7280" },
		{ key: "on_leave", label: "On Leave", color: "#F59E0B" },
	],
	crew_role: [
		{
			key: "lead_photographer",
			label: "Lead Photographer",
			isDefault: true,
		},
		{ key: "photographer", label: "Photographer" },
		{ key: "lead_videographer", label: "Lead Videographer" },
		{ key: "videographer", label: "Videographer" },
		{ key: "cinematographer", label: "Cinematographer" },
		{ key: "drone_operator", label: "Drone Operator" },
		{ key: "assistant", label: "Assistant" },
		{ key: "editor", label: "Editor" },
	],
	shoot_status: [
		{
			key: "scheduled",
			label: "Scheduled",
			color: "#3B82F6",
			isDefault: true,
		},
		{ key: "in_progress", label: "In Progress", color: "#F59E0B" },
		{ key: "completed", label: "Completed", color: "#10B981" },
		{ key: "cancelled", label: "Cancelled", color: "#EF4444" },
	],
	booking_type: [
		{ key: "wedding", label: "Wedding", isDefault: true },
		{ key: "pre_wedding", label: "Pre-Wedding" },
		{ key: "engagement", label: "Engagement" },
		{ key: "corporate", label: "Corporate Event" },
		{ key: "birthday", label: "Birthday" },
		{ key: "other", label: "Other" },
	],
	package_type: [
		{ key: "basic", label: "Basic Package", isDefault: true },
		{ key: "standard", label: "Standard Package" },
		{ key: "premium", label: "Premium Package" },
		{ key: "custom", label: "Custom Package" },
	],
	relation_type: [
		{ key: "bride", label: "Bride", isDefault: true },
		{ key: "groom", label: "Groom" },
		{ key: "bride_family", label: "Bride's Family" },
		{ key: "groom_family", label: "Groom's Family" },
		{ key: "friend", label: "Friend" },
		{ key: "other", label: "Other" },
	],
	expense_category: [
		{ key: "travel", label: "Travel", color: "#3B82F6" },
		{ key: "equipment", label: "Equipment", color: "#8B5CF6" },
		{ key: "crew_payment", label: "Crew Payment", color: "#10B981" },
		{ key: "venue", label: "Venue", color: "#F59E0B" },
		{ key: "catering", label: "Catering", color: "#EC4899" },
		{ key: "props", label: "Props", color: "#6366F1" },
		{ key: "other", label: "Other", color: "#6B7280", isDefault: true },
	],
	event_type: [
		{ key: "wedding", label: "Wedding", isDefault: true },
		{ key: "reception", label: "Reception" },
		{ key: "engagement", label: "Engagement" },
		{ key: "pre_wedding", label: "Pre-Wedding" },
		{ key: "haldi", label: "Haldi" },
		{ key: "mehendi", label: "Mehendi" },
		{ key: "sangeet", label: "Sangeet" },
		{ key: "portrait", label: "Portrait" },
		{ key: "maternity", label: "Maternity" },
		{ key: "baby_shoot", label: "Baby Shoot" },
		{ key: "corporate", label: "Corporate Event" },
		{ key: "other", label: "Other" },
	],
	gst_rate: [{ key: "default", label: "GST Rate (18%)", isDefault: true }],
};
