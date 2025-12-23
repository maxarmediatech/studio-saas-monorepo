/**
 * My Assignments Schemas
 *
 * Zod schemas for crew member's assignment endpoints.
 * These endpoints are for the currently logged-in user to view their assigned work.
 */

import { z } from "zod";
import {
	createListResponseSchema,
	createItemResponseSchema,
	createSortSchema,
	idSchema,
	paginationSchema,
	dateSchema,
	workflowStatusSchema,
	bookingPhaseSchema,
} from "./common";

// ============================================================================
// SHARED TYPES
// ============================================================================

/**
 * Booking info for assignment context
 */
export const assignmentBookingSchema = z.object({
	id: idSchema,
	name: z.string(),
	referenceNumber: z.string(),
	status: bookingPhaseSchema,
});

export type AssignmentBooking = z.infer<typeof assignmentBookingSchema>;

// ============================================================================
// LIST MY ASSIGNMENTS (OVERVIEW)
// ============================================================================

export const listMyAssignmentsInputSchema = z.object({
	includeCompleted: z.boolean().default(false),
});

export type ListMyAssignmentsInput = z.infer<typeof listMyAssignmentsInputSchema>;

/**
 * Assignment summary counts
 */
export const myAssignmentsSummarySchema = z.object({
	upcomingShoots: z.number(),
	activeTasks: z.number(),
	activeDeliverables: z.number(),
	pendingSubmissions: z.number(),
	overdueItems: z.number(),
});

export type MyAssignmentsSummary = z.infer<typeof myAssignmentsSummarySchema>;

/**
 * Overview data combining all assignment types
 */
export const myAssignmentsOverviewSchema = z.object({
	summary: myAssignmentsSummarySchema,
	nextShoot: z
		.object({
			id: idSchema,
			title: z.string(),
			shootDate: z.string(),
			startTime: z.string().nullable(),
			location: z.string().nullable(),
			bookingName: z.string(),
		})
		.nullable(),
	urgentTasks: z.array(
		z.object({
			id: idSchema,
			name: z.string(),
			dueDate: z.string().nullable(),
			isOverdue: z.boolean(),
			workflowStatus: workflowStatusSchema,
			bookingName: z.string(),
		}),
	),
	urgentDeliverables: z.array(
		z.object({
			id: idSchema,
			name: z.string(),
			dueDate: z.string().nullable(),
			isOverdue: z.boolean(),
			workflowStatus: workflowStatusSchema,
			bookingName: z.string(),
		}),
	),
});

export type MyAssignmentsOverview = z.infer<typeof myAssignmentsOverviewSchema>;

export const listMyAssignmentsOutputSchema = createItemResponseSchema(myAssignmentsOverviewSchema);

export type ListMyAssignmentsOutput = z.infer<typeof listMyAssignmentsOutputSchema>;

// ============================================================================
// GET MY SHOOTS
// ============================================================================

const myShootSortFields = ["shootDate", "createdAt"] as const;

export const getMyShootsInputSchema = z
	.object({
		dateFrom: dateSchema.optional(),
		dateTo: dateSchema.optional(),
		status: z.string().optional(),
		bookingId: idSchema.optional(),
		includeCompleted: z.boolean().default(false),
	})
	.merge(paginationSchema)
	.merge(createSortSchema(myShootSortFields, "shootDate"));

export type GetMyShootsInput = z.infer<typeof getMyShootsInputSchema>;

/**
 * My shoot assignment item
 */
export const myShootItemSchema = z.object({
	id: idSchema,
	shootId: idSchema,
	title: z.string(),
	shootDate: z.string(),
	startTime: z.string().nullable(),
	endTime: z.string().nullable(),
	location: z.string().nullable(),
	status: z.string(),
	role: z.string(),
	isLead: z.boolean(),
	booking: assignmentBookingSchema,
	// Other crew on this shoot
	otherCrew: z.array(
		z.object({
			id: idSchema,
			name: z.string(),
			role: z.string(),
			isLead: z.boolean(),
		}),
	),
});

