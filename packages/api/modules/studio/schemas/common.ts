/**
 * Common Schemas for Studio Domain
 *
 * This file contains shared Zod schemas used across all studio domain modules.
 * All domain-specific schemas should import from here for consistency.
 */

import { z } from "zod";

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Standard pagination input schema
 */
export const paginationSchema = z.object({
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Standard pagination response schema
 */
export const paginationResponseSchema = z.object({
	page: z.number(),
	limit: z.number(),
	total: z.number(),
	pageCount: z.number(),
});

export type PaginationResponse = z.infer<typeof paginationResponseSchema>;

/**
 * Create pagination response from query results
 */
export function createPaginationResponse(
	page: number,
	limit: number,
	total: number,
): PaginationResponse {
	return {
		page,
		limit,
		total,
		pageCount: Math.ceil(total / limit),
	};
}

// ============================================================================
// ID SCHEMAS
// ============================================================================

/**
 * UUID ID schema (supports both v4 and v7 formats)
 */
export const idSchema = z
	.string()
	.regex(
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		"Invalid ID format",
	);

/**
 * Array of IDs schema
 */
export const idsSchema = z.array(idSchema).min(1);

/**
 * Standard ID input for single entity operations
 */
export const idInputSchema = z.object({
	id: idSchema,
});

export type IdInput = z.infer<typeof idInputSchema>;

// ============================================================================
// MONEY HANDLING
// ============================================================================

/**
 * Money schema - string format to preserve precision
 *
 * Valid formats:
 * - "100"
 * - "100.00"
 * - "1500.50"
 *
 * Use Decimal.js for calculations in handlers.
 */
export const moneySchema = z
	.string()
	.regex(
		/^\d+(\.\d{1,2})?$/,
		"Must be a valid money amount (e.g., '1500.00')",
	);

/**
 * Optional money schema
 */
export const optionalMoneySchema = moneySchema.optional();

// ============================================================================
// DATE/TIME SCHEMAS
// ============================================================================

function isValidDateString(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));

	return (
		Number.isFinite(year) &&
		Number.isFinite(month) &&
		Number.isFinite(day) &&
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

/**
 * ISO date string schema (YYYY-MM-DD) with calendar validation
 */
export const dateSchema = z
	.string()
	.refine(isValidDateString, "Invalid date format (YYYY-MM-DD)");

/**
 * ISO datetime string schema (requires timezone offset or Z)
 */
export const datetimeSchema = z
	.string()
	.regex(
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/,
		"Invalid datetime format",
	)
	.refine(
		(value) => !Number.isNaN(Date.parse(value)),
		"Invalid datetime value",
	);

/**
 * Date range schema with validation
 */
export const dateRangeSchema = z
	.object({
		start: dateSchema,
		end: dateSchema,
	})
	.refine((data) => new Date(data.start) <= new Date(data.end), {
		message: "Start date must be before or equal to end date",
	});

/**
 * Time string schema (HH:MM or HH:MM:SS)
 */
export const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

// ============================================================================
// SOFT DELETE
// ============================================================================

/**
 * Include deleted records in query
 */
export const includeDeletedSchema = z.boolean().default(false);

/**
 * Standard list filters with soft delete support
 */
export const baseListFiltersSchema = z.object({
	includeDeleted: includeDeletedSchema,
});

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort direction
 */
export const sortDirectionSchema = z.enum(["asc", "desc"]).default("desc");

/**
 * Generic sort schema factory
 */
export function createSortSchema<T extends readonly string[]>(
	allowedFields: T,
	defaultField: T[number] = "createdAt" as T[number],
) {
	return z.object({
		sortBy: z
			.enum(allowedFields as unknown as [string, ...string[]])
			.default(defaultField),
		sortDirection: sortDirectionSchema,
	});
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Text search schema
 */
export const searchSchema = z.object({
	search: z.string().min(1).max(100).optional(),
});

// ============================================================================
// ENUMS (matching database enums)
// ============================================================================

/**
 * Booking phase enum (system-critical, cannot be customized)
 */
export const bookingPhaseSchema = z.enum([
	"new",
	"preparation",
	"shooting",
	"delivery",
	"completed",
	"cancelled",
]);

export type BookingPhase = z.infer<typeof bookingPhaseSchema>;

/**
 * Workflow status enum (system-critical)
 */
export const workflowStatusSchema = z.enum([
	"not_started",
	"assigned",
	"submitted",
	"in_review",
	"revision_requested",
	"approved",
]);

export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

/**
 * Submission status enum
 */
export const submissionStatusSchema = z.enum([
	"draft",
	"submitted",
	"in_review",
	"approved",
	"rejected",
	"revision_requested",
]);

export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

/**
 * Payment method enum
 */
export const paymentMethodSchema = z.enum([
	"cash",
	"upi",
	"bank_transfer",
	"cheque",
	"card",
	"other",
]);

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/**
 * Payment schedule status enum
 */
export const paymentScheduleStatusSchema = z.enum([
	"pending",
	"partial",
	"completed",
	"overdue",
	"cancelled",
]);

export type PaymentScheduleStatus = z.infer<typeof paymentScheduleStatusSchema>;

/**
 * Invoice status enum
 */
export const invoiceStatusSchema = z.enum([
	"draft",
	"sent",
	"paid",
	"partial",
	"overdue",
	"cancelled",
]);

export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

/**
 * Tax type enum - determines how GST is applied to an invoice
 */
export const taxTypeSchema = z.enum(["exclusive", "inclusive", "no_gst"]);

export type TaxType = z.infer<typeof taxTypeSchema>;

/**
 * Bill to enum
 */
export const billToSchema = z.enum(["studio", "client"]);

export type BillTo = z.infer<typeof billToSchema>;

/**
 * Config type enum
 */
export const configTypeSchema = z.enum([
	"task_status",
	"task_priority",
	"deliverable_status",
	"deliverable_priority",
	"crew_status",
	"crew_role",
	"shoot_status",
	"booking_type",
	"package_type",
	"relation_type",
	"expense_category",
	"event_type",
	"gst_rate",
]);

export type ConfigType = z.infer<typeof configTypeSchema>;

// ============================================================================
// COMMON FIELD SCHEMAS
// ============================================================================

/**
 * Name field (required, non-empty)
 */
export const nameSchema = z.string().min(1).max(255);

/**
 * Description field (optional, can be long)
 */
export const descriptionSchema = z.string().max(5000).optional();

/**
 * Notes field (optional, can be long)
 */
export const notesSchema = z.string().max(10000).optional();

/**
 * Email field
 */
export const emailSchema = z.string().email();

/**
 * Phone field (Indian format or international)
 */
export const phoneSchema = z
	.string()
	.regex(/^(\+91[-\s]?)?[0]?(91)?[6789]\d{9}$|^\+?[1-9]\d{1,14}$/)
	.optional();

/**
 * URL field
 */
export const urlSchema = z.string().url().optional();

// ============================================================================
// ATTACHMENT SCHEMA
// ============================================================================

/**
 * Uploaded attachment metadata schema
 * Matches the frontend uploadedAttachmentSchema structure
 */
export const uploadedAttachmentSchema = z.object({
	name: z.string(),
	size: z.number(),
	type: z.string(),
	key: z.string(),
	url: z.string(),
});

export type UploadedAttachment = z.infer<typeof uploadedAttachmentSchema>;

// ============================================================================
// RESPONSE WRAPPERS
// ============================================================================

/**
 * Standard mutation response schema
 */
export const mutationResponseSchema = z.object({
	data: z.object({
		id: idSchema,
	}),
	message: z.string(),
});

export type MutationResponse = z.infer<typeof mutationResponseSchema>;

/**
 * Create a list response schema for a given item schema
 */
export function createListResponseSchema<T extends z.ZodTypeAny>(
	itemSchema: T,
) {
	return z.object({
		data: z.array(itemSchema),
		pagination: paginationResponseSchema,
	});
}

/**
 * Create a single item response schema
 */
export function createItemResponseSchema<T extends z.ZodTypeAny>(
	itemSchema: T,
) {
	return z.object({
		data: itemSchema,
	});
}
