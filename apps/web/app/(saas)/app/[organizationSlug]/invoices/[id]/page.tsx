import { invoicesApi } from "@saas/studio/lib/api";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import {
	InvoiceDetailPageClient,
	InvoiceDetailSkeleton,
} from "./InvoiceDetailPageClient";

type Props = {
	params: Promise<{ organizationSlug: string; id: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Invoice Details");
}

export default function InvoiceDetailPage({ params }: Props) {
	return (
		<Suspense fallback={<InvoiceDetailSkeleton />}>
			<InvoiceDetailContent params={params} />
		</Suspense>
	);
}

async function InvoiceDetailContent({ params }: Props) {
	const { organizationSlug, id } = await params;
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(invoicesApi.getOptions(id));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<InvoiceDetailPageClient
				organizationSlug={organizationSlug}
				invoiceId={id}
			/>
		</HydrationBoundary>
	);
}
