import type { BookingPhase } from "@repo/api/modules/studio/schemas/common";
import { getActiveOrganization } from "@saas/auth/lib/server";
import { BookingsFilters, BookingsTableSkeleton } from "@saas/studio";
import { BookingsTable } from "@saas/studio/components/bookings/index.server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Boundary from "@/modules/ui/components/internal/Boundary";

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

	// Parse filters
	const page = filters.page ? Number.parseInt(filters.page, 10) : 1;
	const search = filters.search;
	const status = filters.status as BookingPhase | undefined;

	return (
		<div className="space-y-4">
			{/* Filters render instantly - client component */}
			<Boundary hydration="client" label="Filters (instant)">
				<BookingsFilters
					organizationSlug={organizationSlug}
					initialSearch={search}
					initialStatus={status}
				/>
			</Boundary>

			{/* Table streams in - async server component */}
			<Boundary rendering="dynamic" label="Table (streaming)">
				<Suspense fallback={<BookingsTableSkeleton />}>
					<BookingsTable
						organizationSlug={organizationSlug}
						page={page}
						search={search}
						status={status}
					/>
				</Suspense>
			</Boundary>
		</div>
	);
}
