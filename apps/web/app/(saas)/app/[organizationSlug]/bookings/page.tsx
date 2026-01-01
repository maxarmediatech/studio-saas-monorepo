import { getActiveOrganization } from "@saas/auth/lib/server";
import { BookingsFilters, BookingsTableSkeleton } from "@saas/studio";
import { BookingsTable } from "@saas/studio/components/bookings/index.server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
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

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<div className="space-y-4">
			<BookingsFilters />

			<Suspense fallback={<BookingsTableSkeleton />}>
				<BookingsTable
					organizationSlug={organizationSlug}
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
