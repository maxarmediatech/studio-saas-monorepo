import {
	ConfigurationsFilters,
	ConfigurationsTableSkeleton,
} from "@saas/studio";
import { ConfigurationsTable } from "@saas/studio/components/configurations/index.server";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Booking Types");
}

export default function BookingTypesPage({ searchParams }: Props) {
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
