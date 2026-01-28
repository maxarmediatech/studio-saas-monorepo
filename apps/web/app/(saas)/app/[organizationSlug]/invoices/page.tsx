import { getActiveOrganization } from "@saas/auth/lib/server";
import { InvoicesFilters } from "@saas/studio/components/invoices/InvoicesFilters";
import { InvoicesTableSkeleton } from "@saas/studio/components/invoices/InvoicesTableSkeleton";
import { InvoicesTable } from "@saas/studio/components/invoices/index.server";
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
		title: `Invoices | ${organization?.name ?? "Studio"}`,
	};
}

export default async function InvoicesPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<div className="space-y-4">
			<InvoicesFilters />

			<Suspense fallback={<InvoicesTableSkeleton />}>
				<InvoicesTable
					organizationSlug={organizationSlug}
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
