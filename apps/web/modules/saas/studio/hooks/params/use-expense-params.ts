"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "expense",
	idParam: "expenseId",
	createParam: "createExpense",
});

/**
 * URL-based expense sheet params using History API.
 * No Next.js router re-renders, browser back button closes sheets.
 */
export function useExpenseParams() {
	const { entityId, createMode, setParams, ...methods } = useSheetParams();

	return {
		// Aliased params for backward compatibility
		expenseId: entityId,
		createExpense: createMode,
		// Aliased setParams to accept entity-specific keys
		setParams: (params: {
			expenseId?: string | null;
			createExpense?: boolean | null;
		}) =>
			setParams({
				entityId: params.expenseId,
				createMode: params.createExpense,
			}),
		// Methods pass through unchanged
		...methods,
	};
}
