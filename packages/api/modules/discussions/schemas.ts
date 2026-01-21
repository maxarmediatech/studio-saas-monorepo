import { z } from "zod";

export const discussionLinkEntityTypes = [
	"booking",
	"shoot",
	"deliverable",
	"task",
	"payment_schedule",
	"expense",
] as const;

export type DiscussionLinkEntityType =
	(typeof discussionLinkEntityTypes)[number];

export const createChannelInputSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
});

export const updateChannelInputSchema = z.object({
	channelId: z.string().min(1),
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	isArchived: z.boolean().optional(),
});

export const getChannelBySlugInputSchema = z.object({
	slug: z.string().min(1),
});

export const getChannelInputSchema = z.object({
	channelId: z.string().min(1),
});

export const listChannelsInputSchema = z.object({
	includeArchived: z.boolean().default(false),
});

export const deleteChannelInputSchema = z.object({
	channelId: z.string().min(1),
});

export const addChannelMemberInputSchema = z.object({
	channelId: z.string().min(1),
	userId: z.string().min(1),
});

export const removeChannelMemberInputSchema = z.object({
	channelId: z.string().min(1),
	userId: z.string().min(1),
});

export const toggleSubscriptionInputSchema = z.object({
	channelId: z.string().min(1),
	isSubscribed: z.boolean(),
});

export const createDiscussionInputSchema = z.object({
	channelId: z.string().min(1),
	title: z.string().min(1).max(200),
	content: z.string().max(10000).optional(),
	links: z
		.array(
			z.object({
				entityType: z.enum(discussionLinkEntityTypes),
				entityId: z.string().min(1),
			}),
		)
		.optional(),
});

export const updateDiscussionInputSchema = z.object({
	discussionId: z.string().min(1),
	title: z.string().min(1).max(200).optional(),
	content: z.string().max(10000).optional(),
});

export const listDiscussionsInputSchema = z.object({
	channelId: z.string().min(1),
	status: z.enum(["open", "resolved", "all"]).default("all"),
	sortBy: z.enum(["created", "activity"]).default("created"),
	cursor: z
		.object({
			createdAt: z.string().datetime(),
			id: z.string().min(1),
		})
		.optional(),
	limit: z.number().min(1).max(100).default(20),
});

export const getDiscussionInputSchema = z.object({
	discussionId: z.string().min(1),
});

export const resolveDiscussionInputSchema = z.object({
	discussionId: z.string().min(1),
	resolution: z.string().min(1).max(5000),
});

export const reopenDiscussionInputSchema = z.object({
	discussionId: z.string().min(1),
});

export const deleteDiscussionInputSchema = z.object({
	discussionId: z.string().min(1),
});

export const addDiscussionLinkInputSchema = z.object({
	discussionId: z.string().min(1),
	entityType: z.enum(discussionLinkEntityTypes),
	entityId: z.string().min(1),
});

export const removeDiscussionLinkInputSchema = z.object({
	linkId: z.string().min(1),
});

export const createMessageInputSchema = z.object({
	discussionId: z.string().min(1),
	content: z.string().min(1).max(5000),
	parentId: z.string().min(1).optional(),
});

export const updateMessageInputSchema = z.object({
	messageId: z.string().min(1),
	content: z.string().min(1).max(5000),
});

export const deleteMessageInputSchema = z.object({
	messageId: z.string().min(1),
});

export const listMessagesInputSchema = z.object({
	discussionId: z.string().min(1),
	threadRootId: z.string().min(1).optional(),
});
