"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "schedule",
	idParam: "scheduleId",
	createParam: "createSchedule",
});

/**
 * URL-based schedule sheet params using History API.
 * No Next.js router re-renders, browser back button closes sheets.
 */
export function useScheduleParams() {
	const { entityId, createMode, setParams, ...methods } = useSheetParams();

	return {
		// Aliased params for backward compatibility
		scheduleId: entityId,
		createSchedule: createMode,
		// Aliased setParams to accept entity-specific keys
		setParams: (params: {
			scheduleId?: string | null;
			createSchedule?: boolean | null;
		}) =>
			setParams({
				entityId: params.scheduleId,
				createMode: params.createSchedule,
			}),
		// Methods pass through unchanged
		...methods,
	};
}
