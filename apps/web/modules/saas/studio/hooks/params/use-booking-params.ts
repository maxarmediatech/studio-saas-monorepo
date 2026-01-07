"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "booking",
	idParam: "bookingId",
	createParam: "createBooking",
});

/**
 * URL-based booking sheet params using History API.
 * No Next.js router re-renders, browser back button closes sheets.
 *
 * Note: Added createBooking param and openCreate/openEdit methods
 * for API normalization with other entity param hooks.
 */
export function useBookingParams() {
	const { entityId, createMode, setParams, ...methods } = useSheetParams();

	return {
		// Aliased params for backward compatibility
		bookingId: entityId,
		createBooking: createMode,
		// Aliased setParams to accept entity-specific keys
		setParams: (params: {
			bookingId?: string | null;
			createBooking?: boolean | null;
		}) =>
			setParams({
				entityId: params.bookingId,
				createMode: params.createBooking,
			}),
		// Methods pass through unchanged (includes openCreate, openEdit, openView, close)
		...methods,
	};
}
