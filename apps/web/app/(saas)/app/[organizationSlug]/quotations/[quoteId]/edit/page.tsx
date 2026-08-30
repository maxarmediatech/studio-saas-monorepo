import { and, db, eq, quotes } from "@repo/database";
import { QuotationWizard } from "@saas/studio/components/quotations/QuotationWizard";
import { resolveQuoteRouteAccess } from "@saas/studio/lib/quote-access.server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { QuotationsLayoutFallback } from "../../quotations-layout-client";

type Props = {
	params: Promise<{ organizationSlug: string; quoteId: string }>;
};

export default function EditQuotationPage({ params }: Props) {
	return (
		<Suspense fallback={<QuotationsLayoutFallback />}>
			<EditQuotationContent params={params} />
		</Suspense>
	);
}

async function EditQuotationContent({ params }: Props) {
	const { organizationSlug, quoteId } = await params;
	const access = await resolveQuoteRouteAccess(organizationSlug);
	// Managers have update authority but cannot fetch operational content. Never weaken the API boundary.
	if (!access?.caps.quoteReadOperational || !access.caps.quoteUpdate) {
		notFound();
	}
	const quote = await db.query.quotes.findFirst({
		where: and(
			eq(quotes.id, quoteId),
			eq(quotes.organizationId, access.organization.id),
		),
		columns: { documentVersion: true, status: true },
	});
	if (!quote || quote.documentVersion !== 1) {
		notFound();
	}
	if (quote.status !== "draft") {
		redirect(`/app/${organizationSlug}/quotations/${quoteId}`);
	}

	return (
		<QuotationWizard
			organizationSlug={organizationSlug}
			organizationTimezone={access.organizationTimezone}
			quoteId={quoteId}
		/>
	);
}
