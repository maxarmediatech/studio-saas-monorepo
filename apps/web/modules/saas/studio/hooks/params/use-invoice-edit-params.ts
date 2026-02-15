"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "invoiceEdit",
	idParam: "editInvoiceId",
	createParam: "createInvoiceEdit",
});

export function useInvoiceEditParams() {
	const { entityId, setParams, ...methods } = useSheetParams();

	return {
		invoiceId: entityId,
		setParams: (params: { invoiceId?: string | null }) =>
			setParams({
				entityId: params.invoiceId,
			}),
		...methods,
	};
}
