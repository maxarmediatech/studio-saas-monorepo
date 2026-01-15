import { getActiveOrganization } from "@saas/auth/lib/server";
import { StickiesPageClient } from "@saas/studio/components/stickies";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Stickies | ${organization?.name ?? "Studio"}`,
	};
}

export default async function StickiesPage({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return <StickiesPageClient />;
}
