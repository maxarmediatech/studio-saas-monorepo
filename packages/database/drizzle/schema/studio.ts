import { relations, sql } from "drizzle-orm";
import {
	boolean,
	date,
	decimal,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { users } from "./auth";
import { organizations } from "./core";
import { bookingPhaseEnum, configTypeEnum } from "./enums";

// ============================================================================
// CONFIGURATIONS TABLE
// Per-organization customizable settings (statuses, priorities, categories)
// ============================================================================

export const configurations = pgTable(
	"configurations",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		type: configTypeEnum("type").notNull(),
		key: varchar("key", { length: 100 }).notNull(),
		label: text("label").notNull(),
		description: text("description"),

		color: varchar("color", { length: 20 }),
		icon: varchar("icon", { length: 50 }),
		sortOrder: integer("sort_order").default(0).notNull(),

		isDefault: boolean("is_default").default(false).notNull(),
		isSystem: boolean("is_system").default(false).notNull(),
		metadata: jsonb("metadata"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("configurations_org_type_key_idx").on(
			table.organizationId,
			table.type,
			table.key,
		),
		index("configurations_org_type_idx").on(
			table.organizationId,
			table.type,
		),
	],
);

// ============================================================================
// CLIENTS TABLE
// Customer/contact management for studio bookings
// ============================================================================

export const clients = pgTable(
	"clients",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		name: text("name").notNull(),
		email: text("email"),
		phoneNumber: text("phone_number"),
		alternatePhone: text("alternate_phone"),
		address: text("address"),
		metadata: jsonb("metadata"),

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
		index("clients_organization_idx").on(table.organizationId),
		uniqueIndex("clients_org_phone_idx")
			.on(table.organizationId, table.phoneNumber)
			.where(sql`phone_number IS NOT NULL AND deleted_at IS NULL`),
		uniqueIndex("clients_org_email_idx")
			.on(table.organizationId, table.email)
			.where(sql`email IS NOT NULL AND deleted_at IS NULL`),
	],
);

// ============================================================================
// BOOKINGS TABLES
// Core entity - represents a wedding/event project
// ============================================================================

export const bookings = pgTable(
	"bookings",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		referenceNumber: varchar("reference_number", { length: 50 }).notNull(),
		name: text("name").notNull(),

		bookingType: text("booking_type").notNull(),
		packageType: text("package_type").notNull(),
		packageCost: decimal("package_cost", { precision: 12, scale: 2 }).notNull(),

		status: bookingPhaseEnum("status").notNull().default("new"),

		totalReceived: decimal("total_received", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		totalExpenses: decimal("total_expenses", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),

		note: text("note"),

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
		uniqueIndex("bookings_org_ref_idx").on(
			table.organizationId,
			table.referenceNumber,
		),
		index("bookings_org_status_idx").on(table.organizationId, table.status),
		index("bookings_org_created_idx").on(
			table.organizationId,
			table.createdAt,
		),
	],
);

export const bookingParticipants = pgTable(
	"booking_participants",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		bookingId: varchar("booking_id", { length: 255 })
			.notNull()
			.references(() => bookings.id, { onDelete: "cascade" }),
		clientId: varchar("client_id", { length: 255 })
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),

		role: text("role").notNull(),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("booking_participants_uniq_idx").on(
			table.bookingId,
			table.clientId,
			table.role,
		),
		index("booking_participants_booking_idx").on(table.bookingId),
	],
);

export const bookingEvents = pgTable(
	"booking_events",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		bookingId: varchar("booking_id", { length: 255 })
			.notNull()
			.references(() => bookings.id, { onDelete: "cascade" }),

		eventType: text("event_type").notNull(),
		eventDate: date("event_date").notNull(),
		venue: text("venue"),
		venueAddress: text("venue_address"),
		notes: text("notes"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("booking_events_booking_idx").on(table.bookingId),
		index("booking_events_date_idx").on(table.eventDate),
	],
);

// ============================================================================
// RELATIONS
// All studio domain relations defined here
// ============================================================================

export const configurationsRelations = relations(configurations, ({ one }) => ({
	organization: one(organizations, {
		fields: [configurations.organizationId],
		references: [organizations.id],
	}),
}));

export const clientRelations = relations(clients, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [clients.organizationId],
		references: [organizations.id],
	}),
	bookingParticipants: many(bookingParticipants),
}));

export const bookingRelations = relations(bookings, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [bookings.organizationId],
		references: [organizations.id],
	}),
	participants: many(bookingParticipants),
	events: many(bookingEvents),
}));

export const bookingParticipantRelations = relations(
	bookingParticipants,
	({ one }) => ({
		booking: one(bookings, {
			fields: [bookingParticipants.bookingId],
			references: [bookings.id],
		}),
		client: one(clients, {
			fields: [bookingParticipants.clientId],
			references: [clients.id],
		}),
	}),
);

export const bookingEventRelations = relations(bookingEvents, ({ one }) => ({
	booking: one(bookings, {
		fields: [bookingEvents.bookingId],
		references: [bookings.id],
	}),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Configuration = typeof configurations.$inferSelect;
export type NewConfiguration = typeof configurations.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type BookingParticipant = typeof bookingParticipants.$inferSelect;
export type NewBookingParticipant = typeof bookingParticipants.$inferInsert;

export type BookingEvent = typeof bookingEvents.$inferSelect;
export type NewBookingEvent = typeof bookingEvents.$inferInsert;
