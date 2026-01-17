"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "crew",
	idParam: "crewId",
	createParam: "createCrew",
});

/**
 * URL-based crew sheet params using History API.
 * No Next.js router re-renders, browser back button closes sheets.
 */
export function useCrewParams() {
	const { entityId, createMode, setParams, ...methods } = useSheetParams();

	return {
		// Aliased params for backward compatibility
		crewId: entityId,
		createCrew: createMode,
		// Aliased setParams to accept entity-specific keys
		setParams: (params: {
			crewId?: string | null;
			createCrew?: boolean | null;
		}) =>
			setParams({
				entityId: params.crewId,
				createMode: params.createCrew,
			}),
		// Methods pass through unchanged
		...methods,
	};
}
