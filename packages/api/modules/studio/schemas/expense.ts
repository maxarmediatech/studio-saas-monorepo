/**
 * Expense Schemas
 *
 * Zod schemas for studio expense tracking endpoints.
 */

import { z } from "zod";
import {
	baseListFiltersSchema,
	billToSchema,
	createItemResponseSchema,
	createListResponseSchema,
	createSortSchema,
	dateSchema,
	idSchema,
	moneySchema,
	mutationResponseSchema,
	notesSchema,
	paginationSchema,
	paymentMethodSchema,
	searchSchema,
} from "./common";

// ============================================================================
// EXPENSE ASSIGNMENT SCHEMA
// ============================================================================

export const expenseAssignmentSchema = z.object({
	id: idSchema,
	expenseId: idSchema,
	bookingId: idSchema.nullable(),
	shootId: idSchema.nullable(),
	crewId: idSchema.nullable(),
	allocationPercentage: z.string().nullable(),
	allocationAmount: z.string().nullable(),
	createdAt: z.string(),
});

export type ExpenseAssignment = z.infer<typeof expenseAssignmentSchema>;

export const expenseAssignmentWithDetailsSchema =
	expenseAssignmentSchema.extend({
		bookingName: z.string().nullable(),
		bookingReferenceNumber: z.string().nullable(),
		shootName: z.string().nullable(),
		crewName: z.string().nullable(),
	});

export type ExpenseAssignmentWithDetails = z.infer<
	typeof expenseAssignmentWithDetailsSchema
>;

// ============================================================================
// EXPENSE SCHEMA
// ============================================================================

/**
 * Full expense schema (output)
 */
export const expenseSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	description: z.string(),
	amount: z.string(),
	category: z.string().nullable(),
	expenseDate: z.string(),
	billTo: billToSchema,
	paymentMethod: paymentMethodSchema.nullable(),
	transactionReference: z.string().nullable(),
	vendor: z.string().nullable(),
	notes: z.string().nullable(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	createdBy: idSchema.nullable(),
	updatedBy: idSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
	deletedBy: idSchema.nullable(),
});

export type Expense = z.infer<typeof expenseSchema>;

/**
 * Minimal expense schema for dropdowns and references (omits sensitive amount)
 */
export const expenseMinimalSchema = z.object({
	id: idSchema,
	description: z.string(),
	category: z.string().nullable(),
	expenseDate: z.string(),
	vendor: z.string().nullable(),
});

export type ExpenseMinimal = z.infer<typeof expenseMinimalSchema>;

/**
 * Expense list item with assignment summary
 */
export const expenseListItemSchema = expenseSchema.extend({
	assignmentsCount: z.number(),
});

export type ExpenseListItem = z.infer<typeof expenseListItemSchema>;

// ============================================================================
// LIST EXPENSES
// ============================================================================

const expenseSortFields = [
	"expenseDate",
	"amount",
	"category",
	"billTo",
	"vendor",
	"createdAt",
] as const;

export const listExpensesInputSchema = z
	.object({
		category: z.union([z.string(), z.array(z.string())]).nullish(),
		billTo: z.union([billToSchema, z.array(billToSchema)]).nullish(),
		paymentMethod: z
			.union([paymentMethodSchema, z.array(paymentMethodSchema)])
			.nullish(),
		dateFrom: dateSchema.optional(),
		dateTo: dateSchema.optional(),
		bookingId: idSchema.optional(),
		shootId: idSchema.optional(),
		crewId: idSchema.optional(),
	})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(baseListFiltersSchema)
	.merge(createSortSchema(expenseSortFields, "expenseDate"));

export type ListExpensesInput = z.infer<typeof listExpensesInputSchema>;

export const listExpensesOutputSchema = createListResponseSchema(
	expenseListItemSchema,
);

export type ListExpensesOutput = z.infer<typeof listExpensesOutputSchema>;

// ============================================================================
// LIST EXPENSES MINIMAL
// ============================================================================

export const listExpensesMinimalInputSchema = z
	.object({
		bookingId: idSchema.optional(),
	})
	.merge(paginationSchema)
	.merge(searchSchema);

export type ListExpensesMinimalInput = z.infer<
	typeof listExpensesMinimalInputSchema
>;

export const listExpensesMinimalOutputSchema =
	createListResponseSchema(expenseMinimalSchema);

