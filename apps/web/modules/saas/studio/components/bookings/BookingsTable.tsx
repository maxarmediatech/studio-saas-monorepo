import type { BookingPhase } from "@repo/api/modules/studio/schemas/common";
import { bookingsApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { BookingsTableClient } from "./BookingsTableClient";

interface BookingsTableProps {
	organizationSlug: string;
	page: number;
	search?: string;
	status?: BookingPhase;
}

export async function BookingsTable({
	organizationSlug,
	page,
	search,
	status,
}: BookingsTableProps) {
	const queryClient = getServerQueryClient();

	// Build query input
	const input = {
		page,
		limit: 10,
		search,
		status,
		sortBy: "createdAt",
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	// Prefetch bookings data on server
	await queryClient.prefetchQuery(bookingsApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<BookingsTableClient
				organizationSlug={organizationSlug}
				initialFilters={{
					page,
					search,
					status,
				}}
			/>
		</HydrationBoundary>
	);
}
