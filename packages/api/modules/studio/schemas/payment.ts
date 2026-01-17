/**
 * Payment Schemas
 *
 * Zod schemas for studio payment tracking (received amounts and payment schedules).
 * Note: This is separate from the core payments module which handles subscriptions/billing.
 */

import { z } from "zod";
import {
	baseListFiltersSchema,
	createItemResponseSchema,
	createListResponseSchema,
	createSortSchema,
	dateSchema,
	idSchema,
	moneySchema,
	mutationResponseSchema,
	nameSchema,
	notesSchema,
	paginationSchema,
	paymentMethodSchema,
	paymentScheduleStatusSchema,
	searchSchema,
	uploadedAttachmentSchema,
} from "./common";

// ============================================================================
// RECEIVED AMOUNT SCHEMA
// ============================================================================

/**
 * Full received amount schema (output)
 */
export const receivedAmountSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	bookingId: idSchema,
	amount: z.string(),
	paymentMethod: paymentMethodSchema,
	transactionReference: z.string().nullable(),
	receivedDate: z.string(),
	notes: z.string().nullable(),
	proofAttachment: uploadedAttachmentSchema.nullable(),
	paymentScheduleId: idSchema.nullable(),
	createdBy: idSchema.nullable(),
	updatedBy: idSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
	deletedBy: idSchema.nullable(),
});

export type ReceivedAmount = z.infer<typeof receivedAmountSchema>;

/**
 * Received amount with booking info for list view
 */
export const receivedAmountListItemSchema = receivedAmountSchema.extend({
	bookingName: z.string(),
	bookingReferenceNumber: z.string(),
	scheduleName: z.string().nullable(),
});

export type ReceivedAmountListItem = z.infer<
	typeof receivedAmountListItemSchema
>;

// ============================================================================
// PAYMENT SCHEDULE SCHEMA
// ============================================================================

/**
 * Full payment schedule schema (output)
 */
export const paymentScheduleSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	bookingId: idSchema,
	name: z.string(),
	amount: z.string(),
	dueDate: z.string(),
	status: paymentScheduleStatusSchema,
	paidAmount: z.string(),
	paidAt: z.string().nullable(),
	notes: z.string().nullable(),
	sortOrder: z.number(),
	createdBy: idSchema.nullable(),
	updatedBy: idSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
	deletedBy: idSchema.nullable(),
});

export type PaymentSchedule = z.infer<typeof paymentScheduleSchema>;

/**
 * Payment schedule with booking info for list view
 */
export const paymentScheduleListItemSchema = paymentScheduleSchema.extend({
	bookingName: z.string(),
	bookingReferenceNumber: z.string(),
});

export type PaymentScheduleListItem = z.infer<
	typeof paymentScheduleListItemSchema
>;

// ============================================================================
// LIST RECEIVED AMOUNTS
// ============================================================================

const receivedSortFields = [
	"receivedDate",
	"amount",
	"paymentMethod",
	"createdAt",
] as const;

export const listReceivedInputSchema = z
	.object({
		bookingId: idSchema.optional(),
		paymentMethod: z
			.union([paymentMethodSchema, z.array(paymentMethodSchema)])
			.nullish(),
		dateFrom: dateSchema.optional(),
		dateTo: dateSchema.optional(),
	})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(baseListFiltersSchema)
	.merge(createSortSchema(receivedSortFields, "receivedDate"));

export type ListReceivedInput = z.infer<typeof listReceivedInputSchema>;

export const listReceivedOutputSchema = createListResponseSchema(
	receivedAmountListItemSchema,
);

export type ListReceivedOutput = z.infer<typeof listReceivedOutputSchema>;

// ============================================================================
// GET RECEIVED AMOUNT
// ============================================================================

export const getReceivedInputSchema = z.object({
	id: idSchema,
});

export type GetReceivedInput = z.infer<typeof getReceivedInputSchema>;

