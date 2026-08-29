import { receiptsApi } from "@saas/studio/lib/api";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import {
	ReceiptDetailPageClient,
	ReceiptDetailSkeleton,
} from "./ReceiptDetailPageClient";

type Props = {
	params: Promise<{ organizationSlug: string; id: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Receipt Details");
}

export default function ReceiptDetailPage({ params }: Props) {
	return (
		<Suspense fallback={<ReceiptDetailSkeleton />}>
			<ReceiptDetailContent params={params} />
		</Suspense>
	);
}

async function ReceiptDetailContent({ params }: Props) {
	const { organizationSlug, id } = await params;
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(receiptsApi.getOptions(id));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ReceiptDetailPageClient
				organizationSlug={organizationSlug}
				receiptId={id}
			/>
		</HydrationBoundary>
	);
}
