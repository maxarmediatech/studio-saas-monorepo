"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "bookingEdit",
	idParam: "editBookingId",
	createParam: "createBookingEdit",
});

export function useBookingEditParams() {
	const { entityId, setParams, ...methods } = useSheetParams();

	return {
		bookingId: entityId,
		setParams: (params: { bookingId?: string | null }) =>
			setParams({
				entityId: params.bookingId,
			}),
		...methods,
	};
}
