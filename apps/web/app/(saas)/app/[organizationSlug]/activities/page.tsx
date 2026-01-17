import { getActiveOrganization } from "@saas/auth/lib/server";
import { ActivitiesPageClient } from "@saas/studio/components/activities";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Activities | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ActivitiesPage({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return <ActivitiesPageClient organizationSlug={organizationSlug} />;
}
