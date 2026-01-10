/**
 * Dashboard Schemas
 *
 * Zod schemas for studio dashboard and analytics endpoints.
 */

import { z } from "zod";
import {
	bookingPhaseSchema,
	createItemResponseSchema,
	dateRangeSchema,
	idSchema,
	workflowStatusSchema,
} from "./common";

// ============================================================================
// SHARED TYPES
// ============================================================================

export const dateRangeInputSchema = z.object({
	dateRange: dateRangeSchema.optional(),
});

export type DateRangeInput = z.infer<typeof dateRangeInputSchema>;

// ============================================================================
// GET DASHBOARD
// ============================================================================

export const getDashboardInputSchema = dateRangeInputSchema;

export type GetDashboardInput = z.infer<typeof getDashboardInputSchema>;

/**
 * Financial summary for dashboard
 */
export const financialSummarySchema = z.object({
	totalRevenue: z.string(),
	totalReceived: z.string(),
	totalPending: z.string(),
	totalExpenses: z.string(),
	netProfit: z.string(),
	collectionRate: z.number(),
});

export type FinancialSummary = z.infer<typeof financialSummarySchema>;

/**
 * Booking summary for dashboard
 */
export const bookingSummarySchema = z.object({
	total: z.number(),
	byPhase: z.record(bookingPhaseSchema, z.number()),
	newThisMonth: z.number(),
	completedThisMonth: z.number(),
});

export type BookingSummary = z.infer<typeof bookingSummarySchema>;

/**
 * Operations summary for dashboard
 */
export const operationsSummarySchema = z.object({
	upcomingShoots: z.number(),
	shootsThisWeek: z.number(),
	pendingTasks: z.number(),
	overdueTasks: z.number(),
	pendingDeliverables: z.number(),
	overdueDeliverables: z.number(),
	pendingSubmissions: z.number(),
});

export type OperationsSummary = z.infer<typeof operationsSummarySchema>;

/**
 * Full dashboard data schema
 */
export const dashboardDataSchema = z.object({
	financial: financialSummarySchema,
	bookings: bookingSummarySchema,
	operations: operationsSummarySchema,
	recentBookings: z.array(
		z.object({
			id: idSchema,
			name: z.string(),
			referenceNumber: z.string(),
			status: bookingPhaseSchema,
			packageCost: z.string(),
			totalReceived: z.string(),
			createdAt: z.string(),
		}),
	),
	upcomingShoots: z.array(
		z.object({
			id: idSchema,
			title: z.string(),
			bookingId: idSchema,
			bookingName: z.string(),
			shootDate: z.string(),
			startTime: z.string().nullable(),
			location: z.string().nullable(),
			assignedCount: z.number(),
		}),
	),
});

export type DashboardData = z.infer<typeof dashboardDataSchema>;

export const getDashboardOutputSchema =
	createItemResponseSchema(dashboardDataSchema);

export type GetDashboardOutput = z.infer<typeof getDashboardOutputSchema>;

// ============================================================================
// GET KPIs
// ============================================================================

export const getKpisInputSchema = dateRangeInputSchema;

export type GetKpisInput = z.infer<typeof getKpisInputSchema>;

/**
 * Key Performance Indicators schema
 */
export const kpisSchema = z.object({
	// Revenue metrics
	totalRevenue: z.string(),
	averageBookingValue: z.string(),
	revenueGrowth: z.number(), // Percentage vs previous period

	// Collection metrics
	totalReceived: z.string(),
	totalPending: z.string(),
	collectionRate: z.number(), // Percentage of revenue collected
	overduePayments: z.string(),

	// Expense metrics
	totalExpenses: z.string(),
	profitMargin: z.number(), // Percentage

	// Booking metrics
	totalBookings: z.number(),
	activeBookings: z.number(),
	completedBookings: z.number(),
	conversionRate: z.number(), // Percentage of bookings completed

	// Operational metrics
	totalShoots: z.number(),
	averageShootsPerBooking: z.number(),
	onTimeDeliveryRate: z.number(), // Percentage
});

export type Kpis = z.infer<typeof kpisSchema>;

export const getKpisOutputSchema = createItemResponseSchema(kpisSchema);

export type GetKpisOutput = z.infer<typeof getKpisOutputSchema>;

