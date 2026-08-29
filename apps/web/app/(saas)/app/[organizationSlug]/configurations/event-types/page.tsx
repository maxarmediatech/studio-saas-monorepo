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
	return getOrganizationPageMetadata(params, "Event Types");
}

export default function EventTypesPage({ searchParams }: Props) {
	return (
		<div className="space-y-4">
			<ConfigurationsFilters
				configType="event_type"
				configTypeLabelPlural="Event Types"
			/>

			<Suspense fallback={<ConfigurationsTableSkeleton />}>
				<ConfigurationsTable
					configType="event_type"
					configTypeLabel="Event Type"
					configTypeLabelPlural="Event Types"
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
