import type { BookingPhase } from "@repo/api/modules/studio/schemas/common";
import { getActiveOrganization } from "@saas/auth/lib/server";
import { BookingsPageClient } from "@saas/studio/components/bookings/BookingsPageClient";
import { bookingsApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<{
		page?: string;
		search?: string;
		status?: string;
	}>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Bookings | ${organization?.name ?? "Studio"}`,
	};
}

export default async function BookingsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;
	const filters = await searchParams;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const queryClient = getServerQueryClient();

	// Prefetch bookings data on server
	const input = {
		page: filters.page ? Number.parseInt(filters.page, 10) : 1,
		limit: 10,
		search: filters.search,
		status: filters.status as BookingPhase | undefined,
		sortBy: "createdAt",
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	await queryClient.prefetchQuery(bookingsApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">
							Bookings
						</h1>
						<p className="text-muted-foreground">
							Manage your projects and client bookings
						</p>
					</div>
				</div>

				<BookingsPageClient
					organizationSlug={organizationSlug}
					initialFilters={{
						page: input.page,
						search: input.search,
						status: input.status,
					}}
				/>
			</div>
		</HydrationBoundary>
	);
}
