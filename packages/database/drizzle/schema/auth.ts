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

// ============================================================================
// AUTH TABLES
// Core authentication tables from NebulaForge + better-auth
// Note: userRelations is defined in core.ts as it spans multiple files
// ============================================================================

export const users = pgTable("users", {
	id: varchar("id", { length: 255 })
		.$defaultFn(() => uuidv7())
		.primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	username: text("username").unique(),
	displayUsername: text("display_username"),
	role: text("role"),
	banned: boolean("banned"),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires", { withTimezone: true }),
	onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
	paymentsCustomerId: text("payments_customer_id"),
	locale: text("locale"),
	timezone: text("timezone"),
	twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
});

export const sessions = pgTable(
	"sessions",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		impersonatedBy: text("impersonated_by"),
		activeOrganizationId: text("active_organization_id"),
		activeTeamId: text("active_team_id"),
		token: text("token").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
	},
	(table) => [uniqueIndex("sessions_token_idx").on(table.token)],
);

export const accounts = pgTable("accounts", {
	id: varchar("id", { length: 255 })
		.$defaultFn(() => uuidv7())
		.primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	expiresAt: timestamp("expires_at", { withTimezone: true }),
	password: text("password"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", {
		withTimezone: true,
	}),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
		withTimezone: true,
	}),
	scope: text("scope"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const verifications = pgTable("verifications", {
	id: varchar("id", { length: 255 })
		.$defaultFn(() => uuidv7())
		.primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }),
	updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const twoFactors = pgTable(
	"two_factors",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
	},
	(table) => [uniqueIndex("two_factors_user_id_idx").on(table.userId)],
);

// ============================================================================
// AUTH RELATIONS (self-contained, don't reference other domains)
// ============================================================================

export const sessionRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const accountRelations = relations(accounts, ({ one }) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id],
	}),
}));

export const twoFactorRelations = relations(twoFactors, ({ one }) => ({
	user: one(users, {
		fields: [twoFactors.userId],
		references: [users.id],
	}),
}));
