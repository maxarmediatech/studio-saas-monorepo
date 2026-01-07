"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "payment",
	idParam: "paymentId",
	createParam: "createPayment",
});

/**
 * URL-based payment sheet params using History API.
 * No Next.js router re-renders, browser back button closes sheets.
 */
export function usePaymentParams() {
	const { entityId, createMode, setParams, ...methods } = useSheetParams();

	return {
		// Aliased params for backward compatibility
		paymentId: entityId,
		createPayment: createMode,
		// Aliased setParams to accept entity-specific keys
		setParams: (params: {
			paymentId?: string | null;
			createPayment?: boolean | null;
		}) =>
			setParams({
				entityId: params.paymentId,
				createMode: params.createPayment,
			}),
		// Methods pass through unchanged
		...methods,
	};
}
