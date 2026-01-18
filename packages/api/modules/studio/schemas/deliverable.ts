/**
 * Deliverable Schemas
 *
 * Zod schemas for final output management endpoints (albums, videos, photos, etc.).
 */

import { z } from "zod";
import {
	baseListFiltersSchema,
	createItemResponseSchema,
	createListResponseSchema,
	createSortSchema,
	dateSchema,
	descriptionSchema,
	idSchema,
	moneySchema,
	mutationResponseSchema,
	nameSchema,
	paginationSchema,
	searchSchema,
	uploadedAttachmentSchema,
	workflowStatusSchema,
} from "./common";

// ============================================================================
// DELIVERABLE ASSIGNMENT SCHEMA
// ============================================================================

export const deliverableAssignmentSchema = z.object({
	id: idSchema,
	deliverableId: idSchema,
	crewId: idSchema,
	isLead: z.boolean(),
	assignedBy: idSchema.nullable(),
	createdAt: z.string(),
});

export type DeliverableAssignment = z.infer<typeof deliverableAssignmentSchema>;

export const deliverableAssignmentWithCrewSchema =
	deliverableAssignmentSchema.extend({
		crew: z.object({
			id: idSchema,
			name: z.string(),
			role: z.string(),
			phoneNumber: z.string().nullable(),
		}),
	});

export type DeliverableAssignmentWithCrew = z.infer<
	typeof deliverableAssignmentWithCrewSchema
>;

// ============================================================================
// DELIVERABLE SCHEMA
// ============================================================================

/**
 * Full deliverable schema (output)
 */
export const deliverableSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	bookingId: idSchema,
	name: z.string(),
	description: z.string().nullable(),
	// Package relationship fields
	quantity: z.number().int().min(1),
	cost: moneySchema.nullable(),
	isPackageIncluded: z.boolean(),
	status: z.string(),
	workflowStatus: workflowStatusSchema,
	dueDate: z.string().nullable(),
	deliveredAt: z.string().nullable(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	createdBy: idSchema.nullable(),
	updatedBy: idSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
	deletedBy: idSchema.nullable(),
});

export type Deliverable = z.infer<typeof deliverableSchema>;

/**
 * Minimal deliverable schema for dropdowns and references
 */
export const deliverableMinimalSchema = z.object({
	id: idSchema,
	name: z.string(),
	status: z.string(),
	workflowStatus: workflowStatusSchema,
	dueDate: z.string().nullable(),
	bookingId: idSchema,
});

export type DeliverableMinimal = z.infer<typeof deliverableMinimalSchema>;

// ============================================================================
// LIST DELIVERABLES
// ============================================================================

const deliverableSortFields = [
	"name",
	"dueDate",
	"status",
	"workflowStatus",
	"createdAt",
] as const;

export const listDeliverablesInputSchema = z
	.object({
		bookingId: idSchema.optional(),
		status: z.union([z.string(), z.array(z.string())]).nullish(),
		workflowStatus: workflowStatusSchema.optional(),
		dueDateFrom: dateSchema.optional(),
		dueDateTo: dateSchema.optional(),
		crewId: idSchema.optional(),
	})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(baseListFiltersSchema)
	.merge(createSortSchema(deliverableSortFields, "dueDate"));

export type ListDeliverablesInput = z.infer<typeof listDeliverablesInputSchema>;

/**
 * Deliverable list item with assignment count and booking info
 */
export const deliverableListItemSchema = deliverableSchema.extend({
	assignmentsCount: z.number(),
	bookingName: z.string(),
	bookingReferenceNumber: z.string(),
	bookingPackageType: z.string(),
});

export type DeliverableListItem = z.infer<typeof deliverableListItemSchema>;

export const listDeliverablesOutputSchema = createListResponseSchema(
	deliverableListItemSchema,
);

export type ListDeliverablesOutput = z.infer<
	typeof listDeliverablesOutputSchema
>;

// ============================================================================
// LIST DELIVERABLES MINIMAL
// ============================================================================

export const listDeliverablesMinimalInputSchema = z
	.object({
		bookingId: idSchema.optional(),
		workflowStatus: workflowStatusSchema.optional(),
	})
	.merge(paginationSchema)
	.merge(searchSchema);

export type ListDeliverablesMinimalInput = z.infer<
	typeof listDeliverablesMinimalInputSchema
>;

export const listDeliverablesMinimalOutputSchema = createListResponseSchema(
	deliverableMinimalSchema,
);

export type ListDeliverablesMinimalOutput = z.infer<
	typeof listDeliverablesMinimalOutputSchema
>;

// ============================================================================
// GET DELIVERABLE
// ============================================================================

export const getDeliverableInputSchema = z.object({
	id: idSchema,
});

export type GetDeliverableInput = z.infer<typeof getDeliverableInputSchema>;

/**
 * Deliverable detail with assignments and booking info
 */
export const deliverableDetailSchema = deliverableSchema.extend({
	assignments: z.array(deliverableAssignmentWithCrewSchema),
	booking: z.object({
		id: idSchema,
		name: z.string(),
		referenceNumber: z.string(),
	}),
});

export type DeliverableDetail = z.infer<typeof deliverableDetailSchema>;

export const getDeliverableOutputSchema = createItemResponseSchema(
	deliverableDetailSchema,
);

export type GetDeliverableOutput = z.infer<typeof getDeliverableOutputSchema>;

// ============================================================================
// CREATE DELIVERABLE
// ============================================================================

