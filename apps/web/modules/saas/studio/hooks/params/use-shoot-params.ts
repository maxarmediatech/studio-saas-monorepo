"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "shoot",
	idParam: "shootId",
	createParam: "createShoot",
});

/**
 * URL-based shoot sheet params using History API.
 * No Next.js router re-renders, browser back button closes sheets.
 */
export function useShootParams() {
	const { entityId, createMode, setParams, ...methods } = useSheetParams();

	return {
		// Aliased params for backward compatibility
		shootId: entityId,
		createShoot: createMode,
		// Aliased setParams to accept entity-specific keys
		setParams: (params: {
			shootId?: string | null;
			createShoot?: boolean | null;
		}) =>
			setParams({
				entityId: params.shootId,
				createMode: params.createShoot,
			}),
		// Methods pass through unchanged
		...methods,
	};
}
