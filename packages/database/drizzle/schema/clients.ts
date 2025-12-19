import { relations, sql } from "drizzle-orm";
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { users } from "./auth";
import { organizations } from "./organizations";

// ============================================================================
// CLIENTS TABLE
// Customer/contact management for studio bookings
// ============================================================================

/**
 * Clients - stores customer contacts for studio bookings
 * Each client belongs to an organization (multi-tenant)
 * Clients can participate in multiple bookings with different roles
 */
export const clients = pgTable(
	"clients",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		// Contact information
		name: text("name").notNull(),
		email: text("email"),
		phoneNumber: text("phone_number"),
		alternatePhone: text("alternate_phone"),
		address: text("address"),

		// Additional data (social profiles, preferences, etc.)
		metadata: jsonb("metadata"),

		// Audit fields
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

		// Soft delete
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		// Fast lookup by organization
		index("clients_organization_idx").on(table.organizationId),
		// Prevent duplicate clients by phone within an org (if phone provided)
		uniqueIndex("clients_org_phone_idx")
			.on(table.organizationId, table.phoneNumber)
			.where(sql`phone_number IS NOT NULL AND deleted_at IS NULL`),
		// Prevent duplicate clients by email within an org (if email provided)
		uniqueIndex("clients_org_email_idx")
			.on(table.organizationId, table.email)
			.where(sql`email IS NOT NULL AND deleted_at IS NULL`),
	],
);

// ============================================================================
// CLIENT RELATIONS
// ============================================================================

export const clientRelations = relations(clients, ({ one }) => ({
	organization: one(organizations, {
		fields: [clients.organizationId],
		references: [organizations.id],
	}),
	createdByUser: one(users, {
		fields: [clients.createdBy],
		references: [users.id],
		relationName: "clientCreatedBy",
	}),
	updatedByUser: one(users, {
		fields: [clients.updatedBy],
		references: [users.id],
		relationName: "clientUpdatedBy",
	}),
	deletedByUser: one(users, {
		fields: [clients.deletedBy],
		references: [users.id],
		relationName: "clientDeletedBy",
	}),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
