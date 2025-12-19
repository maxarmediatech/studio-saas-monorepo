import { relations } from "drizzle-orm";
import {
	boolean,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import {
	accounts,
	sessions,
	twoFactors,
	users,
} from "./auth";
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

export const invitations = pgTable("invitations", {
	id: varchar("id", { length: 255 })
		.$defaultFn(() => uuidv7())
		.primaryKey(),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	email: text("email").notNull(),
	role: text("role"),
	status: text("status").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	inviterId: text("inviter_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
});

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
	invitations: many(invitations),
	purchases: many(purchases),
}));

/**
 * Member relations
 */
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

/**
 * Invitation relations
 */
export const invitationRelations = relations(invitations, ({ one }) => ({
	organization: one(organizations, {
		fields: [invitations.organizationId],
		references: [organizations.id],
	}),
	inviter: one(users, {
		fields: [invitations.inviterId],
		references: [users.id],
	}),
}));

/**
 * Purchase relations
 */
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
