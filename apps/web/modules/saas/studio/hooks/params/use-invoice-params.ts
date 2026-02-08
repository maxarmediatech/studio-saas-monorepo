"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "invoice",
	idParam: "invoiceId",
	createParam: "createInvoice",
});

export function useInvoiceParams() {
	const { entityId, createMode, setParams, ...methods } = useSheetParams();

	return {
		invoiceId: entityId,
		createInvoice: createMode,
		setParams: (params: {
			invoiceId?: string | null;
			createInvoice?: boolean | null;
		}) =>
			setParams({
				entityId: params.invoiceId,
				createMode: params.createInvoice,
			}),
		...methods,
	};
}
