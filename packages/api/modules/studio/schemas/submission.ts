/**
 * Submission Schemas
 *
 * Zod schemas for work submission review workflow endpoints.
 */

import { z } from "zod";
import {
	createListResponseSchema,
	createItemResponseSchema,
	createSortSchema,
	idSchema,
	mutationResponseSchema,
	paginationSchema,
	searchSchema,
	submissionStatusSchema,
	workflowStatusSchema,
} from "./common";

// ============================================================================
// SUBMISSION SCHEMA
// ============================================================================

/**
 * Crew info in submission context
 */
export const submissionCrewSchema = z.object({
	id: idSchema,
	name: z.string(),
	role: z.string(),
	phoneNumber: z.string().nullable(),
});

export type SubmissionCrew = z.infer<typeof submissionCrewSchema>;

/**
 * Submission file schema
 */
export const submissionFileSchema = z.object({
	id: idSchema,
	fileName: z.string(),
	fileUrl: z.string(),
	fileSize: z.number().nullable(),
	mimeType: z.string().nullable(),
	createdAt: z.string(),
});

export type SubmissionFile = z.infer<typeof submissionFileSchema>;

/**
 * Full submission schema (output)
 */
export const submissionSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	taskId: idSchema.nullable(),
	deliverableId: idSchema.nullable(),
	submittedBy: idSchema,
	status: submissionStatusSchema,
	submissionNote: z.string().nullable(),
	submittedAt: z.string().nullable(),
	reviewedBy: idSchema.nullable(),
	reviewedAt: z.string().nullable(),
	reviewNote: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Submission = z.infer<typeof submissionSchema>;

// ============================================================================
// LIST SUBMISSIONS
// ============================================================================

const submissionSortFields = ["submittedAt", "status", "createdAt"] as const;

export const listSubmissionsInputSchema = z
	.object({
		status: submissionStatusSchema.optional(),
		submittedBy: idSchema.optional(),
		reviewedBy: idSchema.optional(),
		taskId: idSchema.optional(),
		deliverableId: idSchema.optional(),
		bookingId: idSchema.optional(),
		entityType: z.enum(["task", "deliverable"]).optional(),
		pendingReviewOnly: z.boolean().default(false),
	})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(createSortSchema(submissionSortFields, "submittedAt"));

export type ListSubmissionsInput = z.infer<typeof listSubmissionsInputSchema>;

/**
 * Submission list item with entity and crew info
 */
export const submissionListItemSchema = submissionSchema.extend({
	// Entity info (task or deliverable)
	entityType: z.enum(["task", "deliverable"]),
	entityId: idSchema,
	entityName: z.string(),
	entityWorkflowStatus: workflowStatusSchema,
	// Booking info
	bookingId: idSchema,
	bookingName: z.string(),
	bookingReferenceNumber: z.string(),
	// Crew info
	submittedByName: z.string(),
	submittedByRole: z.string(),
	// Reviewer info
	reviewedByName: z.string().nullable(),
});

export type SubmissionListItem = z.infer<typeof submissionListItemSchema>;

export const listSubmissionsOutputSchema = createListResponseSchema(submissionListItemSchema);

export type ListSubmissionsOutput = z.infer<typeof listSubmissionsOutputSchema>;

// ============================================================================
// GET SUBMISSION
// ============================================================================

export const getSubmissionInputSchema = z.object({
	id: idSchema,
});

export type GetSubmissionInput = z.infer<typeof getSubmissionInputSchema>;

/**
 * Submission detail with entity, crew, files, and history
 */
export const submissionDetailSchema = submissionSchema.extend({
	// Entity info
	entityType: z.enum(["task", "deliverable"]),
	entityId: idSchema,
	entityName: z.string(),
	entityDescription: z.string().nullable(),
	entityDueDate: z.string().nullable(),
	entityWorkflowStatus: workflowStatusSchema,
	// Booking info
	booking: z.object({
		id: idSchema,
		name: z.string(),
		referenceNumber: z.string(),
	}),
	// Crew info
	submittedByCrew: submissionCrewSchema,
	// Reviewer info
	reviewer: z
		.object({
			id: idSchema,
			name: z.string(),
			email: z.string(),
		})
		.nullable(),
	// Files
	files: z.array(submissionFileSchema),
	// Previous submissions for same entity
	previousSubmissions: z.array(
		z.object({
			id: idSchema,
			status: submissionStatusSchema,
			submittedAt: z.string().nullable(),
			reviewedAt: z.string().nullable(),
			reviewNote: z.string().nullable(),
		}),
	),
});

export type SubmissionDetail = z.infer<typeof submissionDetailSchema>;

export const getSubmissionOutputSchema = createItemResponseSchema(submissionDetailSchema);

export type GetSubmissionOutput = z.infer<typeof getSubmissionOutputSchema>;

// ============================================================================
// CLAIM SUBMISSION
// ============================================================================

export const claimSubmissionInputSchema = z.object({
	id: idSchema,
});

export type ClaimSubmissionInput = z.infer<typeof claimSubmissionInputSchema>;

export const claimSubmissionOutputSchema = mutationResponseSchema;

export type ClaimSubmissionOutput = z.infer<typeof claimSubmissionOutputSchema>;

// ============================================================================
// REVIEW SUBMISSION
// ============================================================================

export const reviewSubmissionInputSchema = z.object({
	id: idSchema,
	decision: z.enum(["approve", "request_revision", "reject"]),
	reviewNote: z.string().max(5000).optional(),
});

export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionInputSchema>;

export const reviewSubmissionOutputSchema = mutationResponseSchema;

export type ReviewSubmissionOutput = z.infer<typeof reviewSubmissionOutputSchema>;
