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
	return getOrganizationPageMetadata(params, "Specialisations");
}

export default function SpecialisationsPage({ searchParams }: Props) {
	return (
		<div className="space-y-4">
			<ConfigurationsFilters
				configType="crew_role"
				configTypeLabelPlural="Specialisations"
			/>

			<Suspense fallback={<ConfigurationsTableSkeleton />}>
				<ConfigurationsTable
					configType="crew_role"
					configTypeLabel="Specialisation"
					configTypeLabelPlural="Specialisations"
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
