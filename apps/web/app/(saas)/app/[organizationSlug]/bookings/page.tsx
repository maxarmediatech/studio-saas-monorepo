import type { BookingPhase } from "@repo/api/modules/studio/schemas/common";
import { Button } from "@repo/ui/components/button";
import { getActiveOrganization } from "@saas/auth/lib/server";
import { BookingsPageClient, PageHeader } from "@saas/studio";
import { bookingsApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
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
			<PageHeader
				title="Bookings"
				actions={
					<Button asChild size="sm">
						<Link href={`/app/${organizationSlug}/bookings/new`}>
							<PlusIcon className="mr-2 h-4 w-4" />
							New Booking
						</Link>
					</Button>
				}
			/>
			<BookingsPageClient
				organizationSlug={organizationSlug}
				initialFilters={{
					page: input.page,
					search: input.search,
					status: input.status,
				}}
			/>
		</HydrationBoundary>
	);
}