/**
 * Received amount detail with booking info
 */
export const receivedAmountDetailSchema = receivedAmountSchema.extend({
	booking: z.object({
		id: idSchema,
		name: z.string(),
		referenceNumber: z.string(),
	}),
	schedule: z
		.object({
			id: idSchema,
			name: z.string(),
		})
		.nullable(),
});

export type ReceivedAmountDetail = z.infer<typeof receivedAmountDetailSchema>;

export const getReceivedOutputSchema = createItemResponseSchema(
	receivedAmountDetailSchema,
);

export type GetReceivedOutput = z.infer<typeof getReceivedOutputSchema>;

// ============================================================================
// CREATE RECEIVED AMOUNT
// ============================================================================

export const createReceivedInputSchema = z.object({
	bookingId: idSchema,
	amount: moneySchema,
	paymentMethod: paymentMethodSchema,
	transactionReference: z.string().max(100).optional(),
	receivedDate: dateSchema,
	notes: notesSchema,
	proofAttachment: uploadedAttachmentSchema.nullable().optional(),
	paymentScheduleId: idSchema.optional(),
});

export type CreateReceivedInput = z.infer<typeof createReceivedInputSchema>;

export const createReceivedOutputSchema = mutationResponseSchema;

export type CreateReceivedOutput = z.infer<typeof createReceivedOutputSchema>;

// ============================================================================
// UPDATE RECEIVED AMOUNT
// ============================================================================

export const updateReceivedInputSchema = z.object({
	id: idSchema,
	amount: moneySchema.optional(),
	paymentMethod: paymentMethodSchema.optional(),
	transactionReference: z.string().max(100).optional().nullable(),
	receivedDate: dateSchema.optional(),
	notes: notesSchema.nullable(),
	proofAttachment: uploadedAttachmentSchema.nullable().optional(),
});

export type UpdateReceivedInput = z.infer<typeof updateReceivedInputSchema>;

export const updateReceivedOutputSchema = mutationResponseSchema;

export type UpdateReceivedOutput = z.infer<typeof updateReceivedOutputSchema>;

// ============================================================================
// DELETE RECEIVED AMOUNT
// ============================================================================

export const deleteReceivedInputSchema = z.object({
	id: idSchema,
});

export type DeleteReceivedInput = z.infer<typeof deleteReceivedInputSchema>;

export const deleteReceivedOutputSchema = mutationResponseSchema;

export type DeleteReceivedOutput = z.infer<typeof deleteReceivedOutputSchema>;

// ============================================================================
// LIST PAYMENT SCHEDULES
// ============================================================================

const scheduleSortFields = [
	"dueDate",
	"amount",
	"status",
	"sortOrder",
	"createdAt",
] as const;

export const listSchedulesInputSchema = z
	.object({
		bookingId: idSchema.optional(),
		status: z
			.union([paymentScheduleStatusSchema, z.array(paymentScheduleStatusSchema)])
			.nullish(),
		dueDateFrom: dateSchema.optional(),
		dueDateTo: dateSchema.optional(),
	})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(baseListFiltersSchema)
	.merge(createSortSchema(scheduleSortFields, "dueDate"));

export type ListSchedulesInput = z.infer<typeof listSchedulesInputSchema>;

export const listSchedulesOutputSchema = createListResponseSchema(
	paymentScheduleListItemSchema,
);

export type ListSchedulesOutput = z.infer<typeof listSchedulesOutputSchema>;

// ============================================================================
// GET PAYMENT SCHEDULE
// ============================================================================

export const getScheduleInputSchema = z.object({
	id: idSchema,
});

export type GetScheduleInput = z.infer<typeof getScheduleInputSchema>;

/**
 * Payment schedule detail with booking info and linked payments
 */
