/**
 * Receipt Schemas
 *
 * Zod schemas for payment receipts.
 * Receipts are immutable - once created, they can only be voided (soft deleted).
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
	paginationSchema,
	searchSchema,
} from "./common";

// ============================================================================
// RECEIPT SCHEMA
// ============================================================================

/**
 * Full receipt schema (output)
 */
export const receiptSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	bookingId: idSchema,
	invoiceId: idSchema.nullable(),
	receivedAmountId: idSchema.nullable(),
	receiptNumber: z.string(),
	amount: z.string(),
	paymentMethod: z.string().nullable(),
	receiptDate: z.string(),
	notes: z.string().nullable(),
	createdBy: idSchema.nullable(),
	updatedBy: idSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
	deletedBy: idSchema.nullable(),
});

export type Receipt = z.infer<typeof receiptSchema>;

/**
 * Receipt with booking info for list view
 */
export const receiptListItemSchema = receiptSchema.extend({
	bookingName: z.string(),
	bookingReferenceNumber: z.string(),
	invoiceNumber: z.string().nullable(),
});

export type ReceiptListItem = z.infer<typeof receiptListItemSchema>;

// ============================================================================
// LIST RECEIPTS
// ============================================================================

const receiptSortFields = [
	"receiptDate",
	"amount",
	"receiptNumber",
	"createdAt",
] as const;

export const listReceiptsInputSchema = z
	.object({
		bookingId: idSchema.optional(),
		clientId: idSchema.optional(),
		invoiceId: idSchema.optional(),
		paymentScheduleId: idSchema.optional(),
		dateFrom: dateSchema.optional(),
		dateTo: dateSchema.optional(),
		amountMin: moneySchema.optional(),
		amountMax: moneySchema.optional(),
	})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(baseListFiltersSchema)
	.merge(createSortSchema(receiptSortFields, "receiptDate"));

export type ListReceiptsInput = z.infer<typeof listReceiptsInputSchema>;

export const listReceiptsOutputSchema = createListResponseSchema(
	receiptListItemSchema,
);

export type ListReceiptsOutput = z.infer<typeof listReceiptsOutputSchema>;

// ============================================================================
// GET RECEIPT
// ============================================================================

export const getReceiptInputSchema = z.object({
	id: idSchema,
});

export type GetReceiptInput = z.infer<typeof getReceiptInputSchema>;

/**
 * Receipt detail with booking and invoice info
 */
export const receiptDetailSchema = receiptSchema.extend({
	booking: z.object({
		id: idSchema,
		name: z.string(),
		referenceNumber: z.string(),
	}),
	invoice: z
		.object({
			id: idSchema,
			invoiceNumber: z.string(),
			totalAmount: z.string(),
		})
		.nullable(),
});

export type ReceiptDetail = z.infer<typeof receiptDetailSchema>;

export const getReceiptOutputSchema =
	createItemResponseSchema(receiptDetailSchema);

export type GetReceiptOutput = z.infer<typeof getReceiptOutputSchema>;

// ============================================================================
// CREATE RECEIPT FROM PAYMENT
// ============================================================================

/**
 * Input for creating a receipt from a payment
 * This is typically called internally when a payment is linked to an invoice
 */
export const createReceiptFromPaymentInputSchema = z.object({
	bookingId: idSchema,
	invoiceId: idSchema,
	receivedAmountId: idSchema,
});

export type CreateReceiptFromPaymentInput = z.infer<
	typeof createReceiptFromPaymentInputSchema
>;

export const createReceiptFromPaymentOutputSchema = mutationResponseSchema;

export type CreateReceiptFromPaymentOutput = z.infer<
	typeof createReceiptFromPaymentOutputSchema
>;

// ============================================================================
// GENERATE RECEIPT FROM RECEIVED PAYMENT
// ============================================================================

export const generateReceiptFromReceivedInputSchema = z.object({
	receivedAmountId: idSchema,
});

export type GenerateReceiptFromReceivedInput = z.infer<
	typeof generateReceiptFromReceivedInputSchema
>;

export const generateReceiptFromReceivedOutputSchema = mutationResponseSchema;

export type GenerateReceiptFromReceivedOutput = z.infer<
	typeof generateReceiptFromReceivedOutputSchema
>;

// ============================================================================
// VOID RECEIPT
// ============================================================================

export const voidReceiptInputSchema = z.object({
	id: idSchema,
	reason: z.string().max(500).optional(),
});

export type VoidReceiptInput = z.infer<typeof voidReceiptInputSchema>;

export const voidReceiptOutputSchema = mutationResponseSchema;

export type VoidReceiptOutput = z.infer<typeof voidReceiptOutputSchema>;
