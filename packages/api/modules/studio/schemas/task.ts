/**
 * Task Schemas
 *
 * Zod schemas for production task management endpoints.
 */

import { z } from "zod";
import {
	assignedCrewSummarySchema,
	assignmentProgressStatusSchema,
	baseListFiltersSchema,
	createItemResponseSchema,
	createListResponseSchema,
	createSortSchema,
	dateSchema,
	descriptionSchema,
	idSchema,
	mutationResponseSchema,
	nameSchema,
	paginationSchema,
	searchSchema,
	uploadedAttachmentSchema,
	workflowStatusSchema,
} from "./common";

// ============================================================================
// TASK ASSIGNMENT SCHEMA
// ============================================================================

export const taskAssignmentSchema = z.object({
	id: idSchema,
	taskId: idSchema,
	crewId: idSchema,
	assignedBy: idSchema.nullable(),
	assignedByName: z.string().nullable(),
	progressStatus: assignmentProgressStatusSchema,
	progressNote: z.string().nullable(),
	startedAt: z.string().nullable(),
	blockedAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type TaskAssignment = z.infer<typeof taskAssignmentSchema>;

export const taskAssignmentWithCrewSchema = taskAssignmentSchema.extend({
	crew: z.object({
		id: idSchema,
		name: z.string(),
		phoneNumber: z.string().nullable(),
	}),
});

export type TaskAssignmentWithCrew = z.infer<
	typeof taskAssignmentWithCrewSchema
>;

export const taskDeliverableLinkSchema = z.object({
	id: idSchema,
	deliverableId: idSchema,
	kind: z.enum(["required", "optional", "reference"]),
	deliverable: z.object({
		id: idSchema,
		name: z.string(),
		status: z.string(),
		workflowStatus: workflowStatusSchema,
	}),
});

// ============================================================================
// TASK SCHEMA
// ============================================================================

/**
 * Full task schema (output)
 */
export const taskSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	bookingId: idSchema,
	name: z.string(),
	description: z.string().nullable(),
	status: z.string(),
	priority: z.string(),
	workflowStatus: workflowStatusSchema,
	dueDate: z.string().nullable(),
	completedAt: z.string().nullable(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	createdBy: idSchema.nullable(),
	updatedBy: idSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
	deletedBy: idSchema.nullable(),
});

export type Task = z.infer<typeof taskSchema>;

/**
 * Minimal task schema for dropdowns and references
 */
export const taskMinimalSchema = z.object({
	id: idSchema,
	name: z.string(),
	status: z.string(),
	priority: z.string(),
	workflowStatus: workflowStatusSchema,
	dueDate: z.string().nullable(),
	bookingId: idSchema,
});

export type TaskMinimal = z.infer<typeof taskMinimalSchema>;

// ============================================================================
// LIST TASKS
// ============================================================================

const taskSortFields = [
	"name",
	"dueDate",
	"status",
	"priority",
	"workflowStatus",
	"createdAt",
] as const;

export const listTasksInputSchema = z
	.object({
		bookingId: idSchema.optional(),
		status: z.union([z.string(), z.array(z.string())]).nullish(),
		priority: z.union([z.string(), z.array(z.string())]).nullish(),
		workflowStatus: workflowStatusSchema.optional(),
		dueDateFrom: dateSchema.optional(),
		dueDateTo: dateSchema.optional(),
		crewId: idSchema.optional(),
	})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(baseListFiltersSchema)
	.merge(createSortSchema(taskSortFields, "dueDate"));

export type ListTasksInput = z.infer<typeof listTasksInputSchema>;

/**
 * Task list item with assignment count and booking info
 */
export const taskListItemSchema = taskSchema.extend({
	assignmentsCount: z.number(),
	assignedCrew: z.array(assignedCrewSummarySchema),
	bookingName: z.string(),
	bookingReferenceNumber: z.string(),
});

export type TaskListItem = z.infer<typeof taskListItemSchema>;

export const listTasksOutputSchema =
	createListResponseSchema(taskListItemSchema);

export type ListTasksOutput = z.infer<typeof listTasksOutputSchema>;

// ============================================================================
// LIST TASKS MINIMAL
// ============================================================================

export const listTasksMinimalInputSchema = z
	.object({
		bookingId: idSchema.optional(),
		workflowStatus: workflowStatusSchema.optional(),
	})
	.merge(paginationSchema)
	.merge(searchSchema);

export type ListTasksMinimalInput = z.infer<typeof listTasksMinimalInputSchema>;

export const listTasksMinimalOutputSchema =
	createListResponseSchema(taskMinimalSchema);

export type ListTasksMinimalOutput = z.infer<
	typeof listTasksMinimalOutputSchema
>;

// ============================================================================
// GET TASK
// ============================================================================

export const getTaskInputSchema = z.object({
	id: idSchema,
});

export type GetTaskInput = z.infer<typeof getTaskInputSchema>;

/**
 * Task detail with assignments and booking info
 */
export const taskDetailSchema = taskSchema.extend({
	assignments: z.array(taskAssignmentWithCrewSchema),
	deliverableLinks: z.array(taskDeliverableLinkSchema),
	booking: z.object({
		id: idSchema,
		name: z.string(),
		referenceNumber: z.string(),
	}),
});

export type TaskDetail = z.infer<typeof taskDetailSchema>;

export const getTaskOutputSchema = createItemResponseSchema(taskDetailSchema);

export type GetTaskOutput = z.infer<typeof getTaskOutputSchema>;

// ============================================================================
// CREATE TASK
// ============================================================================

export const createTaskInputSchema = z.object({
	bookingId: idSchema,
	name: nameSchema,
	description: descriptionSchema,
	status: z.string().min(1).max(50).optional(),
	priority: z.string().min(1).max(50).optional(),
	dueDate: dateSchema.optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	deliverableIds: z
		.array(idSchema)
		.max(100)
		.refine((ids) => new Set(ids).size === ids.length, {
			message: "Each deliverable can only be linked once",
		})
		.optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const createTaskOutputSchema = mutationResponseSchema;

export type CreateTaskOutput = z.infer<typeof createTaskOutputSchema>;

// ============================================================================
// UPDATE TASK
// ============================================================================

export const updateTaskInputSchema = z.object({
	id: idSchema,
	name: nameSchema.optional(),
	description: descriptionSchema.nullable(),
	status: z.string().min(1).max(50).optional(),
	priority: z.string().min(1).max(50).optional(),
	dueDate: dateSchema.optional().nullable(),
	metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

export const updateTaskOutputSchema = mutationResponseSchema;

export type UpdateTaskOutput = z.infer<typeof updateTaskOutputSchema>;

// ============================================================================
// DELETE TASK
// ============================================================================

export const deleteTaskInputSchema = z.object({
	id: idSchema,
});

export type DeleteTaskInput = z.infer<typeof deleteTaskInputSchema>;

export const deleteTaskOutputSchema = mutationResponseSchema;

export type DeleteTaskOutput = z.infer<typeof deleteTaskOutputSchema>;

// ============================================================================
// TASK STATS
// ============================================================================

export const getTaskStatsInputSchema = z.object({
	bookingId: idSchema.optional(),
});

export type GetTaskStatsInput = z.infer<typeof getTaskStatsInputSchema>;

export const taskStatsSchema = z.object({
	totalTasks: z.number(),
	byStatus: z.record(z.string(), z.number()),
	byPriority: z.record(z.string(), z.number()),
	byWorkflowStatus: z.record(z.string(), z.number()),
	overdueTasks: z.number(),
	completedTasks: z.number(),
	tasksThisMonth: z.number(),
});

export type TaskStats = z.infer<typeof taskStatsSchema>;

export const getTaskStatsOutputSchema =
	createItemResponseSchema(taskStatsSchema);

export type GetTaskStatsOutput = z.infer<typeof getTaskStatsOutputSchema>;

// ============================================================================
// ASSIGN CREW
// ============================================================================

export const assignCrewToTaskInputSchema = z.object({
	taskId: idSchema,
	crewId: idSchema,
});

export type AssignCrewToTaskInput = z.infer<typeof assignCrewToTaskInputSchema>;

export const assignCrewToTaskOutputSchema = mutationResponseSchema;

export type AssignCrewToTaskOutput = z.infer<
	typeof assignCrewToTaskOutputSchema
>;

// ============================================================================
// UNASSIGN CREW
// ============================================================================

export const unassignCrewFromTaskInputSchema = z.object({
	taskId: idSchema,
	crewId: idSchema,
});

export type UnassignCrewFromTaskInput = z.infer<
	typeof unassignCrewFromTaskInputSchema
>;

export const unassignCrewFromTaskOutputSchema = mutationResponseSchema;

export type UnassignCrewFromTaskOutput = z.infer<
	typeof unassignCrewFromTaskOutputSchema
>;

// ============================================================================
// UPDATE TASK STATUS
// ============================================================================

export const updateTaskStatusInputSchema = z.object({
	id: idSchema,
	status: z.string().min(1).max(50),
});

export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusInputSchema>;

export const updateTaskStatusOutputSchema = mutationResponseSchema;

export type UpdateTaskStatusOutput = z.infer<
	typeof updateTaskStatusOutputSchema
>;

// ============================================================================
// UPDATE TASK ASSIGNMENT STATUS (ASSIGNEE)
// ============================================================================

export const updateTaskAssignmentStatusInputSchema = z
	.object({
		id: idSchema,
		status: assignmentProgressStatusSchema,
		note: z.string().max(5000).optional(),
	})
	.superRefine((input, context) => {
		if (input.status === "blocked" && !input.note?.trim()) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["note"],
				message: "Explain what is blocking this assignment",
			});
		}
	});

export type UpdateTaskAssignmentStatusInput = z.infer<
	typeof updateTaskAssignmentStatusInputSchema
>;

export const updateTaskAssignmentStatusOutputSchema = mutationResponseSchema;

export type UpdateTaskAssignmentStatusOutput = z.infer<
	typeof updateTaskAssignmentStatusOutputSchema
>;

// ============================================================================
// SUBMIT TASK
// ============================================================================

export const submitTaskInputSchema = z.object({
	taskId: idSchema,
	submissionNote: z.string().max(5000).optional(),
	submissionLinks: z.array(z.string().url()).optional(),
	files: z.array(uploadedAttachmentSchema).optional(),
});

export type SubmitTaskInput = z.infer<typeof submitTaskInputSchema>;

export const submitTaskOutputSchema = mutationResponseSchema;

export type SubmitTaskOutput = z.infer<typeof submitTaskOutputSchema>;
