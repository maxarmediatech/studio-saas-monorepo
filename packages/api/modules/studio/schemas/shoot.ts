/**
 * Shoot Schemas
 *
 * Zod schemas for photo/video shoot management endpoints.
 */

import { z } from "zod";
import {
	baseListFiltersSchema,
	createItemResponseSchema,
	createListResponseSchema,
	createSortSchema,
	dateSchema,
	idSchema,
	mutationResponseSchema,
	nameSchema,
	paginationSchema,
	searchSchema,
	timeSchema,
} from "./common";

// ============================================================================
// SHOOT ASSIGNMENT SCHEMA
// ============================================================================

export const shootAssignmentSchema = z.object({
	id: idSchema,
	shootId: idSchema,
	crewId: idSchema,
	role: z.string(),
	isLead: z.boolean(),
	assignedBy: idSchema.nullable(),
	createdAt: z.string(),
});

export type ShootAssignment = z.infer<typeof shootAssignmentSchema>;

export const shootAssignmentWithCrewSchema = shootAssignmentSchema.extend({
	crew: z.object({
		id: idSchema,
		name: z.string(),
		role: z.string(),
		phoneNumber: z.string().nullable(),
	}),
});

export type ShootAssignmentWithCrew = z.infer<
	typeof shootAssignmentWithCrewSchema
>;

// ============================================================================
// SHOOT SCHEMA
// ============================================================================

/**
 * Full shoot schema (output)
 */
export const shootSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	bookingId: idSchema,
	name: z.string(),
	shootType: z.string(),
	shootDate: z.string(),
	startTime: z.string().nullable(),
	endTime: z.string().nullable(),
	venue: z.string().nullable(),
	venueAddress: z.string().nullable(),
	notes: z.string().nullable(),
	status: z.string(),
	createdBy: idSchema.nullable(),
	updatedBy: idSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
	deletedBy: idSchema.nullable(),
});

export type Shoot = z.infer<typeof shootSchema>;

/**
 * Minimal shoot schema for dropdowns and references
 */
export const shootMinimalSchema = z.object({
	id: idSchema,
	name: z.string(),
	shootType: z.string(),
	shootDate: z.string(),
	status: z.string(),
	bookingId: idSchema,
});

export type ShootMinimal = z.infer<typeof shootMinimalSchema>;

// ============================================================================
// LIST SHOOTS
// ============================================================================

const shootSortFields = [
	"name",
	"shootDate",
	"shootType",
	"status",
	"createdAt",
] as const;

export const listShootsInputSchema = z
	.object({
		bookingId: idSchema.optional(),
		status: z.string().optional(),
		shootType: z.string().optional(),
		dateFrom: dateSchema.optional(),
		dateTo: dateSchema.optional(),
	})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(baseListFiltersSchema)
	.merge(createSortSchema(shootSortFields, "shootDate"));

export type ListShootsInput = z.infer<typeof listShootsInputSchema>;

/**
 * Shoot list item with assignment count
 */
export const shootListItemSchema = shootSchema.extend({
	assignmentsCount: z.number(),
	bookingName: z.string(),
	bookingReferenceNumber: z.string(),
});

export type ShootListItem = z.infer<typeof shootListItemSchema>;

export const listShootsOutputSchema =
	createListResponseSchema(shootListItemSchema);

export type ListShootsOutput = z.infer<typeof listShootsOutputSchema>;

// ============================================================================
// LIST SHOOTS MINIMAL
// ============================================================================

export const listShootsMinimalInputSchema = z
	.object({
		bookingId: idSchema.optional(),
		status: z.string().optional(),
	})
	.merge(searchSchema);

export type ListShootsMinimalInput = z.infer<
	typeof listShootsMinimalInputSchema
>;

export const listShootsMinimalOutputSchema = z.object({
	data: z.array(shootMinimalSchema),
});

export type ListShootsMinimalOutput = z.infer<
	typeof listShootsMinimalOutputSchema
>;

// ============================================================================
// GET SHOOT
// ============================================================================

export const getShootInputSchema = z.object({
	id: idSchema,
});

export type GetShootInput = z.infer<typeof getShootInputSchema>;

