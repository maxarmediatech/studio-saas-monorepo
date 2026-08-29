import { ActivitiesPageClient } from "@saas/studio/components/activities";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Activities");
}

export default function ActivitiesPage() {
	return <ActivitiesPageClient />;
}
