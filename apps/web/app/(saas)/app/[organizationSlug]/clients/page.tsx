import { getActiveOrganization } from "@saas/auth/lib/server";
import { ClientsFilters, ClientsTableSkeleton } from "@saas/studio";
import { ClientsTable } from "@saas/studio/components/clients/index.server";
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
		title: `Clients | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ClientsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<div className="space-y-4">
			<ClientsFilters />

			<Suspense fallback={<ClientsTableSkeleton />}>
				<ClientsTable
					organizationSlug={organizationSlug}
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