// ============================================================================
// GET OPERATIONS
// ============================================================================

export const getOperationsInputSchema = z.object({
	dateRange: dateRangeSchema.optional(),
	limit: z.number().min(1).max(50).default(10),
});

export type GetOperationsInput = z.infer<typeof getOperationsInputSchema>;

/**
 * Upcoming shoot item schema
 */
export const upcomingShootItemSchema = z.object({
	id: idSchema,
	title: z.string(),
	bookingId: idSchema,
	bookingName: z.string(),
	bookingReferenceNumber: z.string(),
	shootDate: z.string(),
	startTime: z.string().nullable(),
	endTime: z.string().nullable(),
	location: z.string().nullable(),
	status: z.string(),
	assignedCrew: z.array(
		z.object({
			id: idSchema,
			name: z.string(),
			role: z.string(),
			isLead: z.boolean(),
		}),
	),
});

export type UpcomingShootItem = z.infer<typeof upcomingShootItemSchema>;

/**
 * Pending task item schema
 */
export const pendingTaskItemSchema = z.object({
	id: idSchema,
	name: z.string(),
	bookingId: idSchema,
	bookingName: z.string(),
	dueDate: z.string().nullable(),
	priority: z.string(),
	workflowStatus: workflowStatusSchema,
	isOverdue: z.boolean(),
	assignedCrew: z.array(
		z.object({
			id: idSchema,
			name: z.string(),
		}),
	),
});

export type PendingTaskItem = z.infer<typeof pendingTaskItemSchema>;

/**
 * Pending deliverable item schema
 */
export const pendingDeliverableItemSchema = z.object({
	id: idSchema,
	name: z.string(),
	bookingId: idSchema,
	bookingName: z.string(),
	dueDate: z.string().nullable(),
	workflowStatus: workflowStatusSchema,
	isOverdue: z.boolean(),
	assignedCrew: z.array(
		z.object({
			id: idSchema,
			name: z.string(),
		}),
	),
});

export type PendingDeliverableItem = z.infer<
	typeof pendingDeliverableItemSchema
>;

/**
 * Operations data schema
 */
export const operationsDataSchema = z.object({
	upcomingShoots: z.array(upcomingShootItemSchema),
	pendingTasks: z.array(pendingTaskItemSchema),
	pendingDeliverables: z.array(pendingDeliverableItemSchema),
	shootsThisWeek: z.number(),
	overdueTasksCount: z.number(),
	overdueDeliverablesCount: z.number(),
});

export type OperationsData = z.infer<typeof operationsDataSchema>;

export const getOperationsOutputSchema =
	createItemResponseSchema(operationsDataSchema);

export type GetOperationsOutput = z.infer<typeof getOperationsOutputSchema>;

// ============================================================================
// GET QUICK ACTIONS
// ============================================================================

export const getQuickActionsInputSchema = z.object({
	limit: z.number().min(1).max(20).default(5),
});

export type GetQuickActionsInput = z.infer<typeof getQuickActionsInputSchema>;

/**
 * Quick action types
 */
export const quickActionTypeSchema = z.enum([
	"overdue_payment",
	"overdue_task",
	"overdue_deliverable",
	"pending_submission",
	"upcoming_shoot_unassigned",
	"booking_needs_attention",
]);

export type QuickActionType = z.infer<typeof quickActionTypeSchema>;

/**
 * Quick action item schema
 */
export const quickActionItemSchema = z.object({
	type: quickActionTypeSchema,
	title: z.string(),
	description: z.string(),
	priority: z.enum(["high", "medium", "low"]),
	entityType: z.enum([
		"booking",
		"shoot",
		"task",
		"deliverable",
		"payment",
		"submission",
	]),
	entityId: idSchema,
	bookingId: idSchema.optional(),
	dueDate: z.string().nullable(),
	createdAt: z.string(),
});

export type QuickActionItem = z.infer<typeof quickActionItemSchema>;

export const quickActionsDataSchema = z.object({
	actions: z.array(quickActionItemSchema),
	totalCount: z.number(),
});

export type QuickActionsData = z.infer<typeof quickActionsDataSchema>;

export const getQuickActionsOutputSchema = createItemResponseSchema(
	quickActionsDataSchema,
);

export type GetQuickActionsOutput = z.infer<typeof getQuickActionsOutputSchema>;
