import {
	CrewsFilters,
	CrewsTableSkeleton,
	PeopleWorkerTypeTabs,
} from "@saas/studio";
import { CrewsTable } from "@saas/studio/components/crews/index.server";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "People");
}

export default function PeoplePage({ params, searchParams }: Props) {
	return (
		<div className="space-y-4">
			<PeopleWorkerTypeTabs />
			<CrewsFilters />

			<Suspense fallback={<CrewsTableSkeleton />}>
				<PeopleContent params={params} searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function PeopleContent({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	return (
		<CrewsTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
