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

const organizationRouteInputSchema = z.object({
	organizationSlug: z.string().min(1),
});

export const createChannelInputSchema = organizationRouteInputSchema.extend({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
});

export const updateChannelInputSchema = organizationRouteInputSchema.extend({
	channelId: z.string().min(1),
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	isArchived: z.boolean().optional(),
});

export const getChannelBySlugInputSchema = organizationRouteInputSchema.extend({
	slug: z.string().min(1),
});

export const getChannelInputSchema = organizationRouteInputSchema.extend({
	channelId: z.string().min(1),
});

export const listChannelsInputSchema = organizationRouteInputSchema.extend({
	includeArchived: z.boolean().default(false),
});

export const deleteChannelInputSchema = organizationRouteInputSchema.extend({
	channelId: z.string().min(1),
});

export const addChannelMemberInputSchema = organizationRouteInputSchema.extend({
	channelId: z.string().min(1),
	userId: z.string().min(1),
});

export const removeChannelMemberInputSchema =
	organizationRouteInputSchema.extend({
		channelId: z.string().min(1),
		userId: z.string().min(1),
	});

export const toggleSubscriptionInputSchema =
	organizationRouteInputSchema.extend({
		channelId: z.string().min(1),
		isSubscribed: z.boolean(),
	});

export const createDiscussionInputSchema = organizationRouteInputSchema.extend({
	channelId: z.string().min(1),
	title: z.string().min(1).max(200),
	content: z.string().max(10000).optional(),
	contentJson: z.unknown().optional(),
	links: z
		.array(
			z.object({
				entityType: z.enum(discussionLinkEntityTypes),
				entityId: z.string().min(1),
			}),
		)
		.optional(),
});

export const updateDiscussionInputSchema = organizationRouteInputSchema.extend({
	discussionId: z.string().min(1),
	title: z.string().min(1).max(200).optional(),
	content: z.string().max(10000).optional(),
	contentJson: z.unknown().optional(),
});

export const listDiscussionsInputSchema = organizationRouteInputSchema.extend({
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

export const getDiscussionInputSchema = organizationRouteInputSchema.extend({
	discussionId: z.string().min(1),
});

export const resolveDiscussionInputSchema = organizationRouteInputSchema.extend(
	{
		discussionId: z.string().min(1),
		resolution: z.string().min(1).max(5000),
	},
);

export const reopenDiscussionInputSchema = organizationRouteInputSchema.extend({
	discussionId: z.string().min(1),
});

export const deleteDiscussionInputSchema = organizationRouteInputSchema.extend({
	discussionId: z.string().min(1),
});

export const addDiscussionLinkInputSchema = organizationRouteInputSchema.extend(
	{
		discussionId: z.string().min(1),
		entityType: z.enum(discussionLinkEntityTypes),
		entityId: z.string().min(1),
	},
);

export const removeDiscussionLinkInputSchema =
	organizationRouteInputSchema.extend({
		linkId: z.string().min(1),
	});

export const createMessageInputSchema = organizationRouteInputSchema
	.extend({
		discussionId: z.string().min(1),
		content: z.string().min(1).max(5000).optional(),
		contentJson: z.unknown().optional(),
		parentId: z.string().min(1).optional(),
	})
	.refine((data) => Boolean(data.content || data.contentJson), {
		message: "content or contentJson is required",
	});

export const updateMessageInputSchema = organizationRouteInputSchema
	.extend({
		messageId: z.string().min(1),
		content: z.string().min(1).max(5000).optional(),
		contentJson: z.unknown().optional(),
	})
	.refine((data) => Boolean(data.content || data.contentJson), {
		message: "content or contentJson is required",
	});

export const deleteMessageInputSchema = organizationRouteInputSchema.extend({
	messageId: z.string().min(1),
});

export const listMessagesInputSchema = organizationRouteInputSchema.extend({
	discussionId: z.string().min(1),
	threadRootId: z.string().min(1).optional(),
});
