/**
 * Booking Schemas
 *
 * Zod schemas for booking/project management endpoints.
 */

import { z } from "zod";
import {
	baseListFiltersSchema,
	bookingPhaseSchema,
	createItemResponseSchema,
	createListResponseSchema,
	createSortSchema,
	dateSchema,
	datetimeSchema,
	idSchema,
	moneySchema,
	mutationResponseSchema,
	nameSchema,
	paginationSchema,
	paymentMethodSchema,
	searchSchema,
	uploadedAttachmentSchema,
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

export type BookingParticipantInput = z.infer<
	typeof bookingParticipantInputSchema
>;

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
	bookingDate: dateSchema,
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

const bookingSortFields = [
	"name",
	"referenceNumber",
	"status",
	"packageCost",
	"bookingDate",
	"createdAt",
	"updatedAt",
] as const;

export const listBookingsInputSchema = z
	.object({
		clientId: idSchema.optional(),
		statuses: z.array(bookingPhaseSchema).optional(),
		bookingType: z.union([z.string(), z.array(z.string())]).nullish(),
		packageType: z.union([z.string(), z.array(z.string())]).nullish(),
		bookingDate: z.string().optional(), // comma-separated date range "from,to"
		createdAt: z.string().optional(), // comma-separated date range "from,to"
	})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(baseListFiltersSchema)
	.merge(createSortSchema(bookingSortFields, "bookingDate"));

export type ListBookingsInput = z.infer<typeof listBookingsInputSchema>;

/**
 * Participant summary for list view (minimal client info)
 */
export const participantSummarySchema = z.object({
	id: idSchema,
	role: z.string(),
	client: z.object({
		id: idSchema,
		name: z.string(),
	}),
});

export type ParticipantSummary = z.infer<typeof participantSummarySchema>;

/**
 * Booking list item with summary info
 */
export const bookingListItemSchema = bookingSchema.extend({
	participantsCount: z.number(),
	participants: z.array(participantSummarySchema),
	shootsCount: z.number(),
	balance: z.string(),
});

export type BookingListItem = z.infer<typeof bookingListItemSchema>;

export const listBookingsOutputSchema = createListResponseSchema(
	bookingListItemSchema,
);

export type ListBookingsOutput = z.infer<typeof listBookingsOutputSchema>;

// ============================================================================
// LIST BOOKINGS MINIMAL
// ============================================================================

export const listBookingsMinimalInputSchema = z
	.object({
		status: bookingPhaseSchema.optional(),
	})
	.merge(searchSchema);

export type ListBookingsMinimalInput = z.infer<
	typeof listBookingsMinimalInputSchema
>;

export const listBookingsMinimalOutputSchema = z.object({
	data: z.array(bookingMinimalSchema),
});

export type ListBookingsMinimalOutput = z.infer<
	typeof listBookingsMinimalOutputSchema
>;

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
	contractAttachment: uploadedAttachmentSchema.nullable(),
});

export type BookingDetail = z.infer<typeof bookingDetailSchema>;

export const getBookingOutputSchema =
	createItemResponseSchema(bookingDetailSchema);

export type GetBookingOutput = z.infer<typeof getBookingOutputSchema>;

// ============================================================================
// CREATE BOOKING
// ============================================================================

// Crew assignment for shoots - role is auto-filled from crew profile if not provided
const shootCrewAssignmentInputSchema = z.object({
	crewId: idSchema,
	role: z.string().min(1).max(100).optional(), // Auto-filled from crew profile
	isLead: z.boolean().default(false).optional(), // Kept for backward compat, not used in UI
	rate: z.preprocess((value) => {
		if (typeof value !== "string") {
			return value;
		}

		const trimmed = value.trim();
		return trimmed === "" ? undefined : trimmed;
	}, moneySchema.optional()), // Per-shoot rate (decimal as string), "" → undefined
});

export type ShootCrewAssignmentInput = z.infer<
	typeof shootCrewAssignmentInputSchema
>;

// Crew assignment for deliverables - simplified to just crewId
const deliverableCrewAssignmentInputSchema = z.object({
	crewId: idSchema,
	isLead: z.boolean().default(false).optional(), // Kept for backward compat, not used in UI
});

export type DeliverableCrewAssignmentInput = z.infer<
	typeof deliverableCrewAssignmentInputSchema
>;

// Shoot input with embedded crew assignments
const shootInputSchema = z.object({
	name: nameSchema,
	shootType: z.string().min(1).max(100),
	shootDate: z.string().min(1), // Date string YYYY-MM-DD
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	venue: z.string().max(255).optional(),
	venueAddress: z.string().max(500).optional(),
	notes: z.string().max(5000).optional(),
	requiredCrewCount: z.number().int().positive().optional(),
	additionalServices: z.array(z.string()).optional(),
	status: z.string().min(1).max(50).default("scheduled"),
	crewAssignments: z.array(shootCrewAssignmentInputSchema).optional(),
});

export type ShootInput = z.infer<typeof shootInputSchema>;

// Deliverable input with embedded crew assignments
const deliverableInputSchema = z.object({
	name: nameSchema,
	description: z.string().max(5000).optional(),
	dueDate: z.string().optional(),
	crewAssignments: z.array(deliverableCrewAssignmentInputSchema).optional(),
	// Package relationship fields
	quantity: z.number().int().min(1).default(1),
	cost: moneySchema.optional(), // Only for custom deliverables
	isPackageIncluded: z.boolean().default(false),
});

export type DeliverableInput = z.infer<typeof deliverableInputSchema>;

// Received payment input
const receivedPaymentInputSchema = z.object({
	amount: moneySchema,
	paymentMethod: paymentMethodSchema,
	receivedDate: z.string().min(1), // Date string YYYY-MM-DD
	transactionReference: z.string().max(100).optional(),
	notes: z.string().max(10000).optional(),
	proofAttachment: uploadedAttachmentSchema.nullable().optional(),
});

