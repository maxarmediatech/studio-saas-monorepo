import { z } from "zod";

export const stickyColorSchema = z.enum([
	"yellow",
	"gray",
	"peach",
	"pink",
	"orange",
	"green",
	"light-blue",
	"dark-blue",
	"purple",
]);

export const stickySchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	userId: z.string(),
	title: z.string().max(255).nullable(),
	content: z.string().nullable(),
	descriptionHtml: z.string().nullable(),
	color: stickyColorSchema,
	sortOrder: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const listStickiesInputSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
});

export const listStickiesOutputSchema = z.object({
	data: z.array(stickySchema),
});

export const createStickyInputSchema = z.object({
	title: z.string().optional(),
	content: z.string().optional(),
	descriptionHtml: z.string().optional(),
	color: stickyColorSchema.optional().default("yellow"),
});

export const createStickyOutputSchema = stickySchema;

export const updateStickyInputSchema = z.object({
	id: z.string().min(1),
	title: z.string().optional(),
	content: z.string().optional(),
	descriptionHtml: z.string().optional(),
	color: stickyColorSchema.optional(),
});

export const updateStickyOutputSchema = stickySchema;

export const deleteStickyInputSchema = z.object({
	id: z.string().min(1),
});

export const deleteStickyOutputSchema = z.object({
	success: z.boolean(),
});

export type Sticky = z.infer<typeof stickySchema>;
export type StickyColor = z.infer<typeof stickyColorSchema>;
export type CreateStickyInput = z.infer<typeof createStickyInputSchema>;
export type UpdateStickyInput = z.infer<typeof updateStickyInputSchema>;