export type ListExpensesMinimalOutput = z.infer<
	typeof listExpensesMinimalOutputSchema
>;

// ============================================================================
// GET EXPENSE
// ============================================================================

export const getExpenseInputSchema = z.object({
	id: idSchema,
});

export type GetExpenseInput = z.infer<typeof getExpenseInputSchema>;

/**
 * Expense detail with assignments
 */
export const expenseDetailSchema = expenseSchema.extend({
	assignments: z.array(expenseAssignmentWithDetailsSchema),
});

export type ExpenseDetail = z.infer<typeof expenseDetailSchema>;

export const getExpenseOutputSchema =
	createItemResponseSchema(expenseDetailSchema);

export type GetExpenseOutput = z.infer<typeof getExpenseOutputSchema>;

// ============================================================================
// CREATE EXPENSE
// ============================================================================

export const expenseAssignmentInputSchema = z
	.object({
		bookingId: idSchema.optional(),
		shootId: idSchema.optional(),
		crewId: idSchema.optional(),
		allocationPercentage: z
			.string()
			.regex(/^\d+(\.\d{1,2})?$/)
			.optional(),
		allocationAmount: moneySchema.optional(),
	})
	.refine(
		(data) => {
			// Exactly one target must be specified
			const targets = [data.bookingId, data.shootId, data.crewId].filter(
				Boolean,
			);
			return targets.length === 1;
		},
		{
			message:
				"Exactly one of bookingId, shootId, or crewId must be specified",
		},
	);

export const createExpenseInputSchema = z.object({
	description: z.string().min(1).max(500),
	amount: moneySchema,
	category: z.string().max(100).optional(),
	expenseDate: dateSchema,
	billTo: billToSchema.optional(),
	paymentMethod: paymentMethodSchema.optional(),
	transactionReference: z.string().max(100).optional(),
	vendor: z.string().max(255).optional(),
	notes: notesSchema,
	metadata: z.record(z.string(), z.unknown()).optional(),
	assignments: z.array(expenseAssignmentInputSchema).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;

export const createExpenseOutputSchema = mutationResponseSchema;

export type CreateExpenseOutput = z.infer<typeof createExpenseOutputSchema>;

// ============================================================================
// UPDATE EXPENSE
// ============================================================================

export const updateExpenseInputSchema = z.object({
	id: idSchema,
	description: z.string().min(1).max(500).optional(),
	amount: moneySchema.optional(),
	category: z.string().max(100).optional().nullable(),
	expenseDate: dateSchema.optional(),
	billTo: billToSchema.optional(),
	paymentMethod: paymentMethodSchema.optional().nullable(),
	transactionReference: z.string().max(100).optional().nullable(),
	vendor: z.string().max(255).optional().nullable(),
	notes: notesSchema.nullable(),
	metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>;

export const updateExpenseOutputSchema = mutationResponseSchema;

export type UpdateExpenseOutput = z.infer<typeof updateExpenseOutputSchema>;

// ============================================================================
// DELETE EXPENSE
// ============================================================================

export const deleteExpenseInputSchema = z.object({
	id: idSchema,
});

export type DeleteExpenseInput = z.infer<typeof deleteExpenseInputSchema>;

export const deleteExpenseOutputSchema = mutationResponseSchema;

export type DeleteExpenseOutput = z.infer<typeof deleteExpenseOutputSchema>;

// ============================================================================
// EXPENSE STATS
// ============================================================================

export const getExpenseStatsInputSchema = z.object({
	bookingId: idSchema.optional(),
	dateFrom: dateSchema.optional(),
	dateTo: dateSchema.optional(),
});

export type GetExpenseStatsInput = z.infer<typeof getExpenseStatsInputSchema>;

export const expenseStatsSchema = z.object({
	totalExpenses: z.string(),
	expensesThisMonth: z.string(),
	byCategory: z.record(z.string(), z.string()),
	byBillTo: z.record(z.string(), z.string()),
	byPaymentMethod: z.record(z.string(), z.string()),
	expenseCount: z.number(),
	averageExpense: z.string(),
});

export type ExpenseStats = z.infer<typeof expenseStatsSchema>;

export const getExpenseStatsOutputSchema =
	createItemResponseSchema(expenseStatsSchema);

export type GetExpenseStatsOutput = z.infer<typeof getExpenseStatsOutputSchema>;
