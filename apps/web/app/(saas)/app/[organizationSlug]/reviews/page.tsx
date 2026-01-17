import { getActiveOrganization } from "@saas/auth/lib/server";
import { ReviewQueueView } from "@saas/studio/components/reviews";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Review Queue | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ReviewQueuePage({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return <ReviewQueueView />;
}
