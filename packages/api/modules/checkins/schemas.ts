import { z } from "zod";

export const checkinLinkEntityTypes = [
	"booking",
	"shoot",
	"deliverable",
	"task",
	"payment_schedule",
	"expense",
] as const;

export type CheckinLinkEntityType = (typeof checkinLinkEntityTypes)[number];

export const createCheckinTypeInputSchema = z.object({
	teamId: z.string().min(1),
	name: z.string().min(1).max(100),
	emoji: z.string().max(10).optional(),
	description: z.string().max(500).optional(),
	frequency: z.enum(["daily", "weekdays", "weekly"]),
	scheduledTime: z
		.string()
		.regex(/^\d{2}:\d{2}$/)
		.optional(),
});

export const updateCheckinTypeInputSchema = z.object({
	checkinTypeId: z.string().min(1),
	name: z.string().min(1).max(100).optional(),
	emoji: z.string().max(10).optional(),
	description: z.string().max(500).optional(),
	frequency: z.enum(["daily", "weekdays", "weekly"]).optional(),
	scheduledTime: z
		.string()
		.regex(/^\d{2}:\d{2}$/)
		.optional(),
	isActive: z.boolean().optional(),
});

export const listCheckinTypesInputSchema = z.object({
	teamId: z.string().min(1).optional(),
	includeInactive: z.boolean().default(false),
});

export const getCheckinTypeInputSchema = z.object({
	checkinTypeId: z.string().min(1),
});

export const deleteCheckinTypeInputSchema = z.object({
	checkinTypeId: z.string().min(1),
});

export const createCheckinInputSchema = z.object({
	checkinTypeId: z.string().min(1),
	content: z.string().max(10000).optional(),
	contentJson: z.unknown().optional(),
	checkinDate: z.string().date(),
	links: z
		.array(
			z.object({
				entityType: z.enum(checkinLinkEntityTypes),
				entityId: z.string().min(1),
			}),
		)
		.optional(),
});

export const updateCheckinInputSchema = z.object({
	checkinId: z.string().min(1),
	content: z.string().max(10000).optional(),
	contentJson: z.unknown().optional(),
});

export const listCheckinsInputSchema = z.object({
	checkinTypeId: z.string().min(1),
	cursor: z
		.object({
			checkinDate: z.string().date(),
			id: z.string().min(1),
		})
		.optional(),
	limit: z.number().min(1).max(100).default(20),
});

export const getCheckinInputSchema = z.object({
	checkinId: z.string().min(1),
});

export const deleteCheckinInputSchema = z.object({
	checkinId: z.string().min(1),
});

export const createCommentInputSchema = z
	.object({
		checkinId: z.string().min(1),
		content: z.string().min(1).max(5000).optional(),
		contentJson: z.unknown().optional(),
		parentId: z.string().min(1).optional(),
	})
	.refine((data) => Boolean(data.content || data.contentJson), {
		message: "content or contentJson is required",
	});

export const updateCommentInputSchema = z
	.object({
		commentId: z.string().min(1),
		content: z.string().min(1).max(5000).optional(),
		contentJson: z.unknown().optional(),
	})
	.refine((data) => Boolean(data.content || data.contentJson), {
		message: "content or contentJson is required",
	});

export const deleteCommentInputSchema = z.object({
	commentId: z.string().min(1),
});

export const listCommentsInputSchema = z.object({
	checkinId: z.string().min(1),
	threadRootId: z.string().min(1).optional(),
});

export const addCheckinLinkInputSchema = z.object({
	checkinId: z.string().min(1),
	entityType: z.enum(checkinLinkEntityTypes),
	entityId: z.string().min(1),
});

export const removeCheckinLinkInputSchema = z.object({
	linkId: z.string().min(1),
});

export const listUserCheckinsInputSchema = z.object({
	userId: z.string().min(1),
	dateFrom: z.string().date().optional(),
	dateTo: z.string().date().optional(),
	limit: z.number().min(1).max(100).default(20),
	cursor: z
		.object({
			checkinDate: z.string().date(),
			id: z.string().min(1),
		})
		.optional(),
});
