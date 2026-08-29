import {
	PaymentsFilters,
	PaymentsTableSkeleton,
} from "@saas/studio/components/payments";
import { PaymentsTable } from "@saas/studio/components/payments/index.server";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Payments");
}

export default function PaymentsPage({ params, searchParams }: Props) {
	return (
		<div className="space-y-4">
			<PaymentsFilters />

			<Suspense fallback={<PaymentsTableSkeleton />}>
				<PaymentsContent params={params} searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function PaymentsContent({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	return (
		<PaymentsTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
