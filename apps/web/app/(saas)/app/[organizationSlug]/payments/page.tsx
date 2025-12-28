import { getActiveOrganization } from "@saas/auth/lib/server";
import { PaymentsPageClient } from "@saas/studio/components/payments/PaymentsPageClient";
import { PaymentCreateSheet, PaymentEditSheet } from "@saas/studio/components/payments/sheets";
import { PageContent } from "@saas/studio";
import { studioPaymentsApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<{
		page?: string;
		search?: string;
	}>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Payments | ${organization?.name ?? "Studio"}`,
	};
}

export default async function PaymentsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;
	const filters = await searchParams;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const queryClient = getServerQueryClient();

	// Prefetch payments data on server
	const input = {
		page: filters.page ? Number.parseInt(filters.page, 10) : 1,
		limit: 10,
		search: filters.search,
		sortBy: "receivedDate" as const,
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	await queryClient.prefetchQuery(studioPaymentsApi.listReceivedOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<PageContent title="Payments">
				<PaymentsPageClient
					organizationSlug={organizationSlug}
					initialFilters={{
						page: input.page,
						search: input.search,
					}}
				/>
				<PaymentCreateSheet />
				<PaymentEditSheet />
			</PageContent>
		</HydrationBoundary>
	);
}
