import { ReceiptsTable } from "@saas/studio/components/receipts/index.server";
import { ReceiptsFilters } from "@saas/studio/components/receipts/ReceiptsFilters";
import { ReceiptsTableSkeleton } from "@saas/studio/components/receipts/ReceiptsTableSkeleton";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Receipts");
}

export default function ReceiptsPage({ params, searchParams }: Props) {
	return (
		<div className="space-y-4" data-route-content="receipts">
			<ReceiptsFilters />

			<Suspense fallback={<ReceiptsTableSkeleton />}>
				<ReceiptsContent params={params} searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function ReceiptsContent({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	return (
		<ReceiptsTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
