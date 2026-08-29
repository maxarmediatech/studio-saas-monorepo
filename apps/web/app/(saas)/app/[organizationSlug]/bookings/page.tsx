import { BookingsFilters, BookingsTableSkeleton } from "@saas/studio";
import { BookingsTable } from "@saas/studio/components/bookings/index.server";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Bookings");
}

export default function BookingsPage({ params, searchParams }: Props) {
	return (
		<div className="space-y-4" data-route-content="bookings">
			<BookingsFilters />

			<Suspense fallback={<BookingsTableSkeleton />}>
				<BookingsContent params={params} searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function BookingsContent({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	return (
		<BookingsTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
