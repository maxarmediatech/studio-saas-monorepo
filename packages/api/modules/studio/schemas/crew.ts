/**
 * Crew Schemas
 *
 * Zod schemas for crew/team member management endpoints.
 */

import { z } from "zod";
import {
	baseListFiltersSchema,
	createItemResponseSchema,
	createListResponseSchema,
	createSortSchema,
	dateSchema,
	emailSchema,
	idSchema,
	moneySchema,
	mutationResponseSchema,
	nameSchema,
	paginationSchema,
	phoneSchema,
	searchSchema,
} from "./common";

// ============================================================================
// CREW SCHEMA
// ============================================================================

/**
 * Full crew schema (output)
 */
export const crewSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	userId: idSchema.nullable(),
	name: z.string(),
	email: z.string().nullable(),
	phoneNumber: z.string().nullable(),
	memberRoles: z.array(z.string()),
	displayRoles: z.array(z.string()),
	isFreelancer: z.boolean(),
	specializations: z.array(z.string()),
	status: z.string(),
	dailyRate: z.string().nullable(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	createdBy: idSchema.nullable(),
	updatedBy: idSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
	deletedBy: idSchema.nullable(),
});

export type Crew = z.infer<typeof crewSchema>;

/**
 * Minimal crew schema for dropdowns and references
 */
export const crewMinimalSchema = z.object({
	id: idSchema,
	name: z.string(),
	displayRoles: z.array(z.string()),
	isFreelancer: z.boolean(),
	specializations: z.array(z.string()),
	status: z.string(),
});

export type CrewMinimal = z.infer<typeof crewMinimalSchema>;

// ============================================================================
// LIST CREWS
// ============================================================================

const crewSortFields = ["name", "status", "createdAt", "updatedAt"] as const;

export const listCrewsInputSchema = z
	.object({
		status: z.union([z.string(), z.array(z.string())]).nullish(),
		specializations: z.union([z.string(), z.array(z.string())]).nullish(),
	})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(baseListFiltersSchema)
	.merge(createSortSchema(crewSortFields, "createdAt"));

export type ListCrewsInput = z.infer<typeof listCrewsInputSchema>;

export const listCrewsOutputSchema = createListResponseSchema(crewSchema);

export type ListCrewsOutput = z.infer<typeof listCrewsOutputSchema>;

// ============================================================================
// GET CREW
// ============================================================================

export const getCrewInputSchema = z.object({
	id: idSchema,
});

export type GetCrewInput = z.infer<typeof getCrewInputSchema>;

/**
 * Crew detail includes assignment statistics
 */
export const crewDetailSchema = crewSchema.extend({
	activeShootAssignments: z.number(),
	activeTaskAssignments: z.number(),
	activeDeliverableAssignments: z.number(),
	totalCompletedAssignments: z.number(),
});

export type CrewDetail = z.infer<typeof crewDetailSchema>;

export const getCrewOutputSchema = createItemResponseSchema(crewDetailSchema);

export type GetCrewOutput = z.infer<typeof getCrewOutputSchema>;

// ============================================================================
// CREATE CREW
// ============================================================================

export const createCrewInputSchema = z.object({
	name: nameSchema,
	email: emailSchema.optional(),
	phoneNumber: phoneSchema,
	specializations: z.array(z.string().min(1).max(100)).optional(),
	status: z.string().min(1).max(50).optional(),
	dailyRate: moneySchema.optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateCrewInput = z.infer<typeof createCrewInputSchema>;

export const createCrewOutputSchema = mutationResponseSchema;

export type CreateCrewOutput = z.infer<typeof createCrewOutputSchema>;

// ============================================================================
// UPDATE CREW
// ============================================================================

export const updateCrewInputSchema = z.object({
	id: idSchema,
	name: nameSchema.optional(),
	email: emailSchema.optional().nullable(),
	phoneNumber: phoneSchema.nullable(),
	specializations: z.array(z.string().min(1).max(100)).optional(),
	status: z.string().min(1).max(50).optional(),
	dailyRate: moneySchema.optional().nullable(),
	metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type UpdateCrewInput = z.infer<typeof updateCrewInputSchema>;

export const updateCrewOutputSchema = mutationResponseSchema;

export type UpdateCrewOutput = z.infer<typeof updateCrewOutputSchema>;

// ============================================================================
// DELETE CREW
// ============================================================================

export const deleteCrewInputSchema = z.object({
	id: idSchema,
});

export type DeleteCrewInput = z.infer<typeof deleteCrewInputSchema>;

export const deleteCrewOutputSchema = mutationResponseSchema;

export type DeleteCrewOutput = z.infer<typeof deleteCrewOutputSchema>;

// ============================================================================
// CREW AVAILABILITY
// ============================================================================

export const crewAvailabilitySchema = z.object({
	id: idSchema,
	crewId: idSchema,
	date: z.string(),
	isAvailable: z.boolean(),
	reason: z.string().nullable(),
	createdAt: z.string(),
});

export type CrewAvailability = z.infer<typeof crewAvailabilitySchema>;

export const getCrewAvailabilityInputSchema = z.object({
	crewIds: z.array(idSchema).optional(),
	startDate: dateSchema,
	endDate: dateSchema,
});

export type GetCrewAvailabilityInput = z.infer<
	typeof getCrewAvailabilityInputSchema
>;

export const getCrewAvailabilityOutputSchema = z.object({
	data: z.array(
		z.object({
			crewId: idSchema,
			crewName: z.string(),
			availability: z.array(
				z.object({
					date: z.string(),
					isAvailable: z.boolean(),
					reason: z.string().nullable(),
					hasShootAssignment: z.boolean(),
				}),
			),
		}),
	),
});

export type GetCrewAvailabilityOutput = z.infer<
	typeof getCrewAvailabilityOutputSchema
>;

// ============================================================================
// CREATE CREW FROM MEMBER
// ============================================================================

export const createCrewFromMemberInputSchema = z.object({
	memberId: idSchema,
	dailyRate: moneySchema.optional(),
	specializations: z.array(z.string().min(1).max(100)).optional(),
});

export type CreateCrewFromMemberInput = z.infer<
	typeof createCrewFromMemberInputSchema
>;

export const createCrewFromMemberOutputSchema = mutationResponseSchema;

export type CreateCrewFromMemberOutput = z.infer<
	typeof createCrewFromMemberOutputSchema
>;
