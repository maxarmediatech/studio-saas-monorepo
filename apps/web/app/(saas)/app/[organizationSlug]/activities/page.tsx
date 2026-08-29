import { PageContent } from "@saas/studio";
import { ActivitiesPageClient } from "@saas/studio/components/activities";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Activities");
}

export default function ActivitiesPage({ params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Activities" />}>
			<ActivitiesContent params={params} />
		</Suspense>
	);
}

async function ActivitiesContent({ params }: Props) {
	const { organizationSlug } = await params;

	return <ActivitiesPageClient organizationSlug={organizationSlug} />;
}
