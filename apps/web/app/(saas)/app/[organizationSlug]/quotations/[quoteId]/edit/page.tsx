import { and, db, eq, quotes } from "@repo/database";
import { QuotationEditor } from "@saas/studio/components/quotations/QuotationEditor";
import { QuotationWizard } from "@saas/studio/components/quotations/QuotationWizard";
import { resolveQuoteRouteAccess } from "@saas/studio/lib/quote-access.server";
import { notFound } from "next/navigation";

export default async function EditQuotationPage({
	params,
}: {
	params: Promise<{ organizationSlug: string; quoteId: string }>;
}) {
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
		columns: { documentVersion: true },
	});
	if (!quote) {
		notFound();
	}
	if (quote.documentVersion === 1) {
		return (
			<QuotationWizard
				organizationSlug={organizationSlug}
				organizationTimezone={access.organizationTimezone}
				quoteId={quoteId}
			/>
		);
	}
	return (
		<QuotationEditor
			organizationSlug={organizationSlug}
			organizationTimezone={access.organizationTimezone}
			quoteId={quoteId}
		/>
	);
}
