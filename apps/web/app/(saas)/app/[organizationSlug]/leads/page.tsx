import { ClientsFilters, ClientsTableSkeleton } from "@saas/studio";
import { ClientsTable } from "@saas/studio/components/clients/index.server";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Leads");
}

export default function LeadsPage({ params, searchParams }: Props) {
	return (
		<div className="space-y-4" data-route-content="leads">
			<ClientsFilters />
			<Suspense fallback={<ClientsTableSkeleton />}>
				<LeadsContent params={params} searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function LeadsContent({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	return (
		<ClientsTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
			lifecycleStage="lead"
		/>
	);
}
