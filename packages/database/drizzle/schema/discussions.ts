import { relations, sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { users } from "./auth";
import { organizations } from "./core";
import { channelVisibilityEnum, discussionStatusEnum } from "./enums";

export const channels = pgTable(
	"channels",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		name: text("name").notNull(),
		slug: varchar("slug", { length: 100 }).notNull(),
		description: text("description"),
		emoji: varchar("emoji", { length: 20 }).default("💬"),
		visibility: channelVisibilityEnum("visibility")
			.default("public")
			.notNull(),

		isArchived: boolean("is_archived").default(false).notNull(),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		uniqueIndex("channels_org_slug_unique")
			.on(table.organizationId, table.slug)
			.where(sql`deleted_at IS NULL`),
		index("channels_org_idx").on(table.organizationId),
	],
);

export const channelMembers = pgTable(
	"channel_members",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		channelId: varchar("channel_id", { length: 255 })
			.notNull()
			.references(() => channels.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		isSubscribed: boolean("is_subscribed").default(true).notNull(),
		lastReadAt: timestamp("last_read_at", { withTimezone: true }),

		joinedAt: timestamp("joined_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("channel_members_channel_user_unique").on(
			table.channelId,
			table.userId,
		),
		index("channel_members_user_idx").on(table.userId),
	],
);

export const discussions = pgTable(
	"discussions",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		channelId: varchar("channel_id", { length: 255 })
			.notNull()
			.references(() => channels.id, { onDelete: "cascade" }),

		title: text("title").notNull(),
		content: text("content"),

		status: discussionStatusEnum("status").default("open").notNull(),
		resolution: text("resolution"),
		resolvedBy: varchar("resolved_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),

		viewCount: integer("view_count").default(0).notNull(),
		messageCount: integer("message_count").default(0).notNull(),
		lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		createdBy: varchar("created_by", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		index("discussions_channel_created_idx").on(
			table.channelId,
			table.createdAt,
			table.id,
		),
		index("discussions_org_channel_cursor_idx").on(
			table.organizationId,
			table.channelId,
			table.createdAt,
			table.id,
		),
		index("discussions_channel_activity_idx").on(
			table.channelId,
			table.lastActivityAt,
		),
		index("discussions_org_idx").on(table.organizationId),
	],
);

export const discussionLinks = pgTable(
	"discussion_links",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		discussionId: varchar("discussion_id", { length: 255 })
			.notNull()
			.references(() => discussions.id, { onDelete: "cascade" }),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		entityType: varchar("entity_type", { length: 50 }).notNull(),
		entityId: varchar("entity_id", { length: 255 }).notNull(),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("discussion_links_unique").on(
			table.discussionId,
			table.entityType,
			table.entityId,
		),
		index("discussion_links_discussion_idx").on(table.discussionId),
		index("discussion_links_entity_idx").on(
			table.entityType,
			table.entityId,
		),
	],
);

export const discussionMessages = pgTable(
	"discussion_messages",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		discussionId: varchar("discussion_id", { length: 255 })
			.notNull()
			.references(() => discussions.id, { onDelete: "cascade" }),

		content: text("content").notNull(),

		parentId: varchar("parent_id", { length: 255 }),
		threadRootId: varchar("thread_root_id", { length: 255 }),

		replyCount: integer("reply_count").default(0).notNull(),

		createdBy: varchar("created_by", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		index("discussion_messages_discussion_idx").on(
			table.discussionId,
			table.createdAt,
		),
		index("discussion_messages_thread_idx").on(
			table.threadRootId,
			table.createdAt,
		),
		index("discussion_messages_parent_idx").on(table.parentId),
	],
);

export const channelsRelations = relations(channels, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [channels.organizationId],
		references: [organizations.id],
	}),
	creator: one(users, {
		fields: [channels.createdBy],
		references: [users.id],
		relationName: "channelCreator",
	}),
	members: many(channelMembers),
	discussions: many(discussions),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
	channel: one(channels, {
		fields: [channelMembers.channelId],
		references: [channels.id],
	}),
	user: one(users, {
		fields: [channelMembers.userId],
		references: [users.id],
	}),
}));

export const discussionsRelations = relations(discussions, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [discussions.organizationId],
		references: [organizations.id],
	}),
	channel: one(channels, {
		fields: [discussions.channelId],
		references: [channels.id],
	}),
	author: one(users, {
		fields: [discussions.createdBy],
		references: [users.id],
		relationName: "discussionAuthor",
	}),
	resolver: one(users, {
		fields: [discussions.resolvedBy],
		references: [users.id],
		relationName: "discussionResolver",
	}),
	links: many(discussionLinks),
	messages: many(discussionMessages),
}));

export const discussionLinksRelations = relations(
	discussionLinks,
	({ one }) => ({
		discussion: one(discussions, {
			fields: [discussionLinks.discussionId],
			references: [discussions.id],
		}),
		organization: one(organizations, {
			fields: [discussionLinks.organizationId],
			references: [organizations.id],
		}),
	}),
);

export const discussionMessagesRelations = relations(
	discussionMessages,
	({ one, many }) => ({
		discussion: one(discussions, {
			fields: [discussionMessages.discussionId],
			references: [discussions.id],
		}),
		author: one(users, {
			fields: [discussionMessages.createdBy],
			references: [users.id],
		}),
		parent: one(discussionMessages, {
			fields: [discussionMessages.parentId],
			references: [discussionMessages.id],
			relationName: "messageReplies",
		}),
		threadRoot: one(discussionMessages, {
			fields: [discussionMessages.threadRootId],
			references: [discussionMessages.id],
			relationName: "threadMessages",
		}),
		replies: many(discussionMessages, {
			relationName: "messageReplies",
		}),
	}),
);

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type ChannelMember = typeof channelMembers.$inferSelect;
export type NewChannelMember = typeof channelMembers.$inferInsert;
export type Discussion = typeof discussions.$inferSelect;
export type NewDiscussion = typeof discussions.$inferInsert;
export type DiscussionLink = typeof discussionLinks.$inferSelect;
export type NewDiscussionLink = typeof discussionLinks.$inferInsert;
export type DiscussionMessage = typeof discussionMessages.$inferSelect;
export type NewDiscussionMessage = typeof discussionMessages.$inferInsert;
