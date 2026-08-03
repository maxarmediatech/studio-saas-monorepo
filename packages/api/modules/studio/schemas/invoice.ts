/**
 * Invoice Schemas
 *
 * Zod schemas for invoice management including line items.
 * Invoices are linked to bookings and payment schedules.
 */

import { z } from "zod";
import {
	baseListFiltersSchema,
	createItemResponseSchema,
	createListResponseSchema,
	createSortSchema,
	dateSchema,
	idSchema,
	invoiceStatusSchema,
	lineItemTypeSchema,
	moneySchema,
	mutationResponseSchema,
	notesSchema,
	paginationSchema,
	searchSchema,
	taxTypeSchema,
} from "./common";

// ============================================================================
// INVOICE LINE ITEM SCHEMAS
// ============================================================================

/**
 * Full invoice line item schema (output)
 */
export const invoiceLineItemSchema = z.object({
	id: idSchema,
	invoiceId: idSchema,
	type: lineItemTypeSchema,
	description: z.string(),
	quantity: z.string().nullable(),
	unitPrice: z.string().nullable(),
	amount: z.string(),
	sortOrder: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>;

// ============================================================================
// INVOICE SCHEMAS
// ============================================================================

/**
 * Full invoice schema (output)
 */
export const invoiceSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	bookingId: idSchema,
	invoiceNumber: z.string(),
	status: invoiceStatusSchema,
	issueDate: z.string(),
	dueDate: z.string().nullable(),
	paymentScheduleId: idSchema.nullable(),
	subtotal: z.string(),
	taxAmount: z.string(),
	discountAmount: z.string(),
	taxType: taxTypeSchema,
	totalAmount: z.string(),
	paidAmount: z.string(),
	notes: z.string().nullable(),
	terms: z.string().nullable(),
	sentAt: z.string().nullable(),
	paidAt: z.string().nullable(),
	createdBy: idSchema.nullable(),
	updatedBy: idSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
	deletedBy: idSchema.nullable(),
});

export type Invoice = z.infer<typeof invoiceSchema>;

/**
 * Invoice with booking info for list view
 */
export const invoiceListItemSchema = invoiceSchema.extend({
	bookingName: z.string(),
	bookingReferenceNumber: z.string(),
	clientName: z.string().nullable(),
});

export type InvoiceListItem = z.infer<typeof invoiceListItemSchema>;

/**
 * Invoice detail with line items
 */
export const invoiceDetailSchema = invoiceSchema.extend({
	booking: z.object({
		id: idSchema,
		name: z.string(),
		referenceNumber: z.string(),
	}),
	client: z
		.object({
			id: idSchema,
			name: z.string(),
			email: z.string().nullable(),
		})
		.nullable(),
	lineItems: z.array(invoiceLineItemSchema),
	schedule: z
		.object({
			id: idSchema,
			name: z.string(),
			amount: z.string(),
			dueDate: z.string().nullable(),
		})
		.nullable(),
});

export type InvoiceDetail = z.infer<typeof invoiceDetailSchema>;

// ============================================================================
// LIST INVOICES
// ============================================================================

const invoiceSortFields = [
	"issueDate",
	"dueDate",
	"totalAmount",
	"status",
	"invoiceNumber",
	"createdAt",
] as const;

export const listInvoicesInputSchema = z
	.object({
		bookingId: idSchema.optional(),
		clientId: idSchema.optional(),
		status: z
			.union([invoiceStatusSchema, z.array(invoiceStatusSchema)])
			.nullish(),
		dateFrom: dateSchema.optional(),
		dateTo: dateSchema.optional(),
		amountMin: moneySchema.optional(),
		amountMax: moneySchema.optional(),
	})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(baseListFiltersSchema)
	.merge(createSortSchema(invoiceSortFields, "issueDate"));

export type ListInvoicesInput = z.infer<typeof listInvoicesInputSchema>;

export const listInvoicesOutputSchema = createListResponseSchema(
	invoiceListItemSchema,
);

export type ListInvoicesOutput = z.infer<typeof listInvoicesOutputSchema>;

// ============================================================================
// GET INVOICE
// ============================================================================

export const getInvoiceInputSchema = z.object({
	id: idSchema,
});

export type GetInvoiceInput = z.infer<typeof getInvoiceInputSchema>;

export const getInvoiceOutputSchema =
	createItemResponseSchema(invoiceDetailSchema);

export type GetInvoiceOutput = z.infer<typeof getInvoiceOutputSchema>;

// ============================================================================
// CREATE INVOICE
// ============================================================================

