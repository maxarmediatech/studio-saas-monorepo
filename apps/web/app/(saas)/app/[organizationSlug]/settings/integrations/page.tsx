import { getActiveOrganization } from "@saas/auth/lib/server";
import { GoogleCalendarIntegrationCard } from "@saas/settings/components/google-calendar-integration-card";
import { WhatsAppAccountsCard } from "@saas/settings/components/whatsapp-accounts-card";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { SettingsList } from "@saas/shared/components/SettingsList";
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
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"integrations",
	);

	if (!context) {
		return notFound();
	}

	return (
		<SettingsList>
			<GoogleCalendarIntegrationCard />
			<WhatsAppAccountsCard />
		</SettingsList>
	);
}
