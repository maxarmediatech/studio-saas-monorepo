import { getActiveOrganization } from "@saas/auth/lib/server";
import { receiptsApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { ReceiptDetailPageClient } from "./ReceiptDetailPageClient";

type Props = {
	params: Promise<{ organizationSlug: string; id: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Receipt Details | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ReceiptDetailPage({ params }: Props) {
	const { organizationSlug, id } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(receiptsApi.getOptions(id));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ReceiptDetailPageClient
				organizationSlug={organizationSlug}
				organizationName={organization.name}
				receiptId={id}
			/>
		</HydrationBoundary>
	);
}
