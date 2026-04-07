import { getActiveOrganization } from "@saas/auth/lib/server";
import { ConfigurationsFilters, ConfigurationsTableSkeleton } from "@saas/studio";
import { ConfigurationsTable } from "@saas/studio/components/configurations/index.server";
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
		title: `Booking Types | ${organization?.name ?? "Studio"}`,
	};
}

export default async function BookingTypesPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<div className="space-y-4">
			<ConfigurationsFilters
				configType="booking_type"
				configTypeLabelPlural="Booking Types"
			/>

			<Suspense fallback={<ConfigurationsTableSkeleton />}>
				<ConfigurationsTable
					configType="booking_type"
					configTypeLabel="Booking Type"
					configTypeLabelPlural="Booking Types"
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
