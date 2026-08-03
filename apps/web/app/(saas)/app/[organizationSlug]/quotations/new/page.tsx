import { QuotationEditor } from "@saas/studio/components/quotations/QuotationEditor";
import { resolveQuoteRouteAccess } from "@saas/studio/lib/quote-access.server";
import { notFound } from "next/navigation";

export const metadata = { title: "New quotation" };

export default async function NewQuotationPage({
	params,
}: {
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;
	const access = await resolveQuoteRouteAccess(organizationSlug);
	if (!access?.caps.quoteCreate || !access.caps.quoteReadOperational) {
		notFound();
	}
	return (
		<QuotationEditor
			organizationSlug={organizationSlug}
			organizationTimezone={access.organizationTimezone}
		/>
	);
}
