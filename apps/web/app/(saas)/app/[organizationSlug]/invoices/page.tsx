import { InvoicesFilters } from "@saas/studio/components/invoices/InvoicesFilters";
import { InvoicesTableSkeleton } from "@saas/studio/components/invoices/InvoicesTableSkeleton";
import { InvoicesTable } from "@saas/studio/components/invoices/index.server";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Invoices");
}

export default function InvoicesPage({ params, searchParams }: Props) {
	return (
		<div className="space-y-4">
			<InvoicesFilters />

			<Suspense fallback={<InvoicesTableSkeleton />}>
				<InvoicesContent params={params} searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function InvoicesContent({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	return (
		<InvoicesTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
