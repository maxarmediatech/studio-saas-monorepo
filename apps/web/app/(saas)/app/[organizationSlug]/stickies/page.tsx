import { StickiesPageClient } from "@saas/studio/components/stickies";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Stickies");
}

export default function StickiesPage() {
	return <StickiesPageClient />;
}
