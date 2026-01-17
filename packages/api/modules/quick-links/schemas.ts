import { z } from "zod";

// ============================================================================
// QUICK LINK SCHEMAS
// ============================================================================

export const quickLinkSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	userId: z.string(),
	title: z.string().nullable(),
	url: z.string(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	sortOrder: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const listQuickLinksInputSchema = z.object({});

export const listQuickLinksOutputSchema = z.object({
	data: z.array(quickLinkSchema),
});

export const createQuickLinkInputSchema = z.object({
	url: z.string().min(1, "URL is required"),
	title: z.string().optional(),
});

export const createQuickLinkOutputSchema = quickLinkSchema;

export const updateQuickLinkInputSchema = z.object({
	id: z.string().min(1),
	url: z.string().min(1).optional(),
	title: z.string().optional(),
});

export const updateQuickLinkOutputSchema = quickLinkSchema;

export const deleteQuickLinkInputSchema = z.object({
	id: z.string().min(1),
});

export const deleteQuickLinkOutputSchema = z.object({
	success: z.boolean(),
});

// ============================================================================
// TYPES
// ============================================================================

export type QuickLink = z.infer<typeof quickLinkSchema>;
export type CreateQuickLinkInput = z.infer<typeof createQuickLinkInputSchema>;
export type UpdateQuickLinkInput = z.infer<typeof updateQuickLinkInputSchema>;
