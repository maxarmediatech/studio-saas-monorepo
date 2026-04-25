"use client";

import type { ToolbarFilterConfig } from "@saas/shared/components/data-table";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const BOOKING_FILTER_PAGE_SIZE = 100;

export function useBookingFilterConfig(): ToolbarFilterConfig {
	const { data: bookingOptions, isLoading } = useQuery({
		queryKey: [...orpc.bookings.key(), "filter-options"],
		queryFn: async () => {
			const allBookings: Array<{
				id: string;
				name: string;
				referenceNumber: string;
			}> = [];
			let page = 1;
			let pageCount = 1;

			while (page <= pageCount) {
				const response = await orpcClient.bookings.list({
					page,
					limit: BOOKING_FILTER_PAGE_SIZE,
					sortBy: "bookingDate",
					sortDirection: "desc",
					includeDeleted: false,
				});

				allBookings.push(
					...response.data.map((booking) => ({
						id: booking.id,
						name: booking.name,
						referenceNumber: booking.referenceNumber,
					})),
				);
				pageCount = response.pagination.pageCount;
				page += 1;
			}

			return Array.from(
				new Map(
					allBookings.map((booking) => [
						booking.id,
						{
							value: booking.id,
							label: `${booking.name} (${booking.referenceNumber})`,
						},
					]),
				).values(),
			);
		},
	});

	return useMemo(
		() => ({
			id: "bookingId",
			label: "Booking",
			variant: "select",
			placeholder: isLoading ? "Loading bookings..." : undefined,
			options: bookingOptions ?? [],
		}),
		[bookingOptions, isLoading],
	);
}

export function getBookingFilterValue(bookingId?: string | null) {
	return bookingId ?? null;
}

export function parseBookingFilterValue(
	value:
		| string
		| string[]
		| { from?: string; to?: string }
		| null
		| undefined,
) {
	if (Array.isArray(value)) {
		return value[0] ?? null;
	}

	return typeof value === "string" ? value || null : null;
}