/**
 * Shoot detail with assignments and booking info
 */
export const shootDetailSchema = shootSchema.extend({
	assignments: z.array(shootAssignmentWithCrewSchema),
	booking: z.object({
		id: idSchema,
		name: z.string(),
		referenceNumber: z.string(),
	}),
});

export type ShootDetail = z.infer<typeof shootDetailSchema>;

export const getShootOutputSchema = createItemResponseSchema(shootDetailSchema);

export type GetShootOutput = z.infer<typeof getShootOutputSchema>;

// ============================================================================
// CREATE SHOOT
// ============================================================================

export const createShootInputSchema = z.object({
	bookingId: idSchema,
	name: nameSchema,
	shootType: z.string().min(1).max(100),
	shootDate: dateSchema,
	startTime: timeSchema.optional(),
	endTime: timeSchema.optional(),
	venue: z.string().max(255).optional(),
	venueAddress: z.string().max(500).optional(),
	notes: z.string().max(5000).optional(),
	status: z.string().min(1).max(50).optional(),
});

export type CreateShootInput = z.infer<typeof createShootInputSchema>;

export const createShootOutputSchema = mutationResponseSchema;

export type CreateShootOutput = z.infer<typeof createShootOutputSchema>;

// ============================================================================
// UPDATE SHOOT
// ============================================================================

export const updateShootInputSchema = z.object({
	id: idSchema,
	name: nameSchema.optional(),
	shootType: z.string().min(1).max(100).optional(),
	shootDate: dateSchema.optional(),
	startTime: timeSchema.optional().nullable(),
	endTime: timeSchema.optional().nullable(),
	venue: z.string().max(255).optional().nullable(),
	venueAddress: z.string().max(500).optional().nullable(),
	notes: z.string().max(5000).optional().nullable(),
	status: z.string().min(1).max(50).optional(),
});

export type UpdateShootInput = z.infer<typeof updateShootInputSchema>;

export const updateShootOutputSchema = mutationResponseSchema;

export type UpdateShootOutput = z.infer<typeof updateShootOutputSchema>;

// ============================================================================
// DELETE SHOOT
// ============================================================================

export const deleteShootInputSchema = z.object({
	id: idSchema,
});

export type DeleteShootInput = z.infer<typeof deleteShootInputSchema>;

export const deleteShootOutputSchema = mutationResponseSchema;

export type DeleteShootOutput = z.infer<typeof deleteShootOutputSchema>;

// ============================================================================
// SHOOT STATS
// ============================================================================

export const getShootStatsInputSchema = z.object({
	bookingId: idSchema.optional(),
});

export type GetShootStatsInput = z.infer<typeof getShootStatsInputSchema>;

export const shootStatsSchema = z.object({
	totalShoots: z.number(),
	byStatus: z.record(z.string(), z.number()),
	upcomingShoots: z.number(),
	completedShoots: z.number(),
	shootsThisMonth: z.number(),
});

export type ShootStats = z.infer<typeof shootStatsSchema>;

export const getShootStatsOutputSchema =
	createItemResponseSchema(shootStatsSchema);

export type GetShootStatsOutput = z.infer<typeof getShootStatsOutputSchema>;

// ============================================================================
// ASSIGN CREW
// ============================================================================

export const assignCrewInputSchema = z.object({
	shootId: idSchema,
	crewId: idSchema,
	role: z.string().min(1).max(100),
	isLead: z.boolean().optional(),
});

export type AssignCrewInput = z.infer<typeof assignCrewInputSchema>;

export const assignCrewOutputSchema = mutationResponseSchema;

export type AssignCrewOutput = z.infer<typeof assignCrewOutputSchema>;

// ============================================================================
// UNASSIGN CREW
// ============================================================================

export const unassignCrewInputSchema = z.object({
	shootId: idSchema,
	crewId: idSchema,
});

export type UnassignCrewInput = z.infer<typeof unassignCrewInputSchema>;

export const unassignCrewOutputSchema = mutationResponseSchema;

export type UnassignCrewOutput = z.infer<typeof unassignCrewOutputSchema>;
