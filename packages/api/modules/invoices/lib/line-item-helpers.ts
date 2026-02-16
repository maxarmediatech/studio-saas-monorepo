import { centsToMoney, moneyToCents } from "../../studio/lib/money";

import type { LineItemType } from "../../studio/schemas/common";

/**
 * Returns true for lump-sum line item types (milestone, expense)
 * where quantity and unitPrice are not applicable.
 */
export function isLumpSumType(type: LineItemType): boolean {
	return type === "milestone" || type === "expense";
}

/**
 * Parse a quantity string into a positive integer.
 * Accepts whole-number numeric strings and numeric strings with only zero
 * fractional precision (e.g. "2.00"), rejects fractional quantities.
 */
export function parseItemizedQuantity(quantity: string): number {
	const trimmed = quantity.trim();
	if (!/^\d+(?:\.0+)?$/.test(trimmed)) {
		throw new Error("Quantity must be a whole number");
	}

	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
		throw new Error("Quantity must be a positive whole number");
	}

	return parsed;
}

/**
 * Computes the DB-ready fields for a line item based on its type.
 *
 * - Lump sum (milestone/expense): quantity=null, unitPrice=null, amount from input
 * - Itemized (item/service): quantity + unitPrice from input, amount = qty x unitPrice
 */
export function computeLineItemFields(
	input: {
		type?: LineItemType;
		quantity?: string | null;
		unitPrice?: string | null;
		amount?: string | null;
	},
	effectiveType: LineItemType,
): {
	type: LineItemType;
	quantity: string | null;
	unitPrice: string | null;
	amount: string;
} {
	if (isLumpSumType(effectiveType)) {
		const amount = input.amount;
		if (amount == null) {
			throw new Error("Amount is required for milestone/expense");
		}
		return {
			type: effectiveType,
			quantity: null,
			unitPrice: null,
			amount,
		};
	}

	// Itemized: compute amount from qty x unitPrice
	const quantity = input.quantity;
	const unitPrice = input.unitPrice;
	if (!quantity || !unitPrice) {
		throw new Error(
			"Quantity and unit price are required for item/service",
		);
	}

	const qty = parseItemizedQuantity(quantity);
	const unitPriceCents = moneyToCents(unitPrice);
	const amountCents = qty * unitPriceCents;

	return {
		type: effectiveType,
		quantity,
		unitPrice: centsToMoney(unitPriceCents),
		amount: centsToMoney(amountCents),
	};
}
