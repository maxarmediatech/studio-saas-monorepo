import { relations } from "drizzle-orm";
import {
	accounts,
	sessions,
	twoFactors,
	users,
} from "./auth";
import { purchases } from "./billing";
import { bookingParticipants, bookings } from "./bookings";
import { clients } from "./clients";
import { configurations } from "./configurations";
import { invitations, members, organizations } from "./organizations";

// ============================================================================
// CROSS-FILE RELATIONS
// Relations that span multiple schema files
// ============================================================================

/**
 * User relations - connects users to all related entities
 * Defined here because it references tables from multiple files
 */
export const userRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	invitations: many(invitations),
	purchases: many(purchases),
	memberships: many(members),
	twoFactors: many(twoFactors),
}));

/**
 * Organization relations - connects organizations to all related entities
 * Defined here because it references tables from multiple files
 */
export const organizationRelations = relations(organizations, ({ many }) => ({
	members: many(members),
	invitations: many(invitations),
	purchases: many(purchases),
	configurations: many(configurations),
	clients: many(clients),
	bookings: many(bookings),
}));

/**
 * Client relations (extended) - adds bookingParticipants
 * Base relations are in clients.ts, this extends them
 */
export const clientBookingsRelation = relations(clients, ({ many }) => ({
	bookingParticipants: many(bookingParticipants),
}));
