import { getActiveOrganization } from "@saas/auth/lib/server";
import { ReceiptsTable } from "@saas/studio/components/receipts/index.server";
import { ReceiptsFilters } from "@saas/studio/components/receipts/ReceiptsFilters";
import { ReceiptsTableSkeleton } from "@saas/studio/components/receipts/ReceiptsTableSkeleton";
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
		title: `Receipts | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ReceiptsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<div className="space-y-4">
			<ReceiptsFilters />

			<Suspense fallback={<ReceiptsTableSkeleton />}>
				<ReceiptsTable
					organizationSlug={organizationSlug}
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
