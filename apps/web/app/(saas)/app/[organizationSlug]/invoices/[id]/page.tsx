import { getActiveOrganization } from "@saas/auth/lib/server";
import { invoicesApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { InvoiceDetailPageClient } from "./InvoiceDetailPageClient";

type Props = {
	params: Promise<{ organizationSlug: string; id: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Invoice Details | ${organization?.name ?? "Studio"}`,
	};
}

export default async function InvoiceDetailPage({ params }: Props) {
	const { organizationSlug, id } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

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
