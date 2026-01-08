"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "client",
	idParam: "clientId",
	createParam: "createClient",
});

/**
 * URL-based client sheet params using History API.
 * No Next.js router re-renders, browser back button closes sheets.
 */
export function useClientParams() {
	const { entityId, createMode, setParams, ...methods } = useSheetParams();

	return {
		// Aliased params for backward compatibility
		clientId: entityId,
		createClient: createMode,
		// Aliased setParams to accept entity-specific keys
		setParams: (params: {
			clientId?: string | null;
			createClient?: boolean | null;
		}) =>
			setParams({
				entityId: params.clientId,
				createMode: params.createClient,
			}),
		// Methods pass through unchanged
		...methods,
	};
}
