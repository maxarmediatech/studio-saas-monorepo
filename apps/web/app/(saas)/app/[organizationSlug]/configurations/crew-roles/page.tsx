import { getActiveOrganization } from "@saas/auth/lib/server";
import { ConfigurationsFilters, ConfigurationsTableSkeleton } from "@saas/studio";
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

	return {
		title: `Crew Roles | ${organization?.name ?? "Studio"}`,
	};
}

export default async function CrewRolesPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<div className="space-y-4">
			<ConfigurationsFilters configTypeLabelPlural="Crew Roles" />

			<Suspense fallback={<ConfigurationsTableSkeleton />}>
				<ConfigurationsTable
					configType="crew_role"
					configTypeLabel="Crew Role"
					configTypeLabelPlural="Crew Roles"
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
