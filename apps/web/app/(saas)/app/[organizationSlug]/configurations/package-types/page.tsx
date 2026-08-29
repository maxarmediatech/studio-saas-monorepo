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
	return getOrganizationPageMetadata(params, "Package Types");
}

export default function PackageTypesPage({ searchParams }: Props) {
	return (
		<div className="space-y-4">
			<ConfigurationsFilters
				configType="package_type"
				configTypeLabelPlural="Package Types"
			/>

			<Suspense fallback={<ConfigurationsTableSkeleton />}>
				<ConfigurationsTable
					configType="package_type"
					configTypeLabel="Package Type"
					configTypeLabelPlural="Package Types"
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