export type MyShootItem = z.infer<typeof myShootItemSchema>;

export const getMyShootsOutputSchema = createListResponseSchema(myShootItemSchema);

export type GetMyShootsOutput = z.infer<typeof getMyShootsOutputSchema>;

// ============================================================================
// GET MY TASKS
// ============================================================================

const myTaskSortFields = ["dueDate", "priority", "workflowStatus", "createdAt"] as const;

export const getMyTasksInputSchema = z
	.object({
		dueDateFrom: dateSchema.optional(),
		dueDateTo: dateSchema.optional(),
		status: z.string().optional(),
		priority: z.string().optional(),
		workflowStatus: workflowStatusSchema.optional(),
		bookingId: idSchema.optional(),
		includeCompleted: z.boolean().default(false),
	})
	.merge(paginationSchema)
	.merge(createSortSchema(myTaskSortFields, "dueDate"));

export type GetMyTasksInput = z.infer<typeof getMyTasksInputSchema>;

/**
 * My task assignment item
 */
export const myTaskItemSchema = z.object({
	id: idSchema,
	taskId: idSchema,
	name: z.string(),
	description: z.string().nullable(),
	status: z.string(),
	priority: z.string(),
	workflowStatus: workflowStatusSchema,
	dueDate: z.string().nullable(),
	isOverdue: z.boolean(),
	booking: assignmentBookingSchema,
	// Current submission status if any
	latestSubmission: z
		.object({
			id: idSchema,
			status: z.string(),
			submittedAt: z.string().nullable(),
			reviewNote: z.string().nullable(),
		})
		.nullable(),
	// Other crew on this task
	otherCrew: z.array(
		z.object({
			id: idSchema,
			name: z.string(),
		}),
	),
});

export type MyTaskItem = z.infer<typeof myTaskItemSchema>;

export const getMyTasksOutputSchema = createListResponseSchema(myTaskItemSchema);

export type GetMyTasksOutput = z.infer<typeof getMyTasksOutputSchema>;

// ============================================================================
// GET MY DELIVERABLES
// ============================================================================

const myDeliverableSortFields = ["dueDate", "priority", "workflowStatus", "createdAt"] as const;

export const getMyDeliverablesInputSchema = z
	.object({
		dueDateFrom: dateSchema.optional(),
		dueDateTo: dateSchema.optional(),
		status: z.string().optional(),
		priority: z.string().optional(),
		workflowStatus: workflowStatusSchema.optional(),
		bookingId: idSchema.optional(),
		includeCompleted: z.boolean().default(false),
	})
	.merge(paginationSchema)
	.merge(createSortSchema(myDeliverableSortFields, "dueDate"));

export type GetMyDeliverablesInput = z.infer<typeof getMyDeliverablesInputSchema>;

/**
 * My deliverable assignment item
 */
export const myDeliverableItemSchema = z.object({
	id: idSchema,
	deliverableId: idSchema,
	name: z.string(),
	description: z.string().nullable(),
	deliverableType: z.string(),
	status: z.string(),
	priority: z.string(),
	workflowStatus: workflowStatusSchema,
	dueDate: z.string().nullable(),
	isOverdue: z.boolean(),
	isLead: z.boolean(),
	booking: assignmentBookingSchema,
	// Current submission status if any
	latestSubmission: z
		.object({
			id: idSchema,
			status: z.string(),
			submittedAt: z.string().nullable(),
			reviewNote: z.string().nullable(),
		})
		.nullable(),
	// Other crew on this deliverable
	otherCrew: z.array(
		z.object({
			id: idSchema,
			name: z.string(),
		}),
	),
});

export type MyDeliverableItem = z.infer<typeof myDeliverableItemSchema>;

export const getMyDeliverablesOutputSchema = createListResponseSchema(myDeliverableItemSchema);

export type GetMyDeliverablesOutput = z.infer<typeof getMyDeliverablesOutputSchema>;
