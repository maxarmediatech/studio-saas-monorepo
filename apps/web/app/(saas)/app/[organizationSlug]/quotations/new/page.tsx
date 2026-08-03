import { QuotationEditor } from "@saas/studio/components/quotations/QuotationEditor";
import { QuotationWizard } from "@saas/studio/components/quotations/QuotationWizard";
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
	if (process.env.QUOTATION_WIZARD_MODE === "document-v1") {
		return (
			<QuotationWizard
				organizationSlug={organizationSlug}
				organizationTimezone={access.organizationTimezone}
			/>
		);
	}
	return (
		<QuotationEditor
			organizationSlug={organizationSlug}
			organizationTimezone={access.organizationTimezone}
		/>
	);
}
