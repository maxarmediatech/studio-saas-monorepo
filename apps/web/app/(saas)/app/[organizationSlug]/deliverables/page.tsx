import { getActiveOrganization } from "@saas/auth/lib/server";
import { DeliverablesFilters, DeliverablesTableSkeleton } from "@saas/studio";
import { DeliverablesTable } from "@saas/studio/components/deliverables/index.server";
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
		title: `Deliverables | ${organization?.name ?? "Studio"}`,
	};
}

export default async function DeliverablesPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<div className="space-y-4">
			<DeliverablesFilters />

			<Suspense fallback={<DeliverablesTableSkeleton />}>
				<DeliverablesTable
					organizationSlug={organizationSlug}
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
