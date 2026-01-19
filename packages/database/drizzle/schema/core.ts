import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { accounts, sessions, twoFactors, users } from "./auth";
import { purchaseTypeEnum } from "./enums";

// ============================================================================
// ORGANIZATION TABLES
// Multi-tenant organization management
// ============================================================================

export const organizations = pgTable(
	"organizations",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		name: text("name").notNull(),
		slug: text("slug"),
		timezone: text("timezone").default("UTC").notNull(),
		logo: text("logo"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		metadata: text("metadata"),
		paymentsCustomerId: text("payments_customer_id"),
	},
	(table) => [uniqueIndex("organizations_slug_idx").on(table.slug)],
);

export const members = pgTable(
	"members",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: text("role").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("members_user_org_idx").on(
			table.userId,
			table.organizationId,
		),
	],
);

export const teams = pgTable(
	"teams",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		name: text("name").notNull(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [index("teams_organization_idx").on(table.organizationId)],
);

export const teamMembers = pgTable(
	"team_members",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		teamId: text("team_id")
			.notNull()
			.references(() => teams.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("team_members_team_idx").on(table.teamId),
		index("team_members_user_idx").on(table.userId),
	],
);

export const invitations = pgTable("invitations", {
	id: varchar("id", { length: 255 })
		.$defaultFn(() => uuidv7())
		.primaryKey(),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	email: text("email").notNull(),
	role: text("role"),
	teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
	status: text("status").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	inviterId: text("inviter_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
});

/**
 * Organization Roles table for Better Auth Dynamic Access Control
 * Stores custom roles created by organizations at runtime
 */
export const organizationRoles = pgTable(
	"organization_roles",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		role: text("role").notNull(),
		permission: text("permission").notNull(),
		description: text("description"),
		color: text("color").default("#6366f1"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("organization_roles_org_id_idx").on(table.organizationId),
		index("organization_roles_role_idx").on(table.role),
	],
);

// ============================================================================
// BILLING TABLES
// SaaS subscription and payment management
// ============================================================================

export const purchases = pgTable("purchases", {
	id: varchar("id", { length: 255 })
		.$defaultFn(() => uuidv7())
		.primaryKey(),
	organizationId: text("organization_id").references(() => organizations.id, {
		onDelete: "cascade",
	}),
	userId: text("user_id").references(() => users.id, {
		onDelete: "cascade",
	}),
	type: purchaseTypeEnum("type").notNull(),
	customerId: text("customer_id").notNull(),
	subscriptionId: text("subscription_id").unique(),
	paymentId: text("payment_id").unique(),
	productId: text("product_id").notNull(),
	status: text("status"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const webhookEvents = pgTable(
	"webhook_events",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		webhookId: text("webhook_id").notNull(),
		eventType: text("event_type").notNull(),
		payload: text("payload").notNull(),
		processed: boolean("processed").default(false).notNull(),
		processedAt: timestamp("processed_at", { withTimezone: true }),
		errorMessage: text("error_message"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("webhook_events_webhook_id_idx").on(table.webhookId),
	],
);

// ============================================================================
// RELATIONS
// All core relations defined here to keep tables and relations together
// ============================================================================

/**
 * User relations - connects users to all auth and core entities
 */
export const userRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	twoFactors: many(twoFactors),
	memberships: many(members),
	teamMemberships: many(teamMembers),
	invitations: many(invitations),
	purchases: many(purchases),
}));

export const memberRelations = relations(members, ({ one }) => ({
	organization: one(organizations, {
		fields: [members.organizationId],
		references: [organizations.id],
	}),
	user: one(users, {
		fields: [members.userId],
		references: [users.id],
	}),
}));

export const teamRelations = relations(teams, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [teams.organizationId],
		references: [organizations.id],
	}),
	members: many(teamMembers),
}));

export const teamMemberRelations = relations(teamMembers, ({ one }) => ({
	team: one(teams, {
		fields: [teamMembers.teamId],
		references: [teams.id],
	}),
	user: one(users, {
		fields: [teamMembers.userId],
		references: [users.id],
	}),
}));

export const purchaseRelations = relations(purchases, ({ one }) => ({
	organization: one(organizations, {
		fields: [purchases.organizationId],
		references: [organizations.id],
	}),
	user: one(users, {
		fields: [purchases.userId],
		references: [users.id],
	}),
}));

export const invitationRelations = relations(invitations, ({ one }) => ({
	organization: one(organizations, {
		fields: [invitations.organizationId],
		references: [organizations.id],
	}),
	team: one(teams, {
		fields: [invitations.teamId],
		references: [teams.id],
	}),
	inviter: one(users, {
		fields: [invitations.inviterId],
		references: [users.id],
	}),
}));

export const organizationRoleRelations = relations(
	organizationRoles,
	({ one }) => ({
		organization: one(organizations, {
			fields: [organizationRoles.organizationId],
			references: [organizations.id],
		}),
	}),
);