export const createDeliverableInputSchema = z.object({
	bookingId: idSchema,
	name: nameSchema,
	description: descriptionSchema,
	quantity: z.number().int().min(1).optional(),
	cost: moneySchema.optional(),
	status: z.string().min(1).max(50).optional(),
	dueDate: dateSchema.optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateDeliverableInput = z.infer<
	typeof createDeliverableInputSchema
>;

export const createDeliverableOutputSchema = mutationResponseSchema;

export type CreateDeliverableOutput = z.infer<
	typeof createDeliverableOutputSchema
>;

// ============================================================================
// UPDATE DELIVERABLE
// ============================================================================

export const updateDeliverableInputSchema = z.object({
	id: idSchema,
	name: nameSchema.optional(),
	description: descriptionSchema.nullable(),
	quantity: z.number().int().min(1).optional(),
	cost: moneySchema.optional().nullable(),
	status: z.string().min(1).max(50).optional(),
	dueDate: dateSchema.optional().nullable(),
	metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type UpdateDeliverableInput = z.infer<
	typeof updateDeliverableInputSchema
>;

export const updateDeliverableOutputSchema = mutationResponseSchema;

export type UpdateDeliverableOutput = z.infer<
	typeof updateDeliverableOutputSchema
>;

// ============================================================================
// UPDATE DELIVERABLE ASSIGNMENT STATUS (ASSIGNEE)
// ============================================================================

export const updateDeliverableAssignmentStatusInputSchema = z.object({
	id: idSchema,
	status: z.enum(["blocked"]),
	note: z.string().max(5000).optional(),
});

export type UpdateDeliverableAssignmentStatusInput = z.infer<
	typeof updateDeliverableAssignmentStatusInputSchema
>;

export const updateDeliverableAssignmentStatusOutputSchema =
	mutationResponseSchema;

export type UpdateDeliverableAssignmentStatusOutput = z.infer<
	typeof updateDeliverableAssignmentStatusOutputSchema
>;

// ============================================================================
// DELETE DELIVERABLE
// ============================================================================

export const deleteDeliverableInputSchema = z.object({
	id: idSchema,
});

export type DeleteDeliverableInput = z.infer<
	typeof deleteDeliverableInputSchema
>;

export const deleteDeliverableOutputSchema = mutationResponseSchema;

export type DeleteDeliverableOutput = z.infer<
	typeof deleteDeliverableOutputSchema
>;

// ============================================================================
// DELIVERABLE STATS
// ============================================================================

export const getDeliverableStatsInputSchema = z.object({
	bookingId: idSchema.optional(),
});

export type GetDeliverableStatsInput = z.infer<
	typeof getDeliverableStatsInputSchema
>;

export const deliverableStatsSchema = z.object({
	totalDeliverables: z.number(),
	byStatus: z.record(z.string(), z.number()),
	byWorkflowStatus: z.record(z.string(), z.number()),
	overdueDeliverables: z.number(),
	deliveredDeliverables: z.number(),
	deliverablesThisMonth: z.number(),
});

export type DeliverableStats = z.infer<typeof deliverableStatsSchema>;

export const getDeliverableStatsOutputSchema = createItemResponseSchema(
	deliverableStatsSchema,
);

export type GetDeliverableStatsOutput = z.infer<
	typeof getDeliverableStatsOutputSchema
>;

// ============================================================================
// ASSIGN CREW
// ============================================================================

export const assignCrewToDeliverableInputSchema = z.object({
	deliverableId: idSchema,
	crewId: idSchema,
	isLead: z.boolean().optional(),
});

export type AssignCrewToDeliverableInput = z.infer<
	typeof assignCrewToDeliverableInputSchema
>;

export const assignCrewToDeliverableOutputSchema = mutationResponseSchema;

export type AssignCrewToDeliverableOutput = z.infer<
	typeof assignCrewToDeliverableOutputSchema
>;

// ============================================================================
// UNASSIGN CREW
// ============================================================================

export const unassignCrewFromDeliverableInputSchema = z.object({
	deliverableId: idSchema,
	crewId: idSchema,
});

export type UnassignCrewFromDeliverableInput = z.infer<
	typeof unassignCrewFromDeliverableInputSchema
>;

export const unassignCrewFromDeliverableOutputSchema = mutationResponseSchema;

export type UnassignCrewFromDeliverableOutput = z.infer<
	typeof unassignCrewFromDeliverableOutputSchema
>;

// ============================================================================
// CONVERT TO TASK
// ============================================================================

export const convertDeliverableToTaskInputSchema = z.object({
	deliverableId: idSchema,
	taskName: nameSchema.optional(),
	taskDescription: descriptionSchema,
	taskPriority: z.string().min(1).max(50).optional(),
	taskDueDate: dateSchema.optional(),
});

export type ConvertDeliverableToTaskInput = z.infer<
	typeof convertDeliverableToTaskInputSchema
>;

export const convertDeliverableToTaskOutputSchema = z.object({
	data: z.object({
		taskId: idSchema,
		deliverableId: idSchema,
	}),
	message: z.string(),
});

export type ConvertDeliverableToTaskOutput = z.infer<
	typeof convertDeliverableToTaskOutputSchema
>;

// ============================================================================
// SUBMIT DELIVERABLE
// ============================================================================

export const submitDeliverableInputSchema = z.object({
	deliverableId: idSchema,
	submissionNote: z.string().max(5000).optional(),
	submissionLinks: z.array(z.string().url()).optional(),
	files: z.array(uploadedAttachmentSchema).optional(),
});

export type SubmitDeliverableInput = z.infer<
	typeof submitDeliverableInputSchema
>;

export const submitDeliverableOutputSchema = mutationResponseSchema;

export type SubmitDeliverableOutput = z.infer<
	typeof submitDeliverableOutputSchema
>;
