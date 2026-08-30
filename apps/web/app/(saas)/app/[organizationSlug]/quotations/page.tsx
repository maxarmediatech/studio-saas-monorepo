import { QuotationsList } from "@saas/studio/components/quotations/QuotationsList";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Quotations");
}

export default async function QuotationsPage({ params }: Props) {
	const { organizationSlug } = await params;

	return (
		<div data-route-content="quotations">
			<QuotationsList organizationSlug={organizationSlug} />
		</div>
	);
}