export const paymentScheduleDetailSchema = paymentScheduleSchema.extend({
	booking: z.object({
		id: idSchema,
		name: z.string(),
		referenceNumber: z.string(),
	}),
	linkedPayments: z.array(
		z.object({
			id: idSchema,
			amount: z.string(),
			receivedDate: z.string(),
			paymentMethod: paymentMethodSchema,
		}),
	),
});

export type PaymentScheduleDetail = z.infer<typeof paymentScheduleDetailSchema>;

export const getScheduleOutputSchema = createItemResponseSchema(
	paymentScheduleDetailSchema,
);

export type GetScheduleOutput = z.infer<typeof getScheduleOutputSchema>;

// ============================================================================
// CREATE PAYMENT SCHEDULE
// ============================================================================

export const createScheduleInputSchema = z.object({
	bookingId: idSchema,
	name: nameSchema,
	amount: moneySchema,
	dueDate: dateSchema,
	notes: notesSchema,
	sortOrder: z.number().min(0).optional(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleInputSchema>;

export const createScheduleOutputSchema = mutationResponseSchema;

export type CreateScheduleOutput = z.infer<typeof createScheduleOutputSchema>;

// ============================================================================
// UPDATE PAYMENT SCHEDULE
// ============================================================================

export const updateScheduleInputSchema = z.object({
	id: idSchema,
	name: nameSchema.optional(),
	amount: moneySchema.optional(),
	dueDate: dateSchema.optional(),
	notes: notesSchema.nullable(),
	sortOrder: z.number().min(0).optional(),
});

export type UpdateScheduleInput = z.infer<typeof updateScheduleInputSchema>;

export const updateScheduleOutputSchema = mutationResponseSchema;

export type UpdateScheduleOutput = z.infer<typeof updateScheduleOutputSchema>;

// ============================================================================
// DELETE PAYMENT SCHEDULE
// ============================================================================

export const deleteScheduleInputSchema = z.object({
	id: idSchema,
});

export type DeleteScheduleInput = z.infer<typeof deleteScheduleInputSchema>;

export const deleteScheduleOutputSchema = mutationResponseSchema;

export type DeleteScheduleOutput = z.infer<typeof deleteScheduleOutputSchema>;

// ============================================================================
// CONVERT SCHEDULE TO RECEIVED
// ============================================================================

export const convertScheduleInputSchema = z.object({
	scheduleId: idSchema,
	paymentMethod: paymentMethodSchema,
	transactionReference: z.string().max(100).optional(),
	receivedDate: dateSchema.optional(),
	notes: notesSchema,
});

export type ConvertScheduleInput = z.infer<typeof convertScheduleInputSchema>;

export const convertScheduleOutputSchema = z.object({
	data: z.object({
		receivedId: idSchema,
		scheduleId: idSchema,
	}),
	message: z.string(),
});

export type ConvertScheduleOutput = z.infer<typeof convertScheduleOutputSchema>;

// ============================================================================
// PAYMENT STATS
// ============================================================================

export const getPaymentStatsInputSchema = z.object({
	bookingId: idSchema.optional(),
});

export type GetPaymentStatsInput = z.infer<typeof getPaymentStatsInputSchema>;

export const paymentStatsSchema = z.object({
	totalReceived: z.string(),
	totalScheduled: z.string(),
	totalPending: z.string(),
	totalOverdue: z.string(),
	receivedThisMonth: z.string(),
	byPaymentMethod: z.record(z.string(), z.string()),
	byScheduleStatus: z.record(z.string(), z.number()),
	upcomingSchedules: z.array(
		z.object({
			id: idSchema,
			name: z.string(),
			amount: z.string(),
			dueDate: z.string(),
			bookingName: z.string(),
		}),
	),
});

export type PaymentStats = z.infer<typeof paymentStatsSchema>;

export const getPaymentStatsOutputSchema =
	createItemResponseSchema(paymentStatsSchema);

export type GetPaymentStatsOutput = z.infer<typeof getPaymentStatsOutputSchema>;
