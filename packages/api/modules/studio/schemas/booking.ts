/**
 * Booking Schemas
 *
 * Zod schemas for booking/project management endpoints.
 */

import { z } from "zod";
import {
	createListResponseSchema,
	createItemResponseSchema,
	createSortSchema,
	idSchema,
	mutationResponseSchema,
	nameSchema,
	paginationSchema,
	searchSchema,
	baseListFiltersSchema,
	datetimeSchema,
	moneySchema,
	bookingPhaseSchema,
} from "./common";

// ============================================================================
// BOOKING PARTICIPANT SCHEMA
// ============================================================================

export const bookingParticipantSchema = z.object({
	id: idSchema,
	bookingId: idSchema,
	clientId: idSchema,
	role: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type BookingParticipant = z.infer<typeof bookingParticipantSchema>;

export const bookingParticipantInputSchema = z.object({
	clientId: idSchema,
	role: z.string().min(1).max(100),
});

export type BookingParticipantInput = z.infer<typeof bookingParticipantInputSchema>;

// ============================================================================
// BOOKING EVENT SCHEMA
// ============================================================================

export const bookingEventSchema = z.object({
	id: idSchema,
	bookingId: idSchema,
	organizationId: idSchema,
	eventType: z.string(),
	eventDate: datetimeSchema,
	venue: z.string().nullable(),
	venueAddress: z.string().nullable(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type BookingEvent = z.infer<typeof bookingEventSchema>;

export const bookingEventInputSchema = z.object({
	eventType: z.string().min(1).max(100),
	eventDate: datetimeSchema,
	venue: z.string().max(255).optional(),
	venueAddress: z.string().max(500).optional(),
	notes: z.string().max(2000).optional(),
});

export type BookingEventInput = z.infer<typeof bookingEventInputSchema>;

// ============================================================================
// BOOKING SCHEMA
// ============================================================================

/**
 * Full booking schema (output)
 */
export const bookingSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	referenceNumber: z.string(),
	name: z.string(),
	bookingType: z.string(),
	packageType: z.string(),
	packageCost: z.string(),
	status: bookingPhaseSchema,
	totalReceived: z.string(),
	totalExpenses: z.string(),
	note: z.string().nullable(),
	createdBy: idSchema.nullable(),
	updatedBy: idSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
	deletedBy: idSchema.nullable(),
});

export type Booking = z.infer<typeof bookingSchema>;

/**
 * Minimal booking schema for dropdowns and references
 */
export const bookingMinimalSchema = z.object({
	id: idSchema,
	referenceNumber: z.string(),
	name: z.string(),
	status: bookingPhaseSchema,
	packageType: z.string(),
});

export type BookingMinimal = z.infer<typeof bookingMinimalSchema>;

// ============================================================================
// LIST BOOKINGS
// ============================================================================

const bookingSortFields = ["name", "referenceNumber", "status", "packageCost", "createdAt", "updatedAt"] as const;

export const listBookingsInputSchema = z
	.object({
		status: bookingPhaseSchema.optional(),
		bookingType: z.string().optional(),
		packageType: z.string().optional(),
	})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(baseListFiltersSchema)
	.merge(createSortSchema(bookingSortFields, "createdAt"));

export type ListBookingsInput = z.infer<typeof listBookingsInputSchema>;

/**
 * Booking list item with summary info
 */
export const bookingListItemSchema = bookingSchema.extend({
	participantsCount: z.number(),
	shootsCount: z.number(),
	balance: z.string(),
});

export type BookingListItem = z.infer<typeof bookingListItemSchema>;

export const listBookingsOutputSchema = createListResponseSchema(bookingListItemSchema);

export type ListBookingsOutput = z.infer<typeof listBookingsOutputSchema>;

// ============================================================================
// LIST BOOKINGS MINIMAL
// ============================================================================

export const listBookingsMinimalInputSchema = z
	.object({
		status: bookingPhaseSchema.optional(),
	})
	.merge(searchSchema);

export type ListBookingsMinimalInput = z.infer<typeof listBookingsMinimalInputSchema>;

export const listBookingsMinimalOutputSchema = z.object({
	data: z.array(bookingMinimalSchema),
});

export type ListBookingsMinimalOutput = z.infer<typeof listBookingsMinimalOutputSchema>;

// ============================================================================
// GET BOOKING
// ============================================================================

export const getBookingInputSchema = z.object({
	id: idSchema,
});

export type GetBookingInput = z.infer<typeof getBookingInputSchema>;

/**
 * Booking detail with related entities
 */
export const bookingDetailSchema = bookingSchema.extend({
	participants: z.array(
		bookingParticipantSchema.extend({
			client: z.object({
				id: idSchema,
				name: z.string(),
				email: z.string().nullable(),
				phoneNumber: z.string().nullable(),
			}),
		}),
	),
	events: z.array(bookingEventSchema),
	shootsCount: z.number(),
	tasksCount: z.number(),
	deliverablesCount: z.number(),
	balance: z.string(),
});

export type BookingDetail = z.infer<typeof bookingDetailSchema>;

export const getBookingOutputSchema = createItemResponseSchema(bookingDetailSchema);

export type GetBookingOutput = z.infer<typeof getBookingOutputSchema>;

// ============================================================================
// CREATE BOOKING
// ============================================================================

export const createBookingInputSchema = z.object({
	name: nameSchema,
	bookingType: z.string().min(1).max(100),
	packageType: z.string().min(1).max(100),
	packageCost: moneySchema,
	note: z.string().max(5000).optional(),
	participants: z.array(bookingParticipantInputSchema).min(1),
	events: z.array(bookingEventInputSchema).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;

export const createBookingOutputSchema = mutationResponseSchema;

export type CreateBookingOutput = z.infer<typeof createBookingOutputSchema>;

// ============================================================================
// UPDATE BOOKING
// ============================================================================

export const updateBookingInputSchema = z.object({
	id: idSchema,
	name: nameSchema.optional(),
	bookingType: z.string().min(1).max(100).optional(),
	packageType: z.string().min(1).max(100).optional(),
	packageCost: moneySchema.optional(),
	note: z.string().max(5000).optional().nullable(),
});

export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>;

export const updateBookingOutputSchema = mutationResponseSchema;

export type UpdateBookingOutput = z.infer<typeof updateBookingOutputSchema>;

// ============================================================================
// DELETE BOOKING
// ============================================================================

export const deleteBookingInputSchema = z.object({
	id: idSchema,
});

export type DeleteBookingInput = z.infer<typeof deleteBookingInputSchema>;

export const deleteBookingOutputSchema = mutationResponseSchema;

export type DeleteBookingOutput = z.infer<typeof deleteBookingOutputSchema>;

// ============================================================================
// UPDATE BOOKING STATUS
// ============================================================================

export const updateBookingStatusInputSchema = z.object({
	id: idSchema,
	status: bookingPhaseSchema,
});

export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusInputSchema>;

export const updateBookingStatusOutputSchema = mutationResponseSchema;

export type UpdateBookingStatusOutput = z.infer<typeof updateBookingStatusOutputSchema>;

// ============================================================================
// BOOKING STATS
// ============================================================================

export const getBookingStatsInputSchema = z.object({});

export type GetBookingStatsInput = z.infer<typeof getBookingStatsInputSchema>;

export const bookingStatsSchema = z.object({
	totalBookings: z.number(),
	byStatus: z.record(z.string(), z.number()),
	totalRevenue: z.string(),
	totalReceived: z.string(),
	totalExpenses: z.string(),
	totalOutstanding: z.string(),
	newThisMonth: z.number(),
});

export type BookingStats = z.infer<typeof bookingStatsSchema>;

export const getBookingStatsOutputSchema = createItemResponseSchema(bookingStatsSchema);

export type GetBookingStatsOutput = z.infer<typeof getBookingStatsOutputSchema>;
