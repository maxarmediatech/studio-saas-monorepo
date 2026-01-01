import { getActiveOrganization } from "@saas/auth/lib/server";
import { BookingShootsStep } from "@saas/studio/components/bookings";
import { ConfigurationsProvider } from "@saas/studio/components/bookings/index.server";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export default async function ShootsPage({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<ConfigurationsProvider organizationId={organization.id}>
			<BookingShootsStep />
		</ConfigurationsProvider>
	);
}
