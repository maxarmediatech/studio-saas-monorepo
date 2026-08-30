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
	return getOrganizationPageMetadata(params, "Quotation Terms");
}

export default function QuotationTermsPage({ searchParams }: Props) {
	return (
		<div className="space-y-4" data-route-content="quotation-terms">
			<ConfigurationsFilters
				configType="quotation_terms"
				configTypeLabelPlural="Quotation Terms"
			/>
			<Suspense fallback={<ConfigurationsTableSkeleton />}>
				<ConfigurationsTable
					configType="quotation_terms"
					configTypeLabel="Quotation Terms Preset"
					configTypeLabelPlural="Quotation Terms"
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
