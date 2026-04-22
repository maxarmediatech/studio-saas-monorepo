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
		title: `Event Types | ${organization?.name ?? "Studio"}`,
	};
}

export default async function EventTypesPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<div className="space-y-4">
			<ConfigurationsFilters
				configType="event_type"
				configTypeLabelPlural="Event Types"
			/>

			<Suspense fallback={<ConfigurationsTableSkeleton />}>
				<ConfigurationsTable
					configType="event_type"
					configTypeLabel="Event Type"
					configTypeLabelPlural="Event Types"
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
