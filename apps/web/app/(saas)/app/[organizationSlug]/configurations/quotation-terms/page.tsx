import { getActiveOrganization } from "@saas/auth/lib/server";
import {
	ConfigurationsFilters,
	ConfigurationsTableSkeleton,
} from "@saas/studio";
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
	return { title: `Quotation Terms | ${organization?.name ?? "Studio"}` };
}

export default async function QuotationTermsPage({
	params,
	searchParams,
}: Props) {
	const { organizationSlug } = await params;
	if (!(await getActiveOrganization(organizationSlug))) {
		return notFound();
	}

	return (
		<div className="space-y-4">
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
