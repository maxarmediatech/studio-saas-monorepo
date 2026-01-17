import { z } from "zod";
import { idSchema } from "./common";

export const savedViewEntityTypeSchema = z.enum([
	"booking",
	"task",
	"shoot",
	"deliverable",
	"payment",
	"schedule",
	"expense",
	"crew",
	"client",
	"invoice",
]);

export type SavedViewEntityType = z.infer<typeof savedViewEntityTypeSchema>;

export const savedViewSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	createdBy: idSchema.nullable(),
	entityType: savedViewEntityTypeSchema,
	name: z.string(),
	description: z.string().nullable(),
	icon: z.string().nullable(),
	color: z.string().nullable(),
	filters: z.record(z.string(), z.unknown()),
	displayFilters: z.record(z.string(), z.unknown()).nullable(),
	columnVisibility: z.record(z.string(), z.boolean()).nullable(),
	sorting: z
		.array(z.object({ id: z.string(), desc: z.boolean() }))
		.nullable(),
	isSystem: z.boolean(),
	isDefault: z.boolean(),
	isPublic: z.boolean(),
	sortOrder: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
	isFavorite: z.boolean(),
	createdByUser: z
		.object({
			id: idSchema,
			name: z.string().nullable(),
			image: z.string().nullable(),
		})
		.nullable(),
});

export type SavedView = z.infer<typeof savedViewSchema>;

export const listSavedViewsInputSchema = z.object({
	entityType: savedViewEntityTypeSchema,
});

export type ListSavedViewsInput = z.infer<typeof listSavedViewsInputSchema>;

export const listSavedViewsOutputSchema = z.object({
	data: z.array(savedViewSchema),
});

export type ListSavedViewsOutput = z.infer<typeof listSavedViewsOutputSchema>;

export const createSavedViewInputSchema = z.object({
	entityType: savedViewEntityTypeSchema,
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	icon: z.string().max(50).optional(),
	color: z.string().max(20).optional(),
	filters: z.record(z.string(), z.unknown()).optional(),
	displayFilters: z.record(z.string(), z.unknown()).optional(),
	columnVisibility: z.record(z.string(), z.boolean()).optional(),
	sorting: z
		.array(z.object({ id: z.string(), desc: z.boolean() }))
		.optional(),
	isPublic: z.boolean().optional(),
});

export type CreateSavedViewInput = z.infer<typeof createSavedViewInputSchema>;

export const createSavedViewOutputSchema = z.object({
	data: z.object({ id: idSchema }),
	message: z.string(),
});

export type CreateSavedViewOutput = z.infer<typeof createSavedViewOutputSchema>;

export const updateSavedViewInputSchema = z.object({
	id: idSchema,
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional().nullable(),
	icon: z.string().max(50).optional().nullable(),
	color: z.string().max(20).optional().nullable(),
	filters: z.record(z.string(), z.unknown()).optional(),
	displayFilters: z.record(z.string(), z.unknown()).optional().nullable(),
	columnVisibility: z.record(z.string(), z.boolean()).optional().nullable(),
	sorting: z
		.array(z.object({ id: z.string(), desc: z.boolean() }))
		.optional()
		.nullable(),
	isPublic: z.boolean().optional(),
});

export type UpdateSavedViewInput = z.infer<typeof updateSavedViewInputSchema>;

export const updateSavedViewOutputSchema = z.object({
	data: z.object({ id: idSchema }),
	message: z.string(),
});

export type UpdateSavedViewOutput = z.infer<typeof updateSavedViewOutputSchema>;

export const deleteSavedViewInputSchema = z.object({
	id: idSchema,
});

export type DeleteSavedViewInput = z.infer<typeof deleteSavedViewInputSchema>;

export const deleteSavedViewOutputSchema = z.object({
	data: z.object({ id: idSchema }),
	message: z.string(),
});

export type DeleteSavedViewOutput = z.infer<typeof deleteSavedViewOutputSchema>;

export const toggleFavoriteInputSchema = z.object({
	viewId: idSchema,
});

export type ToggleFavoriteInput = z.infer<typeof toggleFavoriteInputSchema>;

export const toggleFavoriteOutputSchema = z.object({
	data: z.object({ isFavorite: z.boolean() }),
	message: z.string(),
});

export type ToggleFavoriteOutput = z.infer<typeof toggleFavoriteOutputSchema>;
