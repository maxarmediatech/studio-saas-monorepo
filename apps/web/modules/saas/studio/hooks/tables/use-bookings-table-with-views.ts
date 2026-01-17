"use client";

import type { BookingPhase } from "@repo/api/modules/studio/schemas/common";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from "nuqs";
import { useDataTableWithViews } from "@/modules/saas/shared/hooks/use-data-table";

const BOOKING_PHASES = [
	"new",
	"preparation",
	"shooting",
	"delivery",
	"completed",
	"cancelled",
] as const;

export interface BookingFilters {
	search?: string | null;
	statuses?: BookingPhase[] | null;
	bookingType?: string[] | null;
	packageType?: string[] | null;
	createdAt?: string[] | null;
}

const bookingFilterParsers = {
	statuses: parseAsArrayOf(parseAsStringLiteral(BOOKING_PHASES)),
	bookingType: parseAsArrayOf(parseAsString, ","),
	packageType: parseAsArrayOf(parseAsString, ","),
	createdAt: parseAsArrayOf(parseAsString, ","),
};

export function useBookingsTableWithViews() {
	return useDataTableWithViews<BookingFilters>(bookingFilterParsers, {
		entityType: "booking",
		defaultSortBy: "createdAt",
		defaultSortDirection: "desc",
		defaultLimit: 10,
	});
}
