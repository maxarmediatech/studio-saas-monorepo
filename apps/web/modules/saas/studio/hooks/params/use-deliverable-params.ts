"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "deliverable",
	idParam: "deliverableId",
	createParam: "createDeliverable",
});

/**
 * URL-based deliverable sheet params using History API.
 * No Next.js router re-renders, browser back button closes sheets.
 */
export function useDeliverableParams() {
	const { entityId, createMode, setParams, ...methods } = useSheetParams();

	return {
		// Aliased params for backward compatibility
		deliverableId: entityId,
		createDeliverable: createMode,
		// Aliased setParams to accept entity-specific keys
		setParams: (params: {
			deliverableId?: string | null;
			createDeliverable?: boolean | null;
		}) =>
			setParams({
				entityId: params.deliverableId,
				createMode: params.createDeliverable,
			}),
		// Methods pass through unchanged
		...methods,
	};
}
