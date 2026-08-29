import { ReviewQueueView } from "@saas/studio/components/reviews";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Review Queue");
}

export default function ReviewQueuePage() {
	return <ReviewQueueView />;
}
