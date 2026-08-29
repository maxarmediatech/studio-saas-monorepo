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
	return getOrganizationPageMetadata(params, "Relation Types");
}

export default function RelationTypesPage({ searchParams }: Props) {
	return (
		<div className="space-y-4">
			<ConfigurationsFilters
				configType="relation_type"
				configTypeLabelPlural="Relation Types"
			/>

			<Suspense fallback={<ConfigurationsTableSkeleton />}>
				<ConfigurationsTable
					configType="relation_type"
					configTypeLabel="Relation Type"
					configTypeLabelPlural="Relation Types"
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
