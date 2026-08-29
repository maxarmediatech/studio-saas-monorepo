import { GoogleCalendarIntegrationCard } from "@saas/settings/components/google-calendar-integration-card";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageFallback } from "../_components/settings-page-fallback";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Integrations");
}

export default function IntegrationsSettingsPage({ params }: Props) {
	return (
		<Suspense fallback={<SettingsPageFallback />}>
			<IntegrationsSettingsContent params={params} />
		</Suspense>
	);
}

async function IntegrationsSettingsContent({ params }: Props) {
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
		</SettingsList>
	);
}
