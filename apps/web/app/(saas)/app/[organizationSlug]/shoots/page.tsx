import { ShootsFilters, ShootsTableSkeleton } from "@saas/studio";
import { ShootsTable } from "@saas/studio/components/shoots/index.server";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Shoots");
}

export default function ShootsPage({ params, searchParams }: Props) {
	return (
		<div className="space-y-4" data-route-content="shoots">
			<ShootsFilters />

			<Suspense fallback={<ShootsTableSkeleton />}>
				<ShootsContent params={params} searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function ShootsContent({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	return (
		<ShootsTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
