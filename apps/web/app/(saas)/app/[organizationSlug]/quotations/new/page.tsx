import { QuotationWizard } from "@saas/studio/components/quotations/QuotationWizard";
import {
	findReusableQuotationDraft,
	resolveQuoteRouteAccess,
} from "@saas/studio/lib/quote-access.server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { QuotationsLayoutFallback } from "../quotations-layout-client";

export const metadata = { title: "New quotation" };

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export default function NewQuotationPage({ params }: Props) {
	return (
		<Suspense fallback={<QuotationsLayoutFallback />}>
			<NewQuotationContent params={params} />
		</Suspense>
	);
}

async function NewQuotationContent({ params }: Props) {
	const { organizationSlug } = await params;
	const access = await resolveQuoteRouteAccess(organizationSlug);
	if (
		!access?.caps.quoteCreate ||
		!access.caps.quoteUpdate ||
		!access.caps.quoteReadOperational
	) {
		notFound();
	}
	const reusableDraft = await findReusableQuotationDraft(
		access.organization.id,
		access.userId,
	);
	if (reusableDraft) {
		redirect(
			`/app/${organizationSlug}/quotations/${reusableDraft.id}/edit`,
		);
	}

	return (
		<QuotationWizard
			organizationSlug={organizationSlug}
			organizationTimezone={access.organizationTimezone}
		/>
	);
}
