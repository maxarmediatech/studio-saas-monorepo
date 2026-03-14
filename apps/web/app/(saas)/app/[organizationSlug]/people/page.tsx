import { getActiveOrganization } from "@saas/auth/lib/server";
import {
	CrewsFilters,
	CrewsTableSkeleton,
	PeopleWorkerTypeTabs,
} from "@saas/studio";
import { CrewsTable } from "@saas/studio/components/crews/index.server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `People | ${organization?.name ?? "Studio"}`,
	};
}

export default async function PeoplePage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<div className="space-y-4">
			<PeopleWorkerTypeTabs />
			<CrewsFilters />

			<Suspense fallback={<CrewsTableSkeleton />}>
				<CrewsTable
					organizationSlug={organizationSlug}
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