export const createInvoiceInputSchema = z.object({
	bookingId: idSchema,
	issueDate: dateSchema,
	dueDate: dateSchema.optional(),
	notes: notesSchema,
	terms: z.string().max(5000).optional(),
	discountAmount: moneySchema.optional(),
	taxType: taxTypeSchema.optional(),
	lineItems: z
		.array(
			z
				.object({
					type: lineItemTypeSchema.default("item"),
					description: z.string().min(1).max(500),
					quantity: z.string().regex(/^\d+$/).optional(),
					unitPrice: moneySchema.optional(),
					amount: moneySchema.optional(),
				})
				.superRefine((data, ctx) => {
					const isLumpSum =
						data.type === "milestone" || data.type === "expense";
					if (isLumpSum) {
						if (!data.amount) {
							ctx.addIssue({
								code: "custom",
								path: ["amount"],
								message: "Required for milestone/expense",
							});
						}
						if (data.quantity) {
							ctx.addIssue({
								code: "custom",
								path: ["quantity"],
								message: "Not applicable for milestone/expense",
							});
						}
						if (data.unitPrice) {
							ctx.addIssue({
								code: "custom",
								path: ["unitPrice"],
								message: "Not applicable for milestone/expense",
							});
						}
					} else {
						if (!data.quantity) {
							ctx.addIssue({
								code: "custom",
								path: ["quantity"],
								message: "Required for item/service",
							});
						}
						if (!data.unitPrice) {
							ctx.addIssue({
								code: "custom",
								path: ["unitPrice"],
								message: "Required for item/service",
							});
						}
						if (data.amount) {
							ctx.addIssue({
								code: "custom",
								path: ["amount"],
								message:
									"Computed server-side for item/service",
							});
						}
					}
				}),
		)
		.min(1, "At least one line item is required"),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema>;

export const createInvoiceOutputSchema = mutationResponseSchema;

export type CreateInvoiceOutput = z.infer<typeof createInvoiceOutputSchema>;

// ============================================================================
// CREATE INVOICE FROM SCHEDULE
// ============================================================================

export const createInvoiceFromScheduleInputSchema = z.object({
	paymentScheduleId: idSchema,
	issueDate: dateSchema.optional(),
	dueDate: dateSchema.optional(),
	notes: notesSchema,
	terms: z.string().max(5000).optional(),
	taxType: taxTypeSchema.optional(),
});

export type CreateInvoiceFromScheduleInput = z.infer<
	typeof createInvoiceFromScheduleInputSchema
>;

export const createInvoiceFromScheduleOutputSchema = mutationResponseSchema;

export type CreateInvoiceFromScheduleOutput = z.infer<
	typeof createInvoiceFromScheduleOutputSchema
>;

// ============================================================================
// UPDATE INVOICE
// ============================================================================

export const updateInvoiceInputSchema = z.object({
	id: idSchema,
	issueDate: dateSchema.optional(),
	dueDate: dateSchema.optional().nullable(),
	notes: notesSchema.nullable(),
	terms: z.string().max(5000).optional().nullable(),
	discountAmount: moneySchema.optional(),
	taxType: taxTypeSchema.optional(),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceInputSchema>;

export const updateInvoiceOutputSchema = mutationResponseSchema;

export type UpdateInvoiceOutput = z.infer<typeof updateInvoiceOutputSchema>;

// ============================================================================
// LINE ITEM CRUD
// ============================================================================

export const addLineItemInputSchema = z
	.object({
		invoiceId: idSchema,
		type: lineItemTypeSchema.default("item"),
		description: z.string().min(1).max(500),
		quantity: z.string().regex(/^\d+$/).optional(),
		unitPrice: moneySchema.optional(),
		amount: moneySchema.optional(),
		sortOrder: z.number().min(0).optional(),
	})
	.superRefine((data, ctx) => {
		const isLumpSum = data.type === "milestone" || data.type === "expense";
		if (isLumpSum) {
			if (!data.amount) {
				ctx.addIssue({
					code: "custom",
					path: ["amount"],
					message: "Required for milestone/expense",
				});
			}
			if (data.quantity) {
				ctx.addIssue({
					code: "custom",
					path: ["quantity"],
					message: "Not applicable for milestone/expense",
				});
			}
			if (data.unitPrice) {
				ctx.addIssue({
					code: "custom",
					path: ["unitPrice"],
					message: "Not applicable for milestone/expense",
				});
			}
		} else {
			if (!data.quantity) {
				ctx.addIssue({
					code: "custom",
					path: ["quantity"],
					message: "Required for item/service",
				});
			}
			if (!data.unitPrice) {
				ctx.addIssue({
					code: "custom",
					path: ["unitPrice"],
					message: "Required for item/service",
				});
			}
			if (data.amount) {
				ctx.addIssue({
					code: "custom",
					path: ["amount"],
					message: "Computed server-side for item/service",
				});
			}
		}
	});

export type AddLineItemInput = z.infer<typeof addLineItemInputSchema>;

export const addLineItemOutputSchema = mutationResponseSchema;

export type AddLineItemOutput = z.infer<typeof addLineItemOutputSchema>;

export const updateLineItemInputSchema = z
	.object({
		id: idSchema,
		type: lineItemTypeSchema.optional(),
		description: z.string().min(1).max(500).optional(),
		quantity: z.string().regex(/^\d+$/).optional().nullable(),
		unitPrice: moneySchema.optional().nullable(),
		amount: moneySchema.optional(),
		sortOrder: z.number().min(0).optional(),
	})
	.superRefine((data, ctx) => {
		const hasItemizedValues =
			(data.quantity !== undefined && data.quantity !== null) ||
			(data.unitPrice !== undefined && data.unitPrice !== null);
		if (data.amount !== undefined && hasItemizedValues) {
			ctx.addIssue({
				code: "custom",
				path: ["amount"],
				message:
					"Amount cannot be provided with quantity/unitPrice in the same update",
			});
		}

		if (data.type) {
			const isLumpSum =
				data.type === "milestone" || data.type === "expense";
			if (isLumpSum) {
				if (!data.amount) {
					ctx.addIssue({
						code: "custom",
						path: ["amount"],
						message: "Required when switching to milestone/expense",
					});
				}
				if (data.quantity) {
					ctx.addIssue({
						code: "custom",
						path: ["quantity"],
						message: "Not applicable for milestone/expense",
					});
				}
				if (data.unitPrice) {
					ctx.addIssue({
						code: "custom",
						path: ["unitPrice"],
						message: "Not applicable for milestone/expense",
					});
				}
			} else {
				if (!data.quantity) {
					ctx.addIssue({
						code: "custom",
						path: ["quantity"],
						message: "Required when switching to item/service",
					});
				}
				if (!data.unitPrice) {
					ctx.addIssue({
						code: "custom",
						path: ["unitPrice"],
						message: "Required when switching to item/service",
					});
				}
				if (data.amount) {
					ctx.addIssue({
						code: "custom",
						path: ["amount"],
						message: "Computed server-side for item/service",
					});
				}
			}
			return;
		}

		if (data.quantity === null || data.unitPrice === null) {
			ctx.addIssue({
				code: "custom",
				path: ["type"],
				message:
					"Type is required when setting quantity/unitPrice to null",
			});
		}
	});

export type UpdateLineItemInput = z.infer<typeof updateLineItemInputSchema>;

export const updateLineItemOutputSchema = mutationResponseSchema;

export type UpdateLineItemOutput = z.infer<typeof updateLineItemOutputSchema>;

export const removeLineItemInputSchema = z.object({
	id: idSchema,
});

export type RemoveLineItemInput = z.infer<typeof removeLineItemInputSchema>;

export const removeLineItemOutputSchema = mutationResponseSchema;

export type RemoveLineItemOutput = z.infer<typeof removeLineItemOutputSchema>;

// ============================================================================
// STATUS CHANGES
// ============================================================================

export const markInvoiceSentInputSchema = z.object({
	id: idSchema,
	sentAt: z.string().datetime().optional(),
});

export type MarkInvoiceSentInput = z.infer<typeof markInvoiceSentInputSchema>;

export const markInvoiceSentOutputSchema = mutationResponseSchema;

export type MarkInvoiceSentOutput = z.infer<typeof markInvoiceSentOutputSchema>;

export const cancelInvoiceInputSchema = z.object({
	id: idSchema,
	reason: z.string().max(500).optional(),
});

export type CancelInvoiceInput = z.infer<typeof cancelInvoiceInputSchema>;

export const cancelInvoiceOutputSchema = mutationResponseSchema;

export type CancelInvoiceOutput = z.infer<typeof cancelInvoiceOutputSchema>;

// ============================================================================
// DELETE INVOICE
// ============================================================================

export const deleteInvoiceInputSchema = z.object({
	id: idSchema,
});

export type DeleteInvoiceInput = z.infer<typeof deleteInvoiceInputSchema>;

export const deleteInvoiceOutputSchema = mutationResponseSchema;

export type DeleteInvoiceOutput = z.infer<typeof deleteInvoiceOutputSchema>;
