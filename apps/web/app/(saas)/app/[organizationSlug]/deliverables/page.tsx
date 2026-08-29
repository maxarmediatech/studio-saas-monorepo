import { DeliverablesFilters, DeliverablesTableSkeleton } from "@saas/studio";
import { DeliverablesTable } from "@saas/studio/components/deliverables/index.server";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Deliverables");
}

export default function DeliverablesPage({ params, searchParams }: Props) {
	return (
		<div className="space-y-4">
			<DeliverablesFilters />

			<Suspense fallback={<DeliverablesTableSkeleton />}>
				<DeliverablesContent
					params={params}
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}

async function DeliverablesContent({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	return (
		<DeliverablesTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
