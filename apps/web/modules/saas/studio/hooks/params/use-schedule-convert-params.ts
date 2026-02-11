"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "scheduleConvert",
	idParam: "convertScheduleId",
	createParam: "createScheduleConvert",
});

/**
 * URL-based convert-schedule sheet params using History API.
 * No Next.js router re-renders, browser back button closes sheets.
 */
export function useScheduleConvertParams() {
	const { entityId, createMode, setParams, openEdit, ...methods } = useSheetParams();

	return {
		convertScheduleId: entityId,
		createScheduleConvert: createMode,
		setParams: (params: {
			convertScheduleId?: string | null;
			createScheduleConvert?: boolean | null;
		}) =>
			setParams({
				entityId: params.convertScheduleId,
				createMode: params.createScheduleConvert,
			}),
		openConvert: (scheduleId: string) => openEdit(scheduleId),
		...methods,
	};
}
