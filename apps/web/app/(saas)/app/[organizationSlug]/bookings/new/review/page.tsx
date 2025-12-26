import { getActiveOrganization } from "@saas/auth/lib/server";
import { ConfigurationsProvider } from "@saas/studio/components/bookings/index.server";
import { notFound } from "next/navigation";
import { ReviewPageClient } from "./ReviewPageClient";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export default async function ReviewPage({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<ConfigurationsProvider organizationId={organization.id}>
			<ReviewPageClient />
		</ConfigurationsProvider>
	);
}
