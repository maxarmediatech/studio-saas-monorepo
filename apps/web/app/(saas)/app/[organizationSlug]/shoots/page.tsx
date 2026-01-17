import { getActiveOrganization } from "@saas/auth/lib/server";
import { ShootsFilters, ShootsTableSkeleton } from "@saas/studio";
import { ShootsTable } from "@saas/studio/components/shoots/index.server";
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
		title: `Shoots | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ShootsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<div className="space-y-4">
			<ShootsFilters />

			<Suspense fallback={<ShootsTableSkeleton />}>
				<ShootsTable
					organizationSlug={organizationSlug}
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
