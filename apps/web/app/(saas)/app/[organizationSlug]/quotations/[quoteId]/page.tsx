import { and, db, eq, quotes } from "@repo/database";
import { QuotationDetail } from "@saas/studio/components/quotations/QuotationDetail";
import { quotesApi } from "@saas/studio/lib/api";
import { resolveQuoteRouteAccess } from "@saas/studio/lib/quote-access.server";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { QuotationsLayoutFallback } from "../quotations-layout-client";

type Props = {
	params: Promise<{ organizationSlug: string; quoteId: string }>;
};

export default function QuotationDetailPage({ params }: Props) {
	return (
		<Suspense fallback={<QuotationsLayoutFallback />}>
			<QuotationDetailContent params={params} />
		</Suspense>
	);
}

async function QuotationDetailContent({ params }: Props) {
	const { organizationSlug, quoteId } = await params;
	const access = await resolveQuoteRouteAccess(organizationSlug);
	if (!access?.caps.quoteReadOperational) {
		notFound();
	}
	const quote = await db.query.quotes.findFirst({
		where: and(
			eq(quotes.id, quoteId),
			eq(quotes.organizationId, access.organization.id),
		),
		columns: { documentVersion: true, status: true },
	});
	if (!quote) {
		notFound();
	}
	if (quote.status === "draft") {
		if (quote.documentVersion !== 1) {
			notFound();
		}
		redirect(`/app/${organizationSlug}/quotations/${quoteId}/edit`);
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
