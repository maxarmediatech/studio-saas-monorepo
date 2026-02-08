import { getActiveOrganization } from "@saas/auth/lib/server";
import { GoogleCalendarIntegrationCard } from "@saas/settings/components/google-calendar-integration-card";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { PageContent } from "@saas/studio";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);
	return {
		title: `Integrations | ${organization?.name ?? "Studio"}`,
	};
}

export default async function IntegrationsSettingsPage({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<PageContent title="Integrations">
			<SettingsList>
				<GoogleCalendarIntegrationCard />
			</SettingsList>
		</PageContent>
	);
}
