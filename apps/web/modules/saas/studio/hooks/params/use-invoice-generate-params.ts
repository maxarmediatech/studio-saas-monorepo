"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "invoiceGenerate",
	idParam: "generateInvoiceScheduleId",
	createParam: "createInvoiceGenerate",
});

export function useInvoiceGenerateParams() {
	const { entityId, setParams, ...methods } = useSheetParams();

	return {
		scheduleId: entityId,
		setParams: (params: { scheduleId?: string | null }) =>
			setParams({
				entityId: params.scheduleId,
			}),
		...methods,
	};
}
