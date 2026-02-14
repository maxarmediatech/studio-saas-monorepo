import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	time,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { users } from "./auth";
import { organizations, teams } from "./core";
import { checkinFrequencyEnum, checkinScopeEnum } from "./enums";

// ============================================================================
// CHECKIN TYPES (organization-wide or team-scoped)
// ============================================================================

export const checkinTypes = pgTable(
	"checkin_types",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		scope: checkinScopeEnum("scope").default("organization").notNull(),
		teamId: varchar("team_id", { length: 255 }).references(() => teams.id, {
			onDelete: "cascade",
		}),

		name: text("name").notNull(),
		emoji: varchar("emoji", { length: 10 }),
		description: text("description"),

		frequency: checkinFrequencyEnum("frequency").notNull(),
		scheduledTime: time("scheduled_time"), // HH:MM:SS format

		isActive: boolean("is_active").default(true).notNull(),

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
		check(
			"checkin_types_scope_team_constraint",
			sql`(
				(${table.scope} = 'team' AND ${table.teamId} IS NOT NULL)
				OR
				(${table.scope} = 'organization' AND ${table.teamId} IS NULL)
			)`,
		),
		index("checkin_types_org_idx").on(table.organizationId),
		index("checkin_types_team_idx").on(table.teamId),
		index("checkin_types_org_team_idx").on(
			table.organizationId,
			table.teamId,
		),
	],
);

// ============================================================================
// CHECKINS (individual posts)
// ============================================================================

export const checkins = pgTable(
	"checkins",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		checkinTypeId: varchar("checkin_type_id", { length: 255 })
			.notNull()
			.references(() => checkinTypes.id, { onDelete: "cascade" }),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		content: text("content"),
		contentJson: jsonb("content_json"),
		contentText: text("content_text"), // For search/preview
		contentSchemaVersion: integer("content_schema_version")
			.default(1)
			.notNull(),

		// Business date this checkin is "for" (not when posted)
		checkinDate: date("checkin_date", { mode: "date" }).notNull(),

		commentCount: integer("comment_count").default(0).notNull(),

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
		// One checkin per user per type per day
		uniqueIndex("checkins_type_user_date_unique")
			.on(table.checkinTypeId, table.createdBy, table.checkinDate)
			.where(sql`deleted_at IS NULL`),
		// List checkins by type, grouped by date
		index("checkins_type_date_idx").on(
			table.checkinTypeId,
			table.checkinDate,
			table.createdAt,
		),
		// Admin view: all checkins in org
		index("checkins_org_created_idx").on(
			table.organizationId,
			table.createdAt,
		),
		// Crew tab: user's checkins
		index("checkins_user_date_idx").on(table.createdBy, table.checkinDate),
	],
);

// ============================================================================
// CHECKIN COMMENTS (threaded like discussion_messages)
// ============================================================================

export const checkinComments = pgTable(
	"checkin_comments",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		checkinId: varchar("checkin_id", { length: 255 })
			.notNull()
			.references(() => checkins.id, { onDelete: "cascade" }),

		content: text("content").notNull(),
		contentJson: jsonb("content_json"),
		contentText: text("content_text"),
		contentSchemaVersion: integer("content_schema_version")
			.default(1)
			.notNull(),

		// Threading support (like discussion_messages)
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
		index("checkin_comments_checkin_idx").on(
			table.checkinId,
			table.createdAt,
		),
		index("checkin_comments_thread_idx").on(
			table.threadRootId,
			table.createdAt,
		),
		index("checkin_comments_parent_idx").on(table.parentId),
	],
);

// ============================================================================
// CHECKIN LINKS (polymorphic entity linking)
// ============================================================================

export const checkinLinks = pgTable(
	"checkin_links",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		checkinId: varchar("checkin_id", { length: 255 })
			.notNull()
			.references(() => checkins.id, { onDelete: "cascade" }),
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
		uniqueIndex("checkin_links_unique").on(
			table.checkinId,
			table.entityType,
			table.entityId,
		),
		index("checkin_links_checkin_idx").on(table.checkinId),
		index("checkin_links_entity_idx").on(table.entityType, table.entityId),
	],
);

// ============================================================================
// RELATIONS
// ============================================================================

export const checkinTypesRelations = relations(
	checkinTypes,
	({ one, many }) => ({
		organization: one(organizations, {
			fields: [checkinTypes.organizationId],
			references: [organizations.id],
		}),
		team: one(teams, {
			fields: [checkinTypes.teamId],
			references: [teams.id],
		}),
		creator: one(users, {
			fields: [checkinTypes.createdBy],
			references: [users.id],
			relationName: "checkinTypeCreator",
		}),
		checkins: many(checkins),
	}),
);

export const checkinsRelations = relations(checkins, ({ one, many }) => ({
	checkinType: one(checkinTypes, {
		fields: [checkins.checkinTypeId],
		references: [checkinTypes.id],
	}),
	organization: one(organizations, {
		fields: [checkins.organizationId],
		references: [organizations.id],
	}),
	author: one(users, {
		fields: [checkins.createdBy],
		references: [users.id],
		relationName: "checkinAuthor",
	}),
	comments: many(checkinComments),
	links: many(checkinLinks),
}));

export const checkinCommentsRelations = relations(
	checkinComments,
	({ one, many }) => ({
		checkin: one(checkins, {
			fields: [checkinComments.checkinId],
			references: [checkins.id],
		}),
		author: one(users, {
			fields: [checkinComments.createdBy],
			references: [users.id],
		}),
		parent: one(checkinComments, {
			fields: [checkinComments.parentId],
			references: [checkinComments.id],
			relationName: "commentReplies",
		}),
		threadRoot: one(checkinComments, {
			fields: [checkinComments.threadRootId],
			references: [checkinComments.id],
			relationName: "threadComments",
		}),
		replies: many(checkinComments, {
			relationName: "commentReplies",
		}),
	}),
);

export const checkinLinksRelations = relations(checkinLinks, ({ one }) => ({
	checkin: one(checkins, {
		fields: [checkinLinks.checkinId],
		references: [checkins.id],
	}),
	organization: one(organizations, {
		fields: [checkinLinks.organizationId],
		references: [organizations.id],
	}),
}));

// ============================================================================
// TYPES
// ============================================================================

export type CheckinType = typeof checkinTypes.$inferSelect;
export type NewCheckinType = typeof checkinTypes.$inferInsert;
export type Checkin = typeof checkins.$inferSelect;
export type NewCheckin = typeof checkins.$inferInsert;
export type CheckinComment = typeof checkinComments.$inferSelect;
export type NewCheckinComment = typeof checkinComments.$inferInsert;
export type CheckinLink = typeof checkinLinks.$inferSelect;
export type NewCheckinLink = typeof checkinLinks.$inferInsert;
