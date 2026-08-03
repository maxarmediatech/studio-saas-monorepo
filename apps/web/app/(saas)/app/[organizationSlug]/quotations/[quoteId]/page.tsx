import { QuotationDetail } from "@saas/studio/components/quotations/QuotationDetail";
import { quotesApi } from "@saas/studio/lib/api";
import { resolveQuoteRouteAccess } from "@saas/studio/lib/quote-access.server";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

export default async function QuotationDetailPage({
	params,
}: {
	params: Promise<{ organizationSlug: string; quoteId: string }>;
}) {
	const { organizationSlug, quoteId } = await params;
	const access = await resolveQuoteRouteAccess(organizationSlug);
	if (!access?.caps.quoteReadOperational) {
		notFound();
	}
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(quotesApi.getOptions(quoteId));
	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<QuotationDetail
				organizationSlug={organizationSlug}
				quoteId={quoteId}
			/>
		</HydrationBoundary>
	);
}
