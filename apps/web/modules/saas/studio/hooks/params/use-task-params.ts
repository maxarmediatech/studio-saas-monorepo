"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "task",
	idParam: "taskId",
	createParam: "createTask",
});

/**
 * URL-based task sheet params using History API.
 * No Next.js router re-renders, browser back button closes sheets.
 */
export function useTaskParams() {
	const { entityId, createMode, setParams, ...methods } = useSheetParams();

	return {
		// Aliased params for backward compatibility
		taskId: entityId,
		createTask: createMode,
		// Aliased setParams to accept entity-specific keys
		setParams: (params: {
			taskId?: string | null;
			createTask?: boolean | null;
		}) =>
			setParams({
				entityId: params.taskId,
				createMode: params.createTask,
			}),
		// Methods pass through unchanged
		...methods,
	};
}
