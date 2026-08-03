import { QuotationEditor } from "@saas/studio/components/quotations/QuotationEditor";
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
	return (
		<QuotationEditor
			organizationSlug={organizationSlug}
			organizationTimezone={access.organizationTimezone}
			quoteId={quoteId}
		/>
	);
}