export type ReceivedPaymentInput = z.infer<typeof receivedPaymentInputSchema>;

// Payment schedule input
const paymentScheduleInputSchema = z.object({
	name: nameSchema,
	amount: moneySchema,
	dueDate: z.string().min(1), // Date string YYYY-MM-DD
	notes: z.string().max(10000).optional(),
	sortOrder: z.number().min(0).default(0),
});

export type PaymentScheduleInput = z.infer<typeof paymentScheduleInputSchema>;

export const createBookingInputSchema = z.object({
	// Core booking fields
	name: nameSchema,
	bookingDate: dateSchema,
	bookingType: z.string().min(1).max(100),
	packageType: z.string().min(1).max(100),
	packageCost: moneySchema,
	note: z.string().max(5000).optional(),
	participants: z.array(bookingParticipantInputSchema).min(1),
	events: z.array(bookingEventInputSchema).optional(),

	// Contract attachment (stored in polymorphic attachments table)
	contractAttachment: uploadedAttachmentSchema.nullable().optional(),

	// Shoots with crew assignments
	shoots: z.array(shootInputSchema).optional(),

	// Deliverables with crew assignments
	deliverables: z.array(deliverableInputSchema).optional(),

	// Received payments
	receivedPayments: z.array(receivedPaymentInputSchema).optional(),

	// Payment schedules
	paymentSchedules: z.array(paymentScheduleInputSchema).optional(),
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
	bookingDate: dateSchema.optional(),
	bookingType: z.string().min(1).max(100).optional(),
	packageType: z.string().min(1).max(100).optional(),
	packageCost: moneySchema.optional(),
	note: z.string().max(5000).optional().nullable(),
	contractAttachment: uploadedAttachmentSchema.nullable().optional(),
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

export type UpdateBookingStatusInput = z.infer<
	typeof updateBookingStatusInputSchema
>;

export const updateBookingStatusOutputSchema = mutationResponseSchema;

export type UpdateBookingStatusOutput = z.infer<
	typeof updateBookingStatusOutputSchema
>;

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

export const getBookingStatsOutputSchema =
	createItemResponseSchema(bookingStatsSchema);

export type GetBookingStatsOutput = z.infer<typeof getBookingStatsOutputSchema>;

// ============================================================================
// BOOKING PARTICIPANTS CRUD
// ============================================================================

/**
 * List participants for a booking
 */
export const listParticipantsInputSchema = z.object({
	bookingId: idSchema,
});

export type ListParticipantsInput = z.infer<typeof listParticipantsInputSchema>;

export const participantWithClientSchema = bookingParticipantSchema.extend({
	client: z.object({
		id: idSchema,
		name: z.string(),
		email: z.string().nullable(),
		phoneNumber: z.string().nullable(),
	}),
});

export type ParticipantWithClient = z.infer<typeof participantWithClientSchema>;

export const listParticipantsOutputSchema = z.object({
	data: z.array(participantWithClientSchema),
});

export type ListParticipantsOutput = z.infer<
	typeof listParticipantsOutputSchema
>;

/**
 * Add participant to a booking
 */
export const addParticipantInputSchema = z.object({
	bookingId: idSchema,
	clientId: idSchema,
	role: z.string().min(1).max(100),
});

export type AddParticipantInput = z.infer<typeof addParticipantInputSchema>;

export const addParticipantOutputSchema = mutationResponseSchema;

export type AddParticipantOutput = z.infer<typeof addParticipantOutputSchema>;

/**
 * Update participant role
 */
export const updateParticipantInputSchema = z.object({
	bookingId: idSchema,
	participantId: idSchema,
	role: z.string().min(1).max(100),
});

export type UpdateParticipantInput = z.infer<
	typeof updateParticipantInputSchema
>;

export const updateParticipantOutputSchema = mutationResponseSchema;

export type UpdateParticipantOutput = z.infer<
	typeof updateParticipantOutputSchema
>;

/**
 * Remove participant from a booking
 */
export const removeParticipantInputSchema = z.object({
	bookingId: idSchema,
	participantId: idSchema,
});

export type RemoveParticipantInput = z.infer<
	typeof removeParticipantInputSchema
>;

export const removeParticipantOutputSchema = mutationResponseSchema;

export type RemoveParticipantOutput = z.infer<
	typeof removeParticipantOutputSchema
>;

// ============================================================================
// LIST BOOKING CREWS (Aggregated from shoots, tasks, deliverables)
// ============================================================================

/**
 * List all crew members assigned to a booking
 */
export const listBookingCrewsInputSchema = z.object({
	bookingId: idSchema,
});

export type ListBookingCrewsInput = z.infer<typeof listBookingCrewsInputSchema>;

/**
 * Assignment source info - where is this crew assigned
 */
export const crewAssignmentSourceSchema = z.object({
	type: z.enum(["shoot", "task", "deliverable"]),
	id: idSchema,
	name: z.string(),
});

export type CrewAssignmentSource = z.infer<typeof crewAssignmentSourceSchema>;

/**
 * Crew member with their assignment sources
 */
export const bookingCrewMemberSchema = z.object({
	id: idSchema,
	name: z.string(),
	phoneNumber: z.string().nullable(),
	email: z.string().nullable(),
	assignments: z.array(crewAssignmentSourceSchema),
});

export type BookingCrewMember = z.infer<typeof bookingCrewMemberSchema>;

export const listBookingCrewsOutputSchema = z.object({
	data: z.array(bookingCrewMemberSchema),
});

export type ListBookingCrewsOutput = z.infer<
	typeof listBookingCrewsOutputSchema
>;
