import { relations } from "drizzle-orm";
import {
	decimal,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
	date,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { users } from "./auth";
import { clients } from "./clients";
import { bookingPhaseEnum } from "./enums";
import { organizations } from "./organizations";

// ============================================================================
// BOOKINGS TABLE
// Core entity - represents a wedding/event project
// ============================================================================

/**
 * Bookings - the central entity for studio project management
 * Represents a wedding, corporate event, or any photography/videography project
 * All other domain entities (shoots, tasks, deliverables, payments) link to a booking
 */
export const bookings = pgTable(
	"bookings",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		// Identification
		referenceNumber: varchar("reference_number", { length: 50 }).notNull(),
		name: text("name").notNull(),

		// Type & Package (validated against configurations table)
		bookingType: text("booking_type").notNull(),
		packageType: text("package_type").notNull(),
		packageCost: decimal("package_cost", { precision: 12, scale: 2 }).notNull(),

		// Status (system-critical enum - drives business logic)
		status: bookingPhaseEnum("status").notNull().default("new"),

		// Financial cache (updated via application logic when payments/expenses change)
		totalReceived: decimal("total_received", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		totalExpenses: decimal("total_expenses", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),

		// Details
		note: text("note"),

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
		// Reference number must be unique within an organization
		uniqueIndex("bookings_org_ref_idx").on(
			table.organizationId,
			table.referenceNumber,
		),
		// Fast lookup by status for dashboard/filters
		index("bookings_org_status_idx").on(table.organizationId, table.status),
		// Fast lookup by created date for sorting/pagination
		index("bookings_org_created_idx").on(
			table.organizationId,
			table.createdAt,
		),
	],
);

// ============================================================================
// BOOKING PARTICIPANTS TABLE
// Links clients to bookings with roles (bride, groom, company, etc.)
// ============================================================================

/**
 * BookingParticipants - junction table linking clients to bookings
 * Each participant has a role (e.g., "bride", "groom", "company", "contact")
 * Role is validated against configurations table
 */
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

		// Role in the booking (validated against configurations: relation_type)
		role: text("role").notNull(),

		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// Each client can only have one role per booking
		uniqueIndex("booking_participants_uniq_idx").on(
			table.bookingId,
			table.clientId,
			table.role,
		),
		// Fast lookup by booking
		index("booking_participants_booking_idx").on(table.bookingId),
	],
);

// ============================================================================
// BOOKING EVENTS TABLE
// For multi-day events (e.g., wedding with engagement, haldi, sangeet, etc.)
// ============================================================================

/**
 * BookingEvents - represents individual events within a booking
 * Useful for multi-day weddings with separate functions
 * Each event can have its own date, venue, and notes
 */
export const bookingEvents = pgTable(
	"booking_events",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		bookingId: varchar("booking_id", { length: 255 })
			.notNull()
			.references(() => bookings.id, { onDelete: "cascade" }),

		// Event details
		eventType: text("event_type").notNull(), // engagement, haldi, sangeet, wedding, reception
		eventDate: date("event_date").notNull(),
		venue: text("venue"),
		venueAddress: text("venue_address"),
		notes: text("notes"),

		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// Fast lookup by booking
		index("booking_events_booking_idx").on(table.bookingId),
		// Fast lookup by date for calendar views
		index("booking_events_date_idx").on(table.eventDate),
	],
);

// ============================================================================
// BOOKING RELATIONS
// ============================================================================

export const bookingRelations = relations(bookings, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [bookings.organizationId],
		references: [organizations.id],
	}),
	participants: many(bookingParticipants),
	events: many(bookingEvents),
	createdByUser: one(users, {
		fields: [bookings.createdBy],
		references: [users.id],
		relationName: "bookingCreatedBy",
	}),
	updatedByUser: one(users, {
		fields: [bookings.updatedBy],
		references: [users.id],
		relationName: "bookingUpdatedBy",
	}),
	deletedByUser: one(users, {
		fields: [bookings.deletedBy],
		references: [users.id],
		relationName: "bookingDeletedBy",
	}),
	// Note: relations to shoots, tasks, deliverables, payments, expenses
	// will be added in their respective files
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

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type BookingParticipant = typeof bookingParticipants.$inferSelect;
export type NewBookingParticipant = typeof bookingParticipants.$inferInsert;
export type BookingEvent = typeof bookingEvents.$inferSelect;
export type NewBookingEvent = typeof bookingEvents.$inferInsert;
